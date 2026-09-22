// =========================================================
// sound.js — Sons d'interaction
// ---------------------------------------------------------
// Lib : @web-kits/audio (raphaelsalaja), bundlée via npm (pas
// d'appel CDN runtime), lazy-loadée à la première interaction
// (l'AudioContext exige un geste utilisateur, donc playSound()
// est toujours appelé depuis un handler de clic / change).
// =========================================================

let audioLib = null;
let initPromise = null;
const sounds = {};
let muted = false;

export function setMuted(v) {
  muted = !!v;
}

export function isMuted() {
  return muted;
}

function buildSounds() {
  const ds = audioLib.defineSound;
  const seq = audioLib.defineSequence;

  // Tabs / toggles — sine courte, une fréquence par cible
  const tabBase = (f) =>
    ds({
      source: { type: "sine", frequency: f },
      envelope: { attack: 0.001, decay: 0.06, sustain: 0, release: 0.02 },
      gain: 0.18,
    });
  sounds.tabText = tabBase(880);
  sounds.tabSvg = tabBase(660);
  sounds.tabShader = tabBase(440);
  sounds.tabDots = tabBase(550);

  // Copy — deux sine enchaînées (confirmation montante)
  const copyA = ds({
    source: { type: "sine", frequency: 880 },
    envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.04 },
    gain: 0.18,
  });
  const copyB = ds({
    source: { type: "sine", frequency: 1320 },
    envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.05 },
    gain: 0.2,
  });
  sounds.copy = seq([
    { sound: copyA, at: 0 },
    { sound: copyB, at: 0.08 },
  ]);

  // Shuffle (randomize palette) — triangle, arpège montant
  const sh = (f) =>
    ds({
      source: { type: "triangle", frequency: f },
      envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.02 },
      gain: 0.14,
    });
  sounds.shuffle = seq([
    { sound: sh(523), at: 0 },
    { sound: sh(698), at: 0.05 },
    { sound: sh(880), at: 0.1 },
  ]);

  // Reset — sweep descendant 800 → 200 Hz
  sounds.reset = ds({
    source: { type: "sine", frequency: { start: 800, end: 200 } },
    envelope: { attack: 0.005, decay: 0.18, sustain: 0, release: 0.05 },
    gain: 0.16,
  });

  // Fichier ajouté (upload/drop) — sweep ascendant, court et léger
  sounds.fileAdd = ds({
    source: { type: "sine", frequency: { start: 420, end: 720 } },
    envelope: { attack: 0.002, decay: 0.1, sustain: 0, release: 0.04 },
    gain: 0.15,
  });

  // Fichier retiré (un seul, pas le clear-all) — sweep descendant, court
  sounds.fileRemove = ds({
    source: { type: "sine", frequency: { start: 520, end: 240 } },
    envelope: { attack: 0.002, decay: 0.08, sustain: 0, release: 0.03 },
    gain: 0.14,
  });

  // Tick — gamme de 10 notes (audio réactif / drag éventuel)
  const scale = [
    220.0, 261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25,
    783.99,
  ];
  sounds.tick = scale.map((f) =>
    ds({
      source: { type: "sine", frequency: f },
      envelope: { attack: 0.005, decay: 0.15, sustain: 0, release: 0.25 },
      gain: 0.09,
    })
  );

  // Bounce — pool de square, fréquence aléatoire (easter-eggs)
  const bounceScale = [196.0, 246.94, 293.66, 369.99, 440.0, 587.33, 698.46];
  const bouncePool = bounceScale.map((f) =>
    ds({
      source: { type: "square", frequency: { start: f * 1.4, end: f } },
      envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.03 },
      gain: 0.11,
    })
  );
  sounds.bounce = () => {
    const i = Math.floor(Math.random() * bouncePool.length);
    try {
      bouncePool[i]();
    } catch (_) {
      /* noop */
    }
  };
}

async function initAudio() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      audioLib = await import("@web-kits/audio");
      buildSounds();
      await audioLib.ensureReady();
    } catch (e) {
      console.warn("audio init failed", e);
      audioLib = null;
    }
  })();
  return initPromise;
}

// Joue un son par nom. À appeler depuis un handler de geste
// utilisateur (clic / change) pour que l'AudioContext démarre.
export async function playSound(name) {
  if (muted) return;
  await initAudio();
  const s = sounds[name];
  if (!s) return;
  try {
    if (typeof s === "function") s();
    else if (s && s.play) s.play();
  } catch (_) {
    /* noop */
  }
}

// Mappe un mode de forme vers son tab-sound (comme boids).
export function tabSoundFor(mode) {
  return mode === "shader"
    ? "tabShader"
    : mode === "svg"
      ? "tabSvg"
      : mode === "dots"
        ? "tabDots"
        : "tabText";
}
