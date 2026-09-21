// Génère public/og-image.png (1200×630) dans la DA Billel.
// Lancé via `npm run og`.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Resvg } from "@resvg/resvg-js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// Palette Billel (b-token — repo billel-skill)
const PAPER = "#fff9f5"; // --b-surface
const CARD = "#f1edeb"; // --b-surface-muted
const BORDER = "#dcd5d0"; // --b-gray-300
const INK = "#120f0d"; // --b-ink
const SLATE = "#3b3735"; // --b-text-muted

// Aucune police perso embarquée : Cabinet Grotesk n'est pas dispo dans cet
// environnement (voir public/fonts/CabinetGrotesk/README.md) — --b-font-sans
// retombe sur la pile système, donc l'OG fait pareil plutôt que de dépendre
// de Zodiak/Switzer (abandonnées côté site, tokens.css n'y touche plus).
const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const MONO = "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace";

// Aperçu sobre de l'UI réelle : une ligne par fichier, extension source →
// extension cible. Une paire par catégorie supportée (image / document /
// audio / vidéo), pour montrer la largeur de l'outil sans énumérer un texte.
const rows = [
  { name: "photo.heic", to: "JPG" },
  { name: "report.docx", to: "PDF" },
  { name: "clip.mov", to: "MP4" },
];

const cardX = 700;
const cardY = 163;
const cardW = 430;
const cardH = 304;
const rowGap = 88;
const rowInnerX = cardX + 32;
const rowInnerW = cardW - 64;
const badgeW = 74;

const rowsSvg = rows
  .map((row, i) => {
    const top = cardY + 32 + i * rowGap;
    const nameY = top + 26;
    const badgeX = rowInnerX + rowInnerW - badgeW;
    return `
  <rect x="${rowInnerX}" y="${top}" width="${rowInnerW}" height="52" rx="10" fill="${PAPER}" stroke="${BORDER}" stroke-width="1"/>
  <text x="${rowInnerX + 20}" y="${nameY}" font-family="${MONO}" font-size="18" fill="${INK}">${row.name}</text>
  <text x="${badgeX - 16}" y="${nameY}" font-family="${SANS}" font-size="16" fill="${BORDER}">&#8594;</text>
  <rect x="${badgeX}" y="${top + 11}" width="${badgeW}" height="30" rx="15" fill="none" stroke="#f06800" stroke-width="1.5"/>
  <text x="${badgeX + badgeW / 2}" y="${nameY}" text-anchor="middle" font-family="${SANS}" font-size="14" font-weight="700" fill="#f06800">${row.to}</text>`;
  })
  .join("\n");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${PAPER}"/>

  <!-- Title -->
  <text x="80" y="285" font-family="${SANS}" font-size="96" font-weight="700" letter-spacing="-2" fill="${INK}">Converter</text>

  <!-- Subtitle -->
  <text x="80" y="396" font-family="${SANS}" font-size="25" fill="${SLATE}">Convert any file, locally.</text>
  <text x="80" y="428" font-family="${SANS}" font-size="25" fill="${SLATE}">Nothing leaves your browser.</text>

  <!-- Graphic representation — sober preview of the real file-list UI:
       filename, arrow, target-format badge. Mirrors the app's own layout. -->
  <rect x="${cardX}" y="${cardY}" width="${cardW}" height="${cardH}" rx="28" fill="${CARD}" stroke="${BORDER}" stroke-width="1.5"/>
${rowsSvg}
</svg>`;

const png = new Resvg(svg, {
  font: {
    loadSystemFonts: true,
    defaultFontFamily: "Arial",
  },
  fitTo: { mode: "width", value: 1200 },
  logLevel: "warn",
})
  .render()
  .asPng();

writeFileSync(join(root, "public/og-image.png"), png);
console.log("public/og-image.png written (1200x630)");
