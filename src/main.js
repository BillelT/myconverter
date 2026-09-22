import {
  categoryOf,
  targetsFor,
  runConversion,
  CATEGORY_LABELS,
} from "./converters/registry.js";
import { extOf, triggerDownload } from "./converters/util.js";
import { cancelMedia, mediaEngine } from "./converters/media.js";
import { playSound, setMuted } from "./sound.js";

// ---------- état ----------
const state = {
  files: [],
  quality: 0.92,
  videoMaxHeight: "480",
  soundOn: true,
  dragOver: false,
  busy: false,
  engine: null,
};
let aborted = false;
let nextId = 1;

// ---------- helpers DOM ----------
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") node.className = v;
    else if (k === "dataset") Object.assign(node.dataset, v);
    else if (k.startsWith("on") && typeof v === "function")
      node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === "hidden") node.hidden = !!v;
    else if (k === "disabled") node.disabled = !!v;
    else if (k in node && typeof v !== "string") node[k] = v;
    else node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c == null || c === false) continue;
    node.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return node;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[c]);
}

// ---------- refs ----------
const refs = {
  clearAll: $("[data-clear-all]"),
  statQueued: $("[data-stat-queued]"),
  statDone: $("[data-stat-done]"),
  addFiles: $("[data-add-files]"),
  fileInput: $("[data-file-input]"),
  quality: $("[data-quality]"),
  qualityValue: $("[data-quality-value]"),
  videoSection: $("[data-video-section]"),
  videoMaxHeight: $("[data-video-max-height]"),
  convertSide: $("[data-convert-all-side]"),
  cancelSide: $("[data-cancel-side]"),
  downloadAll: $("[data-download-all]"),
  heavyHint: $("[data-heavy-hint]"),
  engineLabel: $("[data-engine-label]"),
  soundToggle: $("[data-sound-toggle]"),
  work: $("[data-work]"),
  dropzone: $("[data-dropzone]"),
  fileList: $("[data-file-list]"),
};

// ---------- items ----------
function makeItem(file) {
  const ext = extOf(file.name);
  const targets = targetsFor(ext);
  const category = categoryOf(ext);
  return {
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
    node: null,
  };
}

function addFiles(list) {
  if (!list.length) return;
  for (const file of list) state.files.push(makeItem(file));
  renderFileList();
  syncSide();
  if (state.soundOn) playSound("fileAdd");
}

function removeItem(id) {
  const idx = state.files.findIndex((f) => f.id === id);
  if (idx >= 0) {
    const it = state.files[idx];
    if (it.thumbUrl) URL.revokeObjectURL(it.thumbUrl);
    state.files.splice(idx, 1);
    renderFileList();
    syncSide();
    if (state.soundOn) playSound("fileRemove");
  }
}

function clearAll() {
  for (const it of state.files)
    if (it.thumbUrl) URL.revokeObjectURL(it.thumbUrl);
  state.files = [];
  renderFileList();
  syncSide();
  if (state.soundOn) playSound("reset");
}

function changeTarget(id, to) {
  const it = state.files.find((f) => f.id === id);
  if (!it) return;
  it.to = to;
  it.status = "idle";
  it.result = null;
  it.error = null;
  updateRow(it);
  syncSide();
  if (state.soundOn) playSound("tabText");
}

