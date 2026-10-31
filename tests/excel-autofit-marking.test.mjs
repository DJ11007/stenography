import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { diffExcelDocuments, excelQuestionRules, excelRuleGroups } from "../lib/excel-document-diff.ts";
import { toExcelDocumentV3, validateExcelDocument } from "../lib/excel-document.ts";

// EXCEL EFFICIENCY TEST 2, Q4 "Apply Autofit Row and column to complete workbook": AutoFit Row Height on
// default-height rows changed nothing in the sheet, so the Model Answer page said "No change was detected". The
// sheet now remembers the AutoFit rows / columns (migration 202610311000), and they become a markable rule.

const read = async (name) => JSON.parse(await readFile(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));
const initial = await read("excel-test1-initial.json");
const clone = (value) => JSON.parse(JSON.stringify(value));
const v3 = (doc) => toExcelDocumentV3(doc);
const rowsUpTo = (n) => Array.from({ length: n }, (_, i) => i + 1);
const letters = (n) => Array.from({ length: n }, (_, i) => String.fromCharCode(65 + i));

// The whole sheet selected (Select All) and given AutoFit Row Height and AutoFit Column Width.
function autoFitted(doc, { rows = rowsUpTo(200), cols = letters(26), widths = true } = {}) {
  const next = clone(v3(doc));
  next.sheet.autoFitRows = rows;
  next.sheet.autoFitCols = cols;
  if (widths) next.sheet.colWidths = Object.fromEntries(cols.slice(0, next.cols).map((col) => [col, 12]));
  return next;
}

test("AutoFit is a change: rows and columns become two parts, and AutoFit's own widths are not 'unsupported'", () => {
  const before = v3(initial), after = autoFitted(initial);
  const { changes, unsupported } = diffExcelDocuments(before, after);
  assert.deepEqual(changes, [{ kind: "autoFit", axis: "rows" }, { kind: "autoFit", axis: "cols" }]);
  assert.deepEqual(unsupported, []);
  const groups = excelRuleGroups(after, changes);
  assert.equal(groups.length, 2);
  // Only the used part of the sheet is asked for, not every empty row up to 200.
  assert.deepEqual(groups[0].criteria, [{ rule: "sheet", path: "autoFitRows", includesAll: rowsUpTo(after.rows) }]);
  assert.deepEqual(groups[1].criteria, [{ rule: "sheet", path: "autoFitCols", includesAll: letters(after.cols) }]);
  const rules = excelQuestionRules(2.5, groups);
  assert.deepEqual(rules.map((rule) => [rule.partLabel, rule.allocatedMarks]), [["a", 1.25], ["b", 1.25]]);
});

test("AutoFit Row Height alone (no size changed at all) is still detected", () => {
  const before = v3(initial), after = clone(before);
  after.sheet.autoFitRows = rowsUpTo(10);
  assert.deepEqual(diffExcelDocuments(before, after).changes, [{ kind: "autoFit", axis: "rows" }]);
});

test("a column width set by hand (not AutoFit) is still reported as unsupported", () => {
  const before = v3(initial), after = clone(before);
  after.sheet.colWidths = { B: 30 };
  assert.deepEqual(diffExcelDocuments(before, after), { changes: [], unsupported: ["column widths"] });
});

test("the editor records AutoFit and drops it when a size is set by hand", async () => {
  const source = (await readFile(new URL("../app/typing/excel-efficiency/[language]/[testId]/workspace/rich-sheet-editor.tsx", import.meta.url), "utf8")).replace(/\r\n/g, "\n");
  assert.match(source, /<MenuItem onClick=\{\(\) => \{ autoFitRows\(\); setMenu\(null\); \}\}>AutoFit Row Height<\/MenuItem>/);
  assert.match(source, /change\("autoFitRowHeight", \{ sheet: withAutoFit\(\{ \.\.\.sheet, rowHeights: heights \}, "autoFitRows", \[\.\.\.fitted\]\) \}\);/);
  assert.match(source, /fitted\.add\(columnLetters\(col\)\);\n\s+\}\n\s+change\("autoFitColumnWidth"/);
  assert.match(source, /fitted\.delete\(row\); if \(points === null\)/);
  assert.match(source, /fitted\.delete\(columnLetters\(col\)\); if \(width === null\)/);
});

