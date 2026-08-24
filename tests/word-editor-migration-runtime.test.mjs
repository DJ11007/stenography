import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { parseWorkingMatterDocx } from "../lib/word-docx.ts";
import { canonicalWordMeasurement } from "../lib/word-editor-measurements.ts";

const migrationPath = new URL("../supabase/migrations/202608240006_repair_editor_capability_runtime_functions.sql", import.meta.url);
const flowMigrationPath = new URL("../supabase/migrations/202608240007_word_efficiency_capability_version_flow.sql", import.meta.url);
const submissionMigrationPath = new URL("../supabase/migrations/202608240008_repair_word_efficiency_submission_baseline.sql", import.meta.url);
const measurementMigrationPath = new URL("../supabase/migrations/202608240009_repair_word_efficiency_measurement_canonicalization.sql", import.meta.url);
const realDocxPath = "F:/AJAY/ABHUTIM SAMRADHI/L.D.C. EFFICIENCY TEST/efficiency test english/TEST PAPER 1/practice test 1.docx";
const studentId = "00000000-0000-4000-8000-000000000001";
const versionId = "00000000-0000-4000-8000-000000000002";

const run = {
  text: "Runtime validation",
  bold: false,
  italic: false,
  underline: false,
  strike: false,
  superscript: false,
  subscript: false,
  fontFamily: "Calibri",
  fontSize: 11,
  color: null,
  highlight: null,
};

const documentV1 = {
  schemaVersion: "1",
  blocks: [{ id: "block-0", type: "paragraph", alignment: "left", runs: [run] }],
  savedAt: "2026-08-24T00:00:00.000Z",
};

const workingMatter = {
  schemaVersion: "1",
  language: "english",
  paragraphs: [{ id: "paragraph-0", type: "paragraph", alignment: "left", runs: [run] }],
};

async function createRuntime() {
  const database = new PGlite();
  await database.exec(`
    create role anon;
    create role authenticated;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$select '${studentId}'::uuid$$;
    create table public.word_efficiency_versions (
      id uuid primary key,
      test_id uuid,
      title text,
      language text,
      instructions_markdown text,
      delivery_onscreen boolean default true,
      delivery_pdf boolean default false,
      duration_options integer[] default array[600],
      question_count integer default 1,
      maximum_marks numeric default 10,
      pdf_path text,
      pdf_file_name text,
      pdf_size_bytes bigint,
      pdf_page_count integer,
      pdf_uploaded_at timestamptz,
      editor_capabilities jsonb,
      working_matter_snapshot jsonb
    );
    create table public.word_efficiency_tests(id uuid primary key,current_version_id uuid,status text);
    create table public.word_efficiency_questions(id uuid primary key,version_id uuid,question_number integer,display_order integer,instruction text,marks numeric,section text,is_visible boolean);
    create table public.word_efficiency_question_scores(attempt_id uuid,question_id uuid,question_number integer,maximum_marks numeric);
    create table public.word_efficiency_attempts (
      id uuid primary key default '00000000-0000-4000-8000-000000000020'::uuid,
      student_id uuid not null,
      version_id uuid not null references public.word_efficiency_versions(id),
      test_id uuid,
      delivery_method text,
      status text not null default 'prepared',
      started_at timestamptz,
      selected_duration_seconds integer not null default 600,
      original_document_snapshot jsonb,
      document_autosave jsonb,
      final_document_snapshot jsonb,
      snapshot jsonb,
      submitted_at timestamptz,
      updated_at timestamptz
    );
    create function public.is_active_word_efficiency_student() returns boolean language sql stable as $$select true$$;
    create function public.assert_word_efficiency_working_matter(jsonb) returns void language plpgsql immutable as $$begin return;end$$;
    create function public.word_efficiency_document_feature(d jsonb,f text) returns jsonb language sql immutable as $$select '{}'::jsonb$$;
  `);
  await database.exec(await readFile(migrationPath, "utf8"));
  await database.exec(await readFile(flowMigrationPath, "utf8"));
  await database.exec(await readFile(submissionMigrationPath, "utf8"));
  await database.exec(await readFile(measurementMigrationPath, "utf8"));
  return database;
}

