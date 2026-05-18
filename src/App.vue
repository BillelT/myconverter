<script setup>
import { ref, computed } from "vue";
import FileRow from "./components/FileRow.vue";
import {
  categoryOf,
  targetsFor,
  runConversion,
  conversionMatrix,
  CATEGORY_LABELS,
} from "./converters/registry.js";
import { extOf, triggerDownload } from "./converters/util.js";
import { cancelMedia, mediaEngine } from "./converters/media.js";
import { playSound, setMuted } from "./sound.js";

const files = ref([]);
const dragOver = ref(false);
const quality = ref(0.92);
const videoMaxHeight = ref("480");
const soundOn = ref(true);
const fileInput = ref(null);
const engine = ref(null);
let aborted = false;
let nextId = 1;

const matrix = conversionMatrix();

const hasFiles = computed(() => files.value.length > 0);
const doneCount = computed(
  () => files.value.filter((f) => f.status === "done").length,
);
const convertible = computed(() =>
  files.value.filter((f) => f.targets.length && f.status !== "running"),
);
const busy = computed(() =>
  files.value.some((f) => f.status === "running"),
);
const heavySelected = computed(() =>
  files.value.some((f) =>
    f.targets.find((t) => t.to === f.to && t.heavy),
  ),
);
const hasVideo = computed(() =>
  files.value.some((f) => f.category === "video"),
);
const engineLabel = computed(() =>
  engine.value === "mt"
    ? "multi-thread"
    : engine.value === "st"
      ? "mono-thread (lent)"
      : null,
);

function makeItem(file) {
  const ext = extOf(file.name);
  const targets = targetsFor(ext);
  const category = categoryOf(ext);
  const item = {
    id: nextId++,
    file,
    name: file.name,
    ext,
    category,
    targets,
    to: targets[0] ? targets[0].to : null,
    status: "idle",
    progress: null,
    result: null,
    error: null,
    thumbUrl: category === "image" ? URL.createObjectURL(file) : null,
  };
  return item;
}

function addFiles(list) {
  for (const file of list) files.value.push(makeItem(file));
}

function onPick(e) {
  addFiles(e.target.files);
  e.target.value = "";
}

function onDrop(e) {
  dragOver.value = false;
  if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files);
}

function changeTarget(id, to) {
  const it = files.value.find((f) => f.id === id);
  if (it) {
    it.to = to;
    it.status = "idle";
    it.result = null;
    it.error = null;
  }
  if (soundOn.value) playSound("tabText");
}

function removeItem(id) {
  const idx = files.value.findIndex((f) => f.id === id);
  if (idx >= 0) {
    const it = files.value[idx];
    if (it.thumbUrl) URL.revokeObjectURL(it.thumbUrl);
    files.value.splice(idx, 1);
  }
}

function clearAll() {
  for (const it of files.value)
    if (it.thumbUrl) URL.revokeObjectURL(it.thumbUrl);
  files.value = [];
  if (soundOn.value) playSound("reset");
}

async function convertOne(it) {
  if (!it.to) return;
  it.status = "running";
  it.progress = null;
  it.error = null;
  try {
    const result = await runConversion(
      it.file,
      it.ext,
      it.to,
      { quality: quality.value, videoMaxHeight: videoMaxHeight.value },
      (p) => {
        it.progress = p;
        engine.value = mediaEngine();
      },
    );
    it.result = result;
    it.status = "done";
    it.progress = null;
    if (soundOn.value) playSound("copy");
  } catch (err) {
    const msg = err?.message || String(err);
    it.progress = null;
    if (/annul/i.test(msg)) {
      it.status = "idle";
      it.error = null;
    } else {
      it.status = "error";
      it.error = msg;
    }
  }
  engine.value = mediaEngine();
}

async function convertAll() {
  aborted = false;
  if (soundOn.value) playSound("shuffle");
  for (const it of files.value) {
    if (aborted) break;
    if (it.targets.length && it.status !== "done") {
      // eslint-disable-next-line no-await-in-loop
      await convertOne(it);
    }
  }
}

function cancelConversion() {
  aborted = true;
  cancelMedia();
  for (const it of files.value) {
    if (it.status === "running") {
      it.status = "idle";
      it.progress = null;
    }
  }
  if (soundOn.value) playSound("reset");
}

function downloadOne(id) {
  const it = files.value.find((f) => f.id === id);
  if (it?.result) triggerDownload(it.result.blob, it.result.filename);
}

async function downloadAll() {
  const done = files.value.filter((f) => f.status === "done" && f.result);
  if (done.length === 1) {
    triggerDownload(done[0].result.blob, done[0].result.filename);
    return;
  }
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  for (const it of done) zip.file(it.result.filename, it.result.blob);
  const blob = await zip.generateAsync({ type: "blob" });
  triggerDownload(blob, "converted.zip");
}

function toggleSound() {
  soundOn.value = !soundOn.value;
  setMuted(!soundOn.value);
  if (soundOn.value) playSound("tabText");
}
</script>

