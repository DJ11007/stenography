import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const targetMigration = new URL("../supabase/migrations/202609081305_fix_word_efficiency_grading_target_uses_ephemeral_id.sql", import.meta.url);
const overhaulMigration = new URL("../supabase/migrations/202610111200_word_efficiency_auto_grading_overhaul.sql", import.meta.url);

const admin = "10000000-0000-0000-0000-00000000000a", student = "20000000-0000-0000-0000-000000000002";
const testId = "40000000-0000-0000-0000-000000000004", version = "50000000-0000-0000-0000-000000000005";
const q1 = "71000000-0000-0000-0000-000000000001", q2 = "72000000-0000-0000-0000-000000000002", q3manual = "73000000-0000-0000-0000-000000000003";

const FULL_TEXT = "Hello World";
const run = (text, extra = {}) => ({ text, bold: false, italic: false, underline: false, color: null, ...extra });
// What a student's document looks like. blocks[0] = the paragraph to capitalize + colour (Q1),
// blocks[1] = a paragraph that must be bold (Q2).
const doc = (blocks, operations = []) => ({ schemaVersion: "2", blocks, pageLayout: {}, operations, savedAt: new Date().toISOString() });
const para = (runs) => ({ id: "x", type: "paragraph", alignment: "left", runs, attrs: {} });
const goodDoc = () => doc([para([run(FULL_TEXT, { color: "C00000" })]), para([run("Bold me", { bold: true })])]);
// Q1's paragraph split into two runs (e.g. because another question highlighted its first line).
const splitDoc = () => doc([para([run("Hello ", { color: "C00000" }), run("World", { color: "C00000" })]), para([run("Bold me", { bold: true })])]);

async function database({ withModel = true, rule2 = true } = {}) {
  const db = new PGlite();
  await db.exec(`
create schema auth;
create table auth.state(uid uuid, admin boolean);
insert into auth.state values('${student}', false);
create function auth.uid() returns uuid language sql stable as $$select uid from auth.state limit 1$$;
create role anon; create role authenticated;
create table public.profiles(id uuid primary key, role text, is_active boolean, full_name text, email text);
insert into public.profiles values('${student}','student',true,'Test Student','s@example.com'),('${admin}','admin',true,'Deepak Admin','a@example.com');
create function public.is_active_word_efficiency_student() returns boolean language sql stable as $$select exists(select 1 from public.profiles where id=auth.uid() and role='student' and is_active)$$;
create function public.is_aal2_admin() returns boolean language sql stable as $$select coalesce((select admin from auth.state limit 1),false)$$;
create function public.normalize_word_efficiency_editor_capabilities(c jsonb) returns jsonb language sql immutable as $$select coalesce(c,'{}'::jsonb)$$;
create function public.assert_word_efficiency_editor_capabilities(c jsonb) returns void language plpgsql immutable as $$begin end $$;
create function public.word_efficiency_initial_editor_document(m jsonb) returns jsonb language sql immutable as $$select m$$;
create function public.assert_word_efficiency_document_schema(d jsonb, caps jsonb) returns void language plpgsql immutable as $$begin end $$;
create function public.assert_word_efficiency_capability_changes(d jsonb, baseline jsonb, caps jsonb) returns void language plpgsql immutable as $$begin end $$;
create table public.word_efficiency_tests(id uuid primary key, current_version_id uuid);
create table public.word_efficiency_versions(id uuid primary key, test_id uuid, title text, language text, maximum_marks numeric, passing_marks numeric, editor_capabilities jsonb, model_answer_snapshot jsonb);
create table public.word_efficiency_questions(id uuid primary key, version_id uuid, question_number int, instruction text, display_order int);
create table public.word_efficiency_attempts(id uuid primary key, test_id uuid, version_id uuid, student_id uuid, status text, selected_duration_seconds int, started_at timestamptz, snapshot jsonb, result jsonb, submitted_at timestamptz, updated_at timestamptz, original_document_snapshot jsonb, final_document_snapshot jsonb, document_autosave jsonb, evaluation_status text, evaluated_at timestamptz, evaluated_by uuid, result_published_at timestamptz, overall_teacher_feedback text, is_live_attempt boolean default false);
create table public.word_efficiency_question_scores(id uuid primary key default gen_random_uuid(), attempt_id uuid, question_id uuid, question_number int, maximum_marks numeric(8,2), awarded_marks numeric(8,2), teacher_comment text, grading_status text, grading_note_snapshot text, graded_by uuid, graded_at timestamptz, created_at timestamptz default now(), updated_at timestamptz default now());
create table public.word_efficiency_grading_rules(id uuid primary key default gen_random_uuid(), version_id uuid, question_id uuid, exact_target text, expected_operation text, expected_value jsonb, allocated_marks numeric, partial_marks numeric, additional_criteria jsonb default '[]'::jsonb);
insert into public.word_efficiency_tests values('${testId}','${version}');
insert into public.word_efficiency_versions values('${version}','${testId}','Efficiency Test','English',5,2,'{}'::jsonb, ${withModel ? `'${JSON.stringify(splitDoc())}'::jsonb` : "null"});
insert into public.word_efficiency_questions values('${q1}','${version}',1,'Capitalize and colour paragraph one',1),('${q2}','${version}',2,'Bold paragraph two',2);
insert into public.word_efficiency_grading_rules(version_id,question_id,exact_target,expected_operation,expected_value,allocated_marks,partial_marks,additional_criteria) values
('${version}','${q1}','blocks.0.runs.0.text','changeCase','${JSON.stringify(FULL_TEXT)}'::jsonb,2.5,1,'[{"target":"blocks.0.runs.0.color","expectedValue":"C00000"}]'::jsonb)
${rule2 ? `,('${version}','${q2}','blocks.1.runs.0.bold','bold','true'::jsonb,2.5,1,'[]'::jsonb)` : ""};
`);
  await db.exec(await readFile(targetMigration, "utf8"));
  await db.exec(await readFile(overhaulMigration, "utf8"));
  return db;
}

