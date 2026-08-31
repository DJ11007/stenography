import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

// Loads the REAL, full historical chain of migrations that build up
// assert_word_efficiency_document_schema/assert_word_efficiency_capability_changes/
// word_efficiency_document_feature, in the exact order they were applied,
// ending with this feature's own migration -- so this test exercises the
// actual wrap-chain a real database has, not a hand-simplified stand-in.
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
].map((name) => new URL(`../supabase/migrations/${name}`, import.meta.url));
const FINAL_MIGRATION = CHAIN.at(-1);

const admin = "72000000-0000-0000-0000-000000000001";
const student = "72000000-0000-0000-0000-000000000002";
const testId = "72000000-0000-0000-0000-000000000003";

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
create table public.word_efficiency_tests(id uuid primary key,slug text,title text,current_version_id uuid,current_version_number int default 1);
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

test("charScale, charSpacing, charPosition, kerningEnabled, and kerningMin are accepted within range and round-trip through the validator", async () => {
  const db = await database();
  const caps = (await db.query("select public.word_efficiency_default_editor_capabilities() as caps")).rows[0].caps;
  const document = baseDocument({ blocks: [{ id: "block-0", type: "paragraph", alignment: "left", runs: [baseRun({ charScale: 150, charSpacing: 2.5, charPosition: -3, kerningEnabled: true, kerningMin: 12 })], attrs: {} }] });
  await assert.doesNotReject(db.query("select public.assert_word_efficiency_document_schema($1::jsonb,$2::jsonb)", [JSON.stringify(document), JSON.stringify(caps)]));
  await db.close();
});

test("charScale outside 1-600 is rejected", async () => {
  const db = await database();
  const caps = (await db.query("select public.word_efficiency_default_editor_capabilities() as caps")).rows[0].caps;
  const document = baseDocument({ blocks: [{ id: "block-0", type: "paragraph", alignment: "left", runs: [baseRun({ charScale: 601 })], attrs: {} }] });
  await assert.rejects(db.query("select public.assert_word_efficiency_document_schema($1::jsonb,$2::jsonb)", [JSON.stringify(document), JSON.stringify(caps)]), /Invalid character scale/);
  await db.close();
});

test("charSpacing and charPosition outside -100..100 are rejected", async () => {
  const db = await database();
  const caps = (await db.query("select public.word_efficiency_default_editor_capabilities() as caps")).rows[0].caps;
  const spacing = baseDocument({ blocks: [{ id: "block-0", type: "paragraph", alignment: "left", runs: [baseRun({ charSpacing: 101 })], attrs: {} }] });
  await assert.rejects(db.query("select public.assert_word_efficiency_document_schema($1::jsonb,$2::jsonb)", [JSON.stringify(spacing), JSON.stringify(caps)]), /Invalid character spacing/);
  const position = baseDocument({ blocks: [{ id: "block-0", type: "paragraph", alignment: "left", runs: [baseRun({ charPosition: -101 })], attrs: {} }] });
  await assert.rejects(db.query("select public.assert_word_efficiency_document_schema($1::jsonb,$2::jsonb)", [JSON.stringify(position), JSON.stringify(caps)]), /Invalid character position/);
  await db.close();
});

test("a non-boolean kerningEnabled and an out-of-range kerningMin are both rejected", async () => {
  const db = await database();
  const caps = (await db.query("select public.word_efficiency_default_editor_capabilities() as caps")).rows[0].caps;
  const flag = baseDocument({ blocks: [{ id: "block-0", type: "paragraph", alignment: "left", runs: [baseRun({ kerningEnabled: "yes" })], attrs: {} }] });
  await assert.rejects(db.query("select public.assert_word_efficiency_document_schema($1::jsonb,$2::jsonb)", [JSON.stringify(flag), JSON.stringify(caps)]), /Invalid kerning flag/);
  const min = baseDocument({ blocks: [{ id: "block-0", type: "paragraph", alignment: "left", runs: [baseRun({ kerningEnabled: true, kerningMin: 100 })], attrs: {} }] });
  await assert.rejects(db.query("select public.assert_word_efficiency_document_schema($1::jsonb,$2::jsonb)", [JSON.stringify(min), JSON.stringify(caps)]), /Invalid kerning minimum size/);
  await db.close();
});

test("a run missing every character-spacing field entirely still validates (older documents are unaffected)", async () => {
  const db = await database();
  const caps = (await db.query("select public.word_efficiency_default_editor_capabilities() as caps")).rows[0].caps;
  await assert.doesNotReject(db.query("select public.assert_word_efficiency_document_schema($1::jsonb,$2::jsonb)", [JSON.stringify(baseDocument()), JSON.stringify(caps)]));
  await db.close();
});

test("capability-change detection recognizes charScale/charSpacing/charPosition/kerningEnabled/kerningMin under the fontDialog capability and allows them since students always get full capabilities", async () => {
  const db = await database();
  const caps = (await db.query("select public.word_efficiency_default_editor_capabilities() as caps")).rows[0].caps;
  const before = baseDocument();
  const after = baseDocument({ blocks: [{ ...before.blocks[0], runs: [baseRun({ charScale: 150, charSpacing: 1, charPosition: 1, kerningEnabled: true, kerningMin: 8 })] }] });
  await assert.doesNotReject(db.query("select public.assert_word_efficiency_capability_changes($1::jsonb,$2::jsonb,$3::jsonb)", [JSON.stringify(after), JSON.stringify(before), JSON.stringify(caps)]));
  await db.close();
});

test("an ordinary schema-v1 document still validates unaffected by any of the new fields", async () => {
  const db = await database();
  const caps = (await db.query("select public.word_efficiency_default_editor_capabilities() as caps")).rows[0].caps;
  const v1 = { schemaVersion: "1", blocks: [{ id: "block-0", type: "paragraph", alignment: "left", runs: [{ text: "Hello", bold: false, italic: false, underline: false, strike: false, superscript: false, subscript: false, fontFamily: null, fontSize: null, color: null, highlight: null }] }], savedAt: new Date().toISOString() };
  await assert.doesNotReject(db.query("select public.assert_word_efficiency_document_schema($1::jsonb,$2::jsonb)", [JSON.stringify(v1), JSON.stringify(caps)]));
  await db.close();
});

test("the migration leaves word_efficiency_default_editor_capabilities untouched (no new command ID was introduced)", async () => {
  const db = await database();
  const caps = (await db.query("select public.word_efficiency_default_editor_capabilities() as caps")).rows[0].caps;
  assert.equal(caps.tabs.Home.groups.font.options.fontDialog, true);
  assert.deepEqual(Object.keys(caps.tabs.Home.groups.font.options).sort(), ["bold", "changeCase", "decreaseFontSize", "fontColor", "fontDialog", "fontName", "fontSize", "highlightColor", "increaseFontSize", "italic", "strikeThrough", "subscript", "superscript", "textEffects", "underline"]);
  await db.close();
});
