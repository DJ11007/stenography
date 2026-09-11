import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

// Regression guard for a real reported bug: the "Take Tests" hub card was
// already scoped to /typing/practice/english (see
// typing-learn-take-tests-language-scoped.test.mjs), but the in-workspace
// Back button rendered *inside* that scoped test was still hardcoded to the
// unscoped /typing/practice picker -- so a student who opened an English
// test and pressed Back landed on a page listing English AND Hindi again.
test("PracticeNavigator's in-workspace Back button is scoped to the language (and stenography-ness) the student is actually practising, not the unscoped /typing/practice picker", async () => {
  const navigator = await read("app/typing/practice/_components/practice-navigator.tsx");
  assert.doesNotMatch(navigator, /backHref="\/typing\/practice"/);
  assert.match(navigator, /const backHref = `\/typing\/practice\/\$\{language === "Hindi" \? "hindi" : "english"\}\$\{mode === "stenography" \? "-stenography" : ""\}`;/);
  assert.match(navigator, /backHref=\{backHref\}/);
});
