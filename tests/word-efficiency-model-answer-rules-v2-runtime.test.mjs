import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { diffWordDocuments, modelAnswerRuleCriteria, stripBlankParagraphs } from "../lib/word-document-diff.ts";

// Real reported case (EFFICIENCY TEST 1): the auto-grading check showed the
// admin's own Model Answer earning 0 on all 13 questions. This replays a paper
// shaped like that one -- several questions editing the same paragraph, a
// Find & Replace that rewrites every paragraph, a list conversion, the editor's
// stray blank paragraphs -- through the real Model Answer rule builder and the
// real SQL, end to end.

const migrations = [
  "202609081305_fix_word_efficiency_grading_target_uses_ephemeral_id.sql",
  "202610111200_word_efficiency_auto_grading_overhaul.sql",
  "202610111500_word_efficiency_blank_paragraph_tolerance.sql",
  "202610131000_late_submit_uses_last_autosave.sql",
  "202610141200_word_efficiency_model_answer_rules_v2.sql",
].map((name) => new URL(`../supabase/migrations/${name}`, import.meta.url));

const admin = "10000000-0000-0000-0000-00000000000a";
const testId = "40000000-0000-0000-0000-000000000004", version = "50000000-0000-0000-0000-000000000005";

const run = (text, extra = {}) => ({ text, bold: false, italic: false, underline: false, strike: false, color: "020618", highlight: null, fontFamily: "Segoe UI", fontSize: 12, charSpacing: null, charPosition: null, ...extra });
const para = (id, text, attrs = { marginLeft: "0pt", marginBottom: "8pt", lineHeight: "1.15" }) => ({ id, type: "paragraph", alignment: "left", runs: [run(text)], attrs });
const blank = (id) => ({ id, type: "paragraph", alignment: "left", runs: [run("")], attrs: { lineHeight: "1.15" } });
const doc = (blocks, operations = []) => ({ schemaVersion: "2", blocks, pageLayout: {}, operations, savedAt: "2026-10-14T00:00:00.000Z" });
const clone = (value) => JSON.parse(JSON.stringify(value));

const P1 = "The council published the note.", P2 = "Every teacher read the plan.", P6 = "An experienced writer reviewed the supply.", P7 = "Most families shared the stories.";
const original = () => doc([
  para("matter-p-1", P1), para("matter-p-2", P2), para("matter-p-3", "Our team checked the timetable."), para("matter-p-4", "The club approved the garden."),
  para("matter-p-5", P6), para("matter-p-6", "maths"), para("matter-p-7", "science"), para("matter-p-8", P7),
]);
const replaceThe = (text) => text.replace(/\bthe\b/g, "SAMRADHI CLASSES");
const capitalize = (text) => text.replace(/\b([a-z])/g, (letter) => letter.toUpperCase());
const toggle = (text) => [...text].map((ch) => (ch === ch.toUpperCase() ? ch.toLowerCase() : ch.toUpperCase())).join("");

