import { baseName } from "./util.js";

const AUDIO = ["mp3", "wav", "ogg", "m4a", "aac", "flac"];
const VIDEO = ["mp4", "webm", "mov", "mkv", "avi"];

// Le coeur ffmpeg.wasm doit correspondre à l'ABI du wrapper
// @ffmpeg/ffmpeg (ligne 0.12.x) — un mismatch provoque
// "RuntimeError: memory access out of bounds".
// Le coeur est servi depuis public/ffmpeg-core/ pour rester 100% local
// (aucun appel à un CDN, l'IP de l'utilisateur ne fuit nulle part).
const stBase = "/ffmpeg-core";

let ffmpeg = null;
let loadPromise = null;

// Petit anneau des derniers logs ffmpeg, pour enrichir les
// messages d'erreur (ex. "Output file is empty…").
const logRing = [];
function pushLog(message) {
  logRing.push(message);
  if (logRing.length > 60) logRing.shift();
}
function lastFfmpegError() {
  for (let i = logRing.length - 1; i >= 0; i--) {
    const m = logRing[i];
    if (
      /no such file|empty|invalid|error|unable|not found|unknown encoder|conversion failed/i.test(
        m,
      )
    ) {
      return m.trim();
    }
  }
  return "";
}

export function isMediaExt(ext) {
  return AUDIO.includes(ext) || VIDEO.includes(ext);
}

// "mt" | "st" | null — quel coeur est chargé (affiché dans l'UI
// pour diagnostiquer une conversion lente).
let engine = null;
export function mediaEngine() {
  return engine;
}

// Annulation : on stoppe le coeur et on le jette. L'exec en cours
// rejette, runMedia/runGif lèvent une erreur "annulée".
let canceled = false;
export function cancelMedia() {
  canceled = true;
  const f = ffmpeg;
  ffmpeg = null;
  loadPromise = null;
  engine = null;
  if (f) {
    try {
      f.terminate();
    } catch (_) {
      /* noop */
    }
  }
}

async function getFFmpeg(onProgress) {
  if (ffmpeg && ffmpeg.loaded) return ffmpeg;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const { FFmpeg } = await import("@ffmpeg/ffmpeg");
    const { toBlobURL } = await import("@ffmpeg/util");

    // On utilise UNIQUEMENT le coeur mono-thread. Le coeur
    // multi-thread est plus rapide en théorie, mais chargé via
    // blob URL son worker pthread ne retrouve pas son .wasm et
    // le chargement se hange indéfiniment (spinner figé, aucun
    // %). Le mono-thread est lent mais fiable et termine.
    async function attempt() {
      const f = new FFmpeg();
      if (onProgress) {
        f.on("progress", ({ progress }) =>
          onProgress(Math.max(0, Math.min(1, progress))),
        );
      }
      f.on("log", ({ message }) => pushLog(message));
      const cfg = {
        coreURL: await toBlobURL(
          `${stBase}/ffmpeg-core.js`,
          "text/javascript",
        ),
        wasmURL: await toBlobURL(
          `${stBase}/ffmpeg-core.wasm`,
          "application/wasm",
        ),
      };
      // Garde-fou : un load qui ne résout jamais (réseau, blob
      // cassé…) devient une vraie erreur au lieu d'un spinner
      // infini.
      let timer;
      const timeout = new Promise((_, rej) => {
        timer = setTimeout(
          () =>
            rej(
              new Error(
                "Le moteur ffmpeg n'a pas pu se charger (réseau trop lent ?)",
              ),
            ),
          120000,
        );
      });
      try {
        await Promise.race([f.load(cfg), timeout]);
      } finally {
        clearTimeout(timer);
      }
      engine = "st";
      return f;
    }

    try {
      ffmpeg = await attempt();
    } catch (_) {
      // Une seule nouvelle tentative (instance fraîche) avant
      // d'abandonner.
      ffmpeg = await attempt();
    }
    return ffmpeg;
  })();
  return loadPromise;
}

const MIME = {
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  m4a: "audio/mp4",
  aac: "audio/aac",
  flac: "audio/flac",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  mkv: "video/x-matroska",
  avi: "video/x-msvideo",
  gif: "image/gif",
};

