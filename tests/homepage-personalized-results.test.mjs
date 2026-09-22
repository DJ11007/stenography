import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

// Real requested feature: the homepage shows three stacked, PERSONALIZED
// (the current visitor's own) result cards -- Typing (net/gross WPM), then
// Stenography (Pass/Fail), then Efficiency (marks + Pass/Fail) -- distinct
// from the pre-existing LiveResultsTicker (everyone's recent live-test
// results), which stays, just moved below these new cards. Nothing
// renders for a logged-out visitor.

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
  const tickerIndex = page.indexOf("<LiveResultsByLanguage");
  assert.ok(typingIndex > 0 && stenographyIndex > typingIndex && efficiencyIndex > stenographyIndex && tickerIndex > efficiencyIndex);
  assert.match(page, /Your latest results/);
});

// Real reported follow-up: the result cards were a full-width stacked
// column with lots of unused space beside them, and the Student Success
// Story carousel (with its "Visit Samradhi Classes" info box) sat much
// further down the page, disconnected from this section. Moved up to sit
// beside the result cards as a second column (removed from its old spot,
// appears once) -- deliberately tied to the same "has a result" condition
// as the cards, per the user's own explicit choice, not shown standalone
// for a logged-out visitor or one with no attempts yet.
test("the Student Success Story carousel now sits beside the result cards as a second column, and only appears once (moved, not duplicated)", async () => {
  const page = await read("app/page.tsx");
  assert.match(page, /grid gap-6 lg:grid-cols-2 lg:items-start/);
  const occurrences = page.match(/<StudentSuccessCarousel\s*\/>/g) ?? [];
  assert.equal(occurrences.length, 1, "StudentSuccessCarousel must appear exactly once, not duplicated");
  const resultsGridIndex = page.indexOf("grid gap-6 lg:grid-cols-2 lg:items-start");
  const carouselIndex = page.indexOf("<StudentSuccessCarousel");
  assert.ok(resultsGridIndex > 0 && carouselIndex > resultsGridIndex, "the carousel must be inside the two-column results grid");
});

test("StudentSuccessCarousel no longer hardcodes its own top margin (the call site controls spacing now that it's reused inside a grid column)", async () => {
  const component = await read("app/_components/student-success-carousel.tsx");
  assert.doesNotMatch(component, /className="mt-8 grid overflow-hidden/);
  assert.match(component, /className="overflow-hidden rounded-3xl border border-blue-100 bg-white shadow-sm"/);
});

// Real reported follow-up: the "Visit Samradhi Classes" address/Call/Maps
// box used to live inside the success-story card as a second internal
// column -- moved into the site footer (visible on every page) instead,
// and removed from the card entirely, which is now a single full-width
// card with no internal split.
test("the 'Visit Samradhi Classes' contact box has moved into the site footer and is no longer inside StudentSuccessCarousel", async () => {
  const component = await read("app/_components/student-success-carousel.tsx");
  assert.doesNotMatch(component, /Visit Samradhi Classes/);
  assert.doesNotMatch(component, /Offline institution/);
  assert.doesNotMatch(component, /<aside/);
  const footer = await read("app/_components/site-footer.tsx");
  assert.match(footer, /near Sanganer Airport, behind Choudhary Petrol Pump/);
  assert.match(footer, /Call 7014371324/);
  assert.match(footer, /Open in Google Maps/);
});

// Real reported follow-up: with the success-story card now shorter (no
// more Visit-Samradhi-Classes aside beside it), the result cards column
// left a blank gap below it. Nesting Top Rankers into that same left
// column (only when there's a personalized result to show) fills the
// gap; for a visitor with no personalized result, Top Rankers keeps its
// original full-width standalone placement so it's never hidden from
// anyone.
test("Top Rankers nests into the results column when a personalized result exists, and stays a full-width standalone section otherwise", async () => {
  const page = await read("app/page.tsx");
  assert.match(page, /const hasPersonalizedResults = Boolean\(typingResult \|\| stenographyResult \|\| efficiencyResult\);/);
  assert.match(page, /\{hasPersonalizedResults \? \(/);
  const grid = page.slice(page.indexOf("grid gap-6 lg:grid-cols-2"), page.indexOf("<StudentSuccessCarousel"));
  assert.match(grid, /<LiveTestTopRankers english=\{topRankersEnglish\} hindi=\{topRankersHindi\} \/>/, "Top Rankers must be nested inside the left results column");
  const elseBranch = page.slice(page.indexOf(") : ("), page.indexOf(")}\n          <Reveal className=\"mt-8\">"));
  assert.match(elseBranch, /<LiveTestTopRankers english=\{topRankersEnglish\} hindi=\{topRankersHindi\} \/>/, "the standalone fallback must still render Top Rankers for visitors with no personalized result");
});
