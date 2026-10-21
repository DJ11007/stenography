import type { MatterParagraph, MatterRun, MatterTextParagraph, WorkingMatterSnapshot } from "./word-docx";
import { APPROVED_WORD_FONTS } from "./word-editor-capabilities.ts";

// The admin now DESIGNS the working document in the exam editor itself (instead of uploading a
// .docx that has to be parsed). This turns that editor's document (what the editor's own
// snapshot call returns: { schemaVersion: "2", blocks: [...] }) into the plain "working matter"
// format the rest of the system already stores, validates in the database and gives students.
// Everything not representable in that format is dropped and reported as a warning.

export type MatterConversion = { ok: true; matter: WorkingMatterSnapshot } | { ok: false; error: string };

// Every font the editor offers is kept. This used to be four fonts (Arial, Calibri, Times New Roman,
// Mangal): a Hindi document typed in Kruti Dev 010 lost its font on "Save & return" and students
// saw the Kruti Dev keys (ukyank gekjs ...) instead of Hindi (EFFICIENCY TEST 4).
const APPROVED_MATTER_FONTS = new Set<string>(APPROVED_WORD_FONTS);
const DEFAULT_TEXT_COLORS = new Set(["000000", "020618"]);
const MAX_PARAGRAPHS = 550, MAX_TEXT_PARAGRAPH_NUMBER = 500;

type EditorRun = Record<string, unknown>;
type EditorBlock = { type?: unknown; alignment?: unknown; runs?: unknown; attrs?: Record<string, unknown> };

const asString = (value: unknown) => (typeof value === "string" ? value : "");
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function inches(raw: unknown): number {
  const match = asString(raw).trim().match(/^(-?\d+(?:\.\d+)?)\s*(in|pt|px|cm|mm)?$/i);
  if (!match) return 0;
  const amount = Number(match[1]), unit = (match[2] ?? "in").toLowerCase();
  const value = unit === "pt" ? amount / 72 : unit === "px" ? amount / 96 : unit === "cm" ? amount / 2.54 : unit === "mm" ? amount / 25.4 : amount;
  return clamp(Math.round(value * 1000) / 1000, 0, 10);
}
function points(raw: unknown): number {
  const match = asString(raw).trim().match(/^(-?\d+(?:\.\d+)?)\s*(pt|px|in)?$/i);
  if (!match) return 0;
  const amount = Number(match[1]), unit = (match[2] ?? "pt").toLowerCase();
  const value = unit === "px" ? amount * 0.75 : unit === "in" ? amount * 72 : amount;
  return clamp(Math.round(value * 10) / 10, 0, 500);
}
function lineSpacing(raw: unknown): number {
  const number = Number(asString(raw).trim());
  return Number.isFinite(number) && number > 0 ? clamp(Math.round(number * 100) / 100, 0.5, 5) : 1;
}
function hex(raw: unknown): string | null {
  const value = asString(raw).replace(/^#/, "").trim();
  return /^[0-9a-f]{6}$/i.test(value) ? value.toUpperCase() : null;
}

// Things the editor can do that the working-matter format cannot store. They are dropped, but the
// admin is told exactly which ones, so nothing disappears silently.
function noteLostRunFeatures(run: EditorRun, lost: Set<string>) {
  if (run.superscript === true) lost.add("superscript");
  if (run.subscript === true) lost.add("subscript");
  if (run.smallCaps === true) lost.add("small caps");
  if (run.allCaps === true) lost.add("all caps");
  if (run.hidden === true) lost.add("hidden text");
  if (run.outline === true) lost.add("outline text");
  if (run.emboss === true) lost.add("emboss text");
  if (run.doubleStrike === true) lost.add("double strikethrough (kept as a single strikethrough)");
  if (Number(run.charScale) && Number(run.charScale) !== 100) lost.add("character scale");
  if (Number(run.charSpacing)) lost.add("character spacing");
  if (Number(run.charPosition)) lost.add("raised/lowered text");
}
function noteLostBlockFeatures(attrs: Record<string, unknown>, lost: Set<string>) {
  if (asString(attrs.specialIndentMode) && attrs.specialIndentMode !== "none") lost.add("first-line / hanging indents");
  if (attrs.border) lost.add("paragraph borders");
  if (attrs.backgroundColor) lost.add("paragraph shading");
  if (attrs.hyphens) lost.add("hyphenation");
}

function convertRun(run: EditorRun): MatterRun {
  const family = asString(run.fontFamily).replace(/ \((?:Headings|Body)\)$/u, "");
  const size = Number(run.fontSize);
  const color = hex(run.color);
  return {
    // Line breaks inside a text piece come from pasted HTML (the line-wrapping of the source); the page
    // shows them as spaces, so they are stored as spaces.
    text: asString(run.text).normalize("NFC").replace(/[ \t]*[\r\n]+[ \t]*/gu, " ").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/gu, "").slice(0, 200000),
    bold: run.bold === true,
    italic: run.italic === true,
    underline: run.underline === true,
    strike: run.strike === true || run.doubleStrike === true,
    fontFamily: APPROVED_MATTER_FONTS.has(family) ? family : null,
    fontSize: Number.isFinite(size) && size >= 4 && size <= 200 ? size : null,
    color: color && !DEFAULT_TEXT_COLORS.has(color) ? color : null,
    highlight: hex(run.highlight),
  };
}

