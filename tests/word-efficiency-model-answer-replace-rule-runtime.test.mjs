import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { compressRunCriteria, diffWordDocuments, modelAnswerRuleCriteria } from "../lib/word-document-diff.ts";


// Real reported problem (English Test 3, Q6): "Replace all 'rajasthan' with 'punjab', font size 24, font colour red" earned
// no marks from a student who did exactly that. The Model Answer page saved one criterion per RUN POSITION ("run 1, run 3
// and run 5 of paragraph 3 are 24 pt"); which run number the replaced words get depends on how the rest of the paragraph
// was split by earlier questions, so any student whose runs were split differently (another order of work, "Ajay sir" not
// formatted) was marked wrong. Now a word that is the only thing formatted becomes ONE rule per field ("every occurrence
// of punjab is 24 pt"): migrations 202610201200 / 202610261600.

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
].map((name) => new URL(`../supabase/migrations/${name}`, import.meta.url));

const version = "30000000-0000-0000-0000-000000000002", testId = "30000000-0000-0000-0000-000000000001";
const Q = ["30000000-0000-0000-0000-0000000000a1", "30000000-0000-0000-0000-0000000000a2", "30000000-0000-0000-0000-0000000000a3"];
const run = (text, extra = {}) => ({ text, bold: false, italic: false, underline: false, underlineStyle: null, strike: false, doubleStrike: false, superscript: false, subscript: false, fontFamily: "Calibri", fontSize: 11, color: null, highlight: null, ...extra });
const paragraph = (runs) => ({ id: "p", type: "paragraph", alignment: "left", runs, attrs: {} });
const doc = (...blocks) => ({ schemaVersion: "2", blocks });
const PURPLE = "7030A0";
const first = paragraph([run("Video provides a powerful way to help you. "), run("Ajay sir", { color: PURPLE }), run(" can also type a keyword.")]);
const text = (...parts) => parts.map(([t, extra]) => run(t, extra));
const BIG = { fontSize: 24, color: "FF0000" };
// "Themes and styles rajasthan also help Ajay sir keep your document coordinated. ... graphics rajasthan change ... your Rajasthan headings change."
const before = (ajaySir) => paragraph(text(["Themes and styles rajasthan also help "], [ajaySir ? "Ajay sir" : "Ajay sir", ajaySir ? { color: PURPLE } : {}], [" keep your document coordinated. When you click Design, the graphics rajasthan change to match. When you apply styles, your Rajasthan headings change."]));
const after = (ajaySir) => paragraph(text(["Themes and styles "], ["punjab", BIG], [" also help "], ["Ajay sir", ajaySir ? { color: PURPLE } : {}], [" keep your document coordinated. When you click Design, the graphics "], ["punjab", BIG], [" change to match. When you apply styles, your "], ["Punjab", BIG], [" headings change."]));
const third = paragraph([run("Third paragraph stays as it is.")]);
const initial = doc(first, before(true), third);
const model = doc(first, after(true), third);

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
const markOf = async (document, question = Q[0], max = 2) => Number((await (await database()).query("select (public.word_efficiency_score_question($1::jsonb,$2::uuid,$3::uuid,$4::numeric,null)).awarded::float as a", [JSON.stringify(document), version, question, max])).rows[0].a);
const criteriaFor = (before, after) => compressRunCriteria(after, modelAnswerRuleCriteria(after, diffWordDocuments(before, after).map((change) => ({ target: change.target, savedValue: change.expectedValue, caseOnly: change.caseOnly }))));
const asPayload = (criteria) => criteria.map((criterion) => "rule" in criterion ? criterion : { target: criterion.target, expectedValue: JSON.stringify(criterion.expectedValue ?? null), alternatives: criterion.alternatives, ignoreCase: criterion.ignoreCase, kind: criterion.kind, place: criterion.place });
async function saveRules(items) { await (await database()).query("select public.save_word_efficiency_grading_rules($1::uuid,$2::jsonb)", [version, JSON.stringify(items)]); }

test("the replaced words become one text rule per field, not one criterion per run position", () => {
  const criteria = criteriaFor(initial, model);
  assert.deepEqual(criteria.filter((criterion) => "rule" in criterion), [
    { rule: "text", kind: "body", find: "punjab", wholeWord: true, minCount: 3, props: { fontSize: [24] } },
    { rule: "text", kind: "body", find: "punjab", wholeWord: true, minCount: 3, props: { color: ["FF0000"] } },
  ]);
  assert.ok(!criteria.some((criterion) => "target" in criterion && /runs\.[0-9]+\.(fontSize|color)$/.test(criterion.target)), "no per-run position criteria are left");
});

