// Génère public/og-image.png (1200×630) dans la DA Billel.
// Lancé via `npm run og`.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Resvg } from "@resvg/resvg-js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// Palette Billel (b-token — repo billel-skill)
const PAPER = "#fff9f5"; // --b-surface
const BORDER = "#dcd5d0"; // --b-gray-300
const INK = "#120f0d"; // --b-ink
const SLATE = "#3b3735"; // --b-text-muted
const ACCENT = "#f06800"; // --b-accent
const ACCENT_20 = "#f0680033"; // --b-accent-20

// Cabinet Grotesk n'est pas dispo dans cet environnement (voir
// public/fonts/CabinetGrotesk/README.md) — --b-font-sans retombe sur la
// pile système, donc l'OG fait pareil.
const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

const CANVAS_W = 1200;
const CANVAS_H = 630;
const MARGIN = 64; // marge latérale réduite (gauche = droite)

/* ---------- Bloc de texte (gauche) — hauteur calculée, pas devinée ------- */

const eyebrowLine1 = "Local file converter, no data stored.";
const eyebrowLine2 = "Nothing leaves your browser.";
const eyebrowSize = 22;
const eyebrowLineGap = 32;
const titleSize = 92 * 1.05; // +5%
const gapEyebrowToTitle = 24;
const gapTitleToPills = 24;
const pillFontSize = 19; // 15 + 4px
const pillsH = 44;

const categories = [
  { label: "Image", width: 100 },
  { label: "Document", width: 138 },
  { label: "Data", width: 88 },
  { label: "Audio", width: 100 },
  { label: "Video", width: 100 },
];
const pillGap = 12;

// Hauteur totale du bloc de texte, de haut du eyebrow à bas des pills.
const textBlockH =
  eyebrowSize + eyebrowLineGap + gapEyebrowToTitle + titleSize * 0.78 + gapTitleToPills + pillsH;

// Centré verticalement sur les 630px du canvas.
const textTop = (CANVAS_H - textBlockH) / 2;

const eyebrow1Y = textTop + eyebrowSize * 0.8;
const eyebrow2Y = eyebrow1Y + eyebrowLineGap;
const titleY = eyebrow2Y + gapEyebrowToTitle + titleSize * 0.72;
const pillsTop = titleY + titleSize * 0.22 + gapTitleToPills;
const pillsTextY = pillsTop + pillsH / 2 + pillFontSize * 0.35;

let pillX = MARGIN;
const pillsSvg = categories
  .map((c) => {
    const rect = `<rect x="${pillX}" y="${pillsTop}" width="${c.width}" height="${pillsH}" rx="${pillsH / 2}" fill="${ACCENT_20}"/>`;
    const text = `<text x="${pillX + c.width / 2}" y="${pillsTextY}" text-anchor="middle" font-family="${SANS}" font-size="${pillFontSize}" font-weight="600" fill="${INK}">${c.label}</text>`;
    pillX += c.width + pillGap;
    return rect + "\n  " + text;
  })
  .join("\n  ");

/* ---------- Bloc graphique (droite) — un nuage de fichiers ---------------- */
/* Pas une histoire "avant/après" à deux fichiers — un nuage organique de
   plusieurs fichiers, tailles et formats différents, pour montrer qu'on
   convertit TOUT (un par catégorie réelle : image, document, data, audio,
   vidéo — les mêmes que les pills). Monochrome, pas d'orange. La boîte
   englobante (du plus haut au plus bas fichier) garde la hauteur du bloc
   de texte et son centre vertical. */

const graphicH = textBlockH;
const graphicTop = textTop;
const graphicCenterY = graphicTop + graphicH / 2;
const graphicLeft = MARGIN + 560 + 60; // après la colonne de texte + gouttière
const graphicRight = CANVAS_W - MARGIN;
const graphicCenterX = (graphicLeft + graphicRight) / 2;

const DOC_RATIO = 0.72; // largeur/hauteur d'une page — proportion "papier"

