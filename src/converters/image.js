import {
  baseName,
  loadImageElement,
  imageDataToBmp,
  compressLevel,
  finishCompress,
} from "./util.js";
import { openGif } from "./gif-frames.js";

const RASTER_SOURCES = [
  "png",
  "jpg",
  "webp",
  "bmp",
  "gif",
  "svg",
  "avif",
  "ico",
  "heic",
];
const RASTER_TARGETS = ["png", "jpg", "webp", "bmp"];

const MIME = {
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
};

// HEIC/HEIF n'est pas décodé nativement par <img> (sauf Safari). On
// transcode vers du JPEG via heic-to (libheif wasm récent, inliné) avant
// de passer la main au pipeline canvas.
async function decodeHeic(file) {
  const { heicTo } = await import("heic-to");
  const blob = await heicTo({ blob: file, type: "image/jpeg", quality: 0.95 });
  return new File([blob], `${baseName(file.name)}.jpg`, { type: "image/jpeg" });
}

// GIF : frame choisie dans l'UI (opts.gifFrame), sinon la 1re. Le
// canvas de gif-frames est partagé : on en prend une copie.
async function gifFrameSource(file, opts) {
  let gif;
  try {
    gif = await openGif(file);
  } catch (_) {
    // GIF que gifuct ne sait pas lire : on retombe sur le décodeur
    // du navigateur (1re image).
    return loadImageElement(file);
  }
  const frame = gif.frameAt((opts && opts.gifFrame) || 0);
  const copy = document.createElement("canvas");
  copy.width = gif.width;
  copy.height = gif.height;
  copy.getContext("2d").drawImage(frame, 0, 0);
  return copy;
}

async function drawToCanvas(file, opts) {
  if (/\.(heic|heif)$/i.test(file.name)) {
    file = await decodeHeic(file);
  }
  const img = /\.gif$/i.test(file.name)
    ? await gifFrameSource(file, opts)
    : await loadImageElement(file);
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  if (!w || !h) throw new Error("Dimensions d'image invalides");
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  return { canvas, ctx, img, w, h };
}

function canvasToBlob(canvas, mime, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Encodage impossible"))),
      mime,
      quality,
    );
  });
}

async function rasterConvert(file, to, opts) {
  const { canvas, ctx, img } = await drawToCanvas(file, opts);
  if (to === "jpg" || to === "bmp") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(img, 0, 0);

  let blob;
  if (to === "bmp") {
    blob = imageDataToBmp(ctx.getImageData(0, 0, canvas.width, canvas.height));
  } else {
    const q = opts && typeof opts.quality === "number" ? opts.quality : 0.92;
    blob = await canvasToBlob(canvas, MIME[to], to === "png" ? undefined : q);
  }
  return { blob, filename: `${baseName(file.name)}.${to}` };
}

async function imageToPdf(file, opts) {
  const { jsPDF } = await import("jspdf");
  const { canvas, ctx, img, w, h } = await drawToCanvas(file, opts);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.92);

  const orientation = w >= h ? "landscape" : "portrait";
  const pdf = new jsPDF({ orientation, unit: "pt", format: "a4" });
  const pw = pdf.internal.pageSize.getWidth();
  const ph = pdf.internal.pageSize.getHeight();
  const ratio = Math.min(pw / w, ph / h);
  const dw = w * ratio;
  const dh = h * ratio;
  pdf.addImage(dataUrl, "JPEG", (pw - dw) / 2, (ph - dh) / 2, dw, dh);
  const blob = pdf.output("blob");
  return { blob, filename: `${baseName(file.name)}.pdf` };
}

// Compression même format. JPG/WEBP : ré-encodage à qualité réduite.
// PNG : UPNG — sans perte (légère) ou palette réduite (équilibrée,
// forte), ce que canvas.toBlob ne sait pas faire.
const COMPRESS_QUALITY = [0.82, 0.7, 0.5];
const PNG_COLORS = [0, 256, 64];

async function compressImage(file, ext, opts) {
  const l = compressLevel(opts);
  if (ext !== "png") {
    const out = await rasterConvert(file, ext, {
      ...opts,
      quality: COMPRESS_QUALITY[l],
    });
    return finishCompress(file, ext, out);
  }
  const { canvas, ctx, img } = await drawToCanvas(file, opts);
  ctx.drawImage(img, 0, 0);
  const { width, height } = canvas;
  const pixels = ctx.getImageData(0, 0, width, height).data;
  const UPNG = (await import("upng-js")).default;
  const png = UPNG.encode([pixels.buffer], width, height, PNG_COLORS[l]);
  return finishCompress(file, ext, {
    blob: new Blob([png], { type: "image/png" }),
  });
}

export const defs = [];

for (const from of RASTER_SOURCES) {
  for (const to of RASTER_TARGETS) {
    if (from === to) continue;
    // gif → webp animé fourni par media.js ; ici la version fixe,
    // sous une clé distincte pour coexister dans le sélecteur.
    if (from === "gif" && to === "webp") {
      defs.push({
        from,
        to: "webp-still",
        ext: "webp",
        label: "WEBP (image fixe)",
        category: "image",
        run: (file, opts) => rasterConvert(file, "webp", opts),
      });
      continue;
    }
    defs.push({
      from,
      to,
      // Le canvas ne garde que la 1re image d'un GIF animé.
      label: from === "gif" ? `${to.toUpperCase()} (image fixe)` : to.toUpperCase(),
      category: "image",
      run: (file, opts) => rasterConvert(file, to, opts),
    });
  }
  defs.push({
    from,
    to: "pdf",
    label: "PDF",
    category: "image",
    run: (file, opts) => imageToPdf(file, opts),
  });
}

for (const ext of ["jpg", "png", "webp"]) {
  defs.push({
    from: ext,
    to: "compress",
    ext,
    label: `Compresser (${ext.toUpperCase()})`,
    category: "image",
    run: (file, opts) => compressImage(file, ext, opts),
  });
}
