import test from "node:test";
import assert from "node:assert/strict";
import { MAX_TYPING_FONT_SIZE, MIN_TYPING_FONT_SIZE, changeTypingFontSize, defaultTypingFontPreferences, parseTypingFontPreferences, resetTypingFontSize, typingFontStorageKey } from "../lib/typing-font-preferences.ts";

test("font preferences use script-sensitive defaults", () => {
  assert.deepEqual(defaultTypingFontPreferences("Latin"), { originalSize: 20, typingSize: 18, linked: false });
  assert.deepEqual(defaultTypingFontPreferences("Devanagari"), { originalSize: 22, typingSize: 22, linked: false });
});

test("stored font preferences are validated safely", () => {
  assert.deepEqual(parseTypingFontPreferences({ originalSize: 13, typingSize: 41, linked: "yes" }, "Devanagari"), { originalSize: 22, typingSize: 22, linked: false });
  assert.deepEqual(parseTypingFontPreferences({ originalSize: 14, typingSize: 40, linked: true }), { originalSize: 14, typingSize: 40, linked: true });
  assert.deepEqual(parseTypingFontPreferences({ originalSize: 21, typingSize: 19, linked: false }), { originalSize: 20, typingSize: 18, linked: false });
});

test("font controls use two-pixel steps and clamp to range", () => {
  assert.equal(changeTypingFontSize({ originalSize: MIN_TYPING_FONT_SIZE, typingSize: 18, linked: false }, "original", -1).originalSize, MIN_TYPING_FONT_SIZE);
  assert.equal(changeTypingFontSize({ originalSize: 20, typingSize: MAX_TYPING_FONT_SIZE, linked: false }, "typing", 1).typingSize, MAX_TYPING_FONT_SIZE);
  assert.equal(changeTypingFontSize({ originalSize: 20, typingSize: 18, linked: false }, "original", 1).originalSize, 22);
});

test("linked controls update and reset both panels", () => {
  assert.deepEqual(changeTypingFontSize({ originalSize: 20, typingSize: 20, linked: true }, "typing", 1), { originalSize: 22, typingSize: 22, linked: true });
  assert.deepEqual(resetTypingFontSize({ originalSize: 30, typingSize: 30, linked: true }, "original", "Devanagari"), { originalSize: 22, typingSize: 22, linked: true });
});

test("font preference storage separates scripts and legacy encoding", () => {
  assert.notEqual(typingFontStorageKey("Latin", "unicode"), typingFontStorageKey("Devanagari", "unicode"));
  assert.notEqual(typingFontStorageKey("Devanagari", "unicode"), typingFontStorageKey("Devanagari", "krutidev-legacy"));
});

// Requested: some exams show the English passage in Courier New, so students can choose it in typing Settings.
test("English students can switch the passage and typing area to Courier New, and the choice is kept", async () => {
  const { typingFontFamily, COURIER_FONT_STACK } = await import("../lib/typing-font-preferences.ts");
  const prefs = parseTypingFontPreferences({ originalSize: 20, typingSize: 18, linked: false, englishFont: "courier" }, "Latin");
  assert.equal(prefs.englishFont, "courier");
  assert.equal(typingFontFamily(prefs, "Latin", "Arial"), COURIER_FONT_STACK);
  assert.equal(typingFontFamily(prefs, "Devanagari", "Mangal"), "Mangal", "Hindi keeps its own font");
  assert.equal(typingFontFamily(parseTypingFontPreferences({ englishFont: "comic" }, "Latin"), "Latin", "Arial"), "Arial");
  const { readFile } = await import("node:fs/promises");
  const [controls, exam] = await Promise.all(["app/typing/_components/font-size-controls.tsx", "app/typing/_components/configurable-typing-exam.tsx"].map((path) => readFile(new URL(`../${path}`, import.meta.url), "utf8")));
  assert.match(controls, /\{script === "Latin" && <label/);
  assert.match(controls, /<option value="courier"[^>]*>Courier New<\/option>/);
  assert.equal(exam.split("fontFamily: typingFontFamily(fontPreferences, inputSystem.script, inputSystem.fontStack)").length - 1, 2, "the passage and the typing area");
  assert.doesNotMatch(exam, /fontFamily: inputSystem\.fontStack/);
});
