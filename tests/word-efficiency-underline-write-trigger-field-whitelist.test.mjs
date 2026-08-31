import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

// This is the REAL live bug: "Autosave failed: Document run fields are
// invalid" survived every earlier fix because the actual failure point was
// never assert_word_efficiency_document_schema (the RPC-level validator,
// which strips newer run fields in its own wrap-chain layers before ever
// reaching assert_word_efficiency_underline_styles) -- it was the
// validate_word_efficiency_underline_write trigger (before update of
// document_autosave/final_document_snapshot on word_efficiency_attempts,
// added in migration 202608240011), which calls
// assert_word_efficiency_underline_styles directly on the RAW document with
// none of that stripping. That function's run-field whitelist was never
// extended for smallCaps/allCaps/hidden (202608280040) or
// charScale/charSpacing/charPosition/kerningEnabled/kerningMin
// (202608310043) until 202608310047 -- so this test drives an actual UPDATE
// of document_autosave (the real code path autosave_word_efficiency_document
// takes), not a direct call to the validator function, to prove the whole
// trigger chain now accepts these fields end to end.
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
  "202608310045_word_efficiency_drop_cap_options_and_wide_columns.sql",
].map((name) => new URL(`../supabase/migrations/${name}`, import.meta.url));
const FIX_MIGRATION = new URL("../supabase/migrations/202608310047_fix_underline_write_trigger_field_whitelist.sql", import.meta.url);

const student = "73000000-0000-0000-0000-000000000001";
const testId = "73000000-0000-0000-0000-000000000002";
const versionId = "73000000-0000-0000-0000-000000000003";
const attemptId = "73000000-0000-0000-0000-000000000004";

function baseRun(overrides = {}) {
  return { text: "Hello", bold: false, italic: false, underline: false, strike: false, superscript: false, subscript: false, fontFamily: null, fontSize: null, color: null, highlight: null, doubleStrike: false, href: null, bookmark: null, field: null, ...overrides };
}
function baseDocument(overrides = {}) {
  return { schemaVersion: "2", blocks: [{ id: "block-0", type: "paragraph", alignment: "left", runs: [baseRun()], attrs: {} }], pageLayout: { padding: null, maxWidth: null, aspectRatio: null, columnCount: null, backgroundColor: null, border: null, watermark: null }, operations: [], savedAt: new Date().toISOString(), ...overrides };
}

async function database({ applyFix }) {
  const db = new PGlite();
  await db.exec(`
create schema auth;
create table auth.users(id uuid primary key);
create table auth.state(uid uuid);
insert into auth.state values('${student}');
create function auth.uid()returns uuid language sql stable as $$select uid from auth.state limit 1$$;
create role anon;create role authenticated;
create table public.profiles(id uuid primary key,role text,is_active boolean);
insert into public.profiles values('${student}','student',true);
insert into auth.users(id) values('${student}');
create function public.is_active_word_efficiency_student()returns boolean language sql stable as $$select exists(select 1 from public.profiles where id=auth.uid() and role='student' and is_active)$$;
create function public.is_aal2_admin()returns boolean language sql stable as $$select false$$;
create table public.word_efficiency_tests(id uuid primary key,slug text,title text,current_version_id uuid,current_version_number int default 1);
create table public.word_efficiency_versions(id uuid primary key,test_id uuid,version_number int default 1,title text,language text,description text default '',instructions_markdown text default 'Instructions here for the test.',delivery_onscreen boolean default true,delivery_pdf boolean default false,question_count int default 1,maximum_marks numeric default 5,duration_options int[] default array[600],passing_marks numeric,pdf_path text,pdf_file_name text,pdf_size_bytes bigint,pdf_page_count int,pdf_uploaded_at timestamptz,working_matter_snapshot jsonb,editor_capabilities jsonb,model_answer_snapshot jsonb,created_by uuid);
create table public.word_efficiency_questions(id uuid primary key,version_id uuid,question_number int,instruction text,marks numeric,section text,display_order int,is_visible boolean default true);
create table public.word_efficiency_attempts(id uuid primary key,test_id uuid,version_id uuid,student_id uuid,delivery_method text default 'onscreen',status text default'active',selected_duration_seconds int,snapshot jsonb default'{}'::jsonb,result jsonb,submitted_at timestamptz,started_at timestamptz,updated_at timestamptz,original_document_snapshot jsonb,final_document_snapshot jsonb,document_autosave jsonb);
create table public.word_efficiency_question_scores(id uuid primary key default gen_random_uuid(),attempt_id uuid,question_id uuid,question_number int,maximum_marks numeric,awarded_marks numeric,teacher_comment text,grading_status text default'ungraded',grading_note_snapshot text,graded_by uuid,graded_at timestamptz,created_at timestamptz default now(),updated_at timestamptz default now());
create table public.word_efficiency_grading_rules(id uuid primary key default gen_random_uuid(),version_id uuid,question_id uuid,exact_target text,expected_operation text,expected_value jsonb,allocated_marks numeric,partial_marks numeric,created_at timestamptz default now());
insert into public.word_efficiency_tests(id,title)values('${testId}','Sample Test');
`);
  for (const path of CHAIN) await db.exec(await readFile(path, "utf8"));
  if (applyFix) await db.exec(await readFile(FIX_MIGRATION, "utf8"));

  const caps = (await db.query("select public.word_efficiency_default_editor_capabilities() as caps")).rows[0].caps;
  const workingMatter = { schemaVersion: 1, language: "English", paragraphs: [{ id: "p1", type: "paragraph", paragraphNumber: 1, listGroup: null, runs: [{ text: "Hi", bold: false, italic: false, underline: false, strike: false, fontFamily: null, fontSize: null, color: null, highlight: null }], alignment: "left", leftIndent: 0, rightIndent: 0, lineSpacing: 1, spaceBefore: 0, spaceAfter: 0 }], formattingSummary: {}, warnings: [] };
  await db.query("insert into public.word_efficiency_versions(id,test_id,editor_capabilities,working_matter_snapshot)values($1,$2,$3::jsonb,$4::jsonb)", [versionId, testId, JSON.stringify(caps), JSON.stringify(workingMatter)]);
  await db.query("insert into public.word_efficiency_attempts(id,test_id,version_id,student_id,status,started_at,original_document_snapshot)values($1,$2,$3,$4,'active',now(),$5::jsonb)", [attemptId, testId, versionId, student, JSON.stringify(workingMatter)]);
  return db;
}

