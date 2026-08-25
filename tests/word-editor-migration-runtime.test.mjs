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
const gradingMigrationPath = new URL("../supabase/migrations/202608240010_word_efficiency_grading_and_results.sql", import.meta.url);
const underlineMigrationPath = new URL("../supabase/migrations/202608240011_word_efficiency_font_and_underline_styles.sql", import.meta.url);
const repair012MigrationPath = new URL("../supabase/migrations/202608250012_repair_word_efficiency_fonts_clipboard_and_measurements.sql", import.meta.url);
const repair013MigrationPath = new URL("../supabase/migrations/202608250013_repair_word_efficiency_margin_serialization.sql", import.meta.url);
const grading014MigrationPath = new URL("../supabase/migrations/202608250014_word_efficiency_explicit_grading_rules.sql", import.meta.url);
const realDocxPath = "F:/AJAY/ABHUTIM SAMRADHI/L.D.C. EFFICIENCY TEST/efficiency test english/TEST PAPER 1/practice test 1.docx";
const studentId = "00000000-0000-4000-8000-000000000001";
const versionId = "00000000-0000-4000-8000-000000000002";
const historicalVersionId = "00000000-0000-4000-8000-000000000090";
const historicalAttemptId = "00000000-0000-4000-8000-000000000091";

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
    create table public.profiles(id uuid primary key);
    insert into public.profiles values('${studentId}');
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
      passing_marks numeric,
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
    create table public.word_efficiency_question_scores(id uuid primary key default gen_random_uuid(),attempt_id uuid,question_id uuid,question_number integer,maximum_marks numeric,awarded_marks numeric,teacher_comment text,grading_status text,grading_note_snapshot text,graded_by uuid,graded_at timestamptz,created_at timestamptz default now(),updated_at timestamptz default now());
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
      result jsonb,
      submitted_at timestamptz,
      updated_at timestamptz
    );
    create function public.is_active_word_efficiency_student() returns boolean language sql stable as $$select true$$;
    create function public.is_aal2_admin() returns boolean language sql stable as $$select true$$;
    create function public.assert_word_efficiency_working_matter(jsonb) returns void language plpgsql immutable as $$begin return;end$$;
    create function public.word_efficiency_document_feature(d jsonb,f text) returns jsonb language sql immutable as $$select '{}'::jsonb$$;
  `);
  await database.exec(await readFile(migrationPath, "utf8"));
  await database.exec(await readFile(flowMigrationPath, "utf8"));
  await database.exec(await readFile(submissionMigrationPath, "utf8"));
  await database.exec(await readFile(measurementMigrationPath, "utf8"));
  await database.exec(await readFile(gradingMigrationPath, "utf8"));
  await database.query("insert into public.word_efficiency_versions(id,title,editor_capabilities,working_matter_snapshot)values($1,'Historical version','{}'::jsonb,$2::jsonb)", [historicalVersionId, workingMatter]);
  await database.query("insert into public.word_efficiency_attempts(id,student_id,version_id,status,original_document_snapshot,snapshot)values($1,$2,$3,'prepared',$4::jsonb,$5::jsonb)", [historicalAttemptId, studentId, historicalVersionId, workingMatter, { historical: true }]);
  await database.exec(await readFile(underlineMigrationPath, "utf8"));
  await database.exec(await readFile(repair012MigrationPath, "utf8"));
  await database.exec(await readFile(repair013MigrationPath, "utf8"));
  await database.exec(await readFile(grading014MigrationPath, "utf8"));
  return database;
}

async function editorSetup(database, id = versionId, matter = workingMatter, mutateCapabilities = value => value) {
  const { rows: [{ capabilities: defaults }] } = await database.query("select public.word_efficiency_default_editor_capabilities() as capabilities");
  const capabilities = mutateCapabilities(structuredClone(defaults));
  await database.query("insert into public.word_efficiency_versions(id,editor_capabilities,working_matter_snapshot)values($1,$2::jsonb,$3::jsonb)", [id, capabilities, matter]);
  const { rows: [{ baseline }] } = await database.query("select public.word_efficiency_initial_editor_document($1::jsonb) as baseline", [matter]);
  return { capabilities, baseline };
}

function styled(document, patch) {
  const value = structuredClone(document);
  Object.assign(value.blocks[0].runs[0], patch);
  value.savedAt = "2026-08-25T00:00:00.000Z";
  return value;
}

test("migration 011 executes after migrations 006 through 010 and preserves existing rows", async () => {
  const database = await createRuntime();
  try {
    const { rows: [version] } = await database.query("select title,working_matter_snapshot from public.word_efficiency_versions where id=$1", [historicalVersionId]);
    const { rows: [attempt] } = await database.query("select status,original_document_snapshot,snapshot,document_autosave,final_document_snapshot from public.word_efficiency_attempts where id=$1", [historicalAttemptId]);
    assert.equal(version.title, "Historical version"); assert.deepEqual(version.working_matter_snapshot, workingMatter);
    assert.equal(attempt.status, "prepared"); assert.deepEqual(attempt.original_document_snapshot, workingMatter); assert.deepEqual(attempt.snapshot, { historical: true });
    assert.equal(attempt.document_autosave, null); assert.equal(attempt.final_document_snapshot, null);
  } finally { await database.close(); }
});

test("migration 011 accepts every underline style and historical boolean-only documents", async () => {
  const database = await createRuntime();
  try {
    const { capabilities, baseline } = await editorSetup(database);
    await database.query("select public.assert_word_efficiency_document_schema($1::jsonb,$2::jsonb)", [documentV1, capabilities]);
    for (const underlineStyle of ["single", "double", "thick", "dotted", "dashed", "dot-dash", "dot-dot-dash", "wavy", "words-only"]) {
      const candidate = styled(baseline, { underline: true, underlineStyle, underlineColor: "336699", underlineThickness: underlineStyle === "thick" ? 3 : null, underlineWordsOnly: underlineStyle === "words-only" });
      await database.query("select public.assert_word_efficiency_document_schema($1::jsonb,$2::jsonb)", [candidate, capabilities]);
    }
  } finally { await database.close(); }
});

test("migration 011 rejects invalid underline metadata through the database schema function", async () => {
  const database = await createRuntime();
  try {
    const { capabilities, baseline } = await editorSetup(database);
    const invalid = [
      ["style", { underline: true, underlineStyle: "blink" }, /Invalid underline style/],
      ["color", { underline: true, underlineStyle: "single", underlineColor: "red;url(x)" }, /Invalid underline color/],
      ["thickness", { underline: true, underlineStyle: "thick", underlineThickness: 6 }, /Invalid underline thickness/],
      ["words-only", { underline: true, underlineStyle: "words-only", underlineWordsOnly: "yes" }, /Invalid words-only underline setting/],
    ];
    for (const [, patch, pattern] of invalid) await assert.rejects(database.query("select public.assert_word_efficiency_document_schema($1::jsonb,$2::jsonb)", [styled(baseline, patch), capabilities]), pattern);
  } finally { await database.close(); }
});

test("migration 011 validates initialization autosave normal submission and grace submission", async () => {
  const database = await createRuntime();
  try {
    const { baseline } = await editorSetup(database);
    const candidate = styled(baseline, { underline: true, underlineStyle: "wavy", underlineColor: "336699", underlineThickness: null, underlineWordsOnly: false });

    const initialized = "00000000-0000-4000-8000-000000000092";
    await database.query("insert into public.word_efficiency_attempts(id,student_id,version_id,status)values($1,$2,$3,'prepared')", [initialized, studentId, versionId]);
    await database.query("select public.initialize_word_efficiency_document($1::uuid,false)", [initialized]);

    const normal = "00000000-0000-4000-8000-000000000093";
    await database.query("insert into public.word_efficiency_attempts(id,student_id,version_id,status,started_at,original_document_snapshot,snapshot)values($1,$2,$3,'active',now(),$4::jsonb,jsonb_build_object('initial_editor_document',$5::jsonb))", [normal, studentId, versionId, workingMatter, baseline]);
    await database.query("select public.autosave_word_efficiency_document($1::uuid,$2::jsonb)", [normal, candidate]);
    await database.query("select public.submit_word_efficiency_document($1::uuid,$2::jsonb)", [normal, candidate]);

    const grace = "00000000-0000-4000-8000-000000000094";
    await database.query("insert into public.word_efficiency_attempts(id,student_id,version_id,status,started_at,selected_duration_seconds,original_document_snapshot,document_autosave,snapshot)values($1,$2,$3,'active',now()-interval '601 seconds',600,$4::jsonb,$5::jsonb,jsonb_build_object('initial_editor_document',$6::jsonb))", [grace, studentId, versionId, workingMatter, candidate, baseline]);
    await database.query("select public.submit_word_efficiency_document($1::uuid,$2::jsonb)", [grace, candidate]);
    const { rows } = await database.query("select id,status,final_document_snapshot from public.word_efficiency_attempts where id in($1,$2)order by id", [normal, grace]);
    assert.equal(rows.length, 2); assert.ok(rows.every(row => row.status === "submitted")); assert.ok(rows.every(row => row.final_document_snapshot.blocks[0].runs[0].underlineStyle === "wavy"));
  } finally { await database.close(); }
});

test("disabled Underline rejects all metadata changes including originally underlined text", async () => {
  const database = await createRuntime();
  try {
    const disabledVersion = "00000000-0000-4000-8000-000000000095";
    const disableUnderline = capabilities => { capabilities.tabs.Home.groups.font.options.underline = false; return capabilities; };
    const { baseline } = await editorSetup(database, disabledVersion, workingMatter, disableUnderline);
    const patches = [
      { underline: false, underlineStyle: "single" },
      { underline: false, underlineColor: "336699" },
      { underline: false, underlineThickness: 2 },
      { underline: false, underlineWordsOnly: true },
    ];
    for (let index = 0; index < patches.length; index++) {
      const attemptId = `00000000-0000-4000-8000-0000000001${String(index).padStart(2, "0")}`;
      await database.query("insert into public.word_efficiency_attempts(id,student_id,version_id,status,started_at,original_document_snapshot,snapshot)values($1,$2,$3,'active',now(),$4::jsonb,jsonb_build_object('initial_editor_document',$5::jsonb))", [attemptId, studentId, disabledVersion, workingMatter, baseline]);
      await assert.rejects(database.query("select public.autosave_word_efficiency_document($1::uuid,$2::jsonb)", [attemptId, styled(baseline, patches[index])]), /Underline metadata requires underline|Disabled underline capability/);
    }

    const underlinedMatter = structuredClone(workingMatter); underlinedMatter.paragraphs[0].runs[0].underline = true;
    const underlinedVersion = "00000000-0000-4000-8000-000000000096";
    const { baseline: underlinedBaseline } = await editorSetup(database, underlinedVersion, underlinedMatter, disableUnderline);
    for (const [index, patch] of [{ underlineStyle: "double" }, { underlineColor: "336699" }, { underlineThickness: 2 }, { underlineWordsOnly: true }].entries()) {
      const attemptId = `00000000-0000-4000-8000-0000000002${String(index).padStart(2, "0")}`;
      await database.query("insert into public.word_efficiency_attempts(id,student_id,version_id,status,started_at,original_document_snapshot,snapshot)values($1,$2,$3,'active',now(),$4::jsonb,jsonb_build_object('initial_editor_document',$5::jsonb))", [attemptId, studentId, underlinedVersion, underlinedMatter, underlinedBaseline]);
      await assert.rejects(database.query("select public.autosave_word_efficiency_document($1::uuid,$2::jsonb)", [attemptId, styled(underlinedBaseline, patch)]), /Disabled underline capability changed document feature/);
    }
  } finally { await database.close(); }
});

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

test("migration 013 treats every browser zero margin form equally and still rejects non-zero drift",async()=>{const database=await createRuntime();try{const{capabilities,baseline}=await editorSetup(database);assert.equal(baseline.blocks[0].attrs.marginRight,"0in");const forms=[undefined,null,"",0,"0","0in","0pt","0px"," 0px ","0em","0rem","0%","0vh"];for(const[index,value]of forms.entries()){const candidate=structuredClone(baseline);if(value===undefined)delete candidate.blocks[0].attrs.marginRight;else candidate.blocks[0].attrs.marginRight=value;const{rows:[{feature}]}=await database.query("select public.word_efficiency_document_feature($1::jsonb,'marginRight') as feature",[candidate]);assert.equal(feature["block-0"],0,`zero form ${String(value)}`);await database.query("select public.assert_word_efficiency_capability_changes($1::jsonb,$2::jsonb,$3::jsonb)",[candidate,baseline,capabilities]);if(index<8){const attemptId=`00000000-0000-4000-8000-${String(130+index).padStart(12,"0")}`;await database.query("insert into public.word_efficiency_attempts(id,student_id,version_id,status,started_at,original_document_snapshot,snapshot)values($1,$2,$3,'active',now(),$4::jsonb,jsonb_build_object('editor_capabilities',$5::jsonb,'initial_editor_document',$6::jsonb))",[attemptId,studentId,versionId,workingMatter,capabilities,baseline]);await database.query("select public.autosave_word_efficiency_document($1::uuid,$2::jsonb)",[attemptId,candidate])}}const nonzero=structuredClone(baseline);nonzero.blocks[0].attrs.marginRight="1px";await assert.rejects(database.query("select public.assert_word_efficiency_capability_changes($1::jsonb,$2::jsonb,$3::jsonb)",[nonzero,baseline,capabilities]),/marginRight/);for(const unsafe of["1em","1rem","1%"]){const candidate=structuredClone(baseline);candidate.blocks[0].attrs.marginRight=unsafe;await assert.rejects(database.query("select public.word_efficiency_document_feature($1::jsonb,'marginRight')",[candidate]),/safe CSS unit/)}}finally{await database.close()}});

test("real PRACTICE TEST Strikethrough snapshots preserve exact marginRight through autosave and submissions",async()=>{const database=await createRuntime();try{const original=parseWorkingMatterDocx(new Uint8Array(await readFile(realDocxPath)));const{capabilities,baseline}=await editorSetup(database,versionId,original);assert.equal(original.paragraphs[0].rightIndent,0);assert.equal(baseline.blocks[0].attrs.marginRight,"0in");const browserAfterStrike=structuredClone(baseline);browserAfterStrike.operations=["strikeThrough"];browserAfterStrike.blocks[0].runs[0].strike=true;browserAfterStrike.savedAt="2026-08-25T12:00:00.000Z";assert.equal(browserAfterStrike.blocks[0].attrs.marginRight,"0in");assert.deepEqual({...browserAfterStrike.blocks[0].runs[0],strike:false},baseline.blocks[0].runs[0]);const normalId="00000000-0000-4000-8000-000000000150";await database.query("insert into public.word_efficiency_attempts(id,student_id,version_id,status)values($1,$2,$3,'prepared')",[normalId,studentId,versionId]);await database.query("select public.initialize_word_efficiency_document($1::uuid,false)",[normalId]);await database.query("update public.word_efficiency_attempts set status='active',started_at=now() where id=$1",[normalId]);await database.query("select public.autosave_word_efficiency_document($1::uuid,$2::jsonb)",[normalId,browserAfterStrike]);await database.query("select public.submit_word_efficiency_document($1::uuid,$2::jsonb)",[normalId,browserAfterStrike]);const browserAfterDouble=structuredClone(baseline);browserAfterDouble.operations=["textEffects"];browserAfterDouble.blocks[0].runs[0].doubleStrike=true;browserAfterDouble.savedAt="2026-08-25T12:00:01.000Z";assert.equal(browserAfterDouble.blocks[0].runs[0].strike,false);assert.equal(browserAfterDouble.blocks[0].attrs.marginRight,"0in");const graceId="00000000-0000-4000-8000-000000000151";await database.query("insert into public.word_efficiency_attempts(id,student_id,version_id,status,started_at,selected_duration_seconds,original_document_snapshot,document_autosave,snapshot)values($1,$2,$3,'active',now()-interval '601 seconds',600,$4::jsonb,$5::jsonb,jsonb_build_object('editor_capabilities',$6::jsonb,'initial_editor_document',$7::jsonb))",[graceId,studentId,versionId,original,browserAfterDouble,capabilities,baseline]);await database.query("select public.submit_word_efficiency_document($1::uuid,$2::jsonb)",[graceId,browserAfterDouble]);const{rows}=await database.query("select id,status,document_autosave,final_document_snapshot from public.word_efficiency_attempts where id in($1,$2)order by id",[normalId,graceId]);assert.equal(rows[0].status,"submitted");assert.equal(rows[0].final_document_snapshot.blocks[0].runs[0].strike,true);assert.equal(rows[0].final_document_snapshot.blocks[0].runs[0].doubleStrike,false);assert.equal(rows[1].status,"submitted");assert.equal(rows[1].document_autosave.blocks[0].runs[0].strike,false);assert.equal(rows[1].final_document_snapshot.blocks[0].runs[0].doubleStrike,true);assert.ok(rows.every(row=>row.final_document_snapshot.blocks[0].attrs.marginRight==="0in"))}finally{await database.close()}});

test("migration 012 accepts approved expanded fonts and rejects arbitrary names",async()=>{const database=await createRuntime();try{const{capabilities,baseline}=await editorSetup(database);for(const font of["Bahnschrift SemiBold","Nirmala UI","Noto Sans Devanagari"]){const caps=structuredClone(capabilities);caps.fonts=[font];await database.query("select public.assert_word_efficiency_editor_capabilities($1::jsonb)",[caps]);const document=structuredClone(baseline);document.blocks[0].runs[0].fontFamily=font;await database.query("select public.assert_word_efficiency_document_schema($1::jsonb,$2::jsonb)",[document,caps])}const malicious=structuredClone(capabilities);malicious.fonts=["Client Supplied Font"];await assert.rejects(database.query("select public.assert_word_efficiency_editor_capabilities($1::jsonb)",[malicious]),/Unknown or duplicate editor font/)}finally{await database.close()}});

test("migration 014 stores explicit rules, validates marks, and locks them after attempt preparation",async()=>{const database=await createRuntime();try{const questionId="00000000-0000-4000-8000-000000000214";await database.query("insert into public.word_efficiency_versions(id,title,editor_capabilities,working_matter_snapshot)values($1,'Rule version','{}'::jsonb,$2::jsonb)",[versionId,workingMatter]);await database.query("insert into public.word_efficiency_questions(id,version_id,question_number,display_order,instruction,marks,section,is_visible)values($1,$2,1,1,'Apply bold',5,null,true)",[questionId,versionId]);const rules=[{questionNumber:1,exactTarget:"blocks.paragraph-0.runs.0.bold",expectedOperation:"bold",expectedValue:"true",allocatedMarks:5,partialMarks:2}];await database.query("select public.save_word_efficiency_grading_rules($1::uuid,$2::jsonb)",[versionId,rules]);const{rows:[saved]}=await database.query("select exact_target,expected_operation,expected_value,allocated_marks,partial_marks from public.word_efficiency_grading_rules where version_id=$1",[versionId]);assert.equal(saved.exact_target,rules[0].exactTarget);assert.equal(saved.expected_operation,"bold");assert.equal(saved.expected_value,true);assert.equal(Number(saved.allocated_marks),5);await assert.rejects(database.query("select public.save_word_efficiency_grading_rules($1::uuid,$2::jsonb)",[versionId,[{...rules[0],allocatedMarks:6}]]),/exceed question marks/);await database.query("insert into public.word_efficiency_attempts(id,student_id,version_id,status)values('00000000-0000-4000-8000-000000000215',$1,$2,'prepared')",[studentId,versionId]);await assert.rejects(database.query("select public.save_word_efficiency_grading_rules($1::uuid,$2::jsonb)",[versionId,rules]),/immutable after an attempt/)}finally{await database.close()}});