test("only the replaced words are graded by the text rule: a word formatted in one place only keeps its run criteria", () => {
  // "Ajay sir" occurs in the first paragraph too, unformatted there, so "every occurrence" would be a rule the model fails.
  const one = doc(first, paragraph(text(["Themes and styles "], ["Ajay sir", { color: "FF0000" }], [" keep your document."])), third);
  const base = doc(first, paragraph(text(["Themes and styles Ajay sir keep your document."])), third);
  const criteria = criteriaFor(base, one);
  assert.ok(criteria.every((criterion) => !("rule" in criterion)), JSON.stringify(criteria));
});

test("a student earns the marks however their paragraph is split into runs; wrong or missing formatting does not", async () => {
  await saveRules([{ questionNumber: 1, exactTarget: "rule", expectedOperation: "model-answer-match-v2", expectedValue: "null", allocatedMarks: 2, partialMarks: null, additionalCriteria: asPayload(criteriaFor(initial, model)) }]);
  assert.equal(await markOf(model), 2, "the model answer itself");
  // Ajay sir not formatted (the student skipped that question): the run numbers of the replaced words are different.
  assert.equal(await markOf(doc(first, after(false), third)), 2, "other work left undone, so the runs are numbered differently");
  // The replaced words split further (each letter typed in one by one, then formatted).
  const split = paragraph(text(["Themes and styles "], ["pun", BIG], ["jab", BIG], [" also help "], ["Ajay sir", { color: PURPLE }], [" keep your document coordinated. When you click Design, the graphics "], ["punjab", BIG], [" change to match. When you apply styles, your "], ["Punjab", BIG], [" headings change."]));
  assert.equal(await markOf(doc(first, split, third)), 2, "one word split in two runs with the same formatting");
  // Not done, or done wrongly.
  assert.equal(await markOf(initial), 0, "nothing replaced");
  const wrongSize = paragraph(text(["Themes and styles "], ["punjab", { ...BIG, fontSize: 20 }], [" also help "], ["Ajay sir", { color: PURPLE }], [" keep your document coordinated. When you click Design, the graphics "], ["punjab", { ...BIG, fontSize: 20 }], [" change to match. When you apply styles, your "], ["Punjab", { ...BIG, fontSize: 20 }], [" headings change."]));
  assert.equal(await markOf(doc(first, wrongSize, third)), 0, "right text and colour, wrong size");
  const oneMissed = paragraph(text(["Themes and styles "], ["punjab", BIG], [" also help "], ["Ajay sir", { color: PURPLE }], [" keep your document coordinated. When you click Design, the graphics "], ["punjab", BIG], [" change to match. When you apply styles, your "], ["Punjab"], [" headings change."]));
  assert.equal(await markOf(doc(first, oneMissed, third)), 0, "one occurrence left unformatted");
});

test("the old per-run criteria are what failed: the same answer with different run numbers earns nothing", async () => {
  const changes = diffWordDocuments(initial, model);
  const perRun = modelAnswerRuleCriteria(model, changes.map((change) => ({ target: change.target, savedValue: change.expectedValue, caseOnly: change.caseOnly })));
  assert.ok(perRun.some((criterion) => /runs\.[0-9]+\.fontSize$/.test(criterion.target)));
  await saveRules([{ questionNumber: 2, exactTarget: "rule", expectedOperation: "model-answer-match-v2", expectedValue: "null", allocatedMarks: 2, partialMarks: null, additionalCriteria: asPayload(perRun) }]);
  assert.equal(await markOf(model, Q[1]), 2);
  const split = paragraph(text(["Themes and styles "], ["pun", BIG], ["jab", BIG], [" also help "], ["Ajay sir", { color: PURPLE }], [" keep your document coordinated. When you click Design, the graphics "], ["punjab", BIG], [" change to match. When you apply styles, your "], ["Punjab", BIG], [" headings change."]));
  assert.equal(await markOf(doc(first, split, third), Q[1]), 0, "a word split in two runs: the position criteria are not met");
});
