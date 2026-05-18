// Petits helpers partagés par tous les converters.

export function extOf(filename) {
  const m = /\.([a-z0-9]+)$/i.exec(filename || "");
  if (!m) return "";
  return canonicalExt(m[1].toLowerCase());
}

// Normalise les alias d'extension vers une forme canonique.
const ALIASES = {
  jpeg: "jpg",
  jpe: "jpg",
  tif: "tiff",
  htm: "html",
  yml: "yaml",
  mkv: "mkv",
  mpeg: "mpg",
};

export function canonicalExt(ext) {
  return ALIASES[ext] || ext;
}

export function baseName(filename) {
  return (filename || "file").replace(/\.[^.]+$/, "");
}

export function readAsArrayBuffer(file) {
  return file.arrayBuffer();
}

export function readAsText(file) {
  return file.text();
}

export function readAsDataURL(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

export function loadImageElement(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Image illisible"));
    };
    img.src = url;
  });
}

// Encodeur BMP 24 bits (canvas.toBlob ne sait pas produire du BMP).
export function imageDataToBmp(imageData) {
  const { width, height, data } = imageData;
  const rowSize = Math.floor((24 * width + 31) / 32) * 4;
  const pixelArraySize = rowSize * height;
  const fileSize = 54 + pixelArraySize;
  const buf = new ArrayBuffer(fileSize);
  const view = new DataView(buf);

  view.setUint8(0, 0x42);
  view.setUint8(1, 0x4d);
  view.setUint32(2, fileSize, true);
  view.setUint32(10, 54, true);
  view.setUint32(14, 40, true);
  view.setInt32(18, width, true);
  view.setInt32(22, height, true);
  view.setUint16(26, 1, true);
  view.setUint16(28, 24, true);
  view.setUint32(34, pixelArraySize, true);
  view.setInt32(38, 2835, true);
  view.setInt32(42, 2835, true);

  let offset = 54;
  for (let y = height - 1; y >= 0; y--) {
    let rowStart = offset;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      view.setUint8(rowStart++, data[i + 2]);
      view.setUint8(rowStart++, data[i + 1]);
      view.setUint8(rowStart++, data[i]);
    }
    offset += rowSize;
  }
  return new Blob([buf], { type: "image/bmp" });
}

export function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
