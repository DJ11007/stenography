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

test("saving a managed test validates and uploads dictation audio only in stenography mode, preserving or clearing the existing path as requested", async () => {
  const actions = await read("app/admin/tests/actions.ts");
  assert.match(actions, /async function resolveAudioPath/);
  assert.match(actions, /upload\.type\.startsWith\("audio\/"\)/);
  assert.match(actions, /MAX_AUDIO_BYTES = 50 \* 1024 \* 1024/);
  assert.match(actions, /removeAudio.*=== "on"/);
  assert.match(actions, /if \(draft\.mode === "stenography"\)/);
  assert.match(actions, /audio_path: audioPath/);
  assert.match(actions, /storage\.from\("stenography-audio"\)\.upload/);
});