test("BEFORE the fix, autosaving a document with a smallCaps run reproduces the reported live bug: the trigger rejects it even though the RPC-level validator would accept it", async () => {
  const db = await database({ applyFix: false });
  const document = baseDocument({ blocks: [{ id: "block-0", type: "paragraph", alignment: "left", runs: [baseRun({ smallCaps: true })], attrs: {} }] });
  await assert.rejects(
    db.query("update public.word_efficiency_attempts set document_autosave=$2::jsonb where id=$1", [attemptId, JSON.stringify(document)]),
    /Document run fields are invalid/,
  );
  await db.close();
});

for (const [label, overrides] of [
  ["smallCaps", { smallCaps: true }],
  ["allCaps", { allCaps: true }],
  ["hidden", { hidden: true }],
  ["charScale", { charScale: 150 }],
  ["charSpacing", { charSpacing: 2.5 }],
  ["charPosition", { charPosition: -3 }],
  ["kerningEnabled and kerningMin", { kerningEnabled: true, kerningMin: 12 }],
]) {
  test(`AFTER the fix, autosaving a document with a ${label} run field succeeds through the real trigger`, async () => {
    const db = await database({ applyFix: true });
    const document = baseDocument({ blocks: [{ id: "block-0", type: "paragraph", alignment: "left", runs: [baseRun(overrides)], attrs: {} }] });
    await assert.doesNotReject(db.query("update public.word_efficiency_attempts set document_autosave=$2::jsonb where id=$1", [attemptId, JSON.stringify(document)]));
    await db.close();
  });
}

test("AFTER the fix, a genuinely unknown/unsupported run field is still rejected by the trigger (the whitelist widening is not a bypass)", async () => {
  const db = await database({ applyFix: true });
  const document = baseDocument({ blocks: [{ id: "block-0", type: "paragraph", alignment: "left", runs: [baseRun({ notARealField: "x" })], attrs: {} }] });
  await assert.rejects(
    db.query("update public.word_efficiency_attempts set document_autosave=$2::jsonb where id=$1", [attemptId, JSON.stringify(document)]),
    /Document run fields are invalid/,
  );
  await db.close();
});

test("AFTER the fix, submitting a final_document_snapshot with the newer fields also succeeds through the same trigger", async () => {
  const db = await database({ applyFix: true });
  const document = baseDocument({ blocks: [{ id: "block-0", type: "paragraph", alignment: "left", runs: [baseRun({ allCaps: true, kerningEnabled: false })], attrs: {} }] });
  await assert.doesNotReject(db.query("update public.word_efficiency_attempts set final_document_snapshot=$2::jsonb where id=$1", [attemptId, JSON.stringify(document)]));
  await db.close();
});

test("the fix migration only widens the field whitelist -- underline-metadata validation rules are unchanged", async () => {
  const db = await database({ applyFix: true });
  const invalidStyle = baseDocument({ blocks: [{ id: "block-0", type: "paragraph", alignment: "left", runs: [baseRun({ underline: true, underlineStyle: "not-a-real-style" })], attrs: {} }] });
  await assert.rejects(
    db.query("update public.word_efficiency_attempts set document_autosave=$2::jsonb where id=$1", [attemptId, JSON.stringify(invalidStyle)]),
    /Invalid underline style/,
  );
  const orphanedMetadata = baseDocument({ blocks: [{ id: "block-0", type: "paragraph", alignment: "left", runs: [baseRun({ underline: false, underlineColor: "FF0000" })], attrs: {} }] });
  await assert.rejects(
    db.query("update public.word_efficiency_attempts set document_autosave=$2::jsonb where id=$1", [attemptId, JSON.stringify(orphanedMetadata)]),
    /Underline metadata requires underline/,
  );
  await db.close();
});
