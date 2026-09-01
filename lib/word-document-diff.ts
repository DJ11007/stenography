// Powers "Model Answer" grading: an admin solves the question paper in the
// same rich document editor a student uses, and this compares their
// finished document against the original Working Matter to find every
// leaf-level change. Each detected change becomes a candidate grading
// criterion the admin can assign to a question -- so grading a question
// means "does the student's final document match these exact values",
// rather than the admin hand-typing a JSON path.
//
// Scope, stated plainly: this detects changes to an EXISTING block's
// alignment, run-level formatting (bold/italic/underline/strike/
// superscript/subscript/font/color/highlight), run text, table cell text,
// paragraph-level attrs (margins, line spacing, shading, border), and page
// layout. It does not attempt to diff a paragraph whose run count changed
// (e.g. bolding only part of a sentence splits one run into three) -- that
// whole block is reported as a single "block changed" entry instead of a
// misleading partial match. Blocks inserted or removed entirely are
// reported the same way. This covers every example in the reference
// question set (bold/italic/underline, color, alignment, indent, table
// cell edits, list item text, margins) without needing a full tree-edit
// distance algorithm.

export type WordDetectedChange = {
  /** The same target-path syntax word_efficiency_grading_target_value already resolves. */
  target: string;
  expectedValue: unknown;
  /** Human-readable, e.g. "Paragraph 6: bold changed to true". */
  label: string;
  /** 1-based position of the affected block, for grouping in the UI. */
  blockPosition: number;
};

type JsonRecord = Record<string, unknown>;
type WordBlock = JsonRecord & { id?: unknown; type?: unknown; alignment?: unknown; runs?: unknown; attrs?: unknown };

function isObject(value: unknown): value is JsonRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
function blocksOf(document: unknown): WordBlock[] {
  if (!isObject(document) || !Array.isArray(document.blocks)) return [];
  return document.blocks.filter(isObject) as WordBlock[];
}
function runsOf(block: WordBlock): JsonRecord[] {
  return Array.isArray(block.runs) ? (block.runs.filter(isObject) as JsonRecord[]) : [];
}
function equalValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

const RUN_FIELDS = ["text", "bold", "italic", "underline", "strike", "doubleStrike", "superscript", "subscript", "smallCaps", "allCaps", "hidden", "outline", "emboss", "fontFamily", "fontSize", "color", "highlight", "field", "charScale", "charSpacing", "charPosition", "kerningEnabled", "kerningMin"] as const;
// Newer optional boolean run fields (smallCaps/allCaps/hidden, added after
// doubleStrike) can be absent on one side of a diff -- e.g. a document
// captured before these fields existed, or any snapshot that simply never
// set them -- without that meaning anything actually changed. Missing is
// the same as "off" for every one of these, exactly like the schema
// validator already treats them (optional, type-checked only when
// present), so the diff must use the same default before comparing, or it
// reports a false "changed to undefined" for every single run.
const BOOLEAN_RUN_FIELDS = new Set(["bold", "italic", "underline", "strike", "doubleStrike", "superscript", "subscript", "smallCaps", "allCaps", "hidden", "outline", "emboss", "kerningEnabled"]);
function normalizedRunField(run: JsonRecord, field: string): unknown {
  const value = run[field];
  return BOOLEAN_RUN_FIELDS.has(field) ? Boolean(value) : (value ?? null);
}
const PARAGRAPH_ATTR_FIELDS = ["marginLeft", "marginRight", "marginTop", "marginBottom", "lineHeight", "backgroundColor", "border", "hyphens", "lineNumbers", "dropCap", "dropCapLines", "dropCapDistance", "dropCapMargin", "listStyle", "specialIndentMode", "specialIndentAmount"] as const;
const TABLE_ATTR_FIELDS = ["tableLayout"] as const;
const PAGE_LAYOUT_FIELDS = ["padding", "maxWidth", "aspectRatio", "columnCount", "backgroundColor", "border", "watermark"] as const;

function fieldLabel(field: string): string {
  const labels: Record<string, string> = {
    text: "text", bold: "bold", italic: "italic", underline: "underline", strike: "strikethrough", doubleStrike: "double strikethrough",
    superscript: "superscript", subscript: "subscript", smallCaps: "small caps", allCaps: "all caps", hidden: "hidden text", outline: "outline", emboss: "emboss", fontFamily: "font", fontSize: "font size", color: "text color", highlight: "highlight color", field: "inserted field",
    charScale: "character scale", charSpacing: "character spacing", charPosition: "character position", kerningEnabled: "kerning", kerningMin: "kerning minimum size",
    marginLeft: "left indent", marginRight: "right indent", marginTop: "space before", marginBottom: "space after", lineHeight: "line spacing",
    backgroundColor: "shading", border: "border", hyphens: "hyphenation", lineNumbers: "line numbers", dropCap: "drop cap", listStyle: "list style",
    specialIndentMode: "special indent", specialIndentAmount: "special indent amount", tableLayout: "table AutoFit behavior",
    dropCapLines: "drop cap lines to drop", dropCapDistance: "drop cap distance from text", dropCapMargin: "drop cap in margin",
  };
  return labels[field] ?? field;
}

