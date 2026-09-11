import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

// The admin Learn Typing tests page listed English and Hindi lessons
// together in one unscoped list. Split it exactly like /admin/practice-tests
// already is: a language picker, then the (now scoped) SectionTestPage list.
test("the admin Learning Tests page gates entry behind a language picker, then goes straight to the (now scoped) test list -- Hindi has no keyboard picker since Kruti Dev is the only option for Learn Typing", async () => {
  const page = await read("app/admin/learning-tests/page.tsx");
  assert.match(page, /const language = params\.language === "Hindi" \? "Hindi" as const : params\.language === "English" \? "English" as const : null;/);
  assert.match(page, /if \(!language\) \{/);
  assert.match(page, /import \{ HINDI_KRUTI_DEV \} from "@\/lib\/typing-curriculum";/);
  assert.doesNotMatch(page, /HINDI_INPUT_SYSTEMS/);
  assert.match(page, /const inputSystemId = language === "Hindi" \? HINDI_KRUTI_DEV\.id : "english-qwerty";/);
  assert.match(page, /<SectionTestPage mode="learn" language=\{language\} inputSystemId=\{inputSystemId\} backHref=\{backHref\} \/>/);
  assert.match(page, /href="\/admin\/learning-tests\?language=English"/);
  assert.match(page, /href="\/admin\/learning-tests\?language=Hindi"/);
});

test("the admin dashboard's Learning Tests link goes to the unscoped picker, not a stale language-baked URL", async () => {
  const dashboard = await read("app/admin/page.tsx");
  assert.match(dashboard, /\["\/admin\/learning-tests", "Learning Tests",/);
});
