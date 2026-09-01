import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

// Regression fix for a real admin mistake: repeatedly clicking "Edit" on the
// same test row (instead of "New") and typing a different title each time
// versions the SAME test forward under a new identity, rather than creating
// independent tests -- one admin's test ended up going
// TEST-2 -> TEST-1 -> TEST-2 -> TEST-2 -> TEST-4, all one row, with "TEST-2"
// no longer existing anywhere. The save mechanism itself is working exactly
// as documented ("Edit and create version") -- this just makes that
// unmistakable before it happens again.
test("editing an existing test shows an unmistakable warning banner naming it, and a prominent button to start a genuinely new test instead", async () => {
  const manager = await read("app/admin/tests/test-manager.tsx");
  assert.match(manager, /\{editing&&<button type="button" className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-black text-white hover:bg-blue-800" onClick=\{\(\)=>choose\(null\)\}>\+ Create a new test instead<\/button>\}/);
  assert.match(manager, /You are editing <span className="underline">\{editing\.title\}<\/span>/);
  assert.match(manager, /Saving replaces its content with a new version -- it does not create a separate test\./);
});
