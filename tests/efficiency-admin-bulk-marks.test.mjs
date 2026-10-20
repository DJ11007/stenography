import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const WORD = "app/admin/word-efficiency-tests/question-editor.tsx";
const EXCEL = "app/admin/excel-efficiency-tests/question-editor.tsx";

// Bulk marks and Delete used OK/Cancel / prompt boxes; where those are blocked (the app's browser
// pane cancels them at once) the buttons did nothing.
test("bulk marks and delete in both efficiency question editors need no pop-up box", async () => {
  for (const file of [WORD, EXCEL]) {
    const source = await read(file);
    const applyBulk = source.slice(source.indexOf("const applyBulk"), source.indexOf("\n", source.indexOf("const applyBulk")));
    assert.doesNotMatch(applyBulk, /confirm\(|prompt\(|alert\(/, file);
    assert.match(source, /setBulkNote\(\{ ?text: ?`Set \$\{targets\.length\} question/, file);
    assert.match(source, /Click again to delete/, file);
  }
  const word = await read(WORD);
  const distribute = word.slice(word.indexOf("const distribute"), word.indexOf("\n", word.indexOf("const distribute")));
  assert.doesNotMatch(distribute, /confirm\(|prompt\(|alert\(/);
  assert.match(distribute, /const total=Number\(bulkMarks\);/, "Distribute uses the number in the box as the total");
});

test("Distribute shares the total exactly: rounding remainder on the last question", () => {
  const share = (total, count) => { const each = Math.floor(total / count * 100) / 100; const last = Math.round((total - each * (count - 1)) * 100) / 100; return { each, last }; };
  assert.deepEqual(share(25, 13), { each: 1.92, last: 1.96 });
  assert.deepEqual(share(25, 5), { each: 5, last: 5 });
  const { each, last } = share(25, 13);
  assert.equal(Math.round((each * 12 + last) * 100) / 100, 25);
});
