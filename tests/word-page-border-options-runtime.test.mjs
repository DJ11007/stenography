import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { diffWordDocuments, modelAnswerRuleCriteria, wordTargetValue } from "../lib/word-document-diff.ts";
import { pageBorderDistance, pageBorderMeasure } from "../lib/word-page-border.ts";

// Page Border > Options (Measure from, distances) saved inside pageLayout.border and graded through two derived
// targets, pageLayout.borderMeasure and pageLayout.borderDistance (migration 202610291200), next to borderSides.

const migrations = [
  "202609081305_fix_word_efficiency_grading_target_uses_ephemeral_id.sql",
  "202610111200_word_efficiency_auto_grading_overhaul.sql",
  "202610111500_word_efficiency_blank_paragraph_tolerance.sql",
  "202610131000_late_submit_uses_last_autosave.sql",
  "202610141200_word_efficiency_model_answer_rules_v2.sql",
  "202610151200_word_efficiency_rules_block_kind.sql",
  "202610181500_word_efficiency_part_marks.sql",
  "202610191200_word_efficiency_words_only_runs.sql",
  "202610191300_word_efficiency_page_border_sides.sql",
  "202610191900_word_efficiency_nbsp_equals_space.sql",
  "202610201200_word_efficiency_rule_criteria.sql",
  "202610241000_word_efficiency_list_and_table_rules.sql",
  "202610251000_word_efficiency_case_sensitive_text_rule.sql",
  "202610261600_word_efficiency_whole_word_text_rule.sql",
  "202610291100_word_efficiency_model_answer_rule_criteria.sql",
  "202610291200_word_efficiency_page_border_options.sql",
].map((name) => new URL(`../supabase/migrations/${name}`, import.meta.url));

const version = "40000000-0000-0000-0000-000000000002", testId = "40000000-0000-0000-0000-000000000001";
const Q = ["40000000-0000-0000-0000-0000000000a1", "40000000-0000-0000-0000-0000000000a2", "40000000-0000-0000-0000-0000000000a3"];
const WORDS = "Video provides a powerful way to help you prove your point When you click Online Video you can paste in the embed code for the video you want to add".split(" ");
const run = (text, extra = {}) => ({ text, bold: false, italic: false, underline: false, underlineStyle: null, strike: false, doubleStrike: false, superscript: false, subscript: false, fontFamily: "Calibri", fontSize: 11, color: null, highlight: null, ...extra });
const paragraph = (runs) => ({ id: "p", type: "paragraph", alignment: "left", runs, attrs: {} });
const doc = (...blocks) => ({ schemaVersion: "2", blocks });
const wordByWord = (highlight) => WORDS.flatMap((word, i) => [run(word, { highlight }), ...(i < WORDS.length - 1 ? [run(" ")] : [])]);
const oneRun = (highlight) => [run(WORDS.join(" "), { highlight })];
const second = paragraph([run("Second paragraph stays as it is.")]);
const initial = doc(paragraph(oneRun(null)), second);
const model = doc(paragraph(wordByWord("00FFFF")), second);

