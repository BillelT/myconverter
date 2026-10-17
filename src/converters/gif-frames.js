// Décodage image par image d'un GIF (gifuct-js), pour exporter une
// frame précise en image fixe. Le canvas natif ne donne que la 1re.

const cache = new WeakMap();

// Ouvre un GIF une seule fois par File (prévisualisation et
// conversion partagent le même décodage).
export function openGif(file) {
  if (!cache.has(file)) cache.set(file, open(file));
  return cache.get(file);
}

async function open(file) {
  const { parseGIF, decompressFrame } = await import("gifuct-js");
  const gif = parseGIF(await file.arrayBuffer());
  // Parsing seul ici ; la décompression LZW se fait frame par frame,
  // à la demande (tout décompresser d'un coup peut peser des
  // centaines de Mo sur un long GIF).
  const raw = gif.frames.filter((f) => f.image);
  if (!raw.length) throw new Error("GIF sans image");
  const width = gif.lsd.width;
  const height = gif.lsd.height;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  const patch = document.createElement("canvas");
  const pctx = patch.getContext("2d");

  // Les frames sont des patchs à composer dans l'ordre, selon la
  // méthode de disposal de la frame précédente. On garde un curseur
  // pour avancer sans tout recomposer, et un point de reprise toutes
  // les CHECKPOINT frames pour qu'un retour en arrière (scrub du
  // curseur) ne reparte pas de zéro.
  const CHECKPOINT = 16;
  const checkpoints = new Map();
  let idx = -1;
  let prev = null;
  let saved = null;

  function reset() {
    ctx.clearRect(0, 0, width, height);
    idx = -1;
    prev = null;
    saved = null;
  }

  // Revient au point de reprise le plus proche avant `target`.
  function rewind(target) {
    const at = Math.floor(target / CHECKPOINT) * CHECKPOINT;
    const cp = checkpoints.get(at);
    if (!cp) return reset();
    ctx.putImageData(cp.image, 0, 0);
    idx = at;
    prev = cp.prev;
    saved = cp.saved;
  }

  function step() {
    if (prev) {
      const d = prev.dims;
      if (prev.disposalType === 2) {
        ctx.clearRect(d.left, d.top, d.width, d.height);
      } else if (prev.disposalType === 3 && saved) {
        ctx.putImageData(saved, 0, 0);
      }
    }
    const f = decompressFrame(raw[idx + 1], gif.gct, true);
    const d = f.dims;
    saved = f.disposalType === 3 ? ctx.getImageData(0, 0, width, height) : null;
    if (d.width && d.height) {
      patch.width = d.width;
      patch.height = d.height;
      pctx.putImageData(new ImageData(f.patch, d.width, d.height), 0, 0);
      // drawImage (et non putImageData) : les pixels transparents du
      // patch laissent voir les frames précédentes.
      ctx.drawImage(patch, d.left, d.top);
    }
    // Seuls dims et disposal servent à l'étape suivante : on ne garde
    // pas le patch décompressé.
    prev = { dims: d, disposalType: f.disposalType };
    idx++;
    if (idx % CHECKPOINT === 0 && !checkpoints.has(idx)) {
      checkpoints.set(idx, {
        image: ctx.getImageData(0, 0, width, height),
        prev,
        saved,
      });
    }
  }

  return {
    width,
    height,
    count: raw.length,
    // Canvas partagé, composé jusqu'à la frame i : à copier avant
    // tout appel suivant.
    frameAt(i) {
      const target = Math.max(0, Math.min(raw.length - 1, i));
      if (target < idx) rewind(target);
      while (idx < target) step();
      return canvas;
    },
  };
}
