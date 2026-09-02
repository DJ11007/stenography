import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Server Actions body size limit is raised above the largest file upload the app allows (150MB dictation audio)", async () => {
  const [config, testActions] = await Promise.all([
    read("next.config.ts"),
    read("app/admin/tests/actions.ts"),
  ]);
  assert.match(testActions, /const MAX_AUDIO_BYTES = 150 \* 1024 \* 1024;/);
  assert.match(config, /serverActions:\s*\{\s*bodySizeLimit:\s*"160mb",?\s*\}/);
});