const asAdmin = (db) => db.exec(`update auth.state set uid='${admin}', admin=true`);
const asStudent = (db) => db.exec(`update auth.state set uid='${student}', admin=false`);

async function newAttempt(db, id, { maxMarks = 2.5 } = {}) {
  await db.exec(`insert into public.word_efficiency_attempts(id,test_id,version_id,student_id,status,selected_duration_seconds,started_at,snapshot,original_document_snapshot) values('${id}','${testId}','${version}','${student}','active',600,now(),'{}'::jsonb,'{}'::jsonb);
insert into public.word_efficiency_question_scores(attempt_id,question_id,question_number,maximum_marks,grading_status) values('${id}','${q1}',1,${maxMarks},'ungraded'),('${id}','${q2}',2,${maxMarks},'ungraded');`);
}
const submit = (db, id, document) => db.query("select public.submit_word_efficiency_document($1,$2::jsonb)", [id, JSON.stringify(document)]);
const scores = async (db, id) => (await db.query("select question_number, maximum_marks, awarded_marks, grading_status, teacher_comment, graded_by from public.word_efficiency_question_scores where attempt_id=$1 order by question_number", [id])).rows;
const attemptState = async (db, id) => (await db.query("select status, evaluation_status, result, evaluated_by from public.word_efficiency_attempts where id=$1", [id])).rows[0];
const matches = async (db, document, target, expected) => (await db.query("select public.word_efficiency_grading_target_matches($1::jsonb,$2,$3::jsonb) as m", [JSON.stringify(document), target, JSON.stringify(expected)])).rows[0].m;

test("matching still accepts the exact path, and now also a paragraph split into several runs (the Q3-after-Q4 case)", async () => {
  const db = await database();
  assert.equal(await matches(db, goodDoc(), "blocks.0.runs.0.text", FULL_TEXT), true);
  assert.equal(await matches(db, splitDoc(), "blocks.0.runs.0.text", FULL_TEXT), true, "joined runs equal the whole paragraph");
  assert.equal(await matches(db, doc([para([run("Hello ")])]), "blocks.0.runs.0.text", FULL_TEXT), false, "a different text is still wrong");
  await db.close();
});

test("a leading empty run no longer shifts which run a formatting rule reads", async () => {
  const db = await database();
  const shifted = doc([para([run(""), run("Bold me", { bold: true })])]);
  assert.equal(await matches(db, shifted, "blocks.0.runs.0.bold", true), true);
  assert.equal(await matches(db, doc([para([run("x", { bold: false })])]), "blocks.0.runs.0.bold", true), false);
  assert.equal(await matches(db, doc([para([run("x")])]), "blocks.5.runs.0.bold", true), false, "out-of-range paragraph is a miss, not an error");
  await db.close();
});

