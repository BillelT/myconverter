// Génère public/og-image.png (1200×630) dans la DA Billel.
// Lancé via `npm run og`.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Resvg } from "@resvg/resvg-js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// Palette Billel (b-token — repo billel-skill)
const PAPER = "#fff9f5"; // --b-surface
const SURFACE_MUTED = "#f1edeb"; // --b-surface-muted
const BORDER = "#dcd5d0"; // --b-gray-300
const INK = "#120f0d"; // --b-ink
const SLATE = "#3b3735"; // --b-text-muted
const STONE = "#93857d"; // --b-gray-600
const ACCENT = "#f06800"; // --b-accent
const ACCENT_20 = "#f0680033"; // --b-accent-20

// Cabinet Grotesk n'est pas dispo dans cet environnement (voir
// public/fonts/CabinetGrotesk/README.md) — --b-font-sans retombe sur la
// pile système, donc l'OG fait pareil.
const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const MONO = "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace";

// Pills — une par catégorie réellement supportée (src/converters/registry.js
// → CATEGORY_LABELS), pas une liste au pif d'extensions.
const categories = [
  { label: "Image", width: 92 },
  { label: "Document", width: 126 },
  { label: "Data", width: 80 },
  { label: "Audio", width: 92 },
  { label: "Video", width: 92 },
];
const pillGap = 12;
const pillsTop = 380;
const pillsH = 40;
let pillX = 80;
const pillsSvg = categories
  .map((c) => {
    const rect = `<rect x="${pillX}" y="${pillsTop}" width="${c.width}" height="${pillsH}" rx="20" fill="${ACCENT_20}"/>`;
    const text = `<text x="${pillX + c.width / 2}" y="${pillsTop + 26}" text-anchor="middle" font-family="${SANS}" font-size="15" font-weight="600" fill="${INK}">${c.label}</text>`;
    pillX += c.width + pillGap;
    return rect + "\n  " + text;
  })
  .join("\n  ");

// Graphic — deux lignes façon .file-row réelle (thumb + nom + conversion +
// statut), pas les champs texte de hexadecimal-converter : cet outil n'a
// pas d'input, c'est un drop de fichiers qui se convertissent.
const files = [
  { ext: "HEIC", name: "vacation.heic", to: "HEIC → JPG" },
  { ext: "MOV", name: "clip.mov", to: "MOV → MP4" },
];
const rowW = 420;
const rowH = 88;
const rowX = 700;
const rowGap = 20;
let rowY = 220;
const rowsSvg = files
  .map((f) => {
    const thumbX = rowX + 16;
    const thumbY = rowY + 16;
    const svg = `
  <rect x="${rowX}" y="${rowY}" width="${rowW}" height="${rowH}" rx="16" fill="${PAPER}" stroke="${BORDER}" stroke-width="1.5"/>
  <rect x="${thumbX}" y="${thumbY}" width="56" height="56" rx="10" fill="${SURFACE_MUTED}"/>
  <text x="${thumbX + 28}" y="${thumbY + 33}" text-anchor="middle" font-family="${SANS}" font-size="11" font-weight="700" letter-spacing="0.5" fill="${SLATE}">${f.ext}</text>
  <text x="${thumbX + 72}" y="${rowY + 36}" font-family="${SANS}" font-size="16" font-weight="500" fill="${INK}">${f.name}</text>
  <text x="${thumbX + 72}" y="${rowY + 60}" font-family="${MONO}" font-size="13" fill="${STONE}">${f.to}</text>
  <text x="${rowX + rowW - 16}" y="${rowY + 48}" text-anchor="end" font-family="${SANS}" font-size="13" font-weight="600" fill="${ACCENT}">&#10003; Done</text>`;
    rowY += rowH + rowGap;
    return svg;
  })
  .join("\n");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${PAPER}"/>

  <!-- Eyebrow -->
  <text x="80" y="185" font-family="${SANS}" font-size="22" fill="${SLATE}">Local file converter, no data stored.</text>
  <text x="80" y="217" font-family="${SANS}" font-size="22" fill="${SLATE}">Nothing leaves your browser.</text>

  <!-- Title -->
  <text x="80" y="325" font-family="${SANS}" font-size="92" font-weight="700" letter-spacing="-2" fill="${INK}">Converter</text>

  <!-- Supported categories -->
  ${pillsSvg}

  <!-- Graphic — files being dropped and converted -->
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