test("repair migration executes repaired helpers in PostgreSQL without lazy ambiguity", async () => {
  const database = await createRuntime();
  try {
    const { rows: [{ capabilities }] } = await database.query("select public.word_efficiency_default_editor_capabilities() as capabilities");
    await database.query("select public.assert_word_efficiency_editor_capabilities($1::jsonb)", [capabilities]);
    await database.query("select public.assert_word_efficiency_document_schema($1::jsonb,$2::jsonb)", [documentV1, capabilities]);
    const { rows: [{ feature }] } = await database.query("select public.word_efficiency_document_feature($1::jsonb,'bold') as feature", [documentV1]);
    assert.deepEqual(feature, { "block-0": [false] });
    await database.query("select public.assert_word_efficiency_capability_changes($1::jsonb,$1::jsonb,$2::jsonb)", [documentV1, capabilities]);

    await database.query(
      "insert into public.word_efficiency_versions(id,editor_capabilities,working_matter_snapshot)values($1,$2::jsonb,$3::jsonb)",
      [versionId, capabilities, workingMatter],
    );
    await database.query("select public.assert_word_efficiency_edited_document($1::jsonb,$2::uuid)", [documentV1, versionId]);
  } finally {
    await database.close();
  }
});

test("repair migration runtime preserves initialization autosave and submission controls", async () => {
  const database = await createRuntime();
  try {
    const { rows: [{ capabilities }] } = await database.query("select public.word_efficiency_default_editor_capabilities() as capabilities");
    await database.query(
      "insert into public.word_efficiency_versions(id,editor_capabilities,working_matter_snapshot)values($1,$2::jsonb,$3::jsonb)",
      [versionId, capabilities, workingMatter],
    );

    const preparedAttempt = "00000000-0000-4000-8000-000000000003";
    await database.query("insert into public.word_efficiency_attempts(id,student_id,version_id,status)values($1,$2,$3,'prepared')", [preparedAttempt, studentId, versionId]);
    await database.query("select public.initialize_word_efficiency_document($1::uuid,false)", [preparedAttempt]);
    const { rows: [{ original_document_snapshot: original }] } = await database.query("select original_document_snapshot from public.word_efficiency_attempts where id=$1", [preparedAttempt]);
    assert.deepEqual(original, workingMatter);

    const activeAttempt = "00000000-0000-4000-8000-000000000004";
    await database.query(
      "insert into public.word_efficiency_attempts(id,student_id,version_id,status,started_at,original_document_snapshot,snapshot)values($1,$2,$3,'active',now(),$4::jsonb,jsonb_build_object('initial_editor_document',$5::jsonb))",
      [activeAttempt, studentId, versionId, workingMatter, documentV1],
    );
    await database.query("select public.autosave_word_efficiency_document($1::uuid,$2::jsonb)", [activeAttempt, documentV1]);
    await database.query("select public.submit_word_efficiency_document($1::uuid,$2::jsonb)", [activeAttempt, documentV1]);
    const { rows: [{ status, final_document_snapshot: finalSnapshot }] } = await database.query("select status,final_document_snapshot from public.word_efficiency_attempts where id=$1", [activeAttempt]);
    assert.equal(status, "submitted");
    assert.deepEqual(finalSnapshot, documentV1);
  } finally {
    await database.close();
  }
});

test("schema-v2 capabilities survive published version preparation and initialization exactly", async () => {
  const database = await createRuntime();
  try {
    const testId = "00000000-0000-4000-8000-000000000010";
    const currentVersionId = "00000000-0000-4000-8000-000000000011";
    const questionId = "00000000-0000-4000-8000-000000000012";
    const { rows: [{ capabilities }] } = await database.query("select public.word_efficiency_default_editor_capabilities() as capabilities");
    await database.query("insert into public.word_efficiency_versions(id,test_id,title,language,instructions_markdown,delivery_onscreen,duration_options,question_count,maximum_marks,editor_capabilities,working_matter_snapshot)values($1,$2,'All capabilities','English','Instructions',true,array[600],1,10,$3::jsonb,$4::jsonb)", [currentVersionId, testId, capabilities, workingMatter]);
    await database.query("insert into public.word_efficiency_tests(id,current_version_id,status)values($1,$2,'published')", [testId, currentVersionId]);
    await database.query("insert into public.word_efficiency_questions(id,version_id,question_number,display_order,instruction,marks,section,is_visible)values($1,$2,1,1,'Format the document',10,null,true)", [questionId, currentVersionId]);
    const { rows: [{ attempt_id: attemptId }] } = await database.query("select public.prepare_word_efficiency_attempt($1::uuid,600,'onscreen') as attempt_id", [testId]);
    const { rows: [{ snapshot: prepared }] } = await database.query("select snapshot from public.word_efficiency_attempts where id=$1", [attemptId]);
    assert.deepEqual(prepared.editor_capabilities, capabilities);
    await database.query("select public.initialize_word_efficiency_document($1::uuid,true)", [attemptId]);
    const { rows: [{ snapshot: initialized }] } = await database.query("select snapshot from public.word_efficiency_attempts where id=$1", [attemptId]);
    assert.deepEqual(initialized.editor_capabilities, capabilities);
    for (const tab of ["File", "Home", "Insert", "Design", "Page Layout", "View"]) assert.equal(initialized.editor_capabilities.tabs[tab].enabled, true);
    assert.ok(Object.keys(initialized.editor_capabilities.tabs.Insert.groups).length > 0);
    for (const group of Object.values(initialized.editor_capabilities.tabs.Insert.groups)) {
      assert.equal(group.enabled, true);
      assert.ok(Object.values(group.options).every(Boolean));
    }
  } finally {
    await database.close();
  }
});

