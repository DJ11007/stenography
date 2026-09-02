import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

// Regression guard for real bugs found live at
// /admin/word-efficiency-tests?edit=<id> for a test carrying an existing
// PDF and Working Matter snapshot: bare .toLocaleString()/.toLocaleDateString()
// calls (no explicit locale) inside Client Components whose SSR pass can
// render non-empty data on the very first render. Node's server-side
// default locale (en-US grouping, "247,357") and the browser's locale
// (this app's Indian audience, en-IN grouping, "2,47,357") disagreed,
// throwing "Hydration failed because the server rendered text didn't
// match the client" and forcing React to blow away and remount the whole
// tree. Pinning an explicit locale makes server and client agree
// regardless of either environment's own default.
test("existing-PDF and Working Matter size/date formatting pin an explicit locale, not the runtime default", async () => {
  const delivery = await read("app/admin/word-efficiency-tests/delivery-pdf-fields.tsx");
  const workingMatter = await read("app/admin/word-efficiency-tests/working-matter-docx-fields.tsx");
  assert.match(delivery, /existingPdf\.sizeBytes\?\.toLocaleString\("en-IN"\)/);
  assert.match(delivery, /new Date\(existingPdf\.uploadedAt\)\.toLocaleDateString\("en-IN"\)/);
  assert.match(delivery, /selected\.size\.toLocaleString\("en-IN"\)/);
  assert.match(workingMatter, /snapshot\.source\.sizeBytes\.toLocaleString\("en-IN"\)/);
  // No bare, locale-less call left in either file (the actual bug shape).
  assert.doesNotMatch(delivery, /\.toLocaleString\(\)/);
  assert.doesNotMatch(delivery, /\.toLocaleDateString\(\)/);
  assert.doesNotMatch(workingMatter, /\.toLocaleString\(\)/);
});

// Second bug found on the same page: QuestionEditor's initial state used
// crypto.randomUUID() for clientId inside a lazy useState initializer, which
// this Client Component runs once during the server's SSR pass and again
// during browser hydration -- computing two different random ids from the
// exact same initialQuestions prop. That desyncs every question card's React
// key between server and client, forcing a full remount of every existing
// question right after hydration (losing scroll position/focus). Existing
// DB questions already carry a stable id and must key off that instead.
test("QuestionEditor's initial clientId is deterministic (derived from question.id), not random", async () => {
  const editor = await read("app/admin/word-efficiency-tests/question-editor.tsx");
  assert.match(editor, /clientId:question\.id\?\?`new-\$\{index\}`/);
  // fresh() (used only for genuinely-new, purely client-triggered questions
  // added via "Add Question"/"Duplicate Question" after mount) may still use
  // crypto.randomUUID() -- that code path never runs during SSR.
  assert.match(editor, /const fresh=\(number:number\):EditorQuestion=>\(\{clientId:crypto\.randomUUID\(\)/);
});
