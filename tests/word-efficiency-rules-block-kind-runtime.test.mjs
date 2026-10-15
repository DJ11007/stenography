import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { diffWordDocuments, modelAnswerRuleCriteria, stripBlankParagraphs } from "../lib/word-document-diff.ts";

// Real case (EFFICIENCY TEST 2): Q1 inserts a header, which becomes the first
// block. Rules for later questions must still find "paragraph 3" in students'
// documents whether they added the header first, last, or not at all.

const migrations = [
  "202609081305_fix_word_efficiency_grading_target_uses_ephemeral_id.sql",
  "202610111200_word_efficiency_auto_grading_overhaul.sql",
  "202610111500_word_efficiency_blank_paragraph_tolerance.sql",
  "202610131000_late_submit_uses_last_autosave.sql",
  "202610141200_word_efficiency_model_answer_rules_v2.sql",
  "202610151200_word_efficiency_rules_block_kind.sql",
].map((name) => new URL(`../supabase/migrations/${name}`, import.meta.url));

const run = (text, extra = {}) => ({ text, bold: false, italic: false, underline: false, ...extra });
const para = (id, text, extra = {}) => ({ id, type: "paragraph", alignment: "left", runs: [run(text, extra)], attrs: {} });
const header = (text, extra = {}) => ({ id: "h", type: "header", alignment: "center", runs: [run(text, extra)], attrs: {} });
const doc = (blocks) => ({ schemaVersion: "2", blocks, pageLayout: {}, operations: [], savedAt: "2026-10-15T00:00:00.000Z" });
const original = () => doc([para("p1", "One"), para("p2", "Two"), para("p3", "Three")]);

// Model Answer, in paper order: Q1 adds a bold header, Q2 bolds paragraph 3.
function rules() {
  const q1Before = original();
  const q1After = doc([header("SAMRADHI CLASSES", { bold: true }), ...original().blocks]);
  const q2After = doc([header("SAMRADHI CLASSES", { bold: true }), para("p1", "One"), para("p2", "Two"), para("p3", "Three", { bold: true })]);
  const q1 = diffWordDocuments(q1Before, stripBlankParagraphs(q1After)).map((change) => ({ target: change.target, savedValue: change.expectedValue, caseOnly: change.caseOnly }));
  const q2 = diffWordDocuments(q1After, stripBlankParagraphs(q2After)).map((change) => ({ target: change.target, savedValue: change.expectedValue, caseOnly: change.caseOnly }));
  return { q1, q2, model: q2After, criteria: [modelAnswerRuleCriteria(q2After, q1), modelAnswerRuleCriteria(q2After, q2)] };
}

test("adding a header does not make every paragraph look changed, and each criterion knows its block's kind and place", () => {
  const { q1, q2, criteria } = rules();
  // The added header is checked on its text AND its formatting (bold, centred), not text alone.
  assert.deepEqual(q1.map((change) => change.target).sort(), ["blocks.0.alignment", "blocks.0.runs.0.bold", "blocks.0.runs.0.text"]);
  assert.ok(q1.every((change) => change.target.startsWith("blocks.0.")), JSON.stringify(q1));
  assert.deepEqual(q2.map((change) => change.target), ["blocks.3.runs.0.bold"]);
  assert.deepEqual(criteria[1].map(({ kind, place }) => [kind, place]), [["body", 2]]);
  assert.ok(criteria[0].every((criterion) => criterion.kind === "header" && criterion.place === 0));
});

