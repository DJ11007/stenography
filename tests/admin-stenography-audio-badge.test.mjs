import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

// Real stenography rules text (defaultStenographyCategoryRules) tells a
// student outright when "audio dictation delivery is not yet configured
// for this category" -- but an admin managing many stenography tests had
// no way to see that at a glance without opening each one's edit form.
test("the admin test list badges every stenography-mode row with whether dictation audio is attached, without opening the edit form", async () => {
  const manager = await read("app/admin/tests/test-manager.tsx");
  assert.match(manager, /const hasAudio = Boolean\(version\?\.configuration\?\.audio_path\);/);
  assert.match(manager, /test\.mode==="stenography" && \(hasAudio \? <span title="Dictation audio attached"[\s\S]*?>🎧<\/span> : <span title="No dictation audio attached yet"[\s\S]*?>⚠️<\/span>\)/);
});
