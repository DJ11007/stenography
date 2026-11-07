import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const dir = "app/typing/excel-efficiency/[language]/[testId]/workspace";
const read = (path) => readFileSync(path, "utf8");

// EXCEL TEST 3 (7 Nov): Q6 coloured A55:A59, then Q9's Format Cells (Left) on A1:L60 put A1's "Automatic" font
// colour on all 720 cells and wiped Q6. As in Excel, OK applies only what was changed in the dialog.
test("Format Cells applies only the properties changed in the dialog", () => {
  const dialog = read(`${dir}/format-cells-dialog.tsx`);
  assert.match(dialog, /const \[initialValues\] = useState/);
  assert.match(dialog, /const before = buildPatch\(initialValues\)/);
  assert.match(dialog, /JSON\.stringify\(full\[key\]\) !== JSON\.stringify\(before\[key\]\)/);
  assert.match(dialog, /\["numberFormat", "decimals", "currency"\], \["bold", "italic"\], \["underline", "underlineStyle"\]/);
  assert.doesNotMatch(dialog, /patch: \{\s*numberFormat:/);
});

// The exam clock ticked twice a second (4 times on the Live Exam page) and every tick redrew the whole grid;
// each autosave redrew it twice more for "Saving…" / "Saved". Typing and clicking lagged behind those redraws.
test("the clock, the Live Exam page and the autosave line do not redraw the sheet", () => {
  const workspace = read(`${dir}/excel-workspace.tsx`);
  assert.match(workspace, /<ExamClock remainingSeconds=\{remainingSeconds\} onExpire=\{onExpire\}/);
  assert.doesNotMatch(workspace, /useExamCountdown/);
  assert.match(workspace, /const questionBar = useMemo\(/);
  assert.match(workspace, /const afterSubmit = useCallback\(/);
  const editor = read(`${dir}/rich-sheet-editor.tsx`);
  assert.match(editor, /export const RichSheetEditor = memo\(function RichSheetEditor\(/);
  assert.match(editor, /const setStatus = statusStore\.set;/);
  assert.doesNotMatch(editor, /useState\("Ready"\)/);
  assert.match(read("components/efficiency/exam-chrome.tsx"), /export function ExamClock\(/);
});
