import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

// Real requested feature: the homepage shows three stacked, PERSONALIZED
// (the current visitor's own) result cards -- Typing (net/gross WPM), then
// Stenography (Pass/Fail), then Efficiency (marks + Pass/Fail) -- distinct
// from the pre-existing anonymized LiveResultsTicker (everyone's recent
// live-test results), which stays, just moved below these new cards.
// Nothing renders for a logged-out visitor.

test("the homepage queries the current student's own most recent typing, stenography, and efficiency attempts, split by test mode", async () => {
  const page = await read("app/page.tsx");
  assert.match(page, /if \(user\) \{/);
  assert.match(page, /supabase\.from\("test_attempts"\)\.select\("id,test_id,test_version_id,result,submitted_at"\)\.eq\("student_id", user\.id\)/);
  assert.match(page, /supabase\.from\("word_efficiency_attempts"\)\.select\("id,result,submitted_at"\)\.eq\("student_id", user\.id\)\.eq\("evaluation_status", "published"\)/);
  assert.match(page, /supabase\.from\("excel_efficiency_attempts"\)\.select\("id,result,submitted_at"\)\.eq\("student_id", user\.id\)\.eq\("evaluation_status", "published"\)/);
  assert.match(page, /testMap\.get\(attempt\.test_id\)\?\.mode !== "stenography"/);
  assert.match(page, /testMap\.get\(attempt\.test_id\)\?\.mode === "stenography"/);
});

test("the typing card links to the new /typing/attempts/[id] page and shows net/gross WPM (preferring RSSB's real marksNetWpm when present)", async () => {
  const page = await read("app/page.tsx");
  assert.match(page, /href: `\/typing\/attempts\/\$\{typingAttempt\.id\}`/);
  assert.match(page, /netWpm: Number\(r\.marksNetWpm \?\? r\.netWpm \?\? 0\)/);
});

test("the stenography card computes Pass/Fail from marksQualified when present, else the version's required_wpm/required_accuracy (mirroring the admin leaderboard's own logic)", async () => {
  const page = await read("app/page.tsx");
  assert.match(page, /href: `\/typing\/attempts\/\$\{stenographyAttempt\.id\}`/);
  assert.match(page, /const passed = r\.marksQualified != null \? Boolean\(r\.marksQualified\) : version \? netWpm >= Number\(version\.required_wpm\) && Number\(r\.accuracy \?\? 0\) >= Number\(version\.required_accuracy\) : false;/);
});

test("the efficiency card picks whichever of Word/Excel is more recently published, links to the existing results page, and shows marks + Pass/Fail (or Not graded when passingMarks isn't configured)", async () => {
  const page = await read("app/page.tsx");
  assert.match(page, /href: `\/typing\/\$\{latestEfficiency\.subject === "Word" \? "word-efficiency" : "excel-efficiency"\}\/results\/\$\{latestEfficiency\.id\}`/);
  assert.match(page, /passed: r\.passed == null \? null : Boolean\(r\.passed\)/);
});

test("the three cards render in Typing -> Stenography -> Efficiency order, above the pre-existing anonymized live-results ticker (which is kept, not removed)", async () => {
  const page = await read("app/page.tsx");
  const typingIndex = page.indexOf("typingResult && <MyResultCard");
  const stenographyIndex = page.indexOf("stenographyResult && <MyResultCard");
  const efficiencyIndex = page.indexOf("efficiencyResult && <MyResultCard");
  const tickerIndex = page.indexOf("<LiveResultsTicker");
  assert.ok(typingIndex > 0 && stenographyIndex > typingIndex && efficiencyIndex > stenographyIndex && tickerIndex > efficiencyIndex);
  assert.match(page, /Your latest results/);
});
