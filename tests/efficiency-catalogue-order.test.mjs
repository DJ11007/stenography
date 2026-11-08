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

// 8 Nov: the admin drags tests into order (sequence, migration 202611081000); that order wins over the title number,
// tests without a place come after, and the admin list + catalogues still load before the migration is run.
test("the admin's dragged order comes first; tests without a place follow by title number", async () => {
  const { inTitleSequence, missingSequenceColumn } = await import("../lib/efficiency-order.ts");
  const rows = [{ id: "a", title: "EFFICIENCY TEST 1", sequence: 3 }, { id: "b", title: "EFFICIENCY TEST 2", sequence: 1 }, { id: "c", title: "EFFICIENCY TEST 9", sequence: null }, { id: "d", title: "EFFICIENCY TEST 3", sequence: 2 }];
  assert.deepEqual(inTitleSequence(rows).map((row) => row.id), ["b", "d", "a", "c"]);
  assert.equal(missingSequenceColumn({ message: 'column word_efficiency_tests.sequence does not exist' }), true);
  assert.equal(missingSequenceColumn(null), false);
  for (const file of ["app/admin/word-efficiency-tests/tests-page.tsx", "app/admin/excel-efficiency-tests/page.tsx"]) {
    const source = readFileSync(file, "utf8");
    assert.ok(source.includes("<SearchableList onReorder={save"), file);
    assert.ok(source.includes("if (missingSequenceColumn(error))"), file);
  }
  const list = readFileSync("app/admin/word-efficiency-tests/searchable-list.tsx", "utf8");
  assert.ok(list.includes("const canDrag = Boolean(onReorder) && !q && ordered.length > 1;"));
  assert.ok(list.includes("draggable onDragStart"));
  assert.ok(readFileSync("supabase/migrations/202611081000_efficiency_test_order.sql", "utf8").includes("if not public.is_aal2_admin() then raise exception 'not authorized'; end if;"));
});
