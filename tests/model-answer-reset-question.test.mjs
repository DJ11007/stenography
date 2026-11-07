import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Admin (7 Nov): "sometimes we have a mistake in only one question but we have to reset all" -- the Model Answer pages
// now have "Reset Q<n>" next to "Reset all": only that question's answer is undone and its rules cleared.
const { resetWordQuestion, resetExcelQuestion } = await import("../lib/model-answer-reset.ts");

const run = (text, extra = {}) => ({ text, bold: false, color: null, fontSize: 12, ...extra });
const paragraph = (runs, attrs = {}, alignment = "left") => ({ type: "paragraph", alignment, attrs: { lineHeight: "1.15", ...attrs }, runs });

const pristine = { blocks: [paragraph([run("Video provides a powerful way.")]), paragraph([run("Reading is easier, you know.")])], pageLayout: { padding: null, backgroundColor: null } };

test("Word: undoing one question's run formatting keeps another question's work on the same paragraph", () => {
  // Q5 made paragraph 1 right-aligned; Q6 made "powerful" bold red (an auto-built rule on runs.1).
  const current = { blocks: [paragraph([run("Video provides a "), run("powerful", { bold: true, color: "FF0000" }), run(" way.")], {}, "right"), pristine.blocks[1]], pageLayout: { padding: null, backgroundColor: "92D050" } };
  const { document, undone } = resetWordQuestion(current, pristine, [{ target: "blocks.0.runs.1.bold" }, { target: "blocks.0.runs.1.color" }]);
  assert.equal(undone, 2);
  assert.deepEqual(document.blocks[0].runs, [run("Video provides a powerful way.")]);
  assert.equal(document.blocks[0].alignment, "right", "Q5's alignment stays");
  assert.equal(document.pageLayout.backgroundColor, "92D050", "another question's page colour stays");
  assert.equal(current.blocks[0].runs.length, 3, "the saved document passed in is not changed");
});

test("Word: hand-written checks (kind/place, text find, page layout, footer) are undone too", () => {
  const current = {
    blocks: [paragraph([run("VIDEO PROVIDES A POWERFUL WAY.")], { lineHeight: "1.36" }, "right"), paragraph([run("Reading is easier, "), run("you", { highlight: "00FF00" }), run(" know.")]), { type: "footer", runs: [run("Samradhi")] }],
    pageLayout: { padding: "25.4mm 19.1mm 25.4mm 19.1mm", backgroundColor: "92D050" },
  };
  const q5 = [{ rule: "value", kind: "body", place: 0, target: "blocks.0.alignment", spec: ["right"] }, { rule: "value", kind: "body", place: 0, target: "blocks.0.attrs.lineHeight", spec: ["1.36"] }, { rule: "text", kind: "body", place: 0, find: "VIDEO PROVIDES A POWERFUL WAY", caseSensitive: true }];
  let { document } = resetWordQuestion(current, pristine, q5);
  assert.equal(document.blocks[0].alignment, "left");
  assert.equal(document.blocks[0].attrs.lineHeight, "1.15");
  assert.equal(document.blocks[0].runs.map((r) => r.text).join(""), "Video provides a powerful way.");
  assert.equal(document.blocks[1].runs[1].highlight, "00FF00", "Q10's highlight on paragraph 2 stays");
  ({ document } = resetWordQuestion(current, pristine, [{ rule: "text", kind: "body", place: 1, find: "you", props: { highlight: ["00FF00"] } }]));
  assert.equal(document.blocks[1].runs.map((r) => r.text).join(""), "Reading is easier, you know.");
  assert.ok(document.blocks[1].runs.every((r) => !r.highlight));
  ({ document } = resetWordQuestion(current, pristine, [{ rule: "text", kind: "footer", find: "Samradhi" }]));
  assert.ok(!document.blocks.some((b) => b.type === "footer"), "a footer the paper did not have is removed");
  ({ document } = resetWordQuestion(current, pristine, [{ rule: "value", target: "pageLayout.backgroundColor", spec: ["92D050"] }]));
  assert.equal(document.pageLayout.backgroundColor, null);
  assert.equal(document.pageLayout.padding, "25.4mm 19.1mm 25.4mm 19.1mm", "another question's margins stay");
});

test("Word: a check that names nothing in the paper undoes nothing", () => {
  const { undone, skipped } = resetWordQuestion(pristine, pristine, [{ rule: "list", minItems: 3 }]);
  assert.equal(undone, 0);
  assert.equal(skipped, 1);
});

test("Excel: only the question's cells, merges and sheet settings go back to the starting sheet", () => {
  const start = { cells: { A55: { value: "Ram" }, B5: { value: 26 } }, merges: [], sheet: { printArea: null, header: { left: "" } } };
  const current = {
    cells: { A55: { value: "Ram", fontColor: "8EAADB", align: "left" }, B5: { value: 26, bold: true }, A28: { value: null, fontSize: 14 } },
    merges: ["A28:L28", "A1:G1"],
    sheet: { printArea: "A1:L60", header: { left: "Samradhi" } },
  };
  // Q6: A55 font colour (a cells check with props) -> only fontColor goes back, Q9's align stays.
  let { document } = resetExcelQuestion(current, start, [{ rule: "cells", range: "A55", props: { fontColor: ["8EAADB"] } }]);
  assert.deepEqual(document.cells.A55, { value: "Ram", align: "left" });
  assert.equal(document.cells.B5.bold, true);
  ({ document } = resetExcelQuestion(current, start, [{ rule: "merged", ranges: ["A28:L28"] }, { rule: "cells", range: "A28:L28", props: { fontSize: [14] } }]));
  assert.deepEqual(document.merges, ["A1:G1"]);
  assert.equal(document.cells.A28.fontSize, undefined);
  ({ document } = resetExcelQuestion(current, start, [{ rule: "sheet", path: "printArea", in: ["A1:L60"] }, { rule: "sheet", path: "header.left", contains: "Samradhi" }]));
  assert.equal(document.sheet.printArea, null);
  assert.equal(document.sheet.header.left, "");
  ({ document } = resetExcelQuestion(current, start, [{ rule: "value", cell: "B5", equals: 26 }]));
  assert.deepEqual(document.cells.B5, { value: 26 });
});

test("both Model Answer pages show Reset Q<n> next to Reset all and reopen on that question", () => {
  for (const subject of ["word", "excel"]) {
    const editor = readFileSync(`app/admin/${subject}-efficiency-tests/[testId]/model-answer/model-answer-editor.tsx`, "utf8");
    assert.ok(editor.includes("const handleResetQuestion = async () => {"), subject);
    assert.ok(editor.includes("Reset Q${active.number}"), subject);
    assert.ok(editor.includes('"Reset all"'), subject);
    assert.ok(editor.includes("window.location.assign(`?question=${active.number}`)"), subject);
    const page = readFileSync(`app/admin/${subject}-efficiency-tests/[testId]/model-answer/page.tsx`, "utf8");
    assert.ok(page.includes("startQuestion={startQuestion}"), subject);
  }
});
