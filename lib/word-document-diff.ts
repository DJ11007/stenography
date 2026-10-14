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
  /** Text changes only: true when the new text differs from the old one in letter case alone (a Change Case question). */
  caseOnly?: boolean;
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
function runText(run: JsonRecord): string {
  return typeof run.text === "string" ? run.text : "";
}
function paragraphText(block: WordBlock): string {
  return runsOf(block).map(runText).join("");
}
// The runs that carry visible text, in order. Grading reads "the k-th run
// that has text" (word_efficiency_grading_target_matches_at), so detected
// run targets use that same numbering instead of the raw array index -- an
// empty run the editor leaves behind must not shift which run is meant.
function textRuns(block: WordBlock): JsonRecord[] {
  return runsOf(block).filter((run) => runText(run).trim() !== "");
}

/** A paragraph or list item with no visible text. */
export function isBlankParagraph(block: unknown): boolean {
  if (!isObject(block)) return false;
  const type = block.type ?? "paragraph";
  if (type !== "paragraph" && type !== "list-item") return false;
  return paragraphText(block as WordBlock).trim() === "";
}

// Real reported bug: an admin's saved Model Answer had four stray empty
// paragraphs the editor had created (16 blocks against the student paper's
// 12), and line spacing/indents meant for paragraph 1 sat on one of them. Every
// grading rule addresses a paragraph by position, so each stray line shifted
// what "paragraph 6" meant and the model answer failed its own rules on every
// question. Grading positions therefore count text-bearing paragraphs only:
// the Model Answer is saved without blank paragraphs, the diff below compares
// documents with them removed, and the server maps a rule's position to the
// same text-bearing paragraph in each student's document.
export function stripBlankParagraphs<T>(document: T): T {
  if (!isObject(document) || !Array.isArray(document.blocks)) return document;
  return { ...document, blocks: document.blocks.filter((block) => !isBlankParagraph(block)) } as T;
}

// Reads a detected-change target from a document the way the server grades
// it: run text means the whole paragraph's text, and runs.k.<field> means the
// k-th run that has text.
export function wordTargetValue(document: unknown, target: string): unknown {
  const parts = target.split(".");
  if (parts[0] === "pageLayout") {
    let value: unknown = isObject(document) ? document.pageLayout : undefined;
    for (const part of parts.slice(1)) value = isObject(value) ? value[part] : undefined;
    return value ?? null;
  }
  if (parts[0] !== "blocks" || !/^[0-9]+$/.test(parts[1] ?? "")) return undefined;
  const block = blocksOf(document)[Number(parts[1])];
  if (!block) return undefined;
  if (parts.length === 5 && parts[2] === "runs" && /^[0-9]+$/.test(parts[3])) {
    if (parts[4] === "text") return paragraphText(block);
    const run = textRuns(block)[Number(parts[3])];
    return run ? normalizedRunField(run, parts[4]) : undefined;
  }
  let value: unknown = block;
  for (const part of parts.slice(2)) {
    if (Array.isArray(value)) value = value[Number(part)];
    else value = isObject(value) ? value[part] : undefined;
  }
  return value ?? null;
}

const RUN_FIELDS = ["text", "bold", "italic", "underline", "underlineStyle", "underlineColor", "underlineThickness", "underlineWordsOnly", "strike", "doubleStrike", "superscript", "subscript", "smallCaps", "allCaps", "hidden", "outline", "emboss", "fontFamily", "fontSize", "color", "highlight", "field", "charScale", "charSpacing", "charPosition", "kerningEnabled", "kerningMin"] as const;
// Newer optional boolean run fields (smallCaps/allCaps/hidden, added after
// doubleStrike) can be absent on one side of a diff -- e.g. a document
// captured before these fields existed, or any snapshot that simply never
// set them -- without that meaning anything actually changed. Missing is
// the same as "off" for every one of these, exactly like the schema
// validator already treats them (optional, type-checked only when
// present), so the diff must use the same default before comparing, or it
// reports a false "changed to undefined" for every single run.
const BOOLEAN_RUN_FIELDS = new Set(["bold", "italic", "underline", "underlineWordsOnly", "strike", "doubleStrike", "superscript", "subscript", "smallCaps", "allCaps", "hidden", "outline", "emboss", "kerningEnabled"]);
function normalizedRunField(run: JsonRecord, field: string): unknown {
  const value = run[field];
  return BOOLEAN_RUN_FIELDS.has(field) ? Boolean(value) : (value ?? null);
}
const PARAGRAPH_ATTR_FIELDS = ["marginLeft", "marginRight", "marginTop", "marginBottom", "lineHeight", "backgroundColor", "border", "hyphens", "lineNumbers", "dropCap", "dropCapLines", "dropCapDistance", "dropCapMargin", "listStyle", "specialIndentMode", "specialIndentAmount"] as const;
const TABLE_ATTR_FIELDS = ["tableLayout"] as const;
const PAGE_LAYOUT_FIELDS = ["padding", "maxWidth", "aspectRatio", "columnCount", "backgroundColor", "border", "watermark"] as const;

