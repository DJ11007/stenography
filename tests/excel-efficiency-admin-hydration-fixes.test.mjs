import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

// Regression guard, mirroring tests/word-efficiency-admin-hydration-fixes.test.mjs:
// the same bug class was found on the Excel Efficiency admin edit page at
// /admin/excel-efficiency-tests?edit=<id> for a test carrying an existing
// Working Matter XLSX snapshot. Bare .toLocaleString()/.toLocaleDateString()
// calls (no explicit locale) inside Client Components whose SSR pass can
// render non-empty data on the very first render: Node's server-side default
// locale (en-US grouping, "247,357") and the browser's locale (this app's
// Indian audience, en-IN grouping, "2,47,357") disagree, throwing "Hydration
// failed because the server rendered text didn't match the client" and
// forcing React to discard and remount the whole tree. Pinning an explicit
// locale makes server and client agree regardless of either environment's
// own default.
test("Excel Efficiency admin Client Components pin an explicit locale for size/date formatting, not the runtime default", async () => {
  const workingMatter = await read("app/admin/excel-efficiency-tests/working-matter-xlsx-fields.tsx");
  const testManager = await read("app/admin/tests/test-manager.tsx");
  assert.match(workingMatter, /snapshot\.source\.sizeBytes\.toLocaleString\("en-IN"\)/);
  // test-manager.tsx renders the live-test schedule (Date#toLocaleString) from
  // its `tests` prop on the very first render -- the exact SSR-critical shape.
  assert.match(testManager, /new Date\(test\.live_starts_at\?\?""\)\.toLocaleString\("en-IN"\)/);
  assert.match(testManager, /new Date\(test\.live_ends_at\?\?""\)\.toLocaleString\("en-IN"\)/);
  assert.match(testManager, /new Date\(test\.results_publish_at\?\?""\)\.toLocaleString\("en-IN"\)/);
  assert.match(testManager, /new Date\(editing\.updated_at\)\.toLocaleDateString\("en-IN"\)/);
  // No bare, locale-less call left in either "use client" file (the bug shape).
  assert.doesNotMatch(workingMatter, /\.toLocaleString\(\)/);
  assert.doesNotMatch(testManager, /\.toLocaleString\(\)/);
  assert.doesNotMatch(testManager, /\.toLocaleDateString\(\)/);
});
