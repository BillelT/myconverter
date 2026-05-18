import { baseName, readAsArrayBuffer, readAsText } from "./util.js";

function out(file, ext, content, mime) {
  const blob =
    content instanceof Blob ? content : new Blob([content], { type: mime });
  return { blob, filename: `${baseName(file.name)}.${ext}` };
}

function asRows(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") return [value];
  return [{ value }];
}

async function parseCsv(text) {
  const Papa = (await import("papaparse")).default;
  const res = Papa.parse(text.trim(), {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
  });
  return res.data;
}

async function toCsv(rows) {
  const Papa = (await import("papaparse")).default;
  return Papa.unparse(asRows(rows));
}

async function loadYaml() {
  return (await import("js-yaml")).default;
}

async function xmlParser() {
  const { XMLParser, XMLBuilder } = await import("fast-xml-parser");
  return {
    parse: (xml) =>
      new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" }).parse(
        xml,
      ),
    build: (obj) =>
      new XMLBuilder({
        ignoreAttributes: false,
        attributeNamePrefix: "@_",
        format: true,
      }).build(obj),
  };
}

async function getXLSX() {
  return await import("xlsx");
}

async function sheetToValue(file) {
  const XLSX = await getXLSX();
  const buf = await readAsArrayBuffer(file);
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return { XLSX, wb, ws };
}

function jsonString(v) {
  return JSON.stringify(v, null, 2);
}

export const defs = [
  // ---- JSON ----
  {
    from: "json",
    to: "csv",
    label: "CSV",
    category: "data",
    run: async (f) =>
      out(f, "csv", await toCsv(JSON.parse(await readAsText(f))), "text/csv"),
  },
  {
    from: "json",
    to: "yaml",
    label: "YAML",
    category: "data",
    run: async (f) => {
      const yaml = await loadYaml();
      return out(
        f,
        "yaml",
        yaml.dump(JSON.parse(await readAsText(f))),
        "text/yaml",
      );
    },
  },
  {
    from: "json",
    to: "xml",
    label: "XML",
    category: "data",
    run: async (f) => {
      const { build } = await xmlParser();
      const obj = JSON.parse(await readAsText(f));
      return out(
        f,
        "xml",
        build({ root: obj }),
        "application/xml",
      );
    },
  },
  {
    from: "json",
    to: "xlsx",
    label: "XLSX",
    category: "data",
    run: async (f) => {
      const XLSX = await getXLSX();
      const rows = asRows(JSON.parse(await readAsText(f)));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
      const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
      return out(
        f,
        "xlsx",
        new Blob([buf], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
      );
    },
  },

  // ---- CSV ----
  {
    from: "csv",
    to: "json",
    label: "JSON",
    category: "data",
    run: async (f) =>
      out(
        f,
        "json",
        jsonString(await parseCsv(await readAsText(f))),
        "application/json",
      ),
  },
  {
    from: "csv",
    to: "yaml",
    label: "YAML",
    category: "data",
    run: async (f) => {
      const yaml = await loadYaml();
      return out(
        f,
        "yaml",
        yaml.dump(await parseCsv(await readAsText(f))),
        "text/yaml",
      );
    },
  },
  {
    from: "csv",
    to: "xlsx",
    label: "XLSX",
    category: "data",
    run: async (f) => {
      const XLSX = await getXLSX();
      const wb = XLSX.read(await readAsText(f), { type: "string" });
      const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
      return out(
        f,
        "xlsx",
        new Blob([buf], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
      );
    },
  },

  // ---- XLSX ----
  {
    from: "xlsx",
    to: "csv",
    label: "CSV",
    category: "data",
    run: async (f) => {
      const { XLSX, ws } = await sheetToValue(f);
      return out(f, "csv", XLSX.utils.sheet_to_csv(ws), "text/csv");
    },
  },
  {
    from: "xlsx",
    to: "json",
    label: "JSON",
    category: "data",
    run: async (f) => {
      const { XLSX, ws } = await sheetToValue(f);
      return out(
        f,
        "json",
        jsonString(XLSX.utils.sheet_to_json(ws)),
        "application/json",
      );
    },
  },
  {
    from: "xlsx",
    to: "yaml",
    label: "YAML",
    category: "data",
    run: async (f) => {
      const { XLSX, ws } = await sheetToValue(f);
      const yaml = await loadYaml();
      return out(f, "yaml", yaml.dump(XLSX.utils.sheet_to_json(ws)), "text/yaml");
    },
  },

  // ---- YAML ----
  {
    from: "yaml",
    to: "json",
    label: "JSON",
    category: "data",
    run: async (f) => {
      const yaml = await loadYaml();
      return out(
        f,
        "json",
        jsonString(yaml.load(await readAsText(f))),
        "application/json",
      );
    },
  },
  {
    from: "yaml",
    to: "csv",
    label: "CSV",
    category: "data",
    run: async (f) => {
      const yaml = await loadYaml();
      return out(
        f,
        "csv",
        await toCsv(yaml.load(await readAsText(f))),
        "text/csv",
      );
    },
  },

  // ---- XML ----
  {
    from: "xml",
    to: "json",
    label: "JSON",
    category: "data",
    run: async (f) => {
      const { parse } = await xmlParser();
      return out(
        f,
        "json",
        jsonString(parse(await readAsText(f))),
        "application/json",
      );
    },
  },
  {
    from: "xml",
    to: "yaml",
    label: "YAML",
    category: "data",
    run: async (f) => {
      const { parse } = await xmlParser();
      const yaml = await loadYaml();
      return out(f, "yaml", yaml.dump(parse(await readAsText(f))), "text/yaml");
    },
  },
];
