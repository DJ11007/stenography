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

// The Word page had the same clock: every tick redrew the whole document editor and its ribbon.
test("the Word clock does not redraw the document editor", () => {
  const word = read("app/typing/word-efficiency/[language]/[testId]/workspace/word-workspace.tsx");
  assert.match(word, /<ExamClock remainingSeconds=\{remainingSeconds\} onExpire=\{onExpire\}/);
  assert.doesNotMatch(word, /useExamCountdown/);
  assert.match(word, /const questionBar=useMemo\(/);
  assert.match(word, /const afterSubmit=useCallback\(/);
  assert.match(read("app/typing/word-efficiency/[language]/[testId]/workspace/rich-document-editor.tsx"), /export const RichDocumentEditor = memo\(RichDocumentEditorImpl\);/);
});

// Excel 2013 (admin's screenshot, 7 Nov): Indent takes whole numbers only; 0.3 + OK shows "Integer is not valid."
// and the dialog stays open. Test 3 Q9 now asks for indent 3 and checks it.
test("Format Cells: a non-whole Indent shows Excel's 'Integer is not valid.' and applies nothing", () => {
  const dialog = read(`${dir}/format-cells-dialog.tsx`);
  assert.ok(dialog.includes('.test(indentText)) { setTab("Alignment"); setInvalidIndent(true); return; }'));
  assert.match(dialog, /<p>Integer is not valid\.<\/p>/);
  const migration = read("supabase/migrations/202611071800_excel_test3_q9_indent_3.sql");
  assert.match(migration, /"props":\{"align":\["left"\],"indent":\[3\]\}/);
  assert.match(migration, /Horizontal Left indent 3 then set it as print area/);
});

// Admin's screenshots (7 Nov): the Size list ran outside its box, and Font Color was a plain list instead of
// Excel's colour menu (Automatic / Theme Colors / Standard Colors / More Colors..., each swatch named).
test("Format Cells Font tab: lists stay in their columns and Color is Excel's colour menu", () => {
  const dialog = read(`${dir}/format-cells-dialog.tsx`);
  assert.ok(dialog.includes("grid-cols-[minmax(0,1fr)_130px_80px]"));
  assert.ok(dialog.includes("[&_select]:w-full [&_select]:min-w-0"));
  assert.ok(dialog.includes('<ExcelColorPicker label="Color" value={color} onChange={setColor} />'));
  assert.doesNotMatch(dialog, /<select aria-label="Color"/);
  const picker = read(`${dir}/excel-color-picker.tsx`);
  for (const text of ["Theme Colors", "Standard Colors", "More Colors...", "Automatic", "title={swatchName}"]) assert.ok(picker.includes(text), text);
  assert.ok(read(`${dir}/format-cells-border-tab.tsx`).includes('<ExcelColorPicker label="Line color"'));
});
