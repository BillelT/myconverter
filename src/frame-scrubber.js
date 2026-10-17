// Aperçu plein écran pendant qu'on choisit une frame de GIF : la
// frame en grand au centre, et dessous une pellicule qui glisse pour
// garder la frame courante au milieu (façon scrubber de Photos).
// Purement visuel : le curseur de la ligne reste le seul contrôle
// (aria-valuetext), d'où aria-hidden et pointer-events: none.

const THUMB = 56; // côté d'une vignette (px CSS)
const GAP = 8;
const AROUND = 3; // vignettes visibles de chaque côté
const DPR = Math.min(2, window.devicePixelRatio || 1);

let root = null;
let big = null;
let strip = null;
let counter = null;
let gif = null;
let cells = [];
let drawn = new Set();
let marked = null;

function build() {
  big = document.createElement("canvas");
  big.className = "scrubber__frame";
  strip = document.createElement("div");
  strip.className = "scrubber__strip";
  const viewport = document.createElement("div");
  viewport.className = "scrubber__filmstrip";
  viewport.style.setProperty("--thumb", `${THUMB}px`);
  viewport.style.setProperty("--gap", `${GAP}px`);
  viewport.style.setProperty("--around", String(AROUND));
  viewport.append(strip);
  counter = document.createElement("span");
  counter.className = "scrubber__counter";
  root = document.createElement("div");
  root.className = "scrubber";
  root.setAttribute("aria-hidden", "true");
  root.append(big, viewport, counter);
  document.body.append(root);
}

// (Re)crée la pellicule pour un nouveau GIF : une cellule par frame,
// dessinée seulement quand elle entre dans la fenêtre visible.
function load(g) {
  gif = g;
  drawn = new Set();
  big.width = g.width;
  big.height = g.height;
  root.style.setProperty("--ratio", String(g.width / g.height));
  strip.replaceChildren();
  cells = [];
  marked = null;
  for (let i = 0; i < g.count; i++) {
    const c = document.createElement("canvas");
    c.width = THUMB * DPR;
    c.height = THUMB * DPR;
    c.className = "scrubber__thumb";
    strip.append(c);
    cells.push(c);
  }
}

function drawThumb(i) {
  if (drawn.has(i)) return;
  const src = gif.frameAt(i);
  const c = cells[i];
  const ctx = c.getContext("2d");
  const s = Math.max(c.width / src.width, c.height / src.height);
  const w = src.width * s;
  const h = src.height * s;
  ctx.drawImage(src, (c.width - w) / 2, (c.height - h) / 2, w, h);
  drawn.add(i);
}

function render(frame, animate) {
  // Vignettes d'abord (elles déplacent le curseur de décodage),
  // la grande frame en dernier.
  const from = Math.max(0, frame - AROUND - 2);
  const to = Math.min(gif.count - 1, frame + AROUND + 2);
  for (let i = from; i <= to; i++) drawThumb(i);

  const ctx = big.getContext("2d");
  ctx.clearRect(0, 0, big.width, big.height);
  ctx.drawImage(gif.frameAt(frame), 0, 0);

  if (marked) marked.classList.remove("is-current");
  marked = cells[frame];
  marked.classList.add("is-current");
  strip.style.transition = animate ? "" : "none";
  strip.style.transform = `translateX(${-frame * (THUMB + GAP)}px)`;
  counter.textContent = `${frame + 1} / ${gif.count}`;
}

let current = -1;
let pending = null;

export function showScrubber(g, frame) {
  if (!root) build();
  if (g === gif && root.classList.contains("is-open")) {
    return updateScrubber(frame);
  }
  if (g !== gif) load(g);
  current = frame;
  // À l'ouverture, la pellicule se place sans glisser.
  render(frame, false);
  root.classList.add("is-open");
}

// Pendant le scrub : un rendu par frame d'affichage au plus.
export function updateScrubber(frame) {
  if (!root || !root.classList.contains("is-open") || frame === current) {
    return;
  }
  current = frame;
  if (pending) return;
  pending = requestAnimationFrame(() => {
    pending = null;
    render(current, true);
  });
}

export function hideScrubber() {
  if (root) root.classList.remove("is-open");
}