const sameFormat = (a: MatterRun, b: MatterRun) => a.bold === b.bold && a.italic === b.italic && a.underline === b.underline && a.strike === b.strike && a.fontFamily === b.fontFamily && a.fontSize === b.fontSize && a.color === b.color && a.highlight === b.highlight;

function mergeRuns(runs: MatterRun[]): MatterRun[] {
  const merged: MatterRun[] = [];
  for (const run of runs) {
    if (!run.text) continue;
    const last = merged[merged.length - 1];
    if (last && sameFormat(last, run)) last.text += run.text;
    else merged.push({ ...run });
  }
  return merged.length ? merged : [{ ...(runs[0] ?? { text: "", bold: false, italic: false, underline: false, strike: false, fontFamily: null, fontSize: null, color: null, highlight: null }), text: "" }];
}

export type MatterConversionOptions = { defaultSpaceAfter?: number; defaultLineSpacing?: number };

export function editorDocumentToMatter(document: unknown, language: "English" | "Hindi", options: MatterConversionOptions = {}): MatterConversion {
  const blocks = (document as { blocks?: unknown } | null)?.blocks;
  if (!Array.isArray(blocks) || !blocks.length) return { ok: false, error: "The document is empty. Type the working matter into the designer first." };
  const warnings: string[] = [];
  const paragraphs: MatterParagraph[] = [];
  let paragraphNumber = 0, listCounter = 0, previousWasList = false;
  let dropped = 0;
  const lost = new Set<string>();
  for (const raw of blocks as EditorBlock[]) {
    const type = asString(raw?.type) || "paragraph";
    const id = `matter-p-${paragraphs.length + 1}`;
    if (type === "table") {
      const rawRows = (Array.isArray(raw.attrs?.rows) ? raw.attrs!.rows as unknown[] : []).slice(0, 50).map(row => (Array.isArray(row) ? row : []).slice(0, 20));
      const keep = rawRows.map((row, index) => ({ row, index })).filter(item => item.row.length);
      const rows = keep.map(item => item.row.map(cell => asString(cell).replace(/\s+/gu, " ").trim().slice(0, 10000)));
      // Each cell's font and size (Table Tools saves them in attrs.cellFormats), so a Kruti Dev table stays Hindi.
      const formats = Array.isArray(raw.attrs?.cellFormats) ? raw.attrs!.cellFormats as unknown[] : [];
      const cell = (rowIndex: number, cellIndex: number) => { const row = formats[rowIndex]; const format = Array.isArray(row) ? row[cellIndex] as Record<string, unknown> | undefined : undefined; return format ?? {}; };
      const cellFonts = keep.map(item => item.row.map((_, c) => { const family = asString(cell(item.index, c).fontFamily).replace(/ \((?:Headings|Body)\)$/u, ""); return APPROVED_MATTER_FONTS.has(family) ? family : null; }));
      const cellSizes = keep.map(item => item.row.map((_, c) => { const size = Number(cell(item.index, c).fontSize); return Number.isFinite(size) && size >= 4 && size <= 200 ? size : null; }));
      if (rows.length) paragraphs.push({ id, type: "table", rows, ...(cellFonts.flat().some(Boolean) ? { cellFonts } : {}), ...(cellSizes.flat().some(Boolean) ? { cellSizes } : {}) });
      else dropped++;
      previousWasList = false;
      continue;
    }
    if (type !== "paragraph" && type !== "list-item") { dropped++; continue; }
    const attrs = raw.attrs ?? {};
    noteLostBlockFeatures(attrs, lost);
    for (const editorRun of Array.isArray(raw.runs) ? raw.runs as EditorRun[] : []) noteLostRunFeatures(editorRun, lost);
    const runs = mergeRuns((Array.isArray(raw.runs) ? raw.runs as EditorRun[] : []).map(convertRun));
    const alignment = (["left", "center", "right", "justify"] as const).find(item => item === raw.alignment) ?? "left";
    const isList = type === "list-item";
    if (isList && !previousWasList) listCounter++;
    previousWasList = isList;
    if (!isList) paragraphNumber++;
    const paragraph: MatterTextParagraph = {
      id, type: isList ? "list-item" : "paragraph",
      paragraphNumber: isList ? null : paragraphNumber,
      listGroup: isList ? `list-${listCounter}` : null,
      runs, alignment,
      leftIndent: inches(attrs.marginLeft), rightIndent: inches(attrs.marginRight),
      lineSpacing: attrs.lineHeight === undefined && options.defaultLineSpacing ? options.defaultLineSpacing : lineSpacing(attrs.lineHeight),
      spaceBefore: points(attrs.marginTop), spaceAfter: attrs.marginBottom === undefined && !isList && options.defaultSpaceAfter !== undefined ? options.defaultSpaceAfter : points(attrs.marginBottom),
    };
    paragraphs.push(paragraph);
  }
  if (dropped) warnings.push(`${dropped} item${dropped === 1 ? "" : "s"} (such as pictures or page breaks) cannot be part of a working document and were left out.`);
  if (lost.size) warnings.push(`Not kept (the working document cannot store these): ${[...lost].join(", ")}.`);
  if (!paragraphs.length) return { ok: false, error: "The document has no text. Type the working matter into the designer first." };
  if (paragraphs.length > MAX_PARAGRAPHS) return { ok: false, error: `The document has ${paragraphs.length} paragraphs; the limit is ${MAX_PARAGRAPHS}.` };
  if (paragraphNumber > MAX_TEXT_PARAGRAPH_NUMBER) return { ok: false, error: `The document has ${paragraphNumber} numbered paragraphs; the limit is ${MAX_TEXT_PARAGRAPH_NUMBER}.` };
  if (!paragraphs.some(item => item.type === "table" ? item.rows.flat().some(cell => cell.trim()) : item.runs.some(run => run.text.trim()))) return { ok: false, error: "The document is blank. Type the working matter into the designer first." };
  const textParagraphs = paragraphs.filter((item): item is MatterTextParagraph => item.type !== "table");
  const fonts = [...new Set(textParagraphs.flatMap(item => item.runs.map(run => run.fontFamily).filter((font): font is string => Boolean(font))))];
  return {
    ok: true,
    matter: {
      schemaVersion: "1", language, paragraphs,
      formattingSummary: {
        paragraphs: textParagraphs.length, runs: textParagraphs.reduce((sum, item) => sum + item.runs.length, 0),
        italicParagraphs: textParagraphs.filter(item => item.runs.some(run => run.italic)).length,
        justifiedParagraphs: textParagraphs.filter(item => item.alignment === "justify").length,
        listItems: textParagraphs.filter(item => item.type === "list-item").length,
        tables: paragraphs.filter(item => item.type === "table").length, fonts,
      },
      warnings,
    },
  };
}

export function blankWorkingMatter(language: "English" | "Hindi"): WorkingMatterSnapshot {
  return {
    schemaVersion: "1", language,
    paragraphs: [{ id: "matter-p-1", type: "paragraph", paragraphNumber: 1, listGroup: null, runs: [{ text: "", bold: false, italic: false, underline: false, strike: false, fontFamily: null, fontSize: null, color: null, highlight: null }], alignment: "left", leftIndent: 0, rightIndent: 0, lineSpacing: 1.15, spaceBefore: 0, spaceAfter: 8 }],
    formattingSummary: { paragraphs: 1, runs: 1, italicParagraphs: 0, justifiedParagraphs: 0, listItems: 0, tables: 0, fonts: [] },
    warnings: [],
  };
}
