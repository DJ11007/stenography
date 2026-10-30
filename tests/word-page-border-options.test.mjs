import assert from "node:assert/strict";
import test from "node:test";
import { defaultBorderOptions, formatPageBorder, pageBorderDistance, pageBorderMeasure, pageBorderRect, parsePageBorder, PT_PX } from "../lib/word-page-border.ts";

// Word's Page Border > Options: Measure from (Edge of page | Text), four distances, surround header/footer.

const A4 = { pageWidth: 793.7, sheetHeight: 1122.5, marginTop: 96, marginRight: 96, marginBottom: 96, marginLeft: 96, headerBottom: null, footerTop: null };
const near = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 0.01, `${message}: ${actual} vs ${expected}`);

test("a border saved before these options existed means Word's default: Edge of page, 24 pt on every side", () => {
  const parsed = parsePageBorder("3px solid #00B050");
  assert.deepEqual(parsed, { css: "3px solid #00B050", sides: null, options: defaultBorderOptions("page") });
  assert.equal(parsed.options.measure, "page");
  assert.deepEqual([parsed.options.top, parsed.options.right, parsed.options.bottom, parsed.options.left], [24, 24, 24, 24]);
  assert.equal(parsePageBorder("2px wave #00B050 sides:top,bottom").css, "2px wave #00B050");
  assert.equal(parsePageBorder(""), null);
  assert.equal(parsePageBorder(null), null);
});

test("options that are Word's defaults are not written, others are, and the sides always come last", () => {
  const css = "3px solid #00B050";
  assert.equal(formatPageBorder(css, null, defaultBorderOptions("page")), css);
  assert.equal(formatPageBorder(css, ["top", "right", "bottom", "left"], defaultBorderOptions("page")), css, "all four sides = nothing written");
  assert.equal(formatPageBorder(css, null, defaultBorderOptions("text")), `${css} measure:text`);
  assert.equal(formatPageBorder(css, null, { measure: "page", top: 20, right: 20, bottom: 20, left: 20 }), `${css} gap:20,20,20,20`);
  assert.equal(formatPageBorder(css, ["bottom", "right"], { measure: "text", top: 6, right: 6, bottom: 12, left: 6, surroundHeader: false, surroundFooter: false }), `${css} measure:text gap:6,6,12,6 nohdr noftr sides:bottom,right`);
  assert.equal(formatPageBorder("", null, defaultBorderOptions("text")), "", "no line, no border");
  assert.ok(formatPageBorder("2.25px doubleWave #00B050", ["bottom", "left", "right"], { measure: "text", top: 31, right: 31, bottom: 31, left: 31, surroundHeader: false, surroundFooter: false }).length <= 100, "fits the 100 characters the server allows");
});

test("what is saved is read back exactly", () => {
  for (const options of [defaultBorderOptions("page"), defaultBorderOptions("text"), { measure: "text", top: 0, right: 31, bottom: 7, left: 4, surroundHeader: false, surroundFooter: true }, { measure: "page", top: 10, right: 11, bottom: 12, left: 13, surroundHeader: true, surroundFooter: true }]) {
    for (const sides of [null, ["top"], ["bottom", "right"]]) {
      const text = formatPageBorder("1px double #FF0000", sides, options);
      const parsed = parsePageBorder(text);
      assert.deepEqual(parsed.options, { ...defaultBorderOptions(options.measure), ...options }, text);
      assert.deepEqual(parsed.sides, sides, text);
      assert.equal(parsed.css, "1px double #FF0000", text);
    }
  }
});

test("distances are whole points from 0 to 31", () => {
  // Text read from a document is limited too: nothing above 31 pt gets drawn.
  assert.deepEqual(parsePageBorder("1px solid #000000 gap:99,0,3,40").options, { ...defaultBorderOptions("page"), top: 31, right: 0, bottom: 3, left: 31 });
  const text = formatPageBorder("1px solid #000000", null, { measure: "page", top: 99, right: -5, bottom: 3.7, left: 24 });
  assert.equal(text, "1px solid #000000 gap:31,0,4,24");
});

