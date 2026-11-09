import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { krutiDevExerciseJoiner, krutiDevExerciseUnits } from "../lib/krutidev-lesson-units.ts";
import { krutiDevTypingTarget } from "../lib/hindi-font-converter.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

// Real reported bug: the admin editor's live preview and the row list
// resolved a whole field as one blob, while the student page resolves a
// Key drill per line and a Word set per word. One shared definition of
// those units now feeds all three.
test("krutiDevExerciseUnits splits exactly the way the student page resolves exercises", () => {
  assert.deepEqual(krutiDevExerciseUnits("key-lesson", "sdfg ':lk\r\n  \nकर करक\n"), ["sdfg ':lk", "कर करक"]);
  assert.deepEqual(krutiDevExerciseUnits("word-set", " कर  करक\nरकर "), ["कर", "करक", "रकर"]);
  assert.deepEqual(krutiDevExerciseUnits("paragraph", "  एक अनुच्छेद\nदो  "), ["एक अनुच्छेद\nदो"]);
  assert.deepEqual(krutiDevExerciseUnits("paragraph", "   "), []);
  assert.equal(krutiDevExerciseJoiner("word-set"), " ");
  assert.equal(krutiDevExerciseJoiner("key-lesson"), "\n");
  assert.equal(krutiDevExerciseJoiner("paragraph"), "\n");
});

test("a Key drill mixing a raw-key line with real Hindi lines previews each line independently", () => {
  const preview = krutiDevExerciseUnits("key-lesson", "sdfg ':lk\nकर करक\nरकर")
    .map((unit) => krutiDevTypingTarget(unit))
    .join(krutiDevExerciseJoiner("key-lesson"));
  assert.equal(preview, "sdfg ':lk\ndj djd\njdj");
});

test("a Word set mixing a raw-key word with real Hindi words previews each word independently", () => {
  const preview = krutiDevExerciseUnits("word-set", "कर sdfg करक")
    .map((unit) => krutiDevTypingTarget(unit))
    .join(krutiDevExerciseJoiner("word-set"));
  assert.equal(preview, "dj sdfg djd");
});

test("the student-facing server derivation, the admin editor and the admin list all use the shared units function", async () => {
  const [server, manager, listPage] = await Promise.all([
    read("lib/krutidev-tutor-server.ts"),
    read("app/admin/krutidev-lessons/krutidev-lessons-manager.tsx"),
    read("app/admin/krutidev-lessons/page.tsx"),
  ]);
  assert.match(server, /krutiDevExerciseUnits\("key-lesson", row\.content\)/);
  assert.match(server, /krutiDevExerciseUnits\("word-set", row\.content\)/);
  assert.match(server, /krutiDevExerciseUnits\("paragraph", row\.content\)\[0\] \?\? ""/);
  assert.match(manager, /krutiDevExerciseUnits\(editingKind, liveContent\)/);
  assert.match(listPage, /krutiDevExerciseUnits\(row\.kind, row\.content\)/);
});