function diffBlock(before: WordBlock, after: WordBlock, position: number, changes: WordDetectedChange[]) {
  const id = String(after.id ?? before.id ?? "");
  if (!equalValue(before.alignment, after.alignment)) {
    changes.push({ target: `blocks.${id}.alignment`, expectedValue: after.alignment, label: `Paragraph ${position}: alignment changed to ${String(after.alignment)}`, blockPosition: position });
  }
  const beforeAttrs = isObject(before.attrs) ? before.attrs : {};
  const afterAttrs = isObject(after.attrs) ? after.attrs : {};
  if (Array.isArray(afterAttrs.rows) && Array.isArray(beforeAttrs.rows)) {
    for (const field of TABLE_ATTR_FIELDS) {
      if (!(field in beforeAttrs) && !(field in afterAttrs)) continue;
      if (!equalValue(beforeAttrs[field], afterAttrs[field])) changes.push({ target: `blocks.${id}.attrs.${field}`, expectedValue: afterAttrs[field] ?? null, label: `Paragraph ${position} (table): ${fieldLabel(field)} changed to ${String(afterAttrs[field])}`, blockPosition: position });
    }
    const beforeRows = beforeAttrs.rows as unknown[][];
    const afterRows = afterAttrs.rows as unknown[][];
    if (beforeRows.length === afterRows.length && beforeRows.every((row, index) => Array.isArray(row) && Array.isArray(afterRows[index]) && row.length === (afterRows[index] as unknown[]).length)) {
      afterRows.forEach((row, rowIndex) => {
        (row as unknown[]).forEach((cell, colIndex) => {
          const beforeCell = beforeRows[rowIndex][colIndex];
          if (!equalValue(beforeCell, cell)) changes.push({ target: `blocks.${id}.attrs.rows.${rowIndex}.${colIndex}`, expectedValue: cell, label: `Paragraph ${position} (table), row ${rowIndex + 1} column ${colIndex + 1}: text changed to "${String(cell)}"`, blockPosition: position });
        });
      });
      return;
    }
    // Row/column count changed -- too structural to diff cell-by-cell reliably; report the whole table.
    if (!equalValue(beforeRows, afterRows)) changes.push({ target: `blocks.${id}.attrs.rows`, expectedValue: afterRows, label: `Paragraph ${position} (table): the table's rows or columns changed`, blockPosition: position });
    return;
  }
  for (const field of PARAGRAPH_ATTR_FIELDS) {
    if (!(field in beforeAttrs) && !(field in afterAttrs)) continue;
    if (!equalValue(beforeAttrs[field], afterAttrs[field])) changes.push({ target: `blocks.${id}.attrs.${field}`, expectedValue: afterAttrs[field] ?? null, label: `Paragraph ${position}: ${fieldLabel(field)} changed to ${String(afterAttrs[field])}`, blockPosition: position });
  }
  const beforeRuns = runsOf(before);
  const afterRuns = runsOf(after);
  if (beforeRuns.length !== afterRuns.length) {
    if (!equalValue(beforeRuns, afterRuns)) changes.push({ target: `blocks.${id}.runs`, expectedValue: afterRuns, label: `Paragraph ${position}: the text was restructured (a run was split or merged) -- review this paragraph manually`, blockPosition: position });
    return;
  }
  afterRuns.forEach((run, index) => {
    const beforeRun = beforeRuns[index] ?? {};
    // A paragraph is frequently more than one run (e.g. bolding only part of
    // a sentence), so two different runs in the same paragraph can easily
    // pick up the exact same field change (both set to font size 16, say).
    // Without a text snippet those show up as identical-looking rows in the
    // Model Answer diff panel -- they're genuinely separate grading targets,
    // not a duplicate, so the label needs to say which text each one is.
    const runText = typeof run.text === "string" ? run.text.trim() : "";
    const snippet = runText ? ` ("${runText.length > 24 ? `${runText.slice(0, 24)}…` : runText}")` : "";
    for (const field of RUN_FIELDS) {
      const beforeValue = normalizedRunField(beforeRun, field);
      const afterValue = normalizedRunField(run, field);
      if (!equalValue(beforeValue, afterValue)) {
        const preview = field === "text" ? `"${String(afterValue)}"` : String(afterValue);
        changes.push({ target: `blocks.${id}.runs.${index}.${field}`, expectedValue: afterValue, label: `Paragraph ${position}${field === "text" ? "" : snippet}: ${fieldLabel(field)} changed to ${preview}`, blockPosition: position });
      }
    }
  });
}

/** Compares two schema-2 Word editor documents (or a schema-1 Working
 * Matter promoted to that shape) and returns every leaf-level change found
 * in `after` relative to `before`, in document order. */
export function diffWordDocuments(before: unknown, after: unknown): WordDetectedChange[] {
  const beforeBlocks = blocksOf(before);
  const afterBlocks = blocksOf(after);
  const beforeById = new Map(beforeBlocks.map((block) => [String(block.id ?? ""), block]));
  const changes: WordDetectedChange[] = [];
  afterBlocks.forEach((block, index) => {
    const id = String(block.id ?? "");
    const beforeBlock = beforeById.get(id);
    const position = index + 1;
    if (!beforeBlock) {
      changes.push({ target: `blocks.${id}.runs`, expectedValue: block.runs ?? null, label: `Paragraph ${position}: a new paragraph or element was added here`, blockPosition: position });
      return;
    }
    if (beforeBlock.type !== block.type) {
      changes.push({ target: `blocks.${id}.type`, expectedValue: block.type ?? null, label: `Paragraph ${position}: element type changed to ${String(block.type)}`, blockPosition: position });
      return;
    }
    diffBlock(beforeBlock, block, position, changes);
  });
  const beforeLayout = isObject(before) && isObject(before.pageLayout) ? before.pageLayout : {};
  const afterLayout = isObject(after) && isObject(after.pageLayout) ? after.pageLayout : {};
  for (const field of PAGE_LAYOUT_FIELDS) {
    if (!equalValue(beforeLayout[field], afterLayout[field])) changes.push({ target: `pageLayout.${field}`, expectedValue: afterLayout[field] ?? null, label: `Page ${fieldLabel(field)} changed to ${String(afterLayout[field])}`, blockPosition: 0 });
  }
  return changes;
}