// Nombre de threads exploitables (le coeur MT en profite, le
// mono-thread l'ignore sans dommage).
function threadCount() {
  const n =
    (typeof navigator !== "undefined" && navigator.hardwareConcurrency) || 4;
  return Math.max(2, Math.min(8, n));
}

// Débit vidéo cible selon la hauteur de sortie — borne le coût
// d'encodage et la taille du fichier.
function bitrateFor(h) {
  if (!h || h > 1080) return "5M";
  if (h > 720) return "4M";
  if (h > 480) return "2M";
  if (h > 360) return "1M";
  return "700k";
}

// Filtre de mise à l'échelle : on ne réduit JAMAIS au-dessus de
// la source (min(cap, ih)), largeur paire (-2). "source" => pas
// de filtre du tout.
function scaleArgs(maxHeight) {
  if (!maxHeight || maxHeight === "source") return [];
  // Quotes protègent la virgule de l'expression dans le
  // filtergraph ; -2 garde le ratio avec une largeur paire.
  return ["-vf", `scale=-2:'min(${maxHeight},ih)'`];
}

// Options d'entrée tolérantes : les enregistrements d'écran Windows
// (Xbox Game Bar…) sont parfois mal finalisés (mdat volumineux avant
// le moov, paquets partiellement corrompus). On élargit le probing et
// on ignore les erreurs de paquets non fatales plutôt que d'abandonner
// dès le premier octet suspect.
function inputArgs(inName) {
  return [
    "-fflags",
    "+genpts+igndts+discardcorrupt",
    "-err_detect",
    "ignore_err",
    "-analyzeduration",
    "100M",
    "-probesize",
    "100M",
    "-i",
    inName,
  ];
}

function argsFor(from, to, inName, outName, opts) {
  const cap =
    opts && opts.videoMaxHeight && opts.videoMaxHeight !== "source"
      ? Number(opts.videoMaxHeight)
      : null;
  const T = String(threadCount());

  if (VIDEO.includes(from) && to === "mp3") {
    return [...inputArgs(inName), "-vn", "-q:a", "2", outName];
  }
  // VP9 par défaut sur .webm = beaucoup trop lourd en wasm.
  // VP8 (libvpx) en "realtime", vitesse max, multithread libvpx.
  if (to === "webm") {
    return [
      ...inputArgs(inName),
      ...scaleArgs(opts && opts.videoMaxHeight),
      "-c:v",
      "libvpx",
      "-b:v",
      bitrateFor(cap),
      "-deadline",
      "realtime",
      "-cpu-used",
      "8",
      "-row-mt",
      "1",
      "-threads",
      T,
      "-c:a",
      "libvorbis",
      outName,
    ];
  }
  // x264 : preset le plus rapide + faststart, multithread.
  if (to === "mp4") {
    return [
      ...inputArgs(inName),
      ...scaleArgs(opts && opts.videoMaxHeight),
      "-c:v",
      "libx264",
      "-preset",
      "ultrafast",
      "-threads",
      T,
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-movflags",
      "+faststart",
      outName,
    ];
  }
  // Autres conteneurs vidéo : ré-encodage générique borné.
  return [
    ...inputArgs(inName),
    ...scaleArgs(opts && opts.videoMaxHeight),
    "-threads",
    T,
    outName,
  ];
}

// Un crash du coeur (memory access out of bounds, abort…) laisse
// l'instance inutilisable : on la jette pour qu'un nouvel essai
// recharge un coeur frais.
function handleCrash(err, f) {
  if (/memory access|out of bounds|abort|RuntimeError/i.test(String(err))) {
    try {
      f && f.terminate && f.terminate();
    } catch (_) {
      /* noop */
    }
    ffmpeg = null;
    loadPromise = null;
  }
}

// Traduit les erreurs FFmpeg les plus courantes en indice actionnable
// pour l'utilisateur (le fichier lui-même est en cause, pas l'app).
function friendlyHint(detail) {
  if (/invalid data found when processing input/i.test(detail)) {
    return "le fichier semble corrompu ou incomplet (enregistrement interrompu ou pas encore finalisé par Windows) — vérifiez qu'il se lit dans un lecteur vidéo, sinon réexportez-le";
  }
  if (/moov atom not found/i.test(detail)) {
    return "l'index vidéo (moov atom) est manquant, l'enregistrement n'a probablement pas été fermé correctement";
  }
  return "";
}