// ---------- rendu file row ----------
function buildRow(it) {
  const thumb = el(
    "div",
    { class: "file-row__thumb" },
    it.thumbUrl
      ? el("img", { src: it.thumbUrl, alt: "" })
      : el("span", { class: "caption" }, it.ext.toUpperCase()),
  );

  const name = el(
    "span",
    { class: "file-row__name", title: it.name },
    it.name,
  );

  // meta : pill + convert (select target)
  const meta = el("div", { class: "file-row__meta" }, [
    el("span", { class: "pill pill--light" }, CATEGORY_LABELS[it.category]),
  ]);

  if (it.targets.length) {
    const select = el(
      "select",
      {
        class: "format-select",
        disabled: it.status === "running",
        onchange: (e) => changeTarget(it.id, e.target.value),
      },
      it.targets.map((t) =>
        el(
          "option",
          { value: t.to, selected: t.to === it.to },
          `${t.label}${t.heavy ? " ·" : ""}`,
        ),
      ),
    );
    meta.append(
      el("span", { class: "file-row__convert" }, [
        el("span", { class: "caption" }, it.ext),
        el(
          "span",
          { class: "file-row__arrow", "aria-hidden": "true" },
          "→",
        ),
        select,
      ]),
    );
  } else {
    meta.append(
      el("span", { class: "caption" }, "Format non pris en charge"),
    );
  }

  const statusRow = el("div", { class: "file-row__meta" });
  // statusRow rempli dans updateRow

  const main = el("div", { class: "file-row__main" }, [
    name,
    meta,
    statusRow,
  ]);

  const dlBtn = el(
    "button",
    {
      class: "btn btn-tiertary",
      hidden: true,
      onclick: () => downloadOne(it.id),
    },
    "Télécharger",
  );
  const removeBtn = el(
    "button",
    {
      class: "btn btn-ghost",
      onclick: () => removeItem(it.id),
    },
    "Retirer",
  );

  const actions = el("div", { class: "file-row__actions" }, [
    dlBtn,
    removeBtn,
  ]);

  const row = el("div", { class: "file-row" }, [thumb, main, actions]);

  row._parts = { statusRow, dlBtn, removeBtn, select: meta.querySelector("select") };
  return row;
}

function updateRow(it) {
  if (!it.node) return;
  const { statusRow, dlBtn, removeBtn, select } = it.node._parts;

  if (select) select.disabled = it.status === "running";
  if (select && select.value !== it.to) select.value = it.to;

  dlBtn.hidden = it.status !== "done";
  removeBtn.disabled = it.status === "running";

  statusRow.replaceChildren();
  if (it.status === "idle") return;

  if (it.status === "running") {
    const pct =
      it.progress != null ? Math.round(it.progress * 100) : null;
    const isMedia = it.category === "audio" || it.category === "video";
    const label =
      pct != null
        ? `Conversion ${pct}%`
        : isMedia
          ? "Préparation du moteur ffmpeg (~30 Mo, 1re fois)…"
          : "Conversion…";
    statusRow.append(
      el("span", { class: "status" }, [
        el("span", { class: "spinner", "aria-hidden": "true" }),
        " " + label,
      ]),
    );
  } else if (it.status === "done") {
    statusRow.append(
      el(
        "span",
        { class: "status status--done" },
        "✓ " + it.result.filename,
      ),
    );
  } else if (it.status === "error") {
    statusRow.append(
      el(
        "span",
        { class: "status status--error", title: it.error },
        "Échec — " + it.error,
      ),
    );
  }
}

function renderFileList() {
  const hasFiles = state.files.length > 0;
  refs.dropzone.hidden = hasFiles;
  refs.fileList.hidden = !hasFiles;
  refs.clearAll.hidden = !hasFiles;

  refs.fileList.replaceChildren();
  for (const it of state.files) {
    it.node = buildRow(it);
    refs.fileList.append(it.node);
    updateRow(it);
  }
}

// ---------- état global (bouton, compteurs) ----------
function convertibleCount() {
  return state.files.filter(
    (f) => f.targets.length && f.status !== "running",
  ).length;
}
function doneCount() {
  return state.files.filter((f) => f.status === "done").length;
}
function hasVideo() {
  return state.files.some((f) => f.category === "video");
}
function heavySelected() {
  return state.files.some((f) =>
    f.targets.find((t) => t.to === f.to && t.heavy),
  );
}

