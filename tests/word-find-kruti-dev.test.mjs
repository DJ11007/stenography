import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { findMatches, krutiDevKeysAsUnicode, DEFAULT_ENGINE_OPTIONS as D } from "../lib/word-find-engine.ts";

const find = (text, needle, over = {}) => findMatches(text, needle, { ...D, ...over }).map(m => text.slice(m.index, m.index + m.length));
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

// Hindi Word Efficiency Test 6 Q13: "किसान" → "कृषक" typed on the Kruti Dev keyboard.
test("Kruti Dev keys in Find what / Replace with become the Devanagari they stand for", () => {
  assert.equal(krutiDevKeysAsUnicode("fdlku"), "किसान");
  assert.equal(krutiDevKeysAsUnicode('d`"kd'), "कृषक");
  assert.equal(krutiDevKeysAsUnicode('Ñ"kd'), "कृषक");
  assert.equal(krutiDevKeysAsUnicode("fdlku^p"), "किसान^p", "^ codes are kept");
  assert.equal(krutiDevKeysAsUnicode("किसान"), null, "already Devanagari");
  assert.equal(krutiDevKeysAsUnicode(""), null);
});

test("Whole words treats Hindi matras as part of the word", () => {
  const text = "किसान खेत पर। किसानों का गाँव।";
  assert.deepEqual(find(text, "किसान", { wholeWord: true }), ["किसान"]);
  assert.deepEqual(find(text, "किसान"), ["किसान", "किसान"]);
  assert.deepEqual(find("cat catalog cat", "cat", { wholeWord: true }), ["cat", "cat"]);
});

test("the editor falls back to the Kruti Dev reading on Hindi tests but shows the typed keys as they are, as Word does", async () => {
  const editor = await read("app/typing/word-efficiency/[language]/[testId]/workspace/rich-document-editor.tsx");
  const dialogs = await read("components/word-efficiency/word-2013-dialogs.tsx");
  assert.match(editor, /const hindiDocument=documentLanguage==="Hindi";/);
  assert.match(editor, /hindiDocument&&needle&&!matches\.length&&!options\.wildcards\?krutiDevKeysAsUnicode\(needle\)/);
  assert.equal((editor.match(/if\(krutiDev\)replacement=krutiDevKeysAsUnicode\(replacement\)\?\?replacement;/g) ?? []).length, 2);
  // Word shows "fdlku" in Find what as plain letters, not in Kruti Dev.
  assert.match(dialogs, /aria-label="Find what" style=\{\{ width: "100%" \}\}/);
  assert.match(dialogs, /aria-label="Replace with" style=\{\{ width: "100%" \}\}/);
  assert.doesNotMatch(dialogs, /Kruti Dev 010", "Segoe UI"/);
});
