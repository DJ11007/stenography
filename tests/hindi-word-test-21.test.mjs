// Hindi Word EFFICIENCY TEST 21 (previous-year RSMSSB paper): the fixture keeps the image's 15 questions in order,
// the Model Answer shows every change the questions ask for, and the migration embeds exactly these files.
// The migration itself checks in the database that the Model Answer earns 25 and the untouched paper 0.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const spec = JSON.parse(readFileSync("tests/fixtures/hindi-word-test-21.json", "utf8"));
const model = JSON.parse(readFileSync("tests/fixtures/hindi-word-test-21-model.json", "utf8"));
const sql = readFileSync("supabase/migrations/202611281000_hindi_word_test_21_previous_year_paper.sql", "utf8");

test("Test 21 has the 15 questions of the paper, each with checks and a Hindi solution", () => {
  assert.equal(spec.title, "EFFICIENCY TEST 21");
  assert.equal(spec.questions.length, 15);
  for (const question of spec.questions) {
    assert.ok(question.criteria.length > 0);
    assert.match(question.solution, /जाँच/);
  }
  assert.match(spec.questions[0].instruction, /लैंडस्केप/);
  assert.match(spec.questions[14].instruction, /जस्टिफाई/);
});

test("the practice document carries what the remove questions take away", () => {
  const paragraphs = spec.matter.paragraphs;
  assert.equal(paragraphs[0].shading, "FFE699");
  assert.ok(paragraphs[0].runs[0].text.includes("झंडे"));
  assert.equal(paragraphs[4].runs[0].doubleStrike, true);
  const table = paragraphs.find((p) => p.type === "table");
  assert.ok(table.cellFormats.every((row) => row[0]?.underline === true));
});

test("the Model Answer shows the asked changes", () => {
  const blocks = model.blocks;
  assert.equal(model.pageLayout.aspectRatio, "29.7 / 21");
  assert.equal(model.pageLayout.watermark, "DO NOT COPY");
  assert.equal(model.pageLayout.gutterPosition, "top");
  assert.equal(blocks[0].type, "header");
  assert.equal(blocks[0].runs[0].text, "3");
  assert.ok(blocks[1].runs.some((run) => run.text === "झंडे" && run.subscript));
  for (const i of [2, 3]) {
    assert.equal(blocks[i].attrs.marginRight, "79.2pt");
    assert.equal(blocks[i].attrs.lineHeight, "1.5");
    assert.ok(blocks[i].runs.every((run) => run.fontSize === 15));
  }
  assert.ok(blocks[3].runs.every((run) => run.color === "00B050"));
  assert.ok(blocks[4].runs.every((run) => run.color === "C00000" && run.highlight === "0000FF"));
  assert.ok(blocks[5].runs.every((run) => run.highlight === "0000FF" && !run.doubleStrike));
  const formats = blocks[6].attrs.cellFormats;
  assert.ok(formats.every((row) => !row[0].underline && row[2].bold && row[2].color === "FF0000"));
  assert.deepEqual(formats.map((row) => row.every((cell) => cell.align === "justify")), [true, false, true, false, false]);
});

test("the migration embeds these files, totals 25 marks and publishes only after its self-check", () => {
  assert.ok(sql.includes(JSON.stringify(spec.matter)));
  assert.ok(sql.includes(JSON.stringify(model)));
  const marks = [...sql.matchAll(/"marks":([\d.]+)/g)].map((m) => Number(m[1]));
  assert.equal(marks.length, 15);
  assert.equal(Math.round(marks.reduce((a, b) => a + b, 0) * 100) / 100, 25);
  assert.ok(sql.indexOf("model_gets <> 25 or untouched_gets <> 0") < sql.indexOf("status = 'published'"));
});