test("submitting a split-run paragraph now earns the Q1 marks that used to score 0", async () => {
  const db = await database();
  await newAttempt(db, "a1000000-0000-0000-0000-000000000001");
  await submit(db, "a1000000-0000-0000-0000-000000000001", splitDoc());
  const rows = await scores(db, "a1000000-0000-0000-0000-000000000001");
  assert.equal(Number(rows[0].awarded_marks), 2.5);
  assert.equal(Number(rows[1].awarded_marks), 2.5);
  await db.close();
});

test("a wrong or missing change scores 0, and the right tool with a wrong result scores the partial marks", async () => {
  const db = await database();
  await newAttempt(db, "a2000000-0000-0000-0000-000000000002");
  await submit(db, "a2000000-0000-0000-0000-000000000002", doc([para([run("hello world", { color: "C00000" })]), para([run("Bold me", { bold: false })])], ["changeCase", "bold"]));
  const rows = await scores(db, "a2000000-0000-0000-0000-000000000002");
  assert.equal(Number(rows[0].awarded_marks), 1, "used changeCase but text differs -> partial");
  assert.equal(Number(rows[1].awarded_marks), 1, "used bold but not bold -> partial");
  await newAttempt(db, "a2100000-0000-0000-0000-000000000021");
  await submit(db, "a2100000-0000-0000-0000-000000000021", doc([para([run("nothing")]), para([run("nothing")])]));
  const zero = await scores(db, "a2100000-0000-0000-0000-000000000021");
  assert.deepEqual(zero.map((row) => Number(row.awarded_marks)), [0, 0]);
  await db.close();
});

test("marks are scaled to the attempt's own question maximum, so a test whose marks changed can never push a score over its maximum", async () => {
  const db = await database();
  await newAttempt(db, "a3000000-0000-0000-0000-000000000003", { maxMarks: 5 });
  await submit(db, "a3000000-0000-0000-0000-000000000003", goodDoc());
  const rows = await scores(db, "a3000000-0000-0000-0000-000000000003");
  assert.equal(Number(rows[0].awarded_marks), 5, "rule allocates 2.5 but this attempt's question is worth 5: full marks = 5");
  assert.equal(Number(rows[0].awarded_marks) <= Number(rows[0].maximum_marks), true);
  await db.close();
});

test("the self-test passes when every question has a rule the model answer fully satisfies", async () => {
  const db = await database();
  await asAdmin(db);
  const check = (await db.query("select public.check_word_efficiency_auto_grading($1) as c", [testId])).rows[0].c;
  assert.equal(check.ready, true);
  assert.equal(check.hasModelAnswer, true);
  assert.deepEqual(check.questions.map((q) => [q.number, q.hasRule, Number(q.modelGets), q.ok]), [[1, true, 2.5, true], [2, true, 2.5, true]]);
  await db.close();
});

test("the self-test flags a question with no rule, and a missing model answer", async () => {
  const noRule = await database({ rule2: false });
  await asAdmin(noRule);
  const a = (await noRule.query("select public.check_word_efficiency_auto_grading($1) as c", [testId])).rows[0].c;
  assert.equal(a.ready, false);
  assert.equal(a.questions[1].hasRule, false);
  await noRule.close();
  const noModel = await database({ withModel: false });
  await asAdmin(noModel);
  const b = (await noModel.query("select public.check_word_efficiency_auto_grading($1) as c", [testId])).rows[0].c;
  assert.equal(b.hasModelAnswer, false);
  assert.equal(b.ready, false);
  await noModel.close();
});

test("automatic publishing can only be switched on when the self-test passes, and only by an admin", async () => {
  const blocked = await database({ rule2: false });
  await asAdmin(blocked);
  await assert.rejects(blocked.query("select public.set_word_efficiency_auto_publish($1,true)", [testId]), /every question to have a grading rule/);
  await blocked.close();
  const ok = await database();
  await assert.rejects(ok.query("select public.set_word_efficiency_auto_publish($1,true)", [testId]), /not authorized/, "a student cannot switch it on");
  await asAdmin(ok);
  assert.equal((await ok.query("select public.set_word_efficiency_auto_publish($1,true) as r", [testId])).rows[0].r.autoPublish, true);
  assert.equal((await ok.query("select auto_publish_results from public.word_efficiency_tests where id=$1", [testId])).rows[0].auto_publish_results, true);
  await ok.close();
});

