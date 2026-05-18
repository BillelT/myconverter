// Génère public/og-image.png (1200×630) — nom du projet + baseline
// + logo CIB en coin. Lancé via `npm run og`.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Resvg } from "@resvg/resvg-js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const logoRaw = readFileSync(join(root, "public/assets/logo-cib.svg"), "utf8");
// Le logo utilise fill="var(--fill-0, black)" — resvg ne résout pas les
// variables CSS, on force le noir du brand.
const logoInner = logoRaw
  .replace(/var\(--fill-0,\s*black\)/g, "#0a0a0a")
  .replace(/^<svg[^>]*>/, "")
  .replace(/<\/svg>\s*$/, "");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#f9ed32"/>
  <text x="90" y="300" font-family="-apple-system, system-ui, Inter, sans-serif"
        font-size="116" font-weight="700" fill="#0a0a0a"
        letter-spacing="-2">Converter</text>
  <text x="92" y="372" font-family="-apple-system, system-ui, Inter, sans-serif"
        font-size="40" font-weight="500" fill="#0a0a0a">Convert any file, locally.</text>
  <text x="92" y="430" font-family="-apple-system, system-ui, Inter, sans-serif"
        font-size="28" font-weight="400" fill="#52525b">Documents · Images · Data · Audio · Video — nothing leaves your browser.</text>
  <g transform="translate(1010, 470) scale(2.6)">
    <svg viewBox="0 0 40 46" width="40" height="46">${logoInner}</svg>
  </g>
</svg>`;

const png = new Resvg(svg, {
  fitTo: { mode: "width", value: 1200 },
}).render().asPng();

writeFileSync(join(root, "public/og-image.png"), png);
console.log("public/og-image.png written (1200x630)");
