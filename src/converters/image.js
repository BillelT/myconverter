import { baseName, loadImageElement, imageDataToBmp } from "./util.js";

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

async function drawToCanvas(file) {
  if (/\.(heic|heif)$/i.test(file.name)) {
    file = await decodeHeic(file);
  }
  const img = await loadImageElement(file);
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
  const { canvas, ctx, img } = await drawToCanvas(file);
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

async function imageToPdf(file) {
  const { jsPDF } = await import("jspdf");
  const { canvas, ctx, img, w, h } = await drawToCanvas(file);
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

export const defs = [];

for (const from of RASTER_SOURCES) {
  for (const to of RASTER_TARGETS) {
    if (from === to) continue;
    defs.push({
      from,
      to,
      label: to.toUpperCase(),
      category: "image",
      run: (file, opts) => rasterConvert(file, to, opts),
    });
  }
  defs.push({
    from,
    to: "pdf",
    label: "PDF",
    category: "image",
    run: (file) => imageToPdf(file),
  });
}
