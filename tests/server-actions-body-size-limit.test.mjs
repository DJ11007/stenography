import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

// This config's own generous headroom over the Next.js default (1MB)
// stopped being the whole story once dictation audio/PDF uploads moved to
// direct-to-storage signed URLs (a real reported bug: even 160mb here
// wasn't enough, because the hosting platform -- Netlify, not just
// Next.js -- has its own, much smaller, hard serverless-function body
// cap that this config setting has no power over at all). Kept raised
// anyway as a defensive ceiling for whatever else a Server Action might
// legitimately carry; the actual large-file path no longer depends on it.
test("Server Actions body size limit stays raised, defensively, even though large file uploads no longer depend on it", async () => {
  const [config, testActions] = await Promise.all([
    read("next.config.ts"),
    read("app/admin/tests/actions.ts"),
  ]);
  assert.match(config, /serverActions:\s*\{\s*bodySizeLimit:\s*"160mb",?\s*\}/);
  assert.match(testActions, /export async function createTestAssetUploadUrl/);
  assert.match(testActions, /storage\.from\(bucket\)\.createSignedUploadUrl\(path\)/);
});
