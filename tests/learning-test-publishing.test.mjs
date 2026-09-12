import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const source = (relativePath) => readFile(path.join(process.cwd(), relativePath), "utf8");

test("learning-test saves always force learn mode, public visibility, and publication", async () => {
  const actions = await source("app/admin/tests/actions.ts");
  const learningAction = actions.match(/export async function saveLearningManagedTest[\s\S]*?\n}/)?.[0] ?? "";

  assert.match(learningAction, /formData\.set\("mode", "learn"\)/);
  assert.match(learningAction, /formData\.set\("visibility", "public"\)/);
  assert.match(learningAction, /formData\.set\("intent", "publish"\)/);
});

test("learning-test manager exposes one publish action and no duplicate draft creation", async () => {
  const manager = await source("app/admin/tests/test-manager.tsx");

  assert.match(manager, /Create and Publish Test/);
  assert.match(manager, /Save and Publish Changes/);
  assert.match(manager, /learningOnly\?<button[\s\S]*Create and Publish Test/);
  assert.match(manager, /!learningOnly && <form action=\{duplicateManagedTest\}/);
});

test("learning catalogue includes only valid published public learning tests and reports database failures", async () => {
  const catalogue = await source("lib/learning-tests-server.ts");
  const errorUi = await source("app/typing/learn/error.tsx");

  assert.match(catalogue, /\.eq\("mode", "learn"\)/);
  assert.match(catalogue, /\.eq\("visibility", "public"\)/);
  assert.match(catalogue, /\.eq\("status", "published"\)/);
  assert.match(catalogue, /\.neq\("title", ""\)/);
  assert.match(catalogue, /\.neq\("passage", ""\)/);
  assert.match(catalogue, /throw new Error/);
  assert.match(catalogue, /console\.error\("Learning catalogue test query failed"/);
  assert.match(catalogue, /console\.error\("Learning catalogue version query failed"/);
  assert.match(errorUi, /Database error/);
});

test("all catalogue routes are revalidated after managed-test mutations", async () => {
  const actions = await source("app/admin/tests/actions.ts");

  assert.match(actions, /revalidatePath\("\/typing\/learn", "layout"\)/);
  assert.match(actions, /revalidatePath\("\/typing\/learn\/english"\)/);
  assert.match(actions, /revalidatePath\("\/typing\/learn\/hindi"\)/);
  assert.match(actions, /revalidatePath\("\/typing\/learn\/\[lessonId\]", "page"\)/);
  assert.match(actions, /revalidatePath\("\/typing\/practice", "layout"\)/);
  assert.match(actions, /revalidatePath\("\/typing\/exams", "layout"\)/);
  assert.match(actions, /revalidatePath\("\/typing\/stenography", "layout"\)/);
  assert.match(actions, /revalidatePath\("\/live-test"\)/);
  assert.ok((actions.match(/revalidateTestRoutes\(/g) ?? []).length >= 5);
});
