import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

// Reported: admin buttons should "look equal, equal location", and later
// the whole row was reported as too big to scan many tests at once. Row
// actions moved from text buttons (View/Results/Edit/... spelled out) to a
// single shared icon-button treatment (ICON_BUTTON) -- still one neutral
// style for reversible actions (View, Results, Edit, Duplicate, Unpublish,
// Archive), one primary blue for the one "go" action (Publish), and a
// distinct red hover for the one destructive action (Delete), just denser.
test("the admin test row's action buttons share one consistent neutral icon style, Publish is the one primary blue action, and Delete keeps a distinct red hover", async () => {
  const manager = await read("app/admin/tests/test-manager.tsx");
  assert.match(manager, /const ICON_BUTTON = "flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-sm hover:bg-slate-200";/);
  const neutralButtonCount = (manager.match(/className=\{ICON_BUTTON\}|className=\{`relative \$\{ICON_BUTTON\}`\}/g) ?? []).length;
  assert.ok(neutralButtonCount >= 4, `expected at least 4 neutral row buttons (View, Results, Edit, Duplicate) using the shared ICON_BUTTON style, found ${neutralButtonCount}`);
  assert.match(manager, /\$\{ICON_BUTTON\} disabled:opacity-40 \$\{test\.attempts>0\?"":"bg-red-50 text-red-700 hover:bg-red-100"\}/);
  assert.doesNotMatch(manager, /bg-slate-900 px-3 py-2/);
  assert.match(manager, /function Status\(\{test,status,icon,title,tone="neutral"\}/);
  assert.match(manager, /\$\{ICON_BUTTON\} \$\{tone==="primary"\?"bg-blue-700 text-white hover:bg-blue-800":""\}/);
  assert.match(manager, /icon=\{test\.status==="published"\?"⏸":"▶"\} title=\{test\.status==="published"\?"Unpublish":"Publish"\} tone=\{test\.status==="published"\?"neutral":"primary"\}/);
});
