import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = () => readFile(new URL("../lib/homepage-content-server.ts", import.meta.url), "utf8");

// A PostgrestError extends Error, and Error instances lose their own
// properties when Next.js forwards a server console.error call to the
// browser dev overlay -- they render as an unhelpful "{}" there even
// though the error is fully populated (this is exactly what a user saw:
// "Feedback listing failed {}"). Logging the specific fields as a plain
// object instead survives that forwarding intact.
test("every RPC-backed homepage listing logs the actual error fields (message/code/details/hint) instead of the raw PostgrestError object", async () => {
  const source = await read();
  assert.match(source, /function logRpcFailure\(label: ?string, ?error: ?\{ ?message: ?string; ?code: ?string; ?details: ?string; ?hint: ?string ?\}\)/);
  assert.match(source, /console\.error\(label, \{ ?message: ?error\.message, ?code: ?error\.code, ?details: ?error\.details, ?hint: ?error\.hint ?\}\)/);
  const labels = ["Course package listing failed", "Vacancy notice listing failed", "Feedback listing failed", "Official website listing failed"];
  for (const label of labels) assert.match(source, new RegExp(`logRpcFailure\\("${label}", ?error\\)`));
  // No listing function should still be passing the raw error straight to
  // console.error -- that's exactly what produced the unhelpful "{}".
  assert.doesNotMatch(source, /console\.error\("(?:Course package|Vacancy notice|Feedback|Official website) listing failed", error\)/);
});
