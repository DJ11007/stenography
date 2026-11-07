import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Hindi Word catalogue (7 Nov): TEST 8 was published a minute before TEST 6 and 7 and was listed between 5 and 6.
// The Word and Excel catalogues now follow the number in the title.
test("Word and Excel catalogues list tests by the number in their title, not by publish date", async () => {
  const { inTitleSequence } = await import("../lib/efficiency-order.ts");
  const rows = ["EFFICIENCY TEST 8", "EFFICIENCY TEST 10", "EFFICIENCY TEST 6", "EFFICIENCY TEST 1", "EFFICIENCY TEST 7"].map((title, i) => ({ id: String(i), title, published_at: `2026-10-0${i + 1}` }));
  assert.deepEqual(inTitleSequence(rows).map((row) => row.title), ["EFFICIENCY TEST 1", "EFFICIENCY TEST 6", "EFFICIENCY TEST 7", "EFFICIENCY TEST 8", "EFFICIENCY TEST 10"]);
  for (const file of ["lib/word-efficiency-server.ts", "lib/excel-efficiency-server.ts"]) {
    const source = readFileSync(file, "utf8");
    assert.ok(source.includes("inTitleSequence(allTests ?? []).slice((page - 1) * pageSize, page * pageSize)"), file);
  }
});