test("schema-v2 submission succeeds before deadline and matching autosave succeeds in grace", async () => {
  const database = await createRuntime();
  try {
    const { rows: [{ capabilities }] } = await database.query("select public.word_efficiency_default_editor_capabilities() as capabilities");
    await database.query("insert into public.word_efficiency_versions(id,editor_capabilities,working_matter_snapshot)values($1,$2::jsonb,$3::jsonb)", [versionId, capabilities, workingMatter]);
    const { rows: [{ baseline }] } = await database.query("select public.word_efficiency_initial_editor_document($1::jsonb) as baseline", [workingMatter]);

    const beforeDeadline = "00000000-0000-4000-8000-000000000030";
    await database.query("insert into public.word_efficiency_attempts(id,student_id,version_id,status,started_at,original_document_snapshot,snapshot)values($1,$2,$3,'active',now(),$4::jsonb,jsonb_build_object('editor_capabilities',$5::jsonb,'initial_editor_document',$6::jsonb))", [beforeDeadline, studentId, versionId, workingMatter, capabilities, baseline]);
    await database.query("select public.autosave_word_efficiency_document($1::uuid,$2::jsonb)", [beforeDeadline, baseline]);
    await database.query("select public.submit_word_efficiency_document($1::uuid,$2::jsonb)", [beforeDeadline, baseline]);
    const { rows: [submitted] } = await database.query("select status,final_document_snapshot from public.word_efficiency_attempts where id=$1", [beforeDeadline]);
    assert.equal(submitted.status, "submitted"); assert.deepEqual(submitted.final_document_snapshot, baseline);

    const formattedAttempt = "00000000-0000-4000-8000-000000000034"; const formatted = structuredClone(baseline);
    formatted.blocks[0].runs[0].bold = true; formatted.blocks[0].runs[0].italic = true; formatted.blocks[0].runs[0].underline = true;
    await database.query("insert into public.word_efficiency_attempts(id,student_id,version_id,status,started_at,original_document_snapshot,snapshot)values($1,$2,$3,'active',now(),$4::jsonb,jsonb_build_object('editor_capabilities',$5::jsonb,'initial_editor_document',$6::jsonb))", [formattedAttempt, studentId, versionId, workingMatter, capabilities, baseline]);
    await database.query("select public.autosave_word_efficiency_document($1::uuid,$2::jsonb)", [formattedAttempt, formatted]);
    await database.query("select public.submit_word_efficiency_document($1::uuid,$2::jsonb)", [formattedAttempt, formatted]);
    const { rows: [formattedSubmitted] } = await database.query("select status,final_document_snapshot from public.word_efficiency_attempts where id=$1", [formattedAttempt]);
    assert.equal(formattedSubmitted.status, "submitted"); assert.equal(formattedSubmitted.final_document_snapshot.blocks[0].runs[0].bold, true);

    const graceAttempt = "00000000-0000-4000-8000-000000000031";
    await database.query("insert into public.word_efficiency_attempts(id,student_id,version_id,status,started_at,selected_duration_seconds,original_document_snapshot,document_autosave,snapshot)values($1,$2,$3,'active',now()-interval '601 seconds',600,$4::jsonb,$5::jsonb,jsonb_build_object('editor_capabilities',$6::jsonb,'initial_editor_document',$5::jsonb))", [graceAttempt, studentId, versionId, workingMatter, baseline, capabilities]);
    await database.query("select public.submit_word_efficiency_document($1::uuid,$2::jsonb)", [graceAttempt, baseline]);
    const { rows: [graceSubmitted] } = await database.query("select status,final_document_snapshot from public.word_efficiency_attempts where id=$1", [graceAttempt]);
    assert.equal(graceSubmitted.status, "submitted"); assert.deepEqual(graceSubmitted.final_document_snapshot, baseline);
  } finally { await database.close(); }
});