test("the sheet check accepts AutoFit lists and refuses bad ones", () => {
  validateExcelDocument(autoFitted(initial));
  const bad = clone(autoFitted(initial)); bad.sheet.autoFitCols = ["a1"];
  assert.throws(() => validateExcelDocument(bad), /Invalid AutoFit columns/);
});

let db;
async function database() {
  if (db) return db;
  db = new PGlite();
  await db.exec(`
create schema auth;
create table auth.state(uid uuid);
create function auth.uid() returns uuid language sql stable as $$select uid from auth.state limit 1$$;
create role anon; create role authenticated; create role service_role;
create function public.is_active_word_efficiency_student() returns boolean language sql stable as $$select true$$;
create function public.is_aal2_admin() returns boolean language sql stable as $$select true$$;
create function public.evaluate_excel_grading_rule(d jsonb, t text, o text, v jsonb, a numeric, p numeric) returns numeric language sql immutable as $$select 0::numeric$$;
create table public.excel_efficiency_tests(id uuid primary key, current_version_id uuid, status text);
create table public.excel_efficiency_versions(id uuid primary key, test_id uuid, version_number int, passing_marks numeric, working_matter_snapshot jsonb);
create table public.excel_efficiency_questions(id uuid primary key, version_id uuid, question_number int, marks numeric);
create table public.excel_efficiency_grading_rules(id uuid primary key default gen_random_uuid(), version_id uuid, question_id uuid, exact_target text, expected_operation text, expected_value jsonb, allocated_marks numeric, partial_marks numeric, created_at timestamptz default now(), unique(version_id, question_id));
create table public.excel_efficiency_attempts(id uuid primary key, test_id uuid, version_id uuid, student_id uuid, selected_duration_seconds int, status text, started_at timestamptz, original_document_snapshot jsonb, document_autosave jsonb, final_document_snapshot jsonb, result jsonb, evaluation_status text, evaluated_at timestamptz, result_published_at timestamptz, submitted_at timestamptz, updated_at timestamptz);
create table public.excel_efficiency_question_scores(id uuid primary key default gen_random_uuid(), attempt_id uuid, question_id uuid, maximum_marks numeric(8,2), awarded_marks numeric(8,2), teacher_comment text, grading_status text, graded_by uuid, updated_at timestamptz);
`);
  for (const name of ["202610251700_excel_efficiency_sheet_v3_and_rule_marking.sql", "202610251730_excel_efficiency_cell_format_extras.sql", "202610252200_excel_efficiency_workspace_features.sql", "202610252300_excel_efficiency_full_home_tab.sql", "202610311000_excel_efficiency_autofit_marking.sql"]) {
    await db.exec(await readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8"));
  }
  return db;
}
const matches = async (doc, criterion) => (await (await database()).query("select public.excel_efficiency_criterion_matches($1::jsonb,$2::jsonb) as m", [JSON.stringify(doc), JSON.stringify(criterion)])).rows[0].m;

test("SQL: the marking accepts a sheet that has AutoFit on (at least) the asked rows, and the document check allows it", async () => {
  const model = autoFitted(initial);
  const [rows, cols] = excelRuleGroups(model, diffExcelDocuments(v3(initial), model).changes).map((group) => group.criteria[0]);
  assert.equal(await matches(model, rows), true);
  assert.equal(await matches(model, cols), true);
  // A student who selected only the used range also gets the marks.
  const usedOnly = autoFitted(initial, { rows: rowsUpTo(model.rows), cols: letters(model.cols) });
  assert.equal(await matches(usedOnly, rows), true);
  // AutoFit on only some rows, or none, does not.
  assert.equal(await matches(autoFitted(initial, { rows: rowsUpTo(3) }), rows), false);
  assert.equal(await matches(v3(initial), cols), false);
  await (await database()).query("select public.assert_excel_efficiency_document_schema($1::jsonb)", [JSON.stringify(model)]);
  const bad = clone(model); bad.sheet.autoFitRows = [0];
  await assert.rejects((await database()).query("select public.assert_excel_efficiency_document_schema($1::jsonb)", [JSON.stringify(bad)]), /Invalid AutoFit rows/);
});

test("SQL: the migration can run twice", async () => {
  await (await database()).exec(await readFile(new URL("../supabase/migrations/202610311000_excel_efficiency_autofit_marking.sql", import.meta.url), "utf8"));
});