<template>
  <div class="app-shell">
    <aside class="aside">
      <header class="aside__head">
        <h1 class="aside__title">
          Converter <span class="caption">local file converter</span>
        </h1>
        <p class="caption">
          Tout est converti dans ton navigateur. Aucun upload, aucun serveur.
        </p>
      </header>

      <section class="aside__section">
        <div class="aside__section-head">
          <span class="eyebrow">Fichiers</span>
          <button v-if="hasFiles" class="btn-link" @click="clearAll">
            Tout vider
          </button>
        </div>
        <div class="aside__stat">
          <span class="muted">En file</span>
          <span class="aside__stat-value">{{ files.length }}</span>
        </div>
        <div class="aside__stat">
          <span class="muted">Convertis</span>
          <span class="aside__stat-value">{{ doneCount }}</span>
        </div>
        <button
          class="btn btn-secondary"
          @click="fileInput.click()"
        >
          + Ajouter des fichiers
        </button>
        <input
          ref="fileInput"
          type="file"
          multiple
          hidden
          @change="onPick"
        />
      </section>

      <section class="aside__section">
        <span class="eyebrow">Qualité image</span>
        <div class="field">
          <div class="slider-row">
            <label>JPG / WEBP</label>
            <span class="slider-row__value">{{ quality.toFixed(2) }}</span>
          </div>
          <input
            type="range"
            class="slider"
            min="0.4"
            max="1"
            step="0.02"
            v-model.number="quality"
          />
        </div>
      </section>

      <section v-if="hasVideo" class="aside__section">
        <span class="eyebrow">Résolution vidéo (max)</span>
        <select class="select" v-model="videoMaxHeight">
          <option value="source">Source (originale, très lent)</option>
          <option value="1080">1080p (lent)</option>
          <option value="720">720p</option>
          <option value="480">480p (recommandé)</option>
          <option value="360">360p (très rapide)</option>
        </select>
        <p class="caption">
          Jamais agrandie au-dessus de la source. L'encodage vidéo en local
          est lent — plus bas = beaucoup plus rapide.
        </p>
      </section>

      <section class="aside__section">
        <button
          v-if="!busy"
          class="cta cta--block"
          :aria-disabled="!convertible.length"
          :disabled="!convertible.length"
          @click="convertAll"
        >
          Tout convertir
        </button>
        <button
          v-else
          class="btn btn-secondary"
          @click="cancelConversion"
        >
          Annuler la conversion
        </button>
        <button
          class="btn btn-secondary"
          :disabled="!doneCount"
          @click="downloadAll"
        >
          Télécharger {{ doneCount > 1 ? "tout (.zip)" : "" }}
        </button>
        <p v-if="heavySelected" class="caption">
          · Audio/vidéo : moteur ffmpeg (~30 Mo) chargé au 1er lancement.
          <template v-if="engineLabel">
            Moteur : {{ engineLabel }}.
          </template>
        </p>
      </section>

      <footer class="aside__footer">
        <label class="toggle">
          <input
            type="checkbox"
            :checked="soundOn"
            @change="toggleSound"
          />
          <span class="toggle__track"></span>
          son
        </label>
        <a
          href="https://www.lacompagniedesinternetsbordelaise.fr/"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="La Compagnie des Internets™ Bordelaise"
        >
          <img
            src="/assets/signature-cib.svg"
            alt=""
            aria-hidden="true"
            class="signature"
          />
        </a>
      </footer>
    </aside>

    <main
      class="work"
      @dragover.prevent="dragOver = true"
      @dragleave.prevent="dragOver = false"
      @drop.prevent="onDrop"
    >
      <div class="work__bar">
        <div class="work__bar-title">
          <h2 class="h4">Convertir</h2>
          <span class="caption"
            >Glisse tes fichiers, choisis un format, c'est tout.</span
          >
        </div>
        <div class="work__actions">
          <button
            v-if="!busy"
            class="cta"
            :aria-disabled="!convertible.length"
            :disabled="!convertible.length"
            @click="convertAll"
          >
            Tout convertir
          </button>
          <button
            v-else
            class="btn btn-secondary"
            @click="cancelConversion"
          >
            Annuler
          </button>
        </div>
      </div>

      <div class="work__body">
        <div
          v-if="!hasFiles"
          class="dropzone"
          :class="{ 'dropzone--over': dragOver }"
          @click="fileInput.click()"
        >
          <span class="dropzone__glyph" aria-hidden="true">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M4 8h12l-4-4" />
              <path d="M20 16H8l4 4" />
            </svg>
          </span>
          <h3 class="h3">Dépose tes fichiers ici</h3>
          <p class="lead dropzone__hint">
            Documents, images, données, audio, vidéo — convertis localement,
            dans tous les sens logiques.
          </p>
          <span class="caption">ou clique pour parcourir</span>

          <div class="matrix" style="margin-top: var(--space-6)">
            <div
              v-for="row in matrix"
              :key="row.from"
              class="matrix__row"
            >
              <span class="matrix__from">{{ row.from }}</span>
              <span>→ {{ row.to.join(", ") }}</span>
            </div>
          </div>
        </div>

        <div v-else class="file-list">
          <FileRow
            v-for="it in files"
            :key="it.id"
            :item="it"
            @change-target="changeTarget"
            @remove="removeItem"
            @download="downloadOne"
          />
        </div>
      </div>
    </main>
  </div>
</template>
