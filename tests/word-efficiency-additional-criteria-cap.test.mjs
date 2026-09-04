import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const baseGradingMigrationPath = new URL("../supabase/migrations/202608250017_word_efficiency_automatic_grading.sql", import.meta.url);
const modelAnswerMigrationPath = new URL("../supabase/migrations/202608280039_word_efficiency_model_answer_grading.sql", import.meta.url);
const capMigrationPath = new URL("../supabase/migrations/202609040058_raise_additional_grading_criteria_cap.sql", import.meta.url);
const admin = "51000000-0000-0000-0000-000000000001";
const student = "51000000-0000-0000-0000-000000000002";
const testId = "51000000-0000-0000-0000-000000000003";
const version = "51000000-0000-0000-0000-000000000004";
const questionMulti = "51000000-0000-0000-0000-000000000005";
const questionOther = "51000000-0000-0000-0000-000000000006";

async function database() {
  const db = new PGlite();
  await db.exec(`
create schema auth;
create table auth.state(uid uuid);
insert into auth.state values('${student}');
create function auth.uid()returns uuid language sql stable as $$select uid from auth.state limit 1$$;
create role anon;create role authenticated;
create table public.profiles(id uuid primary key,role text,is_active boolean);
insert into public.profiles values('${admin}','admin',true),('${student}','student',true);
create function public.is_active_word_efficiency_student()returns boolean language sql stable as $$select exists(select 1 from public.profiles where id=auth.uid()and role='student'and is_active)$$;
create function public.is_aal2_admin()returns boolean language sql stable as $$select exists(select 1 from public.profiles where id=auth.uid()and role='admin')$$;
create function public.word_efficiency_default_editor_capabilities()returns jsonb language sql immutable as $$select '{}'::jsonb$$;
create function public.normalize_word_efficiency_editor_capabilities(c jsonb)returns jsonb language sql immutable as $$select coalesce(c,'{}'::jsonb)$$;
create function public.assert_word_efficiency_editor_capabilities(c jsonb)returns void language plpgsql immutable as $$begin end $$;
create function public.word_efficiency_initial_editor_document(m jsonb)returns jsonb language sql immutable as $$select m$$;
create function public.assert_word_efficiency_document_schema(d jsonb,caps jsonb)returns void language plpgsql immutable as $$begin end $$;
create function public.assert_word_efficiency_capability_changes(d jsonb,baseline jsonb,caps jsonb)returns void language plpgsql immutable as $$begin end $$;
create table public.word_efficiency_tests(id uuid primary key);
create table public.word_efficiency_versions(id uuid primary key,test_id uuid,title text,language text,maximum_marks numeric,passing_marks numeric,editor_capabilities jsonb,model_answer_snapshot jsonb);
create table public.word_efficiency_questions(id uuid primary key,version_id uuid,instruction text,display_order int,question_number int,marks numeric default 5);
create table public.word_efficiency_attempts(id uuid primary key,test_id uuid,version_id uuid,student_id uuid,status text,selected_duration_seconds int,started_at timestamptz,snapshot jsonb,result jsonb,submitted_at timestamptz,updated_at timestamptz,original_document_snapshot jsonb,final_document_snapshot jsonb,document_autosave jsonb);
create table public.word_efficiency_question_scores(id uuid primary key default gen_random_uuid(),attempt_id uuid,question_id uuid,question_number int,maximum_marks numeric,awarded_marks numeric,teacher_comment text,grading_status text,grading_note_snapshot text,graded_by uuid,graded_at timestamptz,created_at timestamptz default now(),updated_at timestamptz default now());
create table public.word_efficiency_grading_rules(id uuid primary key default gen_random_uuid(),version_id uuid,question_id uuid,exact_target text,expected_operation text,expected_value jsonb,allocated_marks numeric,partial_marks numeric);
insert into public.word_efficiency_tests values('${testId}');
insert into public.word_efficiency_versions(id,test_id,title,language,maximum_marks,passing_marks,editor_capabilities)values('${version}','${testId}','Practice Test','English',10,5,'{}'::jsonb);
insert into public.word_efficiency_questions(id,version_id,instruction,display_order,question_number,marks)values('${questionMulti}','${version}','Restyle a multi-run paragraph',1,1,5),('${questionOther}','${version}','Write a summary',2,2,5);
`);
  await db.exec(await readFile(baseGradingMigrationPath, "utf8"));
  await db.exec(await readFile(modelAnswerMigrationPath, "utf8"));
  await db.exec(await readFile(capMigrationPath, "utf8"));
  return db;
}
const asUser = (db, id) => db.query("update auth.state set uid=$1", [id]);
const criteriaOfSize = (count) => Array.from({ length: count }, (_, i) => ({ target: `blocks.block-6.runs.${i}.bold`, expectedValue: "true" }));

// Real reported bug: saving a Model Answer question hit "invalid additional
// grading criteria" -- the original 20-item cap on additional_criteria,
// which is easy to exceed for a legitimate answer touching a paragraph
// with several separate text runs (diffWordDocuments checks ~20 fields per
// run). Raised to 300 in 202609040058; still bounded so a genuinely
// runaway diff is rejected.
test("more than 20 (but at most 300) additional criteria are accepted -- the original cap that broke a real multi-run answer is gone", async () => {
  const db = await database();
  const rules = [{ questionNumber: 1, exactTarget: "blocks.block-6.runs.0.italic", expectedOperation: "model-answer-match", expectedValue: "true", allocatedMarks: 5, partialMarks: null, additionalCriteria: criteriaOfSize(120) }];
  await asUser(db, admin);
  await db.query("select public.save_word_efficiency_grading_rules($1,$2::jsonb)", [version, JSON.stringify(rules)]);
  const saved = (await db.query("select additional_criteria from public.word_efficiency_grading_rules where version_id=$1", [version])).rows[0];
  assert.equal(saved.additional_criteria.length, 120);
  await db.close();
});

test("more than 300 additional criteria are still rejected -- the cap is raised, not removed", async () => {
  const db = await database();
  const rules = [{ questionNumber: 1, exactTarget: "blocks.block-6.runs.0.italic", expectedOperation: "model-answer-match", expectedValue: "true", allocatedMarks: 5, partialMarks: null, additionalCriteria: criteriaOfSize(301) }];
  await asUser(db, admin);
  await assert.rejects(db.query("select public.save_word_efficiency_grading_rules($1,$2::jsonb)", [version, JSON.stringify(rules)]), /invalid additional grading criteria/);
  const rows = (await db.query("select count(*)::int as count from public.word_efficiency_grading_rules where version_id=$1", [version])).rows;
  assert.equal(rows[0].count, 0);
  await db.close();
});