function fieldLabel(field: string): string {
  const labels: Record<string, string> = {
    text: "text", bold: "bold", italic: "italic", underline: "underline", underlineStyle: "underline style", underlineColor: "underline color", underlineThickness: "underline thickness", underlineWordsOnly: "underline words only", strike: "strikethrough", doubleStrike: "double strikethrough",
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
  // Target paths address the block by its ARRAY INDEX (position - 1), not
  // its `id` field. Block ids are assigned fresh on every toSnapshot() call
  // ("block-0", "block-1", ... by position at THAT render) or inherited
  // from the pristine working-matter render ("matter-p-1", ...) -- neither
  // is stable across sessions: the admin's authoring document and a
  // student's independently-submitted document almost never share the same
  // id for "paragraph 6", even when the content is byte-for-byte identical.
  // A grading rule stored with an id-based target (blocks.block-5.runs.0.bold)
  // therefore matched essentially nothing in any real student submission --
  // every criterion silently evaluated to "block not found", so every
  // attempt scored 0 regardless of what was actually typed or formatted.
  // Confirmed live: every submitted attempt against a version graded this
  // way showed 0/50. Position is stable as long as the student doesn't
  // insert/delete whole paragraphs, which is the same assumption
  // diffWordDocuments already makes elsewhere (before/after compared
  // strictly by array index).
  const index = position - 1;
  if (!equalValue(before.alignment, after.alignment)) {
    changes.push({ target: `blocks.${index}.alignment`, expectedValue: after.alignment, label: `Paragraph ${position}: alignment changed to ${String(after.alignment)}`, blockPosition: position });
  }
  const beforeAttrs = isObject(before.attrs) ? before.attrs : {};
  const afterAttrs = isObject(after.attrs) ? after.attrs : {};
  if (Array.isArray(afterAttrs.rows) && Array.isArray(beforeAttrs.rows)) {
    for (const field of TABLE_ATTR_FIELDS) {
      if (!(field in beforeAttrs) && !(field in afterAttrs)) continue;
      if (!equalValue(beforeAttrs[field], afterAttrs[field])) changes.push({ target: `blocks.${index}.attrs.${field}`, expectedValue: afterAttrs[field] ?? null, label: `Paragraph ${position} (table): ${fieldLabel(field)} changed to ${String(afterAttrs[field])}`, blockPosition: position });
    }
    const beforeRows = beforeAttrs.rows as unknown[][];
    const afterRows = afterAttrs.rows as unknown[][];
    if (beforeRows.length === afterRows.length && beforeRows.every((row, rowIdx) => Array.isArray(row) && Array.isArray(afterRows[rowIdx]) && row.length === (afterRows[rowIdx] as unknown[]).length)) {
      afterRows.forEach((row, rowIndex) => {
        (row as unknown[]).forEach((cell, colIndex) => {
          const beforeCell = beforeRows[rowIndex][colIndex];
          if (!equalValue(beforeCell, cell)) changes.push({ target: `blocks.${index}.attrs.rows.${rowIndex}.${colIndex}`, expectedValue: cell, label: `Paragraph ${position} (table), row ${rowIndex + 1} column ${colIndex + 1}: text changed to "${String(cell)}"`, blockPosition: position });
        });
      });
      return;
    }
    // Row/column count changed -- too structural to diff cell-by-cell reliably; report the whole table.
    if (!equalValue(beforeRows, afterRows)) changes.push({ target: `blocks.${index}.attrs.rows`, expectedValue: afterRows, label: `Paragraph ${position} (table): the table's rows or columns changed`, blockPosition: position });
    return;
  }
  for (const field of PARAGRAPH_ATTR_FIELDS) {
    if (!(field in beforeAttrs) && !(field in afterAttrs)) continue;
    // A field the editor simply stopped writing is serialization noise, not
    // something the admin did, and "0pt" against an absent margin is the same
    // indent. Either used to become a criterion no student could reliably
    // reproduce ("marginLeft must be null").
    if (afterAttrs[field] == null) continue;
    if (isZeroAttr(beforeAttrs[field]) && isZeroAttr(afterAttrs[field])) continue;
    if (!equalValue(beforeAttrs[field], afterAttrs[field])) changes.push({ target: `blocks.${index}.attrs.${field}`, expectedValue: afterAttrs[field] ?? null, label: `Paragraph ${position}: ${fieldLabel(field)} changed to ${String(afterAttrs[field])}`, blockPosition: position });
  }
  const beforeText = paragraphText(before);
  const afterText = paragraphText(after);
  if (beforeText !== afterText) {
    // One criterion per paragraph, on its whole text: grading compares the
    // joined text of every run, so how the editor happened to split the
    // paragraph into runs never matters.
    changes.push({ target: `blocks.${index}.runs.0.text`, expectedValue: afterText, label: `Paragraph ${position}: text changed to "${afterText}"`, blockPosition: position, caseOnly: beforeText.toLowerCase() === afterText.toLowerCase() });
  }
  // Formatting is compared run by run among the runs that carry text. When
  // the run count changed (formatting only part of a paragraph, e.g. its
  // first line, splits it), each new run is compared with the formatting the
  // paragraph had before -- its first text run -- so "run 0 is highlighted"
  // is still a precise, checkable criterion instead of one opaque
  // whole-paragraph value no student could match character for character.
  const beforeRuns = textRuns(before);
  const afterRuns = textRuns(after);
  const sameShape = beforeRuns.length === afterRuns.length;
  afterRuns.forEach((run, runIndex) => {
    const beforeRun = (sameShape ? beforeRuns[runIndex] : beforeRuns[0]) ?? {};
    // A paragraph is frequently more than one run (e.g. bolding only part of
    // a sentence), so two different runs in the same paragraph can easily
    // pick up the exact same field change (both set to font size 16, say).
    // Without a text snippet those show up as identical-looking rows in the
    // Model Answer diff panel -- they're genuinely separate grading targets,
    // not a duplicate, so the label needs to say which text each one is.
    const text = runText(run).trim();
    const snippet = text ? ` ("${text.length > 24 ? `${text.slice(0, 24)}…` : text}")` : "";
    for (const field of RUN_FIELDS) {
      if (field === "text") continue;
      const beforeValue = normalizedRunField(beforeRun, field);
      const afterValue = normalizedRunField(run, field);
      if (!equalValue(beforeValue, afterValue)) {
        changes.push({ target: `blocks.${index}.runs.${runIndex}.${field}`, expectedValue: afterValue, label: `Paragraph ${position}${snippet}: ${fieldLabel(field)} changed to ${String(afterValue)}`, blockPosition: position });
      }
    }
  });
}

function isZeroAttr(value: unknown): boolean {
  return value == null || value === "" || value === 0 || value === "0" || value === "0pt" || value === "0in" || value === "0px";
}

/** Compares two schema-2 Word editor documents (or a schema-1 Working
 * Matter promoted to that shape) and returns every leaf-level change found
 * in `after` relative to `before`, in document order. */
export function diffWordDocuments(before: unknown, after: unknown): WordDetectedChange[] {
  // Paragraphs are paired by their place among text-bearing paragraphs, never
  // by id: ids are "block-<position>" at the moment a snapshot was taken (or
  // "matter-p-<n>" in the pristine render), so a single stray blank line --
  // or a checkpoint and a save rendered by different code paths -- used to
  // pair every later paragraph with the wrong one and report dozens of
  // unrelated "changes" (one real question carried 52 criteria).
  const beforeBlocks = blocksOf(stripBlankParagraphs(before));
  const afterBlocks = blocksOf(stripBlankParagraphs(after));
  const changes: WordDetectedChange[] = [];
  afterBlocks.forEach((block, index) => {
    const beforeBlock = beforeBlocks[index];
    const position = index + 1;
    if (!beforeBlock) {
      changes.push({ target: `blocks.${index}.runs.0.text`, expectedValue: paragraphText(block), label: `Paragraph ${position}: a new paragraph or element was added here`, blockPosition: position });
      return;
    }
    if (beforeBlock.type !== block.type) {
      // Same position-based path as every other target (this used to embed
      // the block's id -- "blocks.block-10.type" -- which the server can't
      // resolve, so list-numbering questions could never be awarded). The
      // rest of the block (list style, formatting) is still compared below.
      changes.push({ target: `blocks.${index}.type`, expectedValue: block.type ?? null, label: `Paragraph ${position}: element type changed to ${String(block.type)}`, blockPosition: position });
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

// What a question's own edit changed: the target, the value it had right
// after that question was saved, and (text only) whether the edit was a
// letter-case change.
export type ModelAnswerCriterion = { target: string; savedValue: unknown; caseOnly?: boolean };

// Real reported bug: each question's rule used to freeze the values present
// at the moment it was saved, so a later question that edited the same
// paragraph (Q3 capitalising paragraph six after Q1 bolded it, or a
// Find & Replace touching every paragraph) left the earlier rule expecting
// text the finished paper no longer had -- the Model Answer failed its own
// rules on all 13 questions of a real test. A question's saved edit now only
// decides WHICH targets it is graded on; the expected values are read from
// the finished Model Answer every time any question is saved, so the order the
// admin solved the paper in doesn't matter. The value at save time stays
// accepted too, so a student who did this question but skipped a later one
// that edits the same text isn't penalised for it, and a text check from a
// question that changed wording (not letter case) ignores case, so another
// question's Change Case doesn't cost it either.
export function modelAnswerRuleCriteria(finalDocument: unknown, criteria: ModelAnswerCriterion[]) {
  return criteria.flatMap((criterion) => {
    const finalValue = wordTargetValue(finalDocument, criterion.target);
    if (finalValue === undefined) return [];
    const isText = criterion.target.endsWith(".text");
    const alternatives = criterion.savedValue !== undefined && JSON.stringify(criterion.savedValue) !== JSON.stringify(finalValue) ? [criterion.savedValue] : [];
    return [{ target: criterion.target, expectedValue: finalValue, alternatives, ignoreCase: isText && !criterion.caseOnly }];
  });
}
