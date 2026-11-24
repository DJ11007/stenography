import assert from "node:assert/strict";
import test from "node:test";
import { excelQuestionRules, questionHasLetteredParts } from "../lib/excel-document-diff.ts";

// Real report (English Excel test 3, Q5 "create cell A59 as 'sales count' with the above formatting"): one question was
// shown as parts (a)-(e) of 0.33 each, because the model answer changed several cells / kinds of formatting and each
// became a part. A question is split into parts only when its own text lists steps (a), (b)...

const groups = [
  { description: "Formatting of A59 (bold, fillColor)", criteria: [{ rule: "cells", range: "A59", props: { bold: [true], fillColor: ["FFFF00"] } }] },
  { description: "Formatting of B59:E59 (fillColor)", criteria: [{ rule: "cells", range: "B59:E59", props: { fillColor: ["FFFF00"] } }] },
  { description: "Content of A59", criteria: [{ rule: "value", cell: "A59", equals: "sales count" }] },
  { description: "Sheet setting zoom", criteria: [{ rule: "sheet", path: "zoom", equals: 120 }] },
  { description: "A59:E59 merged", criteria: [{ rule: "merged", ranges: ["A59:E59"] }] },
];

test("lettered steps in the question's text are recognised, plain sentences are not", () => {
  assert.equal(questionHasLetteredParts('In the given sheet create cell A59 as "sales count" with above formatting\'s.'), false);
  assert.equal(questionHasLetteredParts("Apply following formatting to range A27:L27. a) Merge and Center b) Font color-red c) Font Size 14pt"), true);
  assert.equal(questionHasLetteredParts("Do this:\n(a) Bold\n(b) Italic"), true);
  assert.equal(questionHasLetteredParts("Use option (a) of the menu"), false, "one letter alone is not a list of steps");
  assert.equal(questionHasLetteredParts("Sort the data (ascending) in column B."), false);
});

test("a question that asks for one thing is ONE part with all its marks, however many cells the model answer changed", () => {
  const rules = excelQuestionRules(1.66, groups, 'In the given sheet create cell A59 as "sales count" with above formatting\'s.');
  assert.equal(rules.length, 1);
  assert.equal(rules[0].allocatedMarks, 1.66);
  assert.equal(rules[0].partLabel, null);
  assert.equal(rules[0].additionalCriteria.length, 5, "every requirement is still checked");
});

test("a question whose text lists steps keeps its parts, and the old call without text is unchanged", () => {
  const stepped = excelQuestionRules(2, groups, "Format A59: a) bold b) yellow fill c) merge");
  assert.equal(stepped.length, 5);
  assert.deepEqual(stepped.map((rule) => rule.partLabel), ["a", "b", "c", "d", "e"]);
  assert.equal(excelQuestionRules(2, groups).length, 5);
});

test("too many criteria for one part (the database allows 200) keep the groups", () => {
  const big = Array.from({ length: 3 }, (_, i) => ({ description: `g${i}`, criteria: Array.from({ length: 100 }, (_, k) => ({ rule: "cells", range: `A${k + 1}`, props: { bold: [true] } })) }));
  assert.equal(excelQuestionRules(3, big, "One plain sentence.").length, 3);
});

test("English Excel test 3 Q7 (find total, minimum, maximum, average, sales count in their existing cells): 26 values are one part, not (a) to (z)", () => {
  const values = Array.from({ length: 26 }, (_, i) => ({ description: `Content of B${i + 2}`, criteria: [{ rule: "value", cell: `B${i + 2}`, equals: i * 10 }] }));
  const text = "In the given sheet find all the values for total, minimum, Maximum, Average, Sales Count in there existing cell locations.";
  const rules = excelQuestionRules(1.66, values, text);
  assert.equal(rules.length, 1);
  assert.equal(rules[0].allocatedMarks, 1.66);
  assert.equal(rules[0].additionalCriteria.length, 26);
  assert.equal(excelQuestionRules(1.66, values).length, 26, "without the text, the old split is unchanged");
});