test("with the switch OFF (the default) an auto-scored attempt stays pending for a teacher, exactly as before", async () => {
  const db = await database();
  await newAttempt(db, "a4000000-0000-0000-0000-000000000004");
  await submit(db, "a4000000-0000-0000-0000-000000000004", goodDoc());
  const state = await attemptState(db, "a4000000-0000-0000-0000-000000000004");
  assert.equal(state.status, "submitted");
  assert.equal(state.result, null);
  await db.close();
});

test("with the switch ON the attempt is totalled and published at submission, with a plain-language reason per question", async () => {
  const db = await database();
  await asAdmin(db);
  await db.query("select public.set_word_efficiency_auto_publish($1,true)", [testId]);
  await asStudent(db);
  const id = "a5000000-0000-0000-0000-000000000005";
  await newAttempt(db, id);
  await submit(db, id, doc([para([run("hello world", { color: "C00000" })]), para([run("Bold me", { bold: true })])], ["changeCase"]));
  const state = await attemptState(db, id);
  assert.equal(state.status, "completed");
  assert.equal(state.evaluation_status, "published");
  assert.equal(state.evaluated_by, null, "auto-published attempts carry no teacher");
  assert.equal(Number(state.result.marks), 3.5);
  assert.equal(Number(state.result.maximum_marks), 5);
  assert.equal(Number(state.result.percentage), 70);
  assert.equal(state.result.passed, true, "3.5 >= passing marks 2");
  assert.equal(state.result.auto_graded, true);
  const rows = await scores(db, id);
  assert.match(rows[0].teacher_comment, /Partial marks/);
  assert.match(rows[1].teacher_comment, /Full marks/);
  await db.close();
});

test("an attempt with a question that has no rule is NOT auto-published even when the switch is on -- a teacher still has to grade that one", async () => {
  const db = await database();
  await asAdmin(db);
  await db.query("select public.set_word_efficiency_auto_publish($1,true)", [testId]);
  await db.exec(`update public.word_efficiency_tests set auto_publish_results=true`);
  await asStudent(db);
  const id = "a6000000-0000-0000-0000-000000000006";
  await newAttempt(db, id);
  await db.exec(`insert into public.word_efficiency_question_scores(attempt_id,question_id,question_number,maximum_marks,grading_status) values('${id}','${q3manual}',3,2.5,'ungraded')`);
  await submit(db, id, goodDoc());
  const state = await attemptState(db, id);
  assert.equal(state.status, "submitted");
  assert.equal(state.result, null);
  await db.close();
});

test("re-grade fixes an unpublished attempt's auto scores, leaves human-graded and teacher-published work alone, and refreshes auto-published totals", async () => {
  const db = await database();
  const pending = "b1000000-0000-0000-0000-000000000001", human = "b2000000-0000-0000-0000-000000000002", auto = "b3000000-0000-0000-0000-000000000003", teacherPub = "b4000000-0000-0000-0000-000000000004";
  for (const id of [pending, human, auto, teacherPub]) await newAttempt(db, id);
  for (const id of [pending, human]) await submit(db, id, goodDoc());
  // Simulate the old, too-strict rule: the auto score came out 0 although the document is right.
  await db.exec(`update public.word_efficiency_question_scores set awarded_marks=0 where attempt_id='${pending}' and question_number=1;
update public.word_efficiency_question_scores set awarded_marks=0, graded_by='${admin}' where attempt_id='${human}' and question_number=1;`);
  await asAdmin(db);
  await db.query("select public.set_word_efficiency_auto_publish($1,true)", [testId]);
  await asStudent(db);
  await submit(db, auto, goodDoc());
  await db.exec(`update public.word_efficiency_question_scores set awarded_marks=0 where attempt_id='${auto}' and question_number=1;
update public.word_efficiency_attempts set final_document_snapshot='${JSON.stringify(goodDoc())}'::jsonb, status='completed', evaluation_status='published', result='{"marks":2.5,"maximum_marks":5,"percentage":50,"passed":true,"auto_graded":true}'::jsonb, evaluated_by='${admin}' where id='${teacherPub}';
update public.word_efficiency_question_scores set awarded_marks=0, graded_by='${admin}' where attempt_id='${teacherPub}' and question_number=1;`);
  await asAdmin(db);
  const out = (await db.query("select public.regrade_word_efficiency_version($1) as r", [version])).rows[0].r;
  assert.equal(out.scoresChanged, 2, "pending + auto-published were corrected");
  assert.equal(Number((await scores(db, pending))[0].awarded_marks), 2.5);
  assert.equal(Number((await scores(db, human))[0].awarded_marks), 0, "a human-graded row is never overwritten");
  assert.equal(Number((await scores(db, teacherPub))[0].awarded_marks), 0, "a teacher-published attempt is skipped entirely");
  assert.equal(Number((await scores(db, auto))[0].awarded_marks), 2.5);
  assert.equal(Number((await attemptState(db, auto)).result.marks), 5, "auto-published totals were recomputed");
  const log = (await db.query("select source, old_awarded, new_awarded from public.word_efficiency_grade_changes where source='regrade' order by attempt_id")).rows;
  assert.equal(log.length, 2);
  await asStudent(db);
  await assert.rejects(db.query("select public.regrade_word_efficiency_version($1)", [version]), /not authorized/);
  await db.close();
});

