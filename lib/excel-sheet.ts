import { unzipSync } from "fflate";
import { XMLParser } from "fast-xml-parser";
import { columnLetters, columnIndex } from "./excel-formula.ts";

export type SheetCell = { value: string | number | null; formula: string | null; bold: boolean; italic: boolean; underline: boolean; fontColor: string | null; fillColor: string | null; border: string | null; numberFormat: "General" | "Number" | "Currency" | "Percentage"; align: "left" | "center" | "right" };
export type WorkingSheetSnapshot = { schemaVersion: 1; language: "English" | "Hindi"; rows: number; cols: number; cells: Record<string, SheetCell>; source?: { fileName: string; sizeBytes: number; bucket?: string; storagePath?: string } };

const MAX_XLSX_BYTES = 10 * 1024 * 1024, MAX_UNCOMPRESSED_BYTES = 40 * 1024 * 1024, MAX_ROWS = 200, MAX_COLS = 26;
// trimValues defaults to true in fast-xml-parser, which strips leading/
// trailing space off every text node -- including a rich-text run inside a
// shared string (si/r/t), the same word-glue corruption fixed in
// lib/word-docx.ts for Word's <w:t> runs (e.g. "your Guru cell" split across
// runs at a formatting boundary loses the run-boundary spaces and joins as
// "yourGurucell"). Disabled here for the same reason.
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@", textNodeName: "#text", trimValues: false, isArray: (name) => ["row", "c", "si", "font", "fill", "xf", "sheet"].includes(name) });
const attr = (value: unknown, key: string) => (value && typeof value === "object" ? String((value as Record<string, unknown>)[`@${key}`] ?? "") : "");
const text = (value: unknown): string => { if (value == null) return ""; if (typeof value === "string" || typeof value === "number") return String(value); if (Array.isArray(value)) return value.map(text).join(""); if (typeof value === "object") return text((value as Record<string, unknown>)["#text"]); return "" };

export function validateWorkingSheetFile(file: { name: string; type: string; size: number }) {
  const errors: string[] = [];
  const lower = file.name.toLowerCase();
  if (!lower.endsWith(".xlsx") || lower.endsWith(".xlsm")) errors.push("Upload a Microsoft Excel .xlsx file only.");
  if (file.type && file.type !== "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") errors.push("The file MIME type is not a valid XLSX spreadsheet.");
  if (file.size <= 0 || file.size > MAX_XLSX_BYTES) errors.push("Working matter XLSX must be between 1 byte and 10 MB.");
  return errors;
}

