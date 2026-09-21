// Génère public/og-image.png (1200×630) dans la DA Billel.
// Lancé via `npm run og`.
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Resvg } from "@resvg/resvg-js";
import wawoff2 from "wawoff2";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// resvg-js ne lit pas les woff2 variables — on décompresse vers TTF
// dans un dossier temporaire avant de les passer en fontFiles.
async function woff2ToTtf(woff2Path, outDir, outName) {
  const woff2 = readFileSync(woff2Path);
  const ttf = await wawoff2.decompress(woff2);
  const outPath = join(outDir, outName);
  writeFileSync(outPath, Buffer.from(ttf));
  return outPath;
}

const tmp = mkdtempSync(join(tmpdir(), "billel-og-"));
const zodiakTtf = await woff2ToTtf(
  join(root, "public/fonts/Zodiak_Complete/Zodiak-Variable.woff2"),
  tmp,
  "Zodiak.ttf",
);
const switzerTtf = await woff2ToTtf(
  join(root, "public/fonts/Switzer_Complete/Switzer-Variable.woff2"),
  tmp,
  "Switzer.ttf",
);

// Palette Billel (b-token — repo billel-skill)
const PAPER = "#f1edeb"; // --b-surface-muted
const INK = "#120f0d"; // --b-ink
const SLATE = "#3b3735"; // --b-text-muted
const STONE = "#93857d"; // --b-gray-600
const ORANGE = "#f06800"; // --b-accent

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${PAPER}"/>

  <!-- Accent : disque orange + glyph converter ink, en haut à droite -->
  <circle cx="1020" cy="170" r="110" fill="${ORANGE}"/>
  <g transform="translate(1020 170)" fill="none" stroke="${INK}"
     stroke-width="9" stroke-linecap="round" stroke-linejoin="round">
    <path d="M-40 -16 H22 l-14 -14"/>
    <path d="M40 16 H-22 l14 14"/>
  </g>

  <!-- Eyebrow -->
  <text x="80" y="170" font-family="Switzer Variable" font-size="22"
        font-weight="600" fill="${SLATE}"
        letter-spacing="3">LOCAL FILE CONVERTER</text>

  <!-- Title Zodiak -->
  <text x="80" y="340" font-family="Zodiak Variable" font-size="180"
        font-weight="500" fill="${INK}">Converter</text>

  <!-- Lede -->
  <text x="84" y="420" font-family="Switzer Variable" font-size="36"
        font-weight="400" fill="${SLATE}">Convert any file, locally.</text>
  <text x="84" y="468" font-family="Switzer Variable" font-size="24"
        font-weight="400" fill="${STONE}">Documents · Images · Data · Audio · Video — nothing leaves your browser.</text>

  <!-- Footer brand -->
  <line x1="80" y1="540" x2="1120" y2="540" stroke="${STONE}" stroke-width="1"/>
  <text x="80" y="580" font-family="Zodiak Variable" font-size="28"
        font-weight="500" fill="${INK}">Billel</text>
</svg>`;

const png = new Resvg(svg, {
  font: {
    fontFiles: [zodiakTtf, switzerTtf],
    loadSystemFonts: false,
    defaultFontFamily: "Switzer Variable",
  },
  fitTo: { mode: "width", value: 1200 },
  logLevel: "warn",
})
  .render()
  .asPng();

writeFileSync(join(root, "public/og-image.png"), png);
console.log("public/og-image.png written (1200x630)");
