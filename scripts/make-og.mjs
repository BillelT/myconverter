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
   Composition au nombre d'or plutôt qu'un A→B parfaitement symétrique :
   - le fichier cible (le "après") fait φ fois la hauteur du fichier source
   - le badge de transformation est posé au point d'or de la largeur
     (38.2 %), pas au centre — ça donne un poids visuel plus fort au
     résultat, sur la droite
   - les deux fichiers partagent la même ligne de base (pas centrés sur
     le même axe) : un cadrage plus délibéré qu'un alignement milieu. */

const PHI = 1.618033988749895;

const graphicH = textBlockH;
const graphicTop = textTop;
const graphicCenterY = graphicTop + graphicH / 2;
const graphicBottom = graphicTop + graphicH;
const graphicLeft = MARGIN + 560 + 60; // après la colonne de texte + gouttière
const graphicRight = CANVAS_W - MARGIN;
const graphicW = graphicRight - graphicLeft;

const DOC_RATIO = 0.72; // largeur/hauteur d'une page — proportion "papier"
const targetH = graphicH;
const targetW = targetH * DOC_RATIO;
const sourceH = targetH / PHI;
const sourceW = sourceH * DOC_RATIO;

// Fichier "carte" : coins arrondis + coin plié en duoton (contour + un
// triangle de pli légèrement teinté, pas un dégradé ni une ombre portée —
// juste une 2e teinte, à la manière des icônes de fichier Apple/IBM).
function fileIcon(x, y, w, h, { fold, corner, ext, fill, tag, tagFill, tagStroke, tagText } = {}) {
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
  const tagW = Math.min(w - 20, ext.length * 9 + 28);
  const tagX = x + (w - tagW) / 2;
  const tagY = y + h - 20 - 30;
  return `
  <path d="${body}" fill="${fill}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>
  <path d="${foldTri}" fill="${BORDER}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
  <rect x="${tagX}" y="${tagY}" width="${tagW}" height="30" rx="15" fill="${tagFill}"${tagStroke ? ` stroke="${tagStroke}" stroke-width="1.5"` : ""}/>
  <text x="${x + w / 2}" y="${tagY + 20}" text-anchor="middle" font-family="${SANS}" font-size="13" font-weight="700" letter-spacing="0.5" fill="${tagText}">${ext}</text>
  ${tag === "done" ? `<circle cx="${x + w - 2}" cy="${y + h - 2}" r="16" fill="${ACCENT}"/><path d="M${x + w - 10} ${y + h - 2} l5 5 l10 -11" fill="none" stroke="${PAPER}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>` : ""}`;
}

// Ligne de base commune : les deux cartes "posent" sur le même bas,
// au lieu d'être centrées chacune sur graphicCenterY.
const baseline = graphicBottom;
const sourceX = graphicLeft;
const sourceY = baseline - sourceH;
const goldenX = graphicLeft + graphicW * 0.382; // point d'or de la largeur
const badgeR = 32;
const targetX = goldenX + badgeR + 42;
const targetY = baseline - targetH;

const graphicSvg = `
${fileIcon(sourceX, sourceY, sourceW, sourceH, {
  fold: 20,
  corner: 10,
  ext: "HEIC",
  fill: PAPER,
  tagFill: PAPER,
  tagStroke: BORDER,
  tagText: SLATE,
})}
${fileIcon(targetX, targetY, targetW, targetH, {
  fold: 26,
  corner: 14,
  ext: "JPG",
  fill: PAPER,
  tag: "done",
  tagFill: ACCENT,
  tagText: PAPER,
})}
  <circle cx="${goldenX}" cy="${graphicCenterY}" r="${badgeR}" fill="${ACCENT}"/>
  <g transform="translate(${goldenX} ${graphicCenterY}) scale(1.3)" fill="none" stroke="${PAPER}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round">
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
