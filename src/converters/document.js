import { baseName, readAsArrayBuffer, readAsText } from "./util.js";

function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function htmlToPlainText(html) {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  tmp.querySelectorAll("br").forEach((b) => b.replaceWith("\n"));
  tmp
    .querySelectorAll("p,div,h1,h2,h3,h4,h5,h6,li,tr,blockquote,pre")
    .forEach((el) => el.append("\n"));
  return (tmp.textContent || "").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

function wrapHtmlDoc(title, bodyHtml) {
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(title)}</title>
<style>
  body { font-family: -apple-system, system-ui, sans-serif; line-height: 1.6;
         max-width: 42rem; margin: 2rem auto; padding: 0 1rem; color: #0a0a0a; }
  pre { background: #f7f7f8; padding: 1rem; border-radius: 8px; overflow:auto; }
  code { font-family: ui-monospace, monospace; }
  img { max-width: 100%; }
  table { border-collapse: collapse; } td, th { border: 1px solid #e5e5e5; padding: 4px 8px; }
</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

async function mdToHtmlString(text) {
  const { marked } = await import("marked");
  return marked.parse(text);
}

async function htmlToMdString(html) {
  const Turndown = (await import("turndown")).default;
  return new Turndown({ headingStyle: "atx", codeBlockStyle: "fenced" }).turndown(
    html,
  );
}

async function readDocxHtml(file) {
  const mammoth = await import("mammoth/mammoth.browser.js");
  const arrayBuffer = await readAsArrayBuffer(file);
  const res = await mammoth.convertToHtml({ arrayBuffer });
  return res.value;
}

let pdfjsLib = null;
async function getPdfjs() {
  if (pdfjsLib) return pdfjsLib;
  pdfjsLib = await import("pdfjs-dist");
  const workerUrl = (
    await import("pdfjs-dist/build/pdf.worker.min.mjs?url")
  ).default;
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
  return pdfjsLib;
}

async function pdfToText(file) {
  const lib = await getPdfjs();
  const data = await readAsArrayBuffer(file);
  const pdf = await lib.getDocument({ data }).promise;
  let out = "";
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    let lastY = null;
    let line = "";
    for (const item of tc.items) {
      const y = item.transform[5];
      if (lastY !== null && Math.abs(y - lastY) > 2) {
        out += line.trimEnd() + "\n";
        line = "";
      }
      line += item.str + (item.hasEOL ? "\n" : " ");
      lastY = y;
    }
    out += line.trimEnd() + "\n\n";
  }
  return out.trim() + "\n";
}

async function pdfToImages(file) {
  const lib = await getPdfjs();
  const data = await readAsArrayBuffer(file);
  const pdf = await lib.getDocument({ data }).promise;
  const pages = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({
      canvasContext: canvas.getContext("2d"),
      viewport,
    }).promise;
    const blob = await new Promise((res) =>
      canvas.toBlob(res, "image/png"),
    );
    pages.push(blob);
  }
  return pages;
}

async function textToPdf(text) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 48;
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(11);
  const lines = pdf.splitTextToSize(text, pageW - margin * 2);
  const lineH = 15;
  let y = margin;
  for (const ln of lines) {
    if (y + lineH > pageH - margin) {
      pdf.addPage();
      y = margin;
    }
    pdf.text(ln, margin, y);
    y += lineH;
  }
  return pdf.output("blob");
}

async function htmlStringToPdf(htmlString) {
  const { jsPDF } = await import("jspdf");
  const html2canvas = (await import("html2canvas")).default;
  window.html2canvas = html2canvas;

  const holder = document.createElement("div");
  holder.style.position = "fixed";
  holder.style.left = "-9999px";
  holder.style.top = "0";
  holder.style.width = "794px";
  holder.style.background = "#ffffff";
  holder.innerHTML = htmlString;
  document.body.appendChild(holder);

  const pdf = new jsPDF({ unit: "px", format: "a4" });
  try {
    await pdf.html(holder, {
      autoPaging: "text",
      margin: [24, 24, 24, 24],
      html2canvas: { scale: 0.9, useCORS: true, backgroundColor: "#ffffff" },
      width: pdf.internal.pageSize.getWidth() - 48,
      windowWidth: 794,
    });
  } finally {
    holder.remove();
  }
  return pdf.output("blob");
}

function out(file, ext, blob) {
  return { blob, filename: `${baseName(file.name)}.${ext}` };
}

function txtBlob(text) {
  return new Blob([text], { type: "text/plain" });
}

export const defs = [
  // ---- Markdown ----
  {
    from: "md",
    to: "html",
    label: "HTML",
    category: "document",
    run: async (f) =>
      out(
        f,
        "html",
        new Blob(
          [wrapHtmlDoc(baseName(f.name), await mdToHtmlString(await readAsText(f)))],
          { type: "text/html" },
        ),
      ),
  },
  {
    from: "md",
    to: "txt",
    label: "TXT",
    category: "document",
    run: async (f) =>
      out(
        f,
        "txt",
        txtBlob(htmlToPlainText(await mdToHtmlString(await readAsText(f)))),
      ),
  },
  {
    from: "md",
    to: "pdf",
    label: "PDF",
    category: "document",
    run: async (f) =>
      out(
        f,
        "pdf",
        await htmlStringToPdf(
          wrapHtmlDoc(baseName(f.name), await mdToHtmlString(await readAsText(f))),
        ),
      ),
  },

  // ---- HTML ----
  {
    from: "html",
    to: "md",
    label: "Markdown",
    category: "document",
    run: async (f) =>
      out(f, "md", txtBlob(await htmlToMdString(await readAsText(f)))),
  },
  {
    from: "html",
    to: "txt",
    label: "TXT",
    category: "document",
    run: async (f) =>
      out(f, "txt", txtBlob(htmlToPlainText(await readAsText(f)))),
  },
  {
    from: "html",
    to: "pdf",
    label: "PDF",
    category: "document",
    run: async (f) => out(f, "pdf", await htmlStringToPdf(await readAsText(f))),
  },

  // ---- TXT ----
  {
    from: "txt",
    to: "md",
    label: "Markdown",
    category: "document",
    run: async (f) => out(f, "md", txtBlob(await readAsText(f))),
  },
  {
    from: "txt",
    to: "html",
    label: "HTML",
    category: "document",
    run: async (f) =>
      out(
        f,
        "html",
        new Blob(
          [wrapHtmlDoc(baseName(f.name), `<pre>${escapeHtml(await readAsText(f))}</pre>`)],
          { type: "text/html" },
        ),
      ),
  },
  {
    from: "txt",
    to: "pdf",
    label: "PDF",
    category: "document",
    run: async (f) => out(f, "pdf", await textToPdf(await readAsText(f))),
  },

  // ---- DOCX ----
  {
    from: "docx",
    to: "html",
    label: "HTML",
    category: "document",
    run: async (f) =>
      out(
        f,
        "html",
        new Blob([wrapHtmlDoc(baseName(f.name), await readDocxHtml(f))], {
          type: "text/html",
        }),
      ),
  },
  {
    from: "docx",
    to: "md",
    label: "Markdown",
    category: "document",
    run: async (f) =>
      out(f, "md", txtBlob(await htmlToMdString(await readDocxHtml(f)))),
  },
  {
    from: "docx",
    to: "txt",
    label: "TXT",
    category: "document",
    run: async (f) =>
      out(f, "txt", txtBlob(htmlToPlainText(await readDocxHtml(f)))),
  },
  {
    from: "docx",
    to: "pdf",
    label: "PDF",
    category: "document",
    run: async (f) =>
      out(
        f,
        "pdf",
        await htmlStringToPdf(
          wrapHtmlDoc(baseName(f.name), await readDocxHtml(f)),
        ),
      ),
  },

  // ---- PDF ----
  {
    from: "pdf",
    to: "txt",
    label: "TXT",
    category: "document",
    run: async (f) => out(f, "txt", txtBlob(await pdfToText(f))),
  },
  {
    from: "pdf",
    to: "md",
    label: "Markdown",
    category: "document",
    run: async (f) => out(f, "md", txtBlob(await pdfToText(f))),
  },
  {
    from: "pdf",
    to: "png",
    label: "PNG (pages)",
    category: "document",
    run: async (f) => {
      const pages = await pdfToImages(f);
      if (pages.length === 1) {
        return out(f, "png", pages[0]);
      }
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      pages.forEach((b, i) =>
        zip.file(`${baseName(f.name)}-p${String(i + 1).padStart(2, "0")}.png`, b),
      );
      const blob = await zip.generateAsync({ type: "blob" });
      return { blob, filename: `${baseName(f.name)}-pages.zip` };
    },
  },
];
