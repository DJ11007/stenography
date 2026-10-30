import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { compressRunCriteria, diffWordDocuments, modelAnswerRuleCriteria } from "../lib/word-document-diff.ts";

// Real reported problem: "Highlight the first paragraph's words only with turquoise" could not be graded. Highlighting
// word by word splits the paragraph into ~100 runs and the Model Answer page wrote one criterion per run position
// ("run 37 is highlighted"): a student who highlighted the paragraph in one go (different runs) got 0, and a long
// paragraph needed more criteria than one rule may hold (300), so the question could not even be saved. Now one
// {"rule":"words"} criterion says "every word of the paragraph has the highlight" (migrations 202610201200 and
// 202610291100). Also pinned: saving a question does not delete the rules the page cannot rebuild.

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
const markOf = async (document, question = Q[0], max = 2) => Number((await (await database()).query("select (public.word_efficiency_score_question($1::jsonb,$2::uuid,$3::uuid,$4::numeric,null)).awarded::float as a", [JSON.stringify(document), version, question, max])).rows[0].a);
const criteriaFor = (before, after) => compressRunCriteria(after, modelAnswerRuleCriteria(after, diffWordDocuments(before, after).map((change) => ({ target: change.target, savedValue: change.expectedValue, caseOnly: change.caseOnly }))));
const asPayload = (criteria) => criteria.map((criterion) => "rule" in criterion ? criterion : { target: criterion.target, expectedValue: JSON.stringify(criterion.expectedValue ?? null), alternatives: criterion.alternatives, ignoreCase: criterion.ignoreCase, kind: criterion.kind, place: criterion.place });
async function saveRules(items) { await (await database()).query("select public.save_word_efficiency_grading_rules($1::uuid,$2::jsonb)", [version, JSON.stringify(items)]); }

test("highlighting every word of a paragraph becomes ONE rule, not one criterion per run", () => {
  const criteria = criteriaFor(initial, model);
  assert.equal(criteria.length, 1);
  // Words only: the model's spaces are not highlighted, so the rule says that too.
  assert.deepEqual(criteria[0], { rule: "words", kind: "body", place: 0, props: { highlight: ["00FFFF"] }, spaceProps: { highlight: [null] } });
});

test("formatting only some words keeps the per-run criteria (nothing to generalise)", () => {
  const some = doc(paragraph([run("Video", { highlight: "00FFFF" }), run(" provides "), run("a", { highlight: "00FFFF" }), run(" powerful "), run("way", { highlight: "00FFFF" }), run(" to help")]), second);
  const criteria = criteriaFor(doc(paragraph([run("Video provides a powerful way to help")]), second), some);
  assert.ok(criteria.length >= 3 && criteria.every((criterion) => "target" in criterion));
});

test("words only: a student who highlights the words (however the runs are split) earns the marks; highlighting the spaces too, nothing, or not every word earns none", async () => {
  await saveRules([{ questionNumber: 1, exactTarget: "rule", expectedOperation: "model-answer-match-v2", expectedValue: "null", allocatedMarks: 2, partialMarks: null, additionalCriteria: asPayload(criteriaFor(initial, model)) }]);
  assert.equal(await markOf(model), 2, "the model answer itself");
  assert.equal(await markOf(doc(paragraph(wordByWord("00FFFF")), second)), 2, "words only, one run per word and per space");
  const wordsAndNeighbours = WORDS.flatMap((word, i) => [run(word, { highlight: "00FFFF" }), ...(i < WORDS.length - 1 ? [run(" ", { highlight: null })] : [])]).reduce((all, r) => (all.at(-1) && all.at(-1).highlight === r.highlight && all.at(-1).highlight === null ? [...all.slice(0, -1), { ...all.at(-1), text: all.at(-1).text + r.text }] : [...all, r]), []);
  assert.equal(await markOf(doc(paragraph(wordsAndNeighbours), second)), 2, "words only, spaces merged into neighbouring runs differently");
  assert.equal(await markOf(doc(paragraph(oneRun("00FFFF")), second)), 0, "the whole paragraph in one run: the spaces are highlighted too");
  assert.equal(await markOf(doc(paragraph(wordByWord("00FFFF").map((r) => ({ ...r, highlight: "00FFFF" }))), second)), 0, "spaces highlighted too");
  assert.equal(await markOf(doc(paragraph(WORDS.map((word, i) => run(i < WORDS.length - 1 ? `${word} ` : word, { highlight: "00FFFF" }))), second)), 0, "each word with its trailing space highlighted");
  assert.equal(await markOf(initial), 0, "nothing highlighted");
  assert.equal(await markOf(doc(paragraph(oneRun("FFFF00")), second)), 0, "a different colour");
  const missingOne = wordByWord("00FFFF"); missingOne[4] = { ...missingOne[4], highlight: null };
  assert.equal(await markOf(doc(paragraph(missingOne), second)), 0, "one word left out");
  assert.equal(await markOf(doc(paragraph(oneRun(null)), paragraph([run("Second", { highlight: "00FFFF" })]))), 0, "the wrong paragraph");
});

