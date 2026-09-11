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

// The Back button pointing at /typing/practice/english is only a real fix
// if that URL (no ?test=) is a genuine list to land on -- it used to
// auto-redirect into the newest test, which is usually the exact test the
// student was just viewing, so Back visibly did nothing.
test("landing on /typing/practice/{english,hindi} with no ?test= shows a language-scoped list of tests to choose from, instead of silently auto-selecting one", async () => {
  const navigator = await read("app/typing/practice/_components/practice-navigator.tsx");
  assert.match(navigator, /if \(!params\.test\) \{/);
  assert.match(navigator, /Choose a test/);
  assert.match(navigator, /items\.map\(\(item\) => \(/);
  assert.match(navigator, /href=\{queryFor\(item\.slug\)\}/);
  // The redirect-into-a-test logic only ever runs once a test slug (valid
  // or not) is actually present in the URL -- i.e. after the picker branch.
  const pickerAt = navigator.indexOf("if (!params.test) {");
  const redirectAt = navigator.indexOf("if (params.test !== selected.slug) redirect(queryFor(selected.slug));");
  assert.ok(pickerAt >= 0 && redirectAt >= 0 && pickerAt < redirectAt, "the no-test-param picker must be checked before the stale-slug redirect");
});