let db;
async function database() {
  if (db) return db;
  db = new PGlite();
  await db.exec(`
create schema auth;
create table auth.state(uid uuid, admin boolean);
create function auth.uid() returns uuid language sql stable as $$select uid from auth.state limit 1$$;
create role anon; create role authenticated;
create table public.profiles(id uuid primary key, role text, is_active boolean, full_name text, email text);
create function public.is_active_word_efficiency_student() returns boolean language sql stable as $$select false$$;
create function public.is_aal2_admin() returns boolean language sql stable as $$select true$$;
create function public.normalize_word_efficiency_editor_capabilities(c jsonb) returns jsonb language sql immutable as $$select coalesce(c,'{}'::jsonb)$$;
create function public.assert_word_efficiency_editor_capabilities(c jsonb) returns void language plpgsql immutable as $$begin end $$;
create function public.word_efficiency_initial_editor_document(m jsonb) returns jsonb language sql immutable as $$select m$$;
create function public.assert_word_efficiency_document_schema(d jsonb, caps jsonb) returns void language plpgsql immutable as $$begin end $$;
create function public.assert_word_efficiency_capability_changes(d jsonb, baseline jsonb, caps jsonb) returns void language plpgsql immutable as $$begin end $$;
create table public.excel_efficiency_attempts(id uuid primary key);
create table public.word_efficiency_tests(id uuid primary key, current_version_id uuid);
create table public.word_efficiency_versions(id uuid primary key, test_id uuid, title text, language text, maximum_marks numeric, passing_marks numeric, editor_capabilities jsonb, model_answer_snapshot jsonb);
create table public.word_efficiency_questions(id uuid primary key default gen_random_uuid(), version_id uuid, question_number int, instruction text, display_order int, marks numeric);
create table public.word_efficiency_attempts(id uuid primary key, test_id uuid, version_id uuid, student_id uuid, status text, selected_duration_seconds int, started_at timestamptz, snapshot jsonb, result jsonb, submitted_at timestamptz, updated_at timestamptz, original_document_snapshot jsonb, final_document_snapshot jsonb, document_autosave jsonb, evaluation_status text, evaluated_at timestamptz, evaluated_by uuid, result_published_at timestamptz);
create table public.word_efficiency_question_scores(id uuid primary key default gen_random_uuid(), attempt_id uuid, question_id uuid, maximum_marks numeric(8,2), awarded_marks numeric(8,2), teacher_comment text, grading_status text, graded_by uuid, graded_at timestamptz, updated_at timestamptz default now());
create table public.word_efficiency_grading_rules(id uuid primary key default gen_random_uuid(), version_id uuid, question_id uuid, exact_target text not null, expected_operation text not null, expected_value jsonb not null, allocated_marks numeric not null, partial_marks numeric, additional_criteria jsonb default '[]'::jsonb, created_at timestamptz default now());
insert into public.word_efficiency_tests values('${testId}','${version}');
insert into public.word_efficiency_versions values('${version}','${testId}','Test','English',6,2,'{}'::jsonb,null);
insert into public.word_efficiency_questions(id,version_id,question_number,display_order,marks) values ('${Q[0]}','${version}',1,1,2),('${Q[1]}','${version}',2,2,2),('${Q[2]}','${version}',3,3,2);
`);
  for (const migration of migrations.slice(0, -1)) await db.exec(await readFile(migration, "utf8"));
  // The live table's shape check (migration 202608280039): the rules must pass it to be saved.
  await db.exec(`
create function public.valid_additional_criteria_shape(criteria jsonb) returns boolean language plpgsql immutable as $$
begin perform public.assert_word_efficiency_additional_criteria(criteria); return true; exception when others then return false; end $$;
alter table public.word_efficiency_grading_rules add constraint shape check (public.valid_additional_criteria_shape(additional_criteria));`);
  await db.exec(await readFile(migrations.at(-1), "utf8"));
  return db;
}

const withBorder = (border) => ({ schemaVersion: "2", blocks: [{ id: "p", type: "paragraph", alignment: "left", runs: [run("Some text")], attrs: {} }], pageLayout: { padding: null, maxWidth: null, aspectRatio: null, columnCount: null, backgroundColor: null, border, watermark: null } });
const markOf = async (document, question = Q[0], max = 2) => Number((await (await database()).query("select (public.word_efficiency_score_question($1::jsonb,$2::uuid,$3::uuid,$4::numeric,null)).awarded::float as a", [JSON.stringify(document), version, question, max])).rows[0].a);
const targetValue = async (border, target) => (await (await database()).query("select public.word_efficiency_grading_target_value($1::jsonb,$2) as v", [JSON.stringify(withBorder(border)), target])).rows[0].v;
const criteriaFor = (before, after) => modelAnswerRuleCriteria(after, diffWordDocuments(before, after).map((change) => ({ target: change.target, savedValue: change.expectedValue, caseOnly: change.caseOnly })));
const payload = (criteria) => criteria.map((criterion) => ({ target: criterion.target, expectedValue: JSON.stringify(criterion.expectedValue ?? null), alternatives: criterion.alternatives, ignoreCase: criterion.ignoreCase, kind: criterion.kind, place: criterion.place }));
async function saveRule(criteria) { await (await database()).query("select public.save_word_efficiency_grading_rules($1::uuid,$2::jsonb)", [version, JSON.stringify([{ questionNumber: 1, exactTarget: criteria[0].target, expectedOperation: "model-answer-match-v2", expectedValue: JSON.stringify(criteria[0].expectedValue ?? null), allocatedMarks: 2, partialMarks: null, additionalCriteria: payload(criteria) }])]); }

