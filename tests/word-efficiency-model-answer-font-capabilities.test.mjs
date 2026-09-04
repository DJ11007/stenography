import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const originalMigrationPath = new URL("../supabase/migrations/202608280039_word_efficiency_model_answer_grading.sql", import.meta.url);
const fixMigrationPath = new URL("../supabase/migrations/202609040059_model_answer_uses_real_editor_capabilities.sql", import.meta.url);
const admin = "51000000-0000-0000-0000-000000000001";
const version = "51000000-0000-0000-0000-000000000004";
const testId = "51000000-0000-0000-0000-000000000003";

// The real fontFamily rule (present since migration 202608240006, still true
// through 202608310049): a run's fontFamily is only valid when it's a key in
// the CAPABILITIES OBJECT's own 'fonts' list -- this stub reproduces exactly
// that one rule (not the rest of the real, much larger document schema
// validator) so the test can isolate the actual regression: which
// capabilities object save_word_efficiency_model_answer passes in as the
// second argument.
const FONT_RULE_SQL = `
create function public.assert_word_efficiency_document_schema(d jsonb,caps jsonb)
returns void language plpgsql immutable as $$
declare block_value jsonb;run_value jsonb;
begin
 for block_value in select value from jsonb_array_elements(coalesce(d->'blocks','[]'::jsonb)) loop
  for run_value in select value from jsonb_array_elements(coalesce(block_value->'runs','[]'::jsonb)) loop
   if jsonb_typeof(run_value->'fontFamily')='string' and not(caps->'fonts')?(run_value->>'fontFamily') then
    raise exception 'Disabled or unknown document font';
   end if;
  end loop;
 end loop;
end $$;
`;
// Mirrors the real public.word_efficiency_default_editor_capabilities()
// (migration 202608280040 onward): only 5 basic fonts.
const DEFAULT_CAPABILITIES_FONTS = ["Calibri (Body)", "Calibri", "Arial", "Times New Roman", "Mangal"];
// Mirrors the real client-side recommendedWordEditorCapabilities()
// (lib/word-editor-capabilities.ts), which every real test version actually
// gets saved with at creation time: the FULL APPROVED_WORD_FONTS list,
// including "Bookman Old Style" -- the exact font Q8 asked the admin to
// apply, and the one that reproduced "Autosave: Save failed." live.
const REAL_VERSION_CAPABILITIES_FONTS = [...DEFAULT_CAPABILITIES_FONTS, "Bookman Old Style", "Cambria", "Georgia", "Verdana"];