test("failed grace submission leaves the attempt active and unlocked", async () => {
  const database = await createRuntime();
  try {
    const { rows: [{ capabilities }] } = await database.query("select public.word_efficiency_default_editor_capabilities() as capabilities");
    await database.query("insert into public.word_efficiency_versions(id,editor_capabilities,working_matter_snapshot)values($1,$2::jsonb,$3::jsonb)", [versionId, capabilities, workingMatter]);
    const { rows: [{ baseline }] } = await database.query("select public.word_efficiency_initial_editor_document($1::jsonb) as baseline", [workingMatter]);
    const attemptId = "00000000-0000-4000-8000-000000000032";
    await database.query("insert into public.word_efficiency_attempts(id,student_id,version_id,status,started_at,selected_duration_seconds,original_document_snapshot,document_autosave,snapshot)values($1,$2,$3,'active',now()-interval '601 seconds',600,$4::jsonb,$5::jsonb,jsonb_build_object('editor_capabilities',$6::jsonb,'initial_editor_document',$5::jsonb))", [attemptId, studentId, versionId, workingMatter, baseline, capabilities]);
    const changed = structuredClone(baseline); changed.savedAt = "2026-08-24T00:00:01.000Z";
    await assert.rejects(database.query("select public.submit_word_efficiency_document($1::uuid,$2::jsonb)", [attemptId, changed]), /last valid autosave/);
    const { rows: [attempt] } = await database.query("select status,final_document_snapshot from public.word_efficiency_attempts where id=$1", [attemptId]);
    assert.equal(attempt.status, "active"); assert.equal(attempt.final_document_snapshot, null);
  } finally { await database.close(); }
});

test("real DOCX browser measurements canonicalize without hiding genuine margin edits", async () => {
  const database = await createRuntime();
  try {
    const original = parseWorkingMatterDocx(new Uint8Array(await readFile(realDocxPath)));
    const { rows: [{ capabilities }] } = await database.query("select public.word_efficiency_default_editor_capabilities() as capabilities");
    const { rows: [{ baseline }] } = await database.query("select public.word_efficiency_initial_editor_document($1::jsonb) as baseline", [original]);
    await database.query("insert into public.word_efficiency_versions(id,editor_capabilities,working_matter_snapshot)values($1,$2::jsonb,$3::jsonb)", [versionId, capabilities, original]);
    const preparedAttempt = "00000000-0000-4000-8000-000000000033";
    await database.query("insert into public.word_efficiency_attempts(id,student_id,version_id,status,snapshot)values($1,$2,$3,'prepared',jsonb_build_object('editor_capabilities',$4::jsonb))", [preparedAttempt, studentId, versionId, capabilities]);
    await database.query("select public.initialize_word_efficiency_document($1::uuid,false)", [preparedAttempt]);
    const { rows: [{ initialized }] } = await database.query("select snapshot->'initial_editor_document' as initialized from public.word_efficiency_attempts where id=$1", [preparedAttempt]);
    const browserDocument = structuredClone(baseline);
    browserDocument.blocks.forEach((block, index) => {
      const paragraph = original.paragraphs[index]; if (paragraph.type === "list-item") return;
      block.attrs.marginLeft = canonicalWordMeasurement(`${paragraph.leftIndent}in`, "length");
      block.attrs.marginRight = canonicalWordMeasurement(`${paragraph.rightIndent}in`, "length");
      block.attrs.marginTop = canonicalWordMeasurement(`${paragraph.spaceBefore}pt`, "length");
      block.attrs.marginBottom = canonicalWordMeasurement(`${paragraph.spaceAfter}pt`, "length");
      block.attrs.lineHeight = canonicalWordMeasurement(String(paragraph.lineSpacing), "lineHeight");
    });
    assert.equal(original.paragraphs[0].rightIndent, 0); assert.equal(baseline.blocks[0].attrs.marginRight, "0in"); assert.equal(initialized.blocks[0].attrs.marginRight, "0in"); assert.equal(browserDocument.blocks[0].attrs.marginRight, "0pt");
    for (const feature of ["marginRight", "marginLeft", "marginTop", "marginBottom", "lineHeight"]) {
      const { rows: [{ same }] } = await database.query("select public.word_efficiency_document_feature($1::jsonb,$3) = public.word_efficiency_document_feature($2::jsonb,$3) as same", [baseline, browserDocument, feature]);
      assert.equal(same, true, feature);
    }
    await database.query("select public.assert_word_efficiency_capability_changes($1::jsonb,$2::jsonb,$3::jsonb)", [browserDocument, baseline, capabilities]);
    const changedMargin = structuredClone(browserDocument); changedMargin.blocks[0].attrs.marginRight = "1in";
    await assert.rejects(database.query("select public.assert_word_efficiency_capability_changes($1::jsonb,$2::jsonb,$3::jsonb)", [changedMargin, baseline, capabilities]), /marginRight/);
  } finally { await database.close(); }
});