// Each step is one question as the admin solved it, in paper order. Positions
// are into the original 8 text paragraphs; the editor also keeps adding stray
// blank paragraphs as the admin works (as the real saved answer had).
const QUESTIONS = [
  { marks: 1, edit: (d) => { Object.assign(d.blocks[4].runs[0], { bold: true, italic: true, underline: true }); } },
  { marks: 2, edit: (d) => { d.blocks[1].runs[0].strike = true; d.blocks[0].attrs.lineHeight = "2.5"; d.blocks.splice(0, 0, blank("block-x1")); } },
  { marks: 2, edit: (d) => { const r = textBlock(d, 4).runs[0]; r.text = capitalize(r.text); r.color = "FF0000"; } },
  { marks: 2, edit: (d) => { const b = textBlock(d, 4); const r = b.runs[0]; b.runs = [{ ...r, text: r.text.slice(0, 13), highlight: "FF00FF" }, { ...r, text: r.text.slice(13) }]; } },
  { marks: 2, edit: (d) => { const b = textBlock(d, 0); b.runs[0].color = "FF0000"; b.attrs.marginLeft = "34.8696pt"; b.attrs.marginRight = "46.2024pt"; } },
  { marks: 2, edit: (d) => { for (const b of d.blocks) for (const r of b.runs) r.text = replaceThe(r.text); d.blocks.splice(4, 0, blank("block-x2")); } },
  { marks: 2, edit: (d) => { Object.assign(textBlock(d, 3).runs[0], { doubleStrike: true, underline: true, underlineStyle: "dot-dot-dash" }); } },
  { marks: 2, edit: (d) => { Object.assign(textBlock(d, 0).runs[0], { fontFamily: "Bookman Old Style", fontSize: 18.5 }); } },
  { marks: 2, edit: (d) => { for (const i of [5, 6]) { const b = textBlock(d, i); b.type = "list-item"; b.attrs = { listStyle: "upper-roman" }; } } },
  { marks: 2, edit: (d) => { textBlock(d, 7).runs[0].charSpacing = 2.5; } },
  { marks: 2, edit: (d) => { const r = textBlock(d, 7).runs[0]; r.text = toggle(r.text); } },
  { marks: 2, edit: (d) => { textBlock(d, 3).attrs.marginBottom = "12pt"; } },
  { marks: 2, edit: (d) => { textBlock(d, 1).runs[0].charPosition = -5; } },
];
function textBlock(d, place) {
  return d.blocks.filter((b) => b.runs.some((r) => r.text.trim()))[place];
}

// Exactly what model-answer-editor.tsx does on every "Save answer for Qn".
function solveModelAnswer() {
  let current = original();
  const assignments = {};
  QUESTIONS.forEach((question, index) => {
    const checkpoint = current;
    const next = clone(current);
    question.edit(next);
    const clean = stripBlankParagraphs(next);
    assignments[index + 1] = diffWordDocuments(checkpoint, clean).map((change) => ({ target: change.target, savedValue: change.expectedValue, caseOnly: change.caseOnly }));
    current = clean;
  });
  const rules = QUESTIONS.map((question, index) => {
    const criteria = modelAnswerRuleCriteria(current, assignments[index + 1]);
    const [primary] = criteria;
    return { questionNumber: index + 1, exactTarget: primary.target, expectedOperation: "model-answer-match-v2", expectedValue: JSON.stringify(primary.expectedValue ?? null), allocatedMarks: question.marks, partialMarks: null, additionalCriteria: criteria.map((criterion) => ({ target: criterion.target, expectedValue: JSON.stringify(criterion.expectedValue ?? null), alternatives: criterion.alternatives, ignoreCase: criterion.ignoreCase })) };
  });
  return { model: current, rules };
}

// A student doing the chosen questions (all by default) on a fresh paper.
function studentDocument(numbers = QUESTIONS.map((_, index) => index + 1), { keepBlanks = false } = {}) {
  let current = original();
  QUESTIONS.forEach((question, index) => {
    if (!numbers.includes(index + 1)) return;
    const next = clone(current);
    question.edit(next);
    current = keepBlanks ? next : stripBlankParagraphs(next);
  });
  return current;
}

async function database() {
  const db = new PGlite();
  await db.exec(`
create schema auth;
create table auth.state(uid uuid, admin boolean);
insert into auth.state values('${admin}', true);
create function auth.uid() returns uuid language sql stable as $$select uid from auth.state limit 1$$;
create role anon; create role authenticated;
create table public.profiles(id uuid primary key, role text, is_active boolean, full_name text, email text);
create function public.is_active_word_efficiency_student() returns boolean language sql stable as $$select false$$;
create function public.is_aal2_admin() returns boolean language sql stable as $$select coalesce((select admin from auth.state limit 1),false)$$;
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
create table public.word_efficiency_grading_rules(id uuid primary key default gen_random_uuid(), version_id uuid, question_id uuid, exact_target text not null, expected_operation text not null, expected_value jsonb not null, allocated_marks numeric not null, partial_marks numeric, additional_criteria jsonb default '[]'::jsonb);
insert into public.word_efficiency_tests values('${testId}','${version}');
insert into public.word_efficiency_versions values('${version}','${testId}','EFFICIENCY TEST 1','English',25,10,'{}'::jsonb,null);
insert into public.word_efficiency_questions(version_id,question_number,display_order,marks) select '${version}',n,n,case when n=1 then 1 else 2 end from generate_series(1,13) n;
-- A student attempt already exists: rules must still be savable (the old guard refused).
insert into public.word_efficiency_attempts(id,test_id,version_id,status) values('60000000-0000-0000-0000-000000000006','${testId}','${version}','submitted');
`);
  for (const migration of migrations) await db.exec(await readFile(migration, "utf8"));
  return db;
}