function syncSide() {
  refs.statQueued.textContent = String(state.files.length);
  refs.statDone.textContent = String(doneCount());

  const can = convertibleCount() > 0;
  const done = doneCount();

  refs.convertSide.hidden = state.busy;
  refs.convertSide.disabled = !can;
  refs.convertSide.setAttribute("aria-disabled", String(!can));
  refs.cancelSide.hidden = !state.busy;

  refs.downloadAll.disabled = done === 0;
  refs.downloadAll.textContent =
    done > 1 ? "Télécharger tout (.zip)" : "Télécharger";

  refs.videoSection.hidden = !hasVideo();

  refs.heavyHint.hidden = !heavySelected();
  const eLabel =
    state.engine === "mt"
      ? "multi-thread"
      : state.engine === "st"
        ? "mono-thread (lent)"
        : null;
  refs.engineLabel.textContent = eLabel ? ` Moteur : ${eLabel}.` : "";
}

// ---------- conversion ----------
async function convertOne(it) {
  if (!it.to) return;
  it.status = "running";
  it.progress = null;
  it.error = null;
  updateRow(it);
  syncSide();
  try {
    const result = await runConversion(
      it.file,
      it.ext,
      it.to,
      { quality: state.quality, videoMaxHeight: state.videoMaxHeight },
      (p) => {
        it.progress = p;
        state.engine = mediaEngine();
        updateRow(it);
        syncSide();
      },
    );
    it.result = result;
    it.status = "done";
    it.progress = null;
    if (state.soundOn) playSound("copy");
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
  state.engine = mediaEngine();
  updateRow(it);
  syncSide();
}

async function convertAll() {
  aborted = false;
  state.busy = true;
  syncSide();
  if (state.soundOn) playSound("shuffle");
  for (const it of state.files) {
    if (aborted) break;
    if (it.targets.length && it.status !== "done") {
      // eslint-disable-next-line no-await-in-loop
      await convertOne(it);
    }
  }
  state.busy = false;
  syncSide();
}

function cancelConversion() {
  aborted = true;
  cancelMedia();
  for (const it of state.files) {
    if (it.status === "running") {
      it.status = "idle";
      it.progress = null;
      updateRow(it);
    }
  }
  state.busy = false;
  syncSide();
  if (state.soundOn) playSound("reset");
}

function downloadOne(id) {
  const it = state.files.find((f) => f.id === id);
  if (it?.result) triggerDownload(it.result.blob, it.result.filename);
}

async function downloadAll() {
  const done = state.files.filter((f) => f.status === "done" && f.result);
  if (!done.length) return;
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

function toggleSound(checked) {
  state.soundOn = !!checked;
  setMuted(!state.soundOn);
  if (state.soundOn) playSound("tabText");
}

// ---------- wiring ----------
refs.addFiles.addEventListener("click", () => refs.fileInput.click());
refs.dropzone.addEventListener("click", () => refs.fileInput.click());
refs.fileInput.addEventListener("change", (e) => {
  addFiles(e.target.files);
  e.target.value = "";
});

refs.clearAll.addEventListener("click", clearAll);

refs.quality.addEventListener("input", (e) => {
  state.quality = Number(e.target.value);
  refs.qualityValue.textContent = state.quality.toFixed(2);
});
refs.videoMaxHeight.addEventListener("change", (e) => {
  state.videoMaxHeight = e.target.value;
});

refs.convertSide.addEventListener("click", convertAll);
refs.cancelSide.addEventListener("click", cancelConversion);
refs.downloadAll.addEventListener("click", downloadAll);

refs.soundToggle.addEventListener("change", (e) =>
  toggleSound(e.target.checked),
);

// drag & drop
refs.work.addEventListener("dragover", (e) => {
  e.preventDefault();
  state.dragOver = true;
  refs.dropzone.classList.add("dropzone--over");
});
refs.work.addEventListener("dragleave", (e) => {
  e.preventDefault();
  state.dragOver = false;
  refs.dropzone.classList.remove("dropzone--over");
});
refs.work.addEventListener("drop", (e) => {
  e.preventDefault();
  state.dragOver = false;
  refs.dropzone.classList.remove("dropzone--over");
  if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files);
});

// ---------- init ----------
renderFileList();
syncSide();
