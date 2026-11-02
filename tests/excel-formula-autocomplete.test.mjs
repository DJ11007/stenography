import test from "node:test";
import assert from "node:assert/strict";
import { acceptFunction, functionSuggestions, functionTokenAt } from "../lib/excel-formula-autocomplete.ts";
import { FUNCTION_LIBRARY } from "../lib/excel-formula.ts";

// Excel's Formula AutoComplete in the Excel Efficiency sheet (the user's photo: typing "=sum" in a cell lists SUM,
// SUMIF, SUMIFS, SUMPRODUCT ... and Tab puts the name in).
const NAMES = FUNCTION_LIBRARY.map((fn) => fn.name);

test("typing =sum lists the SUM functions, alphabetically", () => {
  const token = functionTokenAt("=sum", 4);
  assert.deepEqual(token, { start: 1, end: 4, prefix: "sum" });
  const list = functionSuggestions(token.prefix, NAMES);
  assert.equal(list[0], "SUM");
  assert.ok(list.includes("SUMIF") && list.includes("SUMPRODUCT"));
  assert.ok(list.every((name) => name.startsWith("SUM")));
});

test("a name after an operator, a bracket or a comma is matched too; a cell reference or quoted text lists nothing", () => {
  assert.equal(functionTokenAt("=A1+av", 6)?.prefix, "av");
  assert.equal(functionTokenAt("=IF(co", 6)?.prefix, "co");
  assert.equal(functionTokenAt("=SUM(A1,ma", 10)?.prefix, "ma");
  assert.deepEqual(functionSuggestions(functionTokenAt("=I10", 4).prefix, NAMES), []);
  assert.equal(functionTokenAt('="su', 4), null);
  assert.equal(functionTokenAt("sum", 3), null, "not a formula");
  assert.equal(functionTokenAt("=", 1), null);
});

test("Tab puts NAME( in place of the typed letters, the cursor after the bracket", () => {
  assert.deepEqual(acceptFunction("=su", { start: 1, end: 3, prefix: "su" }, "SUM"), { text: "=SUM(", caret: 5 });
  assert.deepEqual(acceptFunction("=A1+av", { start: 4, end: 6, prefix: "av" }, "AVERAGE"), { text: "=A1+AVERAGE(", caret: 12 });
  assert.deepEqual(acceptFunction("=su(A1:A3)", { start: 1, end: 3, prefix: "su" }, "SUM"), { text: "=SUM(A1:A3)", caret: 5 }, "an existing bracket is kept");
});
