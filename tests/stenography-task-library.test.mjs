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

// Real stenography training runs as a speed ladder (60 -> 80 -> 100 -> 120+
// WPM); the library should let a student filter to their current speed
// instead of hunting through every published task regardless of pace.
test("the task library view offers a speed filter derived from the tasks' own required WPM values, sorted low to high", async () => {
  const view = await read("app/typing/practice/stenography/library/_components/task-library-view.tsx");
  assert.match(view, /const speeds = \[\.\.\.new Set\(tasks\.map\(\(task\) => task\.requiredWpm\)\)\]\.sort\(\(a, b\) => a - b\);/);
  assert.match(view, /speed === "All" \|\| task\.requiredWpm === speed/);
  assert.match(view, /aria-label="Filter by dictation speed"/);
  assert.match(view, /\{value\} WPM/);
});

// Matches the reference stenography site: a "Newest First"/"Oldest First"
// sort dropdown (not just the speed-ladder filter above), a completed-test
// "Done" badge, and a per-card word count.
test("the task library view offers a Newest/Oldest/Speed sort control, a Done badge for completed tests, and shows each task's word count", async () => {
  const view = await read("app/typing/practice/stenography/library/_components/task-library-view.tsx");
  assert.match(view, /const \[sort, setSort\] = useState<"newest" \| "oldest" \| "speed">\("newest"\);/);
  assert.match(view, /<option value="newest">Newest First<\/option>/);
  assert.match(view, /<option value="oldest">Oldest First<\/option>/);
  assert.match(view, /<option value="speed">Speed \(Low → High\)<\/option>/);
  assert.match(view, /if \(sort === "speed"\) return a\.requiredWpm - b\.requiredWpm \|\| a\.title\.localeCompare\(b\.title\);/);
  assert.match(view, /task\.completed && <span className="rounded-full bg-emerald-100 px-2 py-0\.5 text-\[11px\] font-black text-emerald-800">✓ Done<\/span>/);
  assert.match(view, /\{task\.passageWords\} words/);
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