// Fichier "carte" : coins arrondis + coin plié en duoton (contour + un
// triangle de pli légèrement teinté, pas un dégradé ni une ombre portée —
// juste une 2e teinte, à la manière des icônes de fichier Apple/IBM).
// w/h sont la taille avant rotation ; le fichier pivote autour de son
// propre centre pour l'effet "posé en vrac".
function fileIcon(cx, cy, w, h, rotateDeg, ext) {
  const x = cx - w / 2;
  const y = cy - h / 2;
  const fold = w * 0.22;
  const corner = w * 0.11;
  const tagH = h * 0.19;
  const tagW = Math.min(w - w * 0.16, ext.length * w * 0.075 + w * 0.26);
  const tagX = x + (w - tagW) / 2;
  const tagY = y + h - h * 0.14 - tagH;
  const fontSize = Math.max(11, w * 0.115);
  const body = `M${x + corner} ${y}
    L${x + w - fold} ${y}
    L${x + w} ${y + fold}
    L${x + w} ${y + h - corner}
    A${corner} ${corner} 0 0 1 ${x + w - corner} ${y + h}
    L${x + corner} ${y + h}
    A${corner} ${corner} 0 0 1 ${x} ${y + h - corner}
    L${x} ${y + corner}
    A${corner} ${corner} 0 0 1 ${x + corner} ${y} Z`;
  const foldTri = `M${x + w - fold} ${y} L${x + w - fold} ${y + fold} L${x + w} ${y + fold} Z`;
  return `
  <g transform="rotate(${rotateDeg} ${cx} ${cy})">
    <path d="${body}" fill="${PAPER}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="${foldTri}" fill="${BORDER}" stroke="${INK}" stroke-width="1.75" stroke-linejoin="round"/>
    <rect x="${tagX}" y="${tagY}" width="${tagW}" height="${tagH}" rx="${tagH / 2}" fill="${PAPER}"/>
    <text x="${cx}" y="${tagY + tagH * 0.68}" text-anchor="middle" font-family="${SANS}" font-size="${fontSize}" font-weight="700" letter-spacing="0.5" fill="${SLATE}">${ext}</text>
  </g>`;
}

// Nuage organique : 10 fichiers (2 par catégorie réelle — même liste que
// les pills), positions/tailles/rotations choisies à la main (pas de
// random) pour que le "vrac" reste équilibré — vraiment petits (38px) à
// plus gros (128px), dispersés sans grille, léger chevauchement pour la
// profondeur.
const cloud = [
  { ext: "HEIC", w: 128, rot: 6, dx: -0.18, dy: -0.12 },
  { ext: "PNG", w: 46, rot: -22, dx: 0.95, dy: -0.88 },
  { ext: "PDF", w: 96, rot: -10, dx: -0.95, dy: -0.62 },
  { ext: "DOCX", w: 54, rot: 18, dx: -0.58, dy: -0.98 },
  { ext: "CSV", w: 68, rot: 14, dx: 0.08, dy: -0.95 },
  { ext: "JSON", w: 38, rot: -16, dx: 0.65, dy: -0.4 },
  { ext: "MP3", w: 74, rot: -13, dx: -0.92, dy: 0.62 },
  { ext: "WAV", w: 42, rot: 20, dx: -0.32, dy: 0.98 },
  { ext: "MP4", w: 110, rot: -6, dx: 0.52, dy: 0.68 },
  { ext: "MOV", w: 50, rot: 15, dx: 0.98, dy: 0.32 },
];

// Marge horizontale symétrique — la même à gauche et à droite de la zone,
// comme la colonne de texte est marginée pareil des deux côtés du canvas.
const CLOUD_PAD = 44;
const zoneHalfW = (graphicRight - graphicLeft) / 2 - CLOUD_PAD;
const zoneHalfH = graphicH / 2 - 12;

const cloudSvg = cloud
  .map((f) =>
    fileIcon(
      graphicCenterX + f.dx * zoneHalfW,
      graphicCenterY + f.dy * zoneHalfH,
      f.w,
      f.w / DOC_RATIO,
      f.rot,
      f.ext,
    ),
  )
  .join("\n");

const graphicSvg = cloudSvg;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_W}" height="${CANVAS_H}" viewBox="0 0 ${CANVAS_W} ${CANVAS_H}">
  <rect width="${CANVAS_W}" height="${CANVAS_H}" fill="${PAPER}"/>

  <!-- Eyebrow -->
  <text x="${MARGIN}" y="${eyebrow1Y}" font-family="${SANS}" font-size="${eyebrowSize}" fill="${SLATE}">${eyebrowLine1}</text>
  <text x="${MARGIN}" y="${eyebrow2Y}" font-family="${SANS}" font-size="${eyebrowSize}" fill="${SLATE}">${eyebrowLine2}</text>

  <!-- Title -->
  <text x="${MARGIN}" y="${titleY}" font-family="${SANS}" font-size="${titleSize}" font-weight="700" letter-spacing="-2" fill="${INK}">Converter</text>

  <!-- Supported categories -->
  ${pillsSvg}

  <!-- Graphic — an organic cloud of files in different formats -->
  ${graphicSvg}
</svg>`;

const png = new Resvg(svg, {
  font: {
    loadSystemFonts: true,
    defaultFontFamily: "Arial",
  },
  fitTo: { mode: "width", value: CANVAS_W },
  logLevel: "warn",
})
  .render()
  .asPng();

writeFileSync(join(root, "public/og-image.png"), png);
console.log("public/og-image.png written (1200x630)");
