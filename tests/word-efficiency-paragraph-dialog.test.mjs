import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

// Loads the REAL, full historical chain of migrations that build up
// word_efficiency_default_editor_capabilities/assert_word_efficiency_capability_changes,
// in the exact order they were applied, ending with this feature's own
// migration -- so this test exercises the actual wrap-chain a real database
// has, not a hand-simplified stand-in.
const CHAIN = [
  "202608240005_word_efficiency_hierarchical_editor_capabilities.sql",
  "202608240006_repair_editor_capability_runtime_functions.sql",
  "202608240007_word_efficiency_capability_version_flow.sql",
  "202608240008_repair_word_efficiency_submission_baseline.sql",
  "202608240009_repair_word_efficiency_measurement_canonicalization.sql",
  "202608240011_word_efficiency_font_and_underline_styles.sql",
  "202608250012_repair_word_efficiency_fonts_clipboard_and_measurements.sql",
  "202608250016_word_efficiency_margin_expansion.sql",
  "202608250017_word_efficiency_automatic_grading.sql",
  "202608250019_word_efficiency_margin_capability_pairing.sql",
  "202608250020_word_efficiency_full_student_capabilities.sql",
  "202608250021_word_efficiency_hyphens_capability_pairing.sql",
  "202608260022_word_efficiency_full_student_capabilities.sql",
  "202608260025_word_efficiency_list_style_gallery.sql",
  "202608280039_word_efficiency_model_answer_grading.sql",
  "202608280040_word_efficiency_font_dialog_and_layout_options.sql",
  "202608310043_word_efficiency_character_spacing.sql",
  "202608310044_word_efficiency_paragraph_dialog.sql",
].map((name) => new URL(`../supabase/migrations/${name}`, import.meta.url));
const FINAL_MIGRATION = CHAIN.at(-1);
const CHAIN_BEFORE_FINAL = CHAIN.slice(0, -1);

const admin = "73000000-0000-0000-0000-000000000001";
const student = "73000000-0000-0000-0000-000000000002";
const testId = "73000000-0000-0000-0000-000000000003";

function baseRun(overrides = {}) {
  return { text: "Hello", bold: false, italic: false, underline: false, strike: false, superscript: false, subscript: false, fontFamily: null, fontSize: null, color: null, highlight: null, doubleStrike: false, href: null, bookmark: null, field: null, ...overrides };
}
function baseDocument(overrides = {}) {
  return { schemaVersion: "2", blocks: [{ id: "block-0", type: "paragraph", alignment: "left", runs: [baseRun()], attrs: {} }], pageLayout: { padding: null, maxWidth: null, aspectRatio: null, columnCount: null, backgroundColor: null, border: null, watermark: null }, operations: [], savedAt: new Date().toISOString(), ...overrides };
}

async function database(chain = CHAIN) {
  const db = new PGlite();
  await db.exec(`
create schema auth;
create table auth.users(id uuid primary key);
create table auth.state(uid uuid);
insert into auth.state values('${student}');
create function auth.uid()returns uuid language sql stable as $$select uid from auth.state limit 1$$;
create role anon;create role authenticated;
create table public.profiles(id uuid primary key,role text,is_active boolean);
insert into public.profiles values('${admin}','admin',true),('${student}','student',true);
insert into auth.users(id) values('${admin}'),('${student}');
create function public.is_active_word_efficiency_student()returns boolean language sql stable as $$select exists(select 1 from public.profiles where id=auth.uid() and role='student' and is_active)$$;
create function public.is_aal2_admin()returns boolean language sql stable as $$select exists(select 1 from public.profiles where id=auth.uid() and role='admin')$$;
create table public.word_efficiency_tests(id uuid primary key default gen_random_uuid(),slug text,title text,current_version_id uuid,current_version_number int default 1);
create table public.word_efficiency_versions(id uuid primary key,test_id uuid,version_number int default 1,title text,language text,description text default '',instructions_markdown text default 'Instructions here for the test.',delivery_onscreen boolean default true,delivery_pdf boolean default false,question_count int default 1,maximum_marks numeric default 5,duration_options int[] default array[600],passing_marks numeric,pdf_path text,pdf_file_name text,pdf_size_bytes bigint,pdf_page_count int,pdf_uploaded_at timestamptz,working_matter_snapshot jsonb,editor_capabilities jsonb,model_answer_snapshot jsonb,created_by uuid);
create table public.word_efficiency_questions(id uuid primary key,version_id uuid,question_number int,instruction text,marks numeric,section text,display_order int,is_visible boolean default true);
create table public.word_efficiency_attempts(id uuid primary key,test_id uuid,version_id uuid,student_id uuid,delivery_method text default 'onscreen',status text default'active',selected_duration_seconds int,snapshot jsonb default'{}'::jsonb,result jsonb,submitted_at timestamptz,started_at timestamptz,updated_at timestamptz,original_document_snapshot jsonb,final_document_snapshot jsonb,document_autosave jsonb);
create table public.word_efficiency_question_scores(id uuid primary key default gen_random_uuid(),attempt_id uuid,question_id uuid,question_number int,maximum_marks numeric,awarded_marks numeric,teacher_comment text,grading_status text default'ungraded',grading_note_snapshot text,graded_by uuid,graded_at timestamptz,created_at timestamptz default now(),updated_at timestamptz default now());
create table public.word_efficiency_grading_rules(id uuid primary key default gen_random_uuid(),version_id uuid,question_id uuid,exact_target text,expected_operation text,expected_value jsonb,allocated_marks numeric,partial_marks numeric,created_at timestamptz default now());
insert into public.word_efficiency_tests(id,title)values('${testId}','Sample Test');
`);
  for (const path of chain) await db.exec(await readFile(path, "utf8"));
  return db;
}

