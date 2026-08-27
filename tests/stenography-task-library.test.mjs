import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { STENOGRAPHY_TASK_CATEGORIES, normalizeTaskCategory } from "../lib/stenography-task-library.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("normalizeTaskCategory accepts only the known category set and falls back to Task otherwise", () => {
  for (const category of STENOGRAPHY_TASK_CATEGORIES) assert.equal(normalizeTaskCategory(category), category);
  assert.equal(normalizeTaskCategory("Nonsense"), "Task");
  assert.equal(normalizeTaskCategory(undefined), "Task");
  assert.equal(normalizeTaskCategory(null), "Task");
  assert.equal(normalizeTaskCategory(42), "Task");
});

test("the stenography admin form lets an admin tag a task category, stored in the same configuration payload as the audio path", () => {
  return read("app/admin/tests/test-manager.tsx").then((manager) => {
    assert.match(manager, /name="taskCategory"/);
    assert.match(manager, /configuration\?\.task_category/);
    assert.match(manager, /STENOGRAPHY_TASK_CATEGORIES\.map/);
  });
});

test("saving a stenography test always includes a task_category in the payload, defaulting to Task", async () => {
  const actions = await read("app/admin/tests/actions.ts");
  assert.match(actions, /const taskCategory = draft\.mode === "stenography" \? \(text\(formData, "taskCategory"\) \|\| "Task"\) : null;/);
  assert.match(actions, /task_category: taskCategory/);
});

test("the task library view renders category tabs, a search box, and links each task into the existing workspace routes without a new launch path", async () => {
  const view = await read("app/typing/practice/stenography/library/_components/task-library-view.tsx");
  assert.match(view, /import \{ STENOGRAPHY_TASK_CATEGORIES, type StenographyTaskSummary \} from "@\/lib\/stenography-task-library"/);
  assert.match(view, /STENOGRAPHY_TASK_CATEGORIES\.map\(\(item\) =>/);
  assert.match(view, /aria-label="Search tests"/);
  assert.match(view, /\/typing\/practice\/english-stenography\?test=/);
  assert.match(view, /\/typing\/practice\/hindi-stenography\?input=.*&test=/);
});

test("the library pages exist for both languages and fetch published tasks server-side", async () => {
  const english = await read("app/typing/practice/stenography/library/english/page.tsx");
  const hindi = await read("app/typing/practice/stenography/library/hindi/page.tsx");
  assert.match(english, /getPublishedStenographyTasks\("English"\)/);
  assert.match(hindi, /getPublishedStenographyTasks\("Hindi"\)/);
});

test("the stenography language chooser links to the new task library", async () => {
  const page = await read("app/typing/practice/stenography/page.tsx");
  assert.match(page, /Task \/ Topic Wise Tests Library/);
  assert.match(page, /href="\/typing\/practice\/stenography\/library"/);
});