test("an admin can adjust one question's marks on a PUBLISHED result with a reason; totals update and the change is logged", async () => {
  const db = await database();
  await asAdmin(db);
  await db.query("select public.set_word_efficiency_auto_publish($1,true)", [testId]);
  await asStudent(db);
  const id = "c1000000-0000-0000-0000-000000000001";
  await newAttempt(db, id);
  await submit(db, id, doc([para([run("nothing")]), para([run("Bold me", { bold: true })])]));
  assert.equal(Number((await attemptState(db, id)).result.marks), 2.5);
  await assert.rejects(db.query("select public.override_word_efficiency_question_marks($1,$2,2.5,'ok then')", [id, q1]), /not authorized/);
  await asAdmin(db);
  await assert.rejects(db.query("select public.override_word_efficiency_question_marks($1,$2,2.5,'')", [id, q1]), /reason/);
  await assert.rejects(db.query("select public.override_word_efficiency_question_marks($1,$2,9,'too many')", [id, q1]), /between 0 and the question maximum/);
  await db.query("select public.override_word_efficiency_question_marks($1,$2,2.5,'Student used the Change Case dialog; result is correct')", [id, q1]);
  const state = await attemptState(db, id);
  assert.equal(Number(state.result.marks), 5);
  assert.equal(Number(state.result.percentage), 100);
  const row = (await scores(db, id))[0];
  assert.equal(Number(row.awarded_marks), 2.5);
  assert.match(row.teacher_comment, /Marks adjusted by your teacher: Student used the Change Case dialog/);
  const log = (await db.query("select source, old_awarded, new_awarded, reason from public.word_efficiency_grade_changes where attempt_id=$1", [id])).rows;
  assert.equal(log.length, 1);
  assert.equal(log[0].source, "override");
  assert.equal(Number(log[0].old_awarded), 0);
  assert.equal(Number(log[0].new_awarded), 2.5);
  await db.close();
});

test("the migration keeps every other line of the current submit function and is wrapped in a transaction", async () => {
  const sql = await readFile(overhaulMigration, "utf8");
  assert.match(sql, /^begin;/);
  assert.match(sql, /commit;\s*$/);
  assert.match(sql, /submission grace expired/);
  assert.match(sql, /post-deadline submission must match the last valid autosave/);
  assert.match(sql, /\*question_scores\.maximum_marks\/rule\.allocated_marks,2\)/);
  assert.match(sql, /perform public\.word_efficiency_auto_publish_attempt\(p_attempt_id\)/);
});

test("the admin history lists adjustments and re-grades with who made them and why, readable only by an admin", async () => {
  const db = await database();
  await asAdmin(db);
  await db.query("select public.set_word_efficiency_auto_publish($1,true)", [testId]);
  await asStudent(db);
  const id = "d1000000-0000-0000-0000-000000000001";
  await newAttempt(db, id);
  await submit(db, id, doc([para([run("nothing")]), para([run("Bold me", { bold: true })])]));
  await assert.rejects(db.query("select * from public.list_word_efficiency_grade_changes($1)", [id]), /not authorized/);
  await asAdmin(db);
  await db.query("select public.override_word_efficiency_question_marks($1,$2,1,'Partly correct on review')", [id, q1]);
  const history = (await db.query("select question_number, old_awarded, new_awarded, source, reason, changed_by_name from public.list_word_efficiency_grade_changes($1)", [id])).rows;
  assert.equal(history.length, 1);
  assert.deepEqual([history[0].question_number, Number(history[0].old_awarded), Number(history[0].new_awarded), history[0].source, history[0].reason, history[0].changed_by_name], [1, 0, 1, "override", "Partly correct on review", "Deepak Admin"]);
  await db.close();
});
