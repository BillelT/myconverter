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
const titleSize = 92;
const gapEyebrowToTitle = 24;
const gapTitleToPills = 24;
const pillsH = 40;

const categories = [
  { label: "Image", width: 92 },
  { label: "Document", width: 126 },
  { label: "Data", width: 80 },
  { label: "Audio", width: 92 },
  { label: "Video", width: 92 },
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
const pillsTextY = pillsTop + 26;

let pillX = MARGIN;
const pillsSvg = categories
  .map((c) => {
    const rect = `<rect x="${pillX}" y="${pillsTop}" width="${c.width}" height="${pillsH}" rx="20" fill="${ACCENT_20}"/>`;
    const text = `<text x="${pillX + c.width / 2}" y="${pillsTextY}" text-anchor="middle" font-family="${SANS}" font-size="15" font-weight="600" fill="${INK}">${c.label}</text>`;
    pillX += c.width + pillGap;
    return rect + "\n  " + text;
  })
  .join("\n  ");

/* ---------- Bloc graphique (droite) — un fichier qui se convertit ------- */
/* Même hauteur que le bloc de texte, centré sur le même axe vertical.
   Pas un composant du site (pas de file-row) : une illustration du concept
   de conversion — un fichier source, une transformation, un fichier cible. */

const graphicH = textBlockH;
const graphicTop = textTop;
const graphicCenterY = graphicTop + graphicH / 2;
const graphicLeft = MARGIN + 560 + 60; // après la colonne de texte + gouttière
const graphicRight = CANVAS_W - MARGIN;
const graphicW = graphicRight - graphicLeft;

const fileW = 140;
const fileH = graphicH; // même hauteur que le bloc de texte, exactement
const fold = 30;
const fileTop = graphicCenterY - fileH / 2;

function fileIcon(x, ext, { badge } = {}) {
  const y = fileTop;
  return `
  <path d="M${x} ${y} L${x + fileW - fold} ${y} L${x + fileW} ${y + fold} L${x + fileW} ${y + fileH} L${x} ${y + fileH} Z" fill="${PAPER}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>
  <path d="M${x + fileW - fold} ${y} L${x + fileW - fold} ${y + fold} L${x + fileW} ${y + fold}" fill="none" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>
  <text x="${x + fileW / 2}" y="${y + fileH * 0.64}" text-anchor="middle" font-family="${SANS}" font-size="17" font-weight="700" letter-spacing="0.5" fill="${INK}">${ext}</text>
  ${badge ? `<circle cx="${x + fileW - 6}" cy="${y + 6}" r="15" fill="${ACCENT}"/><path d="M${x + fileW - 13} ${y + 6} l5 5 l9 -10" fill="none" stroke="${PAPER}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>` : ""}`;
}

const fileAx = graphicLeft;
const fileBx = graphicRight - fileW;
const arrowCx = (fileAx + fileW + fileBx) / 2;
const arrowCy = graphicCenterY;
const arrowScale = 2.1;

const graphicSvg = `
${fileIcon(fileAx, "HEIC")}
${fileIcon(fileBx, "JPG", { badge: true })}
  <g transform="translate(${arrowCx} ${arrowCy}) scale(${arrowScale})" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M-16 -8 L10 -8 L2 -16"/>
    <path d="M16 8 L-10 8 L-2 16"/>
  </g>`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_W}" height="${CANVAS_H}" viewBox="0 0 ${CANVAS_W} ${CANVAS_H}">
  <rect width="${CANVAS_W}" height="${CANVAS_H}" fill="${PAPER}"/>

  <!-- Eyebrow -->
  <text x="${MARGIN}" y="${eyebrow1Y}" font-family="${SANS}" font-size="${eyebrowSize}" fill="${SLATE}">${eyebrowLine1}</text>
  <text x="${MARGIN}" y="${eyebrow2Y}" font-family="${SANS}" font-size="${eyebrowSize}" fill="${SLATE}">${eyebrowLine2}</text>

  <!-- Title -->
  <text x="${MARGIN}" y="${titleY}" font-family="${SANS}" font-size="${titleSize}" font-weight="700" letter-spacing="-2" fill="${INK}">Converter</text>

  <!-- Supported categories -->
  ${pillsSvg}

  <!-- Graphic — a file converted into another format -->
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
