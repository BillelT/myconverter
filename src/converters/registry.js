import { canonicalExt } from "./util.js";
import { defs as imageDefs } from "./image.js";
import { defs as documentDefs } from "./document.js";
import { defs as dataDefs } from "./data.js";
import { defs as mediaDefs } from "./media.js";

// mediaDefs en tête : pour un GIF, les cibles animées passent avant
// les cibles canvas (1re image) et deviennent le choix par défaut.
const ALL = [...mediaDefs, ...imageDefs, ...documentDefs, ...dataDefs];

// from-ext -> [def] (conversions) ; from-ext -> def (compression même
// format, action à part : bouton "Compresser", pas une cible de la liste).
const TABLE = new Map();
const COMPRESS = new Map();
for (const d of ALL) {
  if (d.to === "compress") {
    COMPRESS.set(d.from, d);
    continue;
  }
  if (!TABLE.has(d.from)) TABLE.set(d.from, []);
  TABLE.get(d.from).push(d);
}

const CATEGORY_BY_EXT = {
  png: "image",
  jpg: "image",
  webp: "image",
  bmp: "image",
  gif: "image",
  svg: "image",
  avif: "image",
  ico: "image",
  tiff: "image",
  heic: "image",
  pdf: "document",
  docx: "document",
  md: "document",
  html: "document",
  txt: "document",
  rtf: "document",
  json: "data",
  csv: "data",
  xlsx: "data",
  xls: "data",
  yaml: "data",
  xml: "data",
  mp3: "audio",
  wav: "audio",
  ogg: "audio",
  m4a: "audio",
  aac: "audio",
  flac: "audio",
  mp4: "video",
  webm: "video",
  mov: "video",
  mkv: "video",
  avi: "video",
};

export const CATEGORY_LABELS = {
  image: "Image",
  document: "Document",
  data: "Données",
  audio: "Audio",
  video: "Vidéo",
  unknown: "Inconnu",
};

export function categoryOf(ext) {
  return CATEGORY_BY_EXT[canonicalExt(ext)] || "unknown";
}

export function targetsFor(ext) {
  const list = TABLE.get(canonicalExt(ext)) || [];
  return list.map((d) => ({
    to: d.to,
    label: d.label,
    category: d.category,
    heavy: !!d.heavy,
  }));
}

export function canCompress(ext) {
  return COMPRESS.has(canonicalExt(ext));
}

// La compression ffmpeg (audio, vidéo, GIF) charge le moteur ~30 Mo.
export function compressIsHeavy(ext) {
  return !!COMPRESS.get(canonicalExt(ext))?.heavy;
}

export async function runCompression(file, fromExt, opts, onProgress) {
  const def = COMPRESS.get(canonicalExt(fromExt));
  if (!def) throw new Error(`Compression ${fromExt} non supportée`);
  return def.run(file, opts || {}, onProgress);
}

export function isSupported(ext) {
  return TABLE.has(canonicalExt(ext));
}

export async function runConversion(file, fromExt, toExt, opts, onProgress) {
  const list = TABLE.get(canonicalExt(fromExt)) || [];
  const def = list.find((d) => d.to === toExt);
  if (!def) {
    throw new Error(`Conversion ${fromExt} → ${toExt} non supportée`);
  }
  return def.run(file, opts || {}, onProgress);
}

// Matrice complète pour affichage (panneau d'aide).
export function conversionMatrix() {
  const byFrom = new Map();
  for (const d of ALL) {
    if (d.to === "compress") continue;
    if (!byFrom.has(d.from)) byFrom.set(d.from, new Set());
    byFrom.get(d.from).add(d.ext || d.to);
  }
  return [...byFrom.entries()]
    .map(([from, set]) => ({
      from,
      to: [...set].sort(),
      category: categoryOf(from),
    }))
    .sort((a, b) => a.from.localeCompare(b.from));
}