async function saveModelAnswer(db) {
  const { model, rules } = solveModelAnswer();
  await db.query("update public.word_efficiency_versions set model_answer_snapshot=$1::jsonb where id=$2", [JSON.stringify(model), version]);
  await db.query("select public.save_word_efficiency_grading_rules($1,$2::jsonb)", [version, JSON.stringify(rules)]);
  return { model, rules };
}

async function marksFor(db, document) {
  const { rows } = await db.query(
    `select q.question_number as n, public.evaluate_word_efficiency_grading_rule($1::jsonb,r.exact_target,r.expected_operation,r.expected_value,r.allocated_marks,r.partial_marks,r.additional_criteria,v.model_answer_snapshot)::float as marks
     from public.word_efficiency_grading_rules r join public.word_efficiency_questions q on q.id=r.question_id join public.word_efficiency_versions v on v.id=r.version_id order by q.question_number`,
    [JSON.stringify(document)],
  );
  return Object.fromEntries(rows.map((row) => [row.n, row.marks]));
}
const full = Object.fromEntries(QUESTIONS.map((question, index) => [index + 1, question.marks]));

test("the finished Model Answer earns full marks on every one of its own rules (the auto-grading check passes)", async () => {
  const db = await database();
  const { model } = await saveModelAnswer(db);
  assert.equal(model.blocks.length, 8, "stray blank paragraphs are not saved in the Model Answer");
  const { rows } = await db.query("select public.check_word_efficiency_auto_grading($1) as report", [testId]);
  const report = rows[0].report;
  assert.equal(report.ready, true, JSON.stringify(report.questions));
  assert.ok(report.questions.every((question) => question.ok));
});

test("no rule targets a block by id, and no question carries unrelated paragraphs' criteria", () => {
  const { rules } = solveModelAnswer();
  for (const rule of rules) {
    for (const criterion of rule.additionalCriteria) assert.match(criterion.target, /^(blocks\.[0-9]+\.|pageLayout\.)/);
    assert.ok(rule.additionalCriteria.length <= 9, `Q${rule.questionNumber} has ${rule.additionalCriteria.length} criteria`);
  }
});

test("a student who does the whole paper correctly gets full marks, even with the editor's stray blank paragraphs in their document", async () => {
  const db = await database();
  await saveModelAnswer(db);
  assert.deepEqual(await marksFor(db, studentDocument()), full);
  assert.deepEqual(await marksFor(db, studentDocument(undefined, { keepBlanks: true })), full);
});

test("a student who only does Q1 gets Q1's mark and nothing else", async () => {
  const db = await database();
  await saveModelAnswer(db);
  const marks = await marksFor(db, studentDocument([1]));
  assert.equal(marks[1], 1);
  for (let n = 2; n <= 13; n += 1) assert.equal(marks[n], 0, `Q${n}`);
});

test("questions that touch the same paragraph are graded independently", async () => {
  const db = await database();
  await saveModelAnswer(db);
  // Capitalised paragraph six without doing the Find & Replace (Q6).
  const withoutReplace = await marksFor(db, studentDocument([1, 3]));
  assert.equal(withoutReplace[1], 1);
  assert.equal(withoutReplace[3], 2);
  // Did the Find & Replace without capitalising paragraph six (Q3).
  const replaceOnly = await marksFor(db, studentDocument([6]));
  assert.equal(replaceOnly[6], 2);
  assert.equal(replaceOnly[3], 0);
  // Highlighted the first line (splits paragraph six into two runs) without bolding it.
  const highlightOnly = await marksFor(db, studentDocument([4]));
  assert.equal(highlightOnly[4], 2);
  assert.equal(highlightOnly[1], 0);
});

test("an untouched paper scores zero everywhere", async () => {
  const db = await database();
  await saveModelAnswer(db);
  assert.ok(Object.values(await marksFor(db, original())).every((marks) => marks === 0));
});
