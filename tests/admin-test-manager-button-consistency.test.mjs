import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

// Reported: admin buttons should "look equal, equal location". The test row's
// View/Results/Edit/Duplicate were a plain unstyled `border` with no hover
// state, while Publish/Unpublish/Archive were a solid near-black
// (bg-slate-900) that didn't match any other color in the app, and Delete
// had no hover state either. Every row action now shares one of two
// consistent treatments: a neutral bordered/hover style for reversible
// actions (View, Results, Edit, Duplicate, Unpublish, Archive), a primary
// blue for the one clearly "go" action (Publish), and a bordered red with
// its own hover for the one destructive action (Delete) -- consistent with
// the rest of the app's primary/neutral/destructive button convention.
test("the admin test row's action buttons share one consistent neutral style (border-slate-300, hover:bg-slate-50), Publish is the one primary blue action, and Delete keeps a distinct red hover", async () => {
  const manager = await read("app/admin/tests/test-manager.tsx");
  const neutralButtonCount = (manager.match(/rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50/g) ?? []).length;
  assert.ok(neutralButtonCount >= 4, `expected at least 4 neutral row buttons (View, Results, Edit, Duplicate), found ${neutralButtonCount}`);
  assert.match(manager, /border border-red-200 px-3 py-2 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-40/);
  assert.doesNotMatch(manager, /bg-slate-900 px-3 py-2/);
  assert.match(manager, /function Status\(\{test,status,label,tone="neutral"\}/);
  assert.match(manager, /tone==="primary"\?"bg-blue-700 text-white hover:bg-blue-800":"border border-slate-300 text-slate-700 hover:bg-slate-50"/);
  assert.match(manager, /label=\{test\.status==="published"\?"Unpublish":"Publish"\} tone=\{test\.status==="published"\?"neutral":"primary"\}/);
});
