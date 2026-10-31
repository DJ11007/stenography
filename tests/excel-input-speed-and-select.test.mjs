import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = async (path) => (await readFile(new URL(`../${path}`, import.meta.url), "utf8")).replace(/\r\n/g, "\n");
const sheet = () => read("app/typing/excel-efficiency/[language]/[testId]/workspace/rich-sheet-editor.tsx");

test("clicking the Name Box or the Font Size box selects its text, as in Excel", async () => {
  const source = await sheet();
  assert.match(source, /onFocus: \(event: React\.FocusEvent<HTMLInputElement>\) => \{ event\.currentTarget\.select\(\);/);
  assert.match(source, /<input aria-label="Name Box" value=\{nameBox \?\? nameBoxValue\} onFocus=\{\(event\) => \{ setNameBox\(nameBoxValue\); selectAllOnFocus\.onFocus\(event\); \}\} onMouseUp=\{selectAllOnFocus\.onMouseUp\}/);
  assert.match(source, /<input aria-label="Font Size" disabled=\{disabled\} value=\{text \?\? String\(value\)\} \{\.\.\.selectAllOnFocus\}/);
});

test("typed text lives in a small store, so a keystroke redraws only the cell editor and the formula bar, not the grid", async () => {
  const source = await sheet();
  assert.match(source, /const \[editing, setEditing\] = useState<\{ ref: string; fromBar: boolean \} \| null>\(null\);/);
  assert.match(source, /const \[editText\] = useState\(createTextStore\);/);
  assert.match(source, /<StoreInput inputRef=\{editInputRef\} store=\{editText\} live fallback="" aria-label=\{`Edit \$\{ref\}`\} onText=\{\(value\) => editText\.set\(value\)\}/);
  assert.match(source, /<StoreInput inputRef=\{formulaBarRef\} store=\{editText\} live=\{Boolean\(editing\)\} fallback=\{formulaBarValue\} aria-label="Formula bar"/);
  assert.match(source, /const text = closeBrackets\(editText\.get\(\)\);/);
  assert.doesNotMatch(source, /editing\.value/);
});

test("Escape drops the typed text instead of saving it on the blur that follows", async () => {
  const source = await sheet();
  assert.match(source, /const cancelEdit = \(\) => \{ cancelled\.current = true; setEditing\(null\); focusGrid\(\); cancelled\.current = false; \};/);
  assert.match(source, /if \(!editing \|\| cancelled\.current\) return;/);
  assert.equal(source.match(/event\.key === "Escape"\) cancelEdit\(\);/g)?.length, 2);
});

test("Save answer saves the sheet and the question's rules at the same time, without re-rendering the page", async () => {
  const model = await read("app/admin/excel-efficiency-tests/[testId]/model-answer/model-answer-editor.tsx");
  assert.match(model, /const \[saved, result\] = await Promise\.all\(\[\n\s+saveExcelEfficiencyModelAnswer\(versionId, document\),\n\s+activeNumber !== null && rules\.length \? saveExcelEfficiencyQuestionRules\(versionId, activeNumber, rules\)/);
  const actions = await read("app/admin/excel-efficiency-tests/actions.ts");
  const rulesAction = actions.slice(actions.indexOf("export async function saveExcelEfficiencyQuestionRules"), actions.indexOf("export async function resetExcelEfficiencyModelAnswer"));
  assert.doesNotMatch(rulesAction, /revalidatePath\(/);
});