function noOutputError() {
  const detail = lastFfmpegError();
  const base = detail
    ? `FFmpeg n'a pas pu produire ce format — ${detail}`
    : "FFmpeg n'a pas pu produire ce format";
  const hint = detail ? friendlyHint(detail) : "";
  return new Error(hint ? `${base} (${hint})` : base);
}

async function readOutput(f, outName) {
  let data;
  try {
    data = await f.readFile(outName);
  } catch (_) {
    throw noOutputError();
  }
  if (!data || !data.length) {
    throw noOutputError();
  }
  return data;
}

async function runMedia(file, from, to, opts, onProgress) {
  const { fetchFile } = await import("@ffmpeg/util");
  canceled = false;
  let f;
  try {
    f = await getFFmpeg(onProgress);
    const inName = `in.${from}`;
    const outName = `out.${to}`;
    await f.writeFile(inName, await fetchFile(file));
    // Selon la version du wrapper, exec() renvoie le code de
    // sortie ou undefined : on ne s'y fie pas, on vérifie que le
    // fichier de sortie a bien été produit.
    await f.exec(argsFor(from, to, inName, outName, opts));
    if (canceled) throw new Error("Conversion annulée");
    const data = await readOutput(f, outName);
    await f.deleteFile(inName).catch(() => {});
    await f.deleteFile(outName).catch(() => {});
    return {
      blob: new Blob([data.buffer], {
        type: MIME[to] || "application/octet-stream",
      }),
      filename: `${baseName(file.name)}.${to}`,
    };
  } catch (err) {
    if (canceled) throw new Error("Conversion annulée");
    handleCrash(err, f);
    throw err;
  }
}

// GIF en deux passes (palettegen → paletteuse) : la méthode mono-
// passe produit souvent un fichier vide dans ffmpeg.wasm. scale en
// -2 (hauteur paire imposée) pour éviter les échecs d'encodeur.
async function runGif(file, from, opts, onProgress) {
  const { fetchFile } = await import("@ffmpeg/util");
  canceled = false;
  let f;
  try {
    f = await getFFmpeg(onProgress);
    const inName = `in.${from}`;
    const vf = "fps=12,scale=480:-2:flags=lanczos";
    await f.writeFile(inName, await fetchFile(file));
    await f.exec([
      ...inputArgs(inName),
      "-t",
      "15",
      "-vf",
      `${vf},palettegen`,
      "-y",
      "pal.png",
    ]);
    await f.exec([
      ...inputArgs(inName),
      "-i",
      "pal.png",
      "-t",
      "15",
      "-filter_complex",
      `${vf}[x];[x][1:v]paletteuse`,
      "-y",
      "out.gif",
    ]);
    if (canceled) throw new Error("Conversion annulée");
    const data = await readOutput(f, "out.gif");
    await f.deleteFile(inName).catch(() => {});
    await f.deleteFile("pal.png").catch(() => {});
    await f.deleteFile("out.gif").catch(() => {});
    return {
      blob: new Blob([data.buffer], { type: "image/gif" }),
      filename: `${baseName(file.name)}.gif`,
    };
  } catch (err) {
    if (canceled) throw new Error("Conversion annulée");
    handleCrash(err, f);
    throw err;
  }
}

export const defs = [];

for (const from of AUDIO) {
  for (const to of AUDIO) {
    if (from === to) continue;
    defs.push({
      from,
      to,
      label: to.toUpperCase(),
      category: "audio",
      heavy: true,
      run: (file, opts, onProgress) =>
        runMedia(file, from, to, opts, onProgress),
    });
  }
}

for (const from of VIDEO) {
  for (const to of VIDEO) {
    if (from === to) continue;
    defs.push({
      from,
      to,
      label: to.toUpperCase(),
      category: "video",
      heavy: true,
      run: (file, opts, onProgress) =>
        runMedia(file, from, to, opts, onProgress),
    });
  }
  defs.push({
    from,
    to: "mp3",
    label: "MP3 (audio)",
    category: "video",
    heavy: true,
    run: (file, opts, onProgress) =>
      runMedia(file, from, "mp3", opts, onProgress),
  });
  defs.push({
    from,
    to: "gif",
    label: "GIF (15s)",
    category: "video",
    heavy: true,
    run: (file, opts, onProgress) => runGif(file, from, opts, onProgress),
  });
}