const BORDERS = [null, "", "none", "1px solid #000000", "1px solid #000000 sides:top,bottom", "1px solid #000000 measure:text", "1px solid #000000 measure:text gap:6,7,8,9", "2px wave #00B050 gap:20,20,20,20 sides:bottom", "1px solid #000000 measure:text nohdr noftr sides:left"];

test("the server derives the measure and the distances exactly as the editor's code does", async () => {
  for (const border of BORDERS) {
    assert.equal(await targetValue(border, "pageLayout.borderMeasure"), pageBorderMeasure(border), `measure of ${border}`);
    assert.equal(await targetValue(border, "pageLayout.borderDistance"), pageBorderDistance(border), `distance of ${border}`);
    assert.equal(wordTargetValue(withBorder(border), "pageLayout.borderMeasure"), pageBorderMeasure(border), `TS measure of ${border}`);
  }
  assert.equal(await targetValue("1px solid #000000", "pageLayout.borderDistance"), "24,24,24,24", "Edge of page: 24 pt");
  assert.equal(await targetValue("1px solid #000000 measure:text", "pageLayout.borderDistance"), "4,4,4,4", "Text: 4 pt");
});

test("a question that asks for a border measured from the text at 10 pt is marked on exactly that; the line does not matter", async () => {
  const before = withBorder(null), model = withBorder("1px solid #00B050 measure:text gap:10,10,10,10");
  const criteria = criteriaFor(before, model);
  assert.deepEqual(criteria.map((criterion) => criterion.target).sort(), ["pageLayout.borderDistance", "pageLayout.borderMeasure", "pageLayout.borderSides"]);
  await saveRule(criteria);
  assert.equal(await markOf(model), 2, "the model answer");
  assert.equal(await markOf(withBorder("3px double #FF0000 measure:text gap:10,10,10,10")), 2, "another line style and colour");
  assert.equal(await markOf(withBorder("1px solid #00B050 gap:10,10,10,10")), 0, "measured from the edge of the page");
  assert.equal(await markOf(withBorder("1px solid #00B050 measure:text")), 0, "from the text, but 4 pt");
  assert.equal(await markOf(withBorder("1px solid #00B050 measure:text gap:10,10,10,10 sides:top")), 0, "not all four sides");
  assert.equal(await markOf(withBorder(null)), 0, "no border");
});

test("a question that only asks for a page border is marked on the sides, not on what the student left in Options", async () => {
  const model = withBorder("1px solid #00B050"), criteria = criteriaFor(withBorder(null), model);
  assert.deepEqual(criteria.map((criterion) => criterion.target), ["pageLayout.borderSides"]);
  await saveRule(criteria);
  assert.equal(await markOf(model), 2);
  assert.equal(await markOf(withBorder("2px solid #FF0000 measure:text")), 2, "measured from the text");
  assert.equal(await markOf(withBorder("2px solid #FF0000 gap:12,12,12,12")), 2, "another distance");
  assert.equal(await markOf(withBorder("2px solid #FF0000 sides:top")), 0, "one side only");
});

test("a border saved before the options existed still reads as Edge of page, 24 pt", async () => {
  assert.equal(await targetValue("3px solid #00B050 sides:bottom,right", "pageLayout.borderMeasure"), "page");
  assert.equal(await targetValue("3px solid #00B050 sides:bottom,right", "pageLayout.borderDistance"), "24,24,24,24");
  assert.equal(await targetValue("3px solid #00B050 sides:bottom,right", "pageLayout.borderSides"), "bottom,right");
});
