import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("the admin test form offers a question-paper PDF upload for every mode (not just stenography), with a way to keep or remove existing content", async () => {
  const manager = await read("app/admin/tests/test-manager.tsx");
  assert.match(manager, /<Field label="Question paper PDF \(optional\)">/);
  assert.doesNotMatch(manager, /formMode==="stenography" && <Field label="Question paper PDF/);
  assert.match(manager, /name="existingPdfPath"/);
  assert.match(manager, /name="existingPdfFileName"/);
  assert.match(manager, /name="removePdf"/);
  assert.match(manager, /name="pdfFile" type="file" accept="application\/pdf"/);
});

// Real reported bug: uploads through the Server Action hit Netlify's
// serverless function body-size limit well before this app's own 20MB PDF
// allowance -- see stenography-audio-admin.test.mjs for the audio
// counterpart of this same fix. PDFs now upload directly from the browser
// to Supabase Storage via a signed URL, so only the resulting path (and
// file name) travels through the Server Action.
test("saving a managed test resolves a question-paper PDF from an already-uploaded path (direct-to-storage) regardless of mode, distinct from the dictation-audio upload", async () => {
  const actions = await read("app/admin/tests/actions.ts");
  assert.match(actions, /async function resolvePdfPath/);
  assert.match(actions, /const uploadedPath = text\(formData, "uploadedPdfPath"\)/);
  assert.match(actions, /const resolvedPdf = await resolvePdfPath\(formData\);/);
  assert.doesNotMatch(actions, /if \(draft\.mode === "stenography"\)[\s\S]{0,40}resolvePdfPath/);
  assert.match(actions, /pdf_path: resolvedPdf\.pdfPath, pdf_file_name: resolvedPdf\.pdfFileName/);
});

test("the admin form uploads the question-paper PDF directly to Supabase Storage on submit, never through the Server Action body", async () => {
  const manager = await read("app/admin/tests/test-manager.tsx");
  assert.match(manager, /createTestAssetUploadUrl\("pdf", editing\?\.id \?\? null, pdfFile\.name\)/);
  assert.match(manager, /storage\.from\(result\.bucket\)\.uploadToSignedUrl\(result\.path, result\.token, pdfFile\)/);
  assert.match(manager, /formData\.set\("uploadedPdfPath", result\.path\)/);
  assert.match(manager, /formData\.delete\("pdfFile"\)/);
});

test("the storage-cleanup job processor accepts both the stenography-audio and managed-test-pdfs buckets, keyed to the right configuration field", async () => {
  const actions = await read("app/admin/tests/actions.ts");
  assert.match(actions, /const safeBucket = job\.bucket === "stenography-audio" \|\| job\.bucket === "managed-test-pdfs";/);
  assert.match(actions, /const configKey = job\.bucket === "managed-test-pdfs" \? "pdf_path" : "audio_path";/);
});

test("students see a Download PDF button when the admin attached one, separate from the auto-generated Print/PDF button", async () => {
  const workspace = await read("app/typing/_components/configurable-typing-exam.tsx");
  assert.match(workspace, /\{preset\.pdfUrl && <a href=\{preset\.pdfUrl\}/);
  assert.match(workspace, /Download PDF/);
  assert.match(workspace, /onClick=\{printPassage\}[^>]+>🖨️<\/button>/); // still present, unreplaced
});

test("both server routes that build a managed test preset (direct practice workspace and the canonical /tests/[slug] page) sign and populate pdfUrl the same way they already do for audioUrl", async () => {
  const navigator = await read("app/typing/practice/_components/practice-navigator.tsx");
  const slugPage = await read("app/tests/[slug]/page.tsx");
  for (const source of [navigator, slugPage]) {
    assert.match(source, /storage\.from\("managed-test-pdfs"\)\.createSignedUrl\(version\.pdfPath, ?3600\)/);
    assert.match(source, /preset\.pdfUrl ?= ?signed\?\.signedUrl ?\?\? ?null;/);
  }
});

test("ExamPreset and ManagedTestVersion carry pdfUrl/pdfPath alongside the existing audioUrl/audioPath fields", async () => {
  const curriculum = await read("lib/typing-curriculum.ts");
  const adminTests = await read("lib/admin-tests.ts");
  assert.match(curriculum, /pdfUrl\?: string \| null;/);
  assert.match(curriculum, /pdfFileName\?: string \| null;/);
  assert.match(adminTests, /pdfPath\?: string \| null;/);
  assert.match(adminTests, /pdfFileName\?: string \| null;/);
});