test("the old per-run rule on the same answer: a paragraph highlighted in one go earned nothing (why the rule had to change)", async () => {
  const { changes } = { changes: diffWordDocuments(initial, model) };
  const perRun = modelAnswerRuleCriteria(model, changes.map((change) => ({ target: change.target, savedValue: change.expectedValue })));
  assert.ok(perRun.length >= WORDS.length - 1, "about one criterion per word run");
  await saveRules([{ questionNumber: 1, exactTarget: perRun[0].target, expectedOperation: "model-answer-match-v2", expectedValue: JSON.stringify(perRun[0].expectedValue), allocatedMarks: 2, partialMarks: null, additionalCriteria: asPayload(perRun) }]);
  assert.equal(await markOf(model), 2);
  assert.equal(await markOf(doc(paragraph(oneRun("00FFFF")), second)), 0);
});

test("rules the page cannot rebuild (rule criteria, part marks) are stored as they are, with their part labels", async () => {
  const pg = await database();
  await saveRules([
    { questionNumber: 2, exactTarget: "rule", expectedOperation: "model-answer-match-v2", expectedValue: "null", allocatedMarks: 1, partialMarks: null, partLabel: "a", additionalCriteria: [{ rule: "text", kind: "body", find: "stays as it is", minCount: 1, props: { bold: [true] } }] },
    { questionNumber: 2, exactTarget: "rule", expectedOperation: "model-answer-match-v2", expectedValue: "null", allocatedMarks: 1, partialMarks: null, partLabel: "b", additionalCriteria: [{ rule: "words", kind: "body", place: 1, props: { italic: [true] } }] },
  ]);
  const rows = (await pg.query("select part_label, additional_criteria->0->>'rule' as rule from public.word_efficiency_grading_rules where question_id=$1 order by part_label", [Q[1]])).rows;
  assert.deepEqual(rows, [{ part_label: "a", rule: "text" }, { part_label: "b", rule: "words" }]);
  const bold = doc(paragraph(oneRun(null)), paragraph([run("Second paragraph stays as it is.", { bold: true, italic: true })]));
  assert.equal(await markOf(bold, Q[1]), 2);
  assert.equal(await markOf(doc(paragraph(oneRun(null)), paragraph([run("Second paragraph stays as it is.", { bold: true })])), Q[1]), 1, "part a only");
});

test("a rule that is not a known kind is still refused", async () => {
  await assert.rejects(saveRules([{ questionNumber: 3, exactTarget: "rule", expectedOperation: "model-answer-match-v2", expectedValue: "null", allocatedMarks: 1, partialMarks: null, additionalCriteria: [{ rule: "nonsense" }] }]), /invalid grading rule/);
});

test("the Model Answer page sends back the rules it cannot rebuild, and rebuilds only the questions answered since it opened", async () => {
  const editor = await readFile(new URL("../app/admin/word-efficiency-tests/[testId]/model-answer/model-answer-editor.tsx", import.meta.url), "utf8");
  assert.match(editor, /compressRunCriteria\(cleanDocument, modelAnswerRuleCriteria\(cleanDocument, nextAssignments\[question\.number\] \?\? \[\]\)\)/);
  assert.match(editor, /question\.keptRules\.length && !nextTouched\.has\(question\.number\)/);
  assert.match(editor, /\{ questionNumber: question\.number, keep: question\.keptRules \}/);
  const page = await readFile(new URL("../app/admin/word-efficiency-tests/[testId]/model-answer/page.tsx", import.meta.url), "utf8");
  assert.match(page, /part_label/);
  assert.match(page, /rule\.expected_operation !== "model-answer-match-v2"/);
  const actions = await readFile(new URL("../app/admin/word-efficiency-tests/actions.ts", import.meta.url), "utf8");
  assert.match(actions, /"keep" in assignment/);
  assert.match(actions, /p_rules:\[\.\.\.rules,\.\.\.kept\]/);
});
