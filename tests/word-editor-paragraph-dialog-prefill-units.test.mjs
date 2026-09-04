import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const EDITOR = "app/typing/word-efficiency/[language]/[testId]/workspace/rich-document-editor.tsx";

// Real reported bug, traced live in the browser: reopening the Paragraph
// dialog on a paragraph whose margin was stored in "pt" (leftover data
// from before this app's own collapsed-cursor selection fix -- see
// word-editor-dom.ts's selectedEditorBlocks) showed the raw pt number as
// if it were already inches (88.56pt displayed as "88.56 in" instead of
// the correct 1.23 in). Fixed by routing the dialog's prefill through
// parseInches() (lib/word-editor-dom.ts), the same unit-aware parser
// adjustParagraphIndent already used, instead of a bare
// Number.parseFloat() that silently ignores the unit -- the exact same
// bug class already fixed once for font size (px taken literally as pt).
test("the Paragraph dialog's Left/Right indent and special-indent prefill use parseInches, not a bare parseFloat that ignores the stored unit", async () => {
  const editor = await read(EDITOR);
  assert.match(editor, /import \{ adjustParagraphIndent, changeEditorRangeCase, clearEditorRangeFormatting, parseInches, selectedEditorBlocks, snapshotPaintStyle, wrapEditorRange, type EditorRunStyles \} from "@\/lib\/word-editor-dom";/);
  const body = editor.slice(editor.indexOf('paragraphDialog:()=>{'), editor.indexOf('};map[id]?.();'));
  assert.match(body, /marginLeft:String\(block\?Math\.abs\(parseInches\(block\.style\.marginLeft\)\):0\)/);
  assert.match(body, /marginRight:String\(block\?Math\.abs\(parseInches\(block\.style\.marginRight\)\):0\)/);
  assert.match(body, /specialIndentAmount:block\?\.dataset\.specialIndentAmount\?String\(Math\.abs\(parseInches\(block\.dataset\.specialIndentAmount\)\)\):"0\.5"/);
  assert.doesNotMatch(body, /Number\.parseFloat\(block\.style\.marginLeft\)/);
  assert.doesNotMatch(body, /Number\.parseFloat\(block\.style\.marginRight\)/);
  // Space before/after are genuinely stored (and expected by the dialog)
  // in points, not inches -- these must keep using a plain parseFloat,
  // not parseInches, or they'd be silently divided by 72.
  assert.match(body, /spaceBefore:String\(block\?Math\.abs\(Number\.parseFloat\(block\.style\.marginTop\)\)\|\|0:0\)/);
  assert.match(body, /spaceAfter:String\(block\?Math\.abs\(Number\.parseFloat\(block\.style\.marginBottom\)\)\|\|0:8\)/);
});
