import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("the stenography admin form exposes a dictation-audio upload only for stenography-mode tests, with a way to keep or remove existing audio", async () => {
  const manager = await read("app/admin/tests/test-manager.tsx");
  assert.match(manager, /\{formMode==="stenography" && <Field label="Dictation audio \(optional\)">/);
  assert.match(manager, /name="existingAudioPath"/);
  assert.match(manager, /name="removeAudio"/);
  assert.match(manager, /name="audioFile" type="file" accept="audio\/\*"/);
  assert.match(manager, /configuration\?\.audio_path/);
});

// Real reported bug: a 5.4MB Hindi dictation audio file consistently
// failed to save on production (Netlify) with a bare browser-level "This
// page couldn't load" -- Netlify's serverless functions hard-cap the
// request body well under this app's own 150MB audio allowance. Fixed by
// uploading the file directly from the browser to Supabase Storage via a
// signed URL/token (createTestAssetUploadUrl), so only a short path
// travels through the Server Action, never the file bytes themselves.
test("saving a managed test resolves dictation audio from an already-uploaded path (direct-to-storage), preserving or clearing the existing path as requested", async () => {
  const actions = await read("app/admin/tests/actions.ts");
  assert.match(actions, /async function resolveAudioPath/);
  assert.match(actions, /export async function createTestAssetUploadUrl/);
  assert.match(actions, /ASSET_UPLOAD_BUCKETS = \{ audio: "stenography-audio", pdf: "managed-test-pdfs" \}/);
  assert.match(actions, /storage\.from\(bucket\)\.createSignedUploadUrl\(path\)/);
  assert.match(actions, /const uploaded = text\(formData, "uploadedAudioPath"\)/);
  assert.match(actions, /removeAudio.*=== "on"/);
  assert.match(actions, /if \(draft\.mode === "stenography"\)/);
  assert.match(actions, /audio_path: audioPath/);
});

test("the admin form uploads dictation audio directly to Supabase Storage on submit, never through the Server Action body", async () => {
  const manager = await read("app/admin/tests/test-manager.tsx");
  assert.match(manager, /createTestAssetUploadUrl\("audio", editing\?\.id \?\? null, audioFile\.name\)/);
  assert.match(manager, /storage\.from\(result\.bucket\)\.uploadToSignedUrl\(result\.path, result\.token, audioFile\)/);
  assert.match(manager, /formData\.set\("uploadedAudioPath", result\.path\)/);
  assert.match(manager, /formData\.delete\("audioFile"\)/);
  assert.match(manager, /<form onSubmit=\{handleSubmit\}/);
});