async function database() {
  const db = new PGlite();
  await db.exec(`
create schema auth; create function auth.uid() returns uuid language sql stable as $$select null::uuid$$;
create role anon; create role authenticated; create table public.profiles(id uuid primary key);
create function public.is_active_word_efficiency_student() returns boolean language sql stable as $$select false$$;
create function public.is_aal2_admin() returns boolean language sql stable as $$select true$$;
create function public.normalize_word_efficiency_editor_capabilities(c jsonb) returns jsonb language sql immutable as $$select c$$;
create function public.assert_word_efficiency_editor_capabilities(c jsonb) returns void language plpgsql immutable as $$begin end $$;
create function public.word_efficiency_initial_editor_document(m jsonb) returns jsonb language sql immutable as $$select m$$;
create function public.assert_word_efficiency_document_schema(d jsonb, caps jsonb) returns void language plpgsql immutable as $$begin end $$;
create function public.assert_word_efficiency_capability_changes(d jsonb, b jsonb, c jsonb) returns void language plpgsql immutable as $$begin end $$;
create table public.excel_efficiency_attempts(id uuid primary key);
create table public.word_efficiency_tests(id uuid primary key, current_version_id uuid, auto_publish_results boolean default false);
create table public.word_efficiency_versions(id uuid primary key, model_answer_snapshot jsonb, passing_marks numeric);
create table public.word_efficiency_questions(id uuid primary key default gen_random_uuid(), version_id uuid, question_number int, marks numeric);
create table public.word_efficiency_attempts(id uuid primary key, test_id uuid, version_id uuid, student_id uuid, status text, result jsonb, final_document_snapshot jsonb, evaluated_by uuid);
create table public.word_efficiency_question_scores(id uuid primary key default gen_random_uuid(), attempt_id uuid, question_id uuid, maximum_marks numeric, awarded_marks numeric, graded_by uuid);
create table public.word_efficiency_grading_rules(id uuid primary key default gen_random_uuid(), version_id uuid, question_id uuid, exact_target text not null, expected_operation text not null, expected_value jsonb not null, allocated_marks numeric not null, partial_marks numeric, additional_criteria jsonb default '[]'::jsonb);
insert into public.word_efficiency_versions values('50000000-0000-0000-0000-000000000005',null,null);
insert into public.word_efficiency_questions(version_id,question_number,marks) values('50000000-0000-0000-0000-000000000005',1,5),('50000000-0000-0000-0000-000000000005',2,5);
`);
  for (const migration of migrations) await db.exec(await readFile(migration, "utf8"));
  return db;
}

test("grading finds the right paragraph whether the student added the header first, last, or not at all", async () => {
  const db = await database();
  const { criteria } = rules();
  const payload = criteria.map((list, index) => ({ questionNumber: index + 1, exactTarget: list[0].target, expectedOperation: "model-answer-match-v2", expectedValue: JSON.stringify(list[0].expectedValue), allocatedMarks: 5, partialMarks: null, additionalCriteria: list.map((criterion) => ({ target: criterion.target, expectedValue: JSON.stringify(criterion.expectedValue), alternatives: criterion.alternatives, ignoreCase: criterion.ignoreCase, kind: criterion.kind, place: criterion.place })) }));
  await db.query("select public.save_word_efficiency_grading_rules('50000000-0000-0000-0000-000000000005',$1::jsonb)", [JSON.stringify(payload)]);
  const stored = (await db.query("select additional_criteria from public.word_efficiency_grading_rules order by allocated_marks, id")).rows;
  assert.ok(stored.every((row) => row.additional_criteria.every((criterion) => "kind" in criterion && "place" in criterion)), "kind/place are saved");
  const marks = async (document) => (await db.query(`select q.question_number n, public.evaluate_word_efficiency_grading_rule($1::jsonb,r.exact_target,r.expected_operation,r.expected_value,r.allocated_marks,r.partial_marks,r.additional_criteria,null)::float m from public.word_efficiency_grading_rules r join public.word_efficiency_questions q on q.id=r.question_id order by q.question_number`, [JSON.stringify(document)])).rows.map((row) => row.m);
  const bold3 = para("p3", "Three", { bold: true });
  const hdr = header("SAMRADHI CLASSES", { bold: true });
  assert.deepEqual(await marks(doc([hdr, para("p1", "One"), para("p2", "Two"), bold3])), [5, 5], "header first");
  assert.deepEqual(await marks(doc([para("p1", "One"), para("p2", "Two"), bold3])), [0, 5], "no header: Q2 still found");
  assert.deepEqual(await marks(doc([para("p1", "One"), para("p2", "Two"), para("p3", "Three"), hdr])), [5, 0], "header last, paragraph not bolded");
  assert.deepEqual(await marks(original()), [0, 0]);
});