export function parseWorkingSheetXlsx(bytes: Uint8Array, language: "English" | "Hindi"): WorkingSheetSnapshot {
  if (bytes.byteLength > MAX_XLSX_BYTES) throw new Error("Working matter XLSX exceeds 10 MB.");
  let expanded = 0;
  const files = unzipSync(bytes, { filter: (file) => { if (file.name.includes("..") || file.name.startsWith("/") || file.name.includes("\\")) throw new Error("XLSX contains an unsafe package path."); expanded += file.originalSize; if (expanded > MAX_UNCOMPRESSED_BYTES) throw new Error("XLSX expands beyond the safe 40 MB limit."); return true } });
  const names = Object.keys(files);
  if (!files["[Content_Types].xml"] || !files["xl/workbook.xml"]) throw new Error("Malformed XLSX: required workbook parts are missing.");
  if (names.some((name) => /(?:vbaProject\.bin|activeX|oleObject|\.exe$|\.dll$|\.js$)/iu.test(name))) throw new Error("XLSX contains executable or embedded content that is not allowed.");
  const decoder = new TextDecoder();
  for (const name of names.filter((name) => name.endsWith(".rels"))) if (/TargetMode\s*=\s*["']External["']/iu.test(decoder.decode(files[name]))) throw new Error("XLSX contains unsafe external relationships.");

  const sheetNames = names.filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name)).sort();
  if (!sheetNames.length) throw new Error("XLSX contains no worksheets.");
  const sheetXml = parser.parse(decoder.decode(files[sheetNames[0]]));
  const sharedStrings: string[] = files["xl/sharedStrings.xml"] ? (() => { const parsed = parser.parse(decoder.decode(files["xl/sharedStrings.xml"])); const items = parsed?.sst?.si ?? []; return (Array.isArray(items) ? items : [items]).map((item: Record<string, unknown>) => text(item?.t ?? item?.r ?? item)) })() : [];
  const styles = files["xl/styles.xml"] ? parseStyles(decoder.decode(files["xl/styles.xml"])) : { boldByXf: [] as boolean[], italicByXf: [] as boolean[], fillByXf: [] as (string | null)[], numberFormatByXf: [] as SheetCell["numberFormat"][] };

  const rows = sheetXml?.worksheet?.sheetData?.row ?? [];
  const cells: Record<string, SheetCell> = {};
  let maxRow = 1, maxCol = 0;
  for (const row of Array.isArray(rows) ? rows : [rows]) {
    for (const cell of (Array.isArray(row?.c) ? row.c : row?.c ? [row.c] : [])) {
      const ref = attr(cell, "r");
      const parsedRef = ref.match(/^([A-Z]{1,2})([0-9]{1,3})$/i);
      if (!parsedRef) continue;
      const rowNumber = Number(parsedRef[2]), colIndex = columnIndex(parsedRef[1]);
      if (rowNumber > MAX_ROWS || colIndex >= MAX_COLS) continue;
      maxRow = Math.max(maxRow, rowNumber); maxCol = Math.max(maxCol, colIndex + 1);
      const type = attr(cell, "t");
      const rawValue = text(cell?.v);
      const formulaText = cell?.f !== undefined ? text(cell.f).slice(0, 200) : null;
      let value: string | number | null = null;
      if (type === "s") value = sharedStrings[Number(rawValue)] ?? "";
      else if (type === "str" || type === "inlineStr") value = rawValue;
      else if (rawValue !== "") value = Number(rawValue);
      const styleIndex = Number(attr(cell, "s") || 0);
      cells[`${parsedRef[1].toUpperCase()}${rowNumber}`] = {
        value: typeof value === "string" ? value.slice(0, 1000) : value,
        formula: formulaText ? `=${formulaText.replace(/^=/, "")}` : null,
        bold: styles.boldByXf[styleIndex] ?? false,
        italic: styles.italicByXf[styleIndex] ?? false,
        underline: false,
        fontColor: null,
        fillColor: styles.fillByXf[styleIndex] ?? null,
        border: null,
        numberFormat: styles.numberFormatByXf[styleIndex] ?? "General",
        align: typeof value === "number" ? "right" : "left",
      };
    }
  }
  if (!Object.keys(cells).length) throw new Error("XLSX contains no supported cell data.");
  return { schemaVersion: 1, language, rows: Math.min(Math.max(maxRow, 1), MAX_ROWS), cols: Math.min(Math.max(maxCol, 1), MAX_COLS), cells };
}

function parseStyles(xml: string) {
  const parsed = parser.parse(xml);
  const fonts = (parsed?.styleSheet?.fonts?.font ?? []) as Record<string, unknown>[];
  const fills = (parsed?.styleSheet?.fills?.fill ?? []) as Record<string, unknown>[];
  const cellXfs = (parsed?.styleSheet?.cellXfs?.xf ?? []) as Record<string, unknown>[];
  const boldByXf = cellXfs.map((xf) => Boolean(fonts[Number(attr(xf, "fontId"))]?.b !== undefined));
  const italicByXf = cellXfs.map((xf) => Boolean(fonts[Number(attr(xf, "fontId"))]?.i !== undefined));
  const fillByXf = cellXfs.map((xf) => { const fill = fills[Number(attr(xf, "fillId"))] as Record<string, unknown> | undefined; const rgb = attr((fill?.patternFill as Record<string, unknown>)?.fgColor, "rgb"); return rgb && /^[0-9A-Fa-f]{8}$/.test(rgb) ? rgb.slice(2).toUpperCase() : null });
  const numberFormatByXf = cellXfs.map((xf) => { const id = Number(attr(xf, "numFmtId") || 0); if (id === 0) return "General" as const; if ([9, 10].includes(id)) return "Percentage" as const; if ([164, 165, 166, 167, 44].includes(id) || id >= 37 && id <= 44) return "Currency" as const; return "Number" as const });
  return { boldByXf, italicByXf, fillByXf, numberFormatByXf };
}

export function cloneWorkingSheetSnapshot(snapshot: WorkingSheetSnapshot): WorkingSheetSnapshot {
  return structuredClone(snapshot);
}
export { columnLetters };