test("graded values: the measure and the distances, null without a border", () => {
  assert.equal(pageBorderMeasure("3px solid #00B050"), "page");
  assert.equal(pageBorderMeasure("3px solid #00B050 measure:text"), "text");
  assert.equal(pageBorderDistance("3px solid #00B050"), "24,24,24,24");
  assert.equal(pageBorderDistance("3px solid #00B050 measure:text"), "4,4,4,4");
  assert.equal(pageBorderDistance("3px solid #00B050 measure:text gap:6,7,8,9 sides:top"), "6,7,8,9");
  assert.equal(pageBorderMeasure(""), null);
  assert.equal(pageBorderDistance(null), null);
});

test("Edge of page, 24 pt on A4: 0.333 in from the paper edge, wider than the text area (the margins play no part)", () => {
  const rect = pageBorderRect(defaultBorderOptions("page"), A4);
  near(rect.left, 24 * PT_PX, "left");
  near(rect.left, 32, "left in px");
  near(rect.top, 32, "top");
  near(rect.width, 793.7 - 64, "width = page - 2 x 24 pt");
  near(rect.height, 1122.5 - 64, "height");
  const wide = pageBorderRect(defaultBorderOptions("page"), { ...A4, marginLeft: 200, marginRight: 10 });
  near(wide.left, rect.left, "a margin change does not move it");
  near(wide.width, rect.width, "nor resize it");
});

test("Text, 4 pt: around the text area, 4 pt outside the margins, and it moves with them", () => {
  const rect = pageBorderRect(defaultBorderOptions("text"), A4);
  near(rect.left, 96 - 4 * PT_PX, "left");
  near(rect.top, 96 - 4 * PT_PX, "top");
  near(rect.width, 793.7 - 192 + 8 * PT_PX, "width = text width + 2 x 4 pt");
  near(rect.height, 1122.5 - 192 + 8 * PT_PX, "height");
  const moved = pageBorderRect(defaultBorderOptions("text"), { ...A4, marginLeft: 48, marginRight: 150, marginTop: 60 });
  near(moved.left, 48 - 4 * PT_PX, "a smaller left margin moves it left");
  near(moved.width, 793.7 - 48 - 150 + 8 * PT_PX, "a bigger right margin narrows it");
  near(moved.top, 60 - 4 * PT_PX, "top margin");
});

test("each side has its own distance", () => {
  const rect = pageBorderRect({ measure: "text", top: 0, right: 10, bottom: 20, left: 31 }, A4);
  near(rect.left, 96 - 31 * PT_PX, "left 31 pt");
  near(rect.top, 96, "top 0 pt");
  near(rect.width, 793.7 - 192 + (31 + 10) * PT_PX, "left + right");
  near(rect.height, 1122.5 - 192 + 20 * PT_PX, "top 0, bottom 20");
});

test("Surround header / footer: left out, the border starts below the header and ends above the footer", () => {
  const withBoth = pageBorderRect({ ...defaultBorderOptions("text"), surroundHeader: false, surroundFooter: false }, { ...A4, headerBottom: 130, footerTop: 1000 });
  near(withBoth.top, 130 - 4 * PT_PX, "below the header");
  near(withBoth.top + withBoth.height, 1000 + 4 * PT_PX, "above the footer");
  const surrounding = pageBorderRect(defaultBorderOptions("text"), { ...A4, headerBottom: 130, footerTop: 1000 });
  near(surrounding.top, 96 - 4 * PT_PX, "header surrounded: the text area as usual");
  const noneOnThisSheet = pageBorderRect({ ...defaultBorderOptions("text"), surroundHeader: false, surroundFooter: false }, A4);
  near(noneOnThisSheet.top, 96 - 4 * PT_PX, "a sheet without a header is not changed");
  const fromPage = pageBorderRect({ ...defaultBorderOptions("page"), surroundHeader: false }, { ...A4, headerBottom: 130 });
  near(fromPage.top, 32, "Surround applies to Text only");
});
