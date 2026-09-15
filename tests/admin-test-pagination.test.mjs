import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

// Real admin request: /admin/exam-tests (and every other section built on
// the shared TestManager) rendered every matching test in one long list,
// with no total count and no paging -- the admin explicitly asked for a
// count of how many tests exist, 20/30-per-page pagination instead of one
// long list, a running total at the bottom, and page navigation at both
// the top and the bottom.
test("the admin test manager shows a total test count, paginates the filtered list at 20 or 30 per page, and renders page navigation above and below the list", async () => {
  const manager = await read("app/admin/tests/test-manager.tsx");

  // An unfiltered "N tests total" badge, independent of the active filters.
  assert.match(manager, /\{tests\.length\.toLocaleString\("en-IN"\)\} test\{tests\.length===1\?"":"s"\} total/);

  // Page size defaults to 20 and offers exactly 20/30, per the admin's request.
  assert.match(manager, /const \[pageSize,setPageSize\] = useState\(20\);/);
  assert.match(manager, /<option value=\{20\}>20<\/option><option value=\{30\}>30<\/option>/);

  // Page resets whenever the filtered set could change shape underneath it.
  assert.match(manager, /useEffect\(\(\)=>\{setPage\(1\);\},\[query,status,filterLanguage,filterMode,ownership,sort,pageSize\]\);/);

  // The list itself renders only the current page's slice, not the full filtered array.
  assert.match(manager, /const pageItems = filtered\.slice\(pageStart,pageStart\+pageSize\);/);
  assert.match(manager, /pageItems\.length \? pageItems\.map\(\(test\)=><TestRow/);

  // Pagination renders twice -- once above the list, once below -- sharing the same state.
  const paginationUses = manager.match(/<Pagination page=\{safePage\}/g) ?? [];
  assert.equal(paginationUses.length, 2);
  assert.match(manager, /position="top"/);
  assert.match(manager, /position="bottom"/);

  // The bar itself shows a running "Showing X-Y of Z" count and Prev/Next + First/Last navigation.
  assert.match(manager, /Showing \$\{rangeStart\.toLocaleString\("en-IN"\)\}–\$\{rangeEnd\.toLocaleString\("en-IN"\)\} of \$\{total\.toLocaleString\("en-IN"\)\}/);
  assert.match(manager, />« First<\/button>/);
  assert.match(manager, />‹ Prev<\/button>/);
  assert.match(manager, />Next ›<\/button>/);
  assert.match(manager, />Last »<\/button>/);
});

// Real reported request: /admin/practice-tests (and every other section
// built on the shared TestManager) defaulted to "Recently updated", so
// "TEST - 8" published before "TEST - 6" showed out of series. The list now
// defaults to the same numbered-title "serial" sort already used on the
// student-facing exam category navigator (lib/exam-category-navigator.ts),
// with the old sorts still offered as alternatives.
test("the admin test manager defaults to serial (numbered-title) sort, reusing the exam category navigator's sort helper", async () => {
  const manager = await read("app/admin/tests/test-manager.tsx");
  assert.match(manager, /import \{ sortExamCategoryNavigatorItems \} from "@\/lib\/exam-category-navigator";/);
  assert.match(manager, /const \[sort,setSort\] = useState\("serial"\);/);
  assert.match(manager, /if \(sort==="serial"\) return sortExamCategoryNavigatorItems\(matches,"ascending"\);/);
  assert.match(manager, /<option value="serial">Serial \(1, 2, 3…\)<\/option><option value="updated">Recently updated<\/option>/);
});