async function database(fixed) {
  const db = new PGlite();
  await db.exec(`
create schema auth;
create table auth.state(uid uuid);
insert into auth.state values('${admin}');
create function auth.uid()returns uuid language sql stable as $$select uid from auth.state limit 1$$;
create role anon;create role authenticated;
create table public.profiles(id uuid primary key,role text,is_active boolean);
insert into public.profiles values('${admin}','admin',true);
create function public.is_aal2_admin()returns boolean language sql stable as $$select exists(select 1 from public.profiles where id=auth.uid()and role='admin')$$;
create function public.word_efficiency_default_editor_capabilities()returns jsonb language sql immutable as $$select jsonb_build_object('fonts','${JSON.stringify(DEFAULT_CAPABILITIES_FONTS)}'::jsonb)$$;
create function public.normalize_word_efficiency_editor_capabilities(c jsonb)returns jsonb language sql immutable as $$select coalesce(c,public.word_efficiency_default_editor_capabilities())$$;
${FONT_RULE_SQL}
create table public.word_efficiency_tests(id uuid primary key);
create table public.word_efficiency_versions(id uuid primary key,test_id uuid,title text,language text,editor_capabilities jsonb,model_answer_snapshot jsonb);
create table public.word_efficiency_grading_rules(id uuid primary key default gen_random_uuid(),version_id uuid,question_id uuid,exact_target text,expected_operation text,expected_value jsonb,allocated_marks numeric,partial_marks numeric);
-- Minimal stand-ins so migration 039's %rowtype declarations (in functions
-- this test never calls -- submit_word_efficiency_document, save_word_
-- efficiency_grading_rules) resolve at CREATE FUNCTION time; their columns
-- don't need to be complete since those functions are never executed here.
create table public.word_efficiency_attempts(id uuid primary key,test_id uuid,version_id uuid,student_id uuid,status text,selected_duration_seconds int,started_at timestamptz,snapshot jsonb,original_document_snapshot jsonb,final_document_snapshot jsonb,document_autosave jsonb,submitted_at timestamptz,updated_at timestamptz);
create table public.word_efficiency_questions(id uuid primary key,version_id uuid,question_number int,marks numeric);
create table public.word_efficiency_question_scores(id uuid primary key default gen_random_uuid(),attempt_id uuid,question_id uuid,awarded_marks numeric,grading_status text,graded_by uuid,updated_at timestamptz);
insert into public.word_efficiency_tests values('${testId}');
insert into public.word_efficiency_versions(id,test_id,title,language,editor_capabilities)values('${version}','${testId}','Practice Test','English',jsonb_build_object('fonts','${JSON.stringify(REAL_VERSION_CAPABILITIES_FONTS)}'::jsonb));
`);
  await db.exec(await readFile(originalMigrationPath, "utf8"));
  if (fixed) await db.exec(await readFile(fixMigrationPath, "utf8"));
  return db;
}
const asAdmin = (db) => db.query("update auth.state set uid=$1", [admin]);
const documentWithFont = (fontFamily) => JSON.stringify({ schemaVersion: "2", blocks: [{ id: "block-0", type: "paragraph", alignment: "left", runs: [{ text: "Hello", fontFamily }] }], pageLayout: {}, operations: [], savedAt: new Date().toISOString() });

// Real reported bug, traced live: Q8 asked the admin to set a paragraph to
// "Bookman Old Style" (offered by the Font Name box / Font dialog -- both
// list the full APPROVED_WORD_FONTS set). Applying it made the very next
// Model Answer autosave fail with "Save failed.", even though the exact
// same font works fine in a student's own attempt. save_word_efficiency_
// model_answer validated against the hardcoded, narrow public.word_
// efficiency_default_editor_capabilities() (5 fonts) instead of the
// version's own real, stored editor_capabilities (60 fonts) -- the one
// validation path in this whole app that used the wrong object.
test("before the fix: a real test version's own approved font still fails Model Answer autosave, because the RPC checks the wrong (narrow, hardcoded) capabilities", async () => {
  const db = await database(false);
  await asAdmin(db);
  await assert.rejects(db.query("select public.save_word_efficiency_model_answer($1,$2::jsonb)", [version, documentWithFont("Bookman Old Style")]), /Disabled or unknown document font/);
  await db.close();
});

test("after the fix: save_word_efficiency_model_answer checks the version's own real editor_capabilities, so its full approved font list is accepted", async () => {
  const db = await database(true);
  await asAdmin(db);
  await db.query("select public.save_word_efficiency_model_answer($1,$2::jsonb)", [version, documentWithFont("Bookman Old Style")]);
  const saved = (await db.query("select model_answer_snapshot from public.word_efficiency_versions where id=$1", [version])).rows[0];
  assert.equal(saved.model_answer_snapshot.blocks[0].runs[0].fontFamily, "Bookman Old Style");
  await db.close();
});

test("after the fix: a font that isn't in even the version's own approved list is still rejected -- the check still means something", async () => {
  const db = await database(true);
  await asAdmin(db);
  await assert.rejects(db.query("select public.save_word_efficiency_model_answer($1,$2::jsonb)", [version, documentWithFont("Comic Sans MS")]), /Disabled or unknown document font/);
  await db.close();
});