test("the full historical migration chain loads cleanly and produces the new paragraphDialog capability command", async () => {
  const db = await database();
  const { rows } = await db.query("select public.word_efficiency_default_editor_capabilities() as caps");
  assert.equal(rows[0].caps.tabs.Home.groups.paragraph.options.paragraphDialog, true);
  await db.close();
});

test("existing versions and in-progress attempts (saved under the pre-migration capability shape) are backfilled by this migration to include paragraphDialog", async () => {
  const db = await database(CHAIN_BEFORE_FINAL);
  const oldCaps = (await db.query("select public.word_efficiency_default_editor_capabilities() as caps")).rows[0].caps;
  assert.equal(oldCaps.tabs.Home.groups.paragraph.options.paragraphDialog, undefined, "test setup sanity check: paragraphDialog should not exist before this migration");
  const version = "73000000-0000-0000-0000-000000000004";
  await db.query("insert into public.word_efficiency_versions(id,test_id,title,language,working_matter_snapshot,editor_capabilities) values($1,$2,'v','English','{}'::jsonb,$3::jsonb)", [version, testId, JSON.stringify(oldCaps)]);
  await db.query("update public.word_efficiency_tests set current_version_id=$1 where id=$2", [version, testId]);
  const attempt = "73000000-0000-0000-0000-000000000005";
  await db.query("insert into public.word_efficiency_attempts(id,test_id,version_id,student_id,status,selected_duration_seconds,snapshot) values($1,$2,$3,$4,'active',600,jsonb_build_object('editor_capabilities',$5::jsonb))", [attempt, testId, version, student, JSON.stringify(oldCaps)]);
  await db.exec(await readFile(FINAL_MIGRATION, "utf8"));
  const versionRow = (await db.query("select editor_capabilities from public.word_efficiency_versions where id=$1", [version])).rows[0];
  assert.equal(versionRow.editor_capabilities.tabs.Home.groups.paragraph.options.paragraphDialog, true);
  const attemptRow = (await db.query("select snapshot from public.word_efficiency_attempts where id=$1", [attempt])).rows[0];
  assert.equal(attemptRow.snapshot.editor_capabilities.tabs.Home.groups.paragraph.options.paragraphDialog, true);
  await db.close();
});

test("changing alignment, indents, spacing, hyphenation, or line numbers via the Paragraph dialog is allowed when only paragraphDialog is enabled (not the individual commands)", async () => {
  const db = await database();
  const caps = (await db.query("select public.word_efficiency_default_editor_capabilities() as caps")).rows[0].caps;
  // Disable every individual command that would otherwise gate these features, leaving only paragraphDialog enabled.
  const restricted = JSON.parse(JSON.stringify(caps));
  for (const command of ["alignLeft", "alignCenter", "alignRight", "justify", "increaseIndent", "decreaseIndent", "lineSpacing", "borders", "shading", "lineNumbers"]) restricted.tabs.Home.groups.paragraph.options[command] = false;
  restricted.tabs["Page Layout"].groups.pageSetup.options.lineNumbers = false;
  const before = baseDocument();
  const after = baseDocument({ blocks: [{ id: "block-0", type: "paragraph", alignment: "center", runs: [baseRun()], attrs: { marginLeft: "0.5in", marginRight: "0.5in", marginTop: "12pt", marginBottom: "12pt", lineHeight: "1.5", hyphens: "auto", lineNumbers: true } }] });
  await assert.doesNotReject(db.query("select public.assert_word_efficiency_capability_changes($1::jsonb,$2::jsonb,$3::jsonb)", [JSON.stringify(after), JSON.stringify(before), JSON.stringify(restricted)]));
  await db.close();
});

test("the same change is still rejected when neither the individual commands nor paragraphDialog are enabled", async () => {
  const db = await database();
  const caps = (await db.query("select public.word_efficiency_default_editor_capabilities() as caps")).rows[0].caps;
  const restricted = JSON.parse(JSON.stringify(caps));
  for (const command of ["alignLeft", "alignCenter", "alignRight", "justify", "paragraphDialog"]) restricted.tabs.Home.groups.paragraph.options[command] = false;
  const before = baseDocument();
  const after = baseDocument({ blocks: [{ ...before.blocks[0], alignment: "center" }] });
  await assert.rejects(db.query("select public.assert_word_efficiency_capability_changes($1::jsonb,$2::jsonb,$3::jsonb)", [JSON.stringify(after), JSON.stringify(before), JSON.stringify(restricted)]), /Disabled capability changed document feature/);
  await db.close();
});

test("no new document schema fields were introduced (the paragraph dialog reuses existing attrs/alignment), so an ordinary document with those attrs still validates", async () => {
  const db = await database();
  const caps = (await db.query("select public.word_efficiency_default_editor_capabilities() as caps")).rows[0].caps;
  const document = baseDocument({ blocks: [{ id: "block-0", type: "paragraph", alignment: "justify", runs: [baseRun()], attrs: { marginLeft: "1in", marginRight: "1in", marginTop: "6pt", marginBottom: "6pt", lineHeight: "2", specialIndentMode: "hanging", specialIndentAmount: "0.5in", hyphens: "auto", lineNumbers: true } }] });
  await assert.doesNotReject(db.query("select public.assert_word_efficiency_document_schema($1::jsonb,$2::jsonb)", [JSON.stringify(document), JSON.stringify(caps)]));
  await db.close();
});
