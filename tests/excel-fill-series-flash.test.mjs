import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { seriesLine } from "../lib/excel-series.ts";
import { flashFill } from "../lib/excel-flash-fill.ts";

// HOME > Editing > Fill, as in Excel 2013: Down / Right / Up / Left, Across Worksheets (greyed), Series...
// (Linear / Growth / Date / AutoFill, Date unit, Trend, Step, Stop), Justify and Flash Fill.
const opts = (extra) => ({ type: "linear", dateUnit: "day", step: 1, stop: null, trend: false, ...extra });
const serial = (y, m, d) => Math.round((Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000);

test("Series: linear and growth from the first value, stopping before the stop value", () => {
  assert.deepEqual(seriesLine([1, null, null, null, null], 5, opts({ step: 2 })), [null, 3, 5, 7, 9]);
  assert.deepEqual(seriesLine([1, null, null, null, null], 5, opts({ step: 2, stop: 6 })), [null, 3, 5, null, null]);
  assert.deepEqual(seriesLine([2, null, null, null], 4, opts({ type: "growth", step: 3 })), [null, 6, 18, 54]);
  assert.deepEqual(seriesLine([10, null, null], 3, opts({ step: -4 })), [null, 6, 2]);
  assert.equal(seriesLine(["Name", null], 2, opts()), null, "a line that does not start with a number is left alone");
});

test("Series: dates by day, weekday, month and year (the 31st becomes the month's last day)", () => {
  const jan31 = serial(2026, 1, 31);
  assert.deepEqual(seriesLine([jan31, null, null], 3, opts({ type: "date", dateUnit: "month" })), [null, serial(2026, 2, 28), serial(2026, 3, 31)]);
  assert.deepEqual(seriesLine([jan31, null], 2, opts({ type: "date", dateUnit: "year" })), [null, serial(2027, 1, 31)]);
  assert.deepEqual(seriesLine([jan31, null], 2, opts({ type: "date", dateUnit: "day", step: 7 })), [null, serial(2026, 2, 7)]);
  const friday = serial(2026, 10, 30);
  assert.deepEqual(seriesLine([friday, null, null], 3, opts({ type: "date", dateUnit: "weekday" })), [null, serial(2026, 11, 2), serial(2026, 11, 3)], "Saturday and Sunday are skipped");
});

test("Series: Trend replaces the starting values with the best-fit line / curve", () => {
  assert.deepEqual(seriesLine([1, 3, 4, null, null], 5, opts({ trend: true })), [1.1666666667, 2.6666666667, 4.1666666667, 5.6666666667, 7.1666666667]);
  assert.deepEqual(seriesLine([2, 4, null, null], 4, opts({ type: "growth", trend: true })), [2, 4, 8, 16]);
});

test("Flash Fill: first names, last names, initials, joined names, upper case and fixed text", () => {
  const rows = (outputs) => [["Rajesh Kumar Meena", "Jaipur"], ["Sunita Sharma", "Ajmer"], ["Amit Verma", "Kota"], ["Pooja Devi Jain", "Udaipur"]].map((sources, i) => ({ sources, output: outputs[i] ?? null }));
  assert.deepEqual(flashFill(rows(["Rajesh"])), [null, "Sunita", "Amit", "Pooja"]);
  assert.deepEqual(flashFill(rows(["Meena", "Sharma"])), [null, null, "Verma", "Jain"]);
  assert.deepEqual(flashFill(rows(["RAJESH"])), [null, "SUNITA", "AMIT", "POOJA"]);
  assert.deepEqual(flashFill(rows(["Rajesh - Jaipur"])), [null, "Sunita - Ajmer", "Amit - Kota", "Pooja - Udaipur"]);
  assert.deepEqual(flashFill(rows(["Mr. Rajesh"])), [null, "Mr. Sunita", "Mr. Amit", "Mr. Pooja"]);
  const mails = [["ram@gmail.com"], ["sita@yahoo.in"], ["mohan@sctyping.com"]].map((sources, i) => ({ sources, output: i === 0 ? "ram" : null }));
  assert.deepEqual(flashFill(mails), [null, "sita", "mohan"]);
});

test("Flash Fill: no examples, or no pattern, fills nothing", () => {
  assert.equal(flashFill([{ sources: ["a b"], output: null }]), null);
  assert.equal(flashFill([{ sources: ["Ram"], output: "xyz" }, { sources: ["Sita"], output: null }]), null);
});

test("the Fill menu has every Excel 2013 item, greys what cannot run, and Ctrl+E / Ctrl+D / Ctrl+R work", async () => {
  const source = (await readFile(new URL("../app/typing/excel-efficiency/[language]/[testId]/workspace/rich-sheet-editor.tsx", import.meta.url), "utf8")).replace(/\r\n/g, "\n");
  for (const item of ["<u>D</u>own", "<u>R</u>ight", "<u>U</u>p", "<u>L</u>eft", "<u>A</u>cross Worksheets...", "<u>S</u>eries...", "<u>J</u>ustify", "<u>F</u>lash Fill"]) assert.ok(source.includes(item), item);
  assert.match(source, /disabled=\{fillSourceLine\("down"\) === null\}/);
  assert.match(source, /<MenuItem disabled onClick=\{\(\) => setMenu\(null\)\}><u>A<\/u>cross Worksheets\.\.\.<\/MenuItem>/);
  assert.match(source, /if \(ctrl && key\.toLowerCase\(\) === "e"\) \{ event\.preventDefault\(\); if \(!submitted\) runFlashFill\(\); return; \}/);
  const dialogs = await readFile(new URL("../app/typing/excel-efficiency/[language]/[testId]/workspace/excel-dialogs-more.tsx", import.meta.url), "utf8");
  for (const label of ['"Linear"', '"Growth"', '"Date"', '"AutoFill"', '"Day"', '"Weekday"', '"Month"', '"Year"', "<u>T</u>rend", "Step value:", "Stop value:"]) assert.ok(dialogs.includes(label), label);
});
