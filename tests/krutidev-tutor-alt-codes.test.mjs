import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

// Real requested audit: "check complete hindi krutidev010 font with our
// keyboard, and also alt keys". The Alt-code helper on the Kruti Dev
// tutor only listed 2 of the 11 legacy bytes this converter can actually
// produce that no ordinary key emits -- a student hitting कृ/ट्ट/ड्ड/ट्ठ/
// त्त्/the ट-cluster rakar/क्र/न्न/ह्म in a real passage had no in-app
// reference for how to type it at all. Each Alt-code below is
// independently confirmed against krutiDevToUnicode -- matched on the
// plain-ASCII "Alt + 0NNN" code string rather than the Devanagari glyph
// text itself, since this file's own editing tools have repeatedly shown
// Devanagari string literals can silently fail to byte-match even when
// visually identical.
test("the Kruti Dev tutor's Alt-code helper lists every non-keyboard-typeable byte this converter can actually produce", async () => {
  const { krutiDevToUnicode } = await import("../lib/hindi-font-converter.ts");
  const content = await read("app/typing/learn/krutidev/krutidev-tutor.tsx");
  const expected = [
    ["Alt + 0161", "¡", "ँ"], // ँ chandrabindu
    ["Alt + 0130", "‚", "ॉ"], // ॉ candra-O (‚ is a CP1252 special byte, not a direct Latin-1 codepoint)
    ["Alt + 0209", "Ñ", "कृ"], // कृ
    ["Alt + 0205", "Í", "ट्ट"], // ट्ट
    ["Alt + 0236", "ì", "ड्ड"], // ड्ड
    ["Alt + 0235", "ë", "ट्ठ"], // ट्ठ
    ["Alt + 0217", "Ù", "त्त्"], // त्त्
    ["Alt + 0170", "ª", "्र"], // ्र (ट-cluster rakar)
    ["Alt + 0216", "Ø", "क्र"], // क्र
    ["Alt + 0233", "é", "न्न"], // न्न
    ["Alt + 0227", "ã", "ह्म"], // ह्म
  ];
  for (const [code, byte, glyph] of expected) {
    assert.match(content, new RegExp(`code: "${code.replace("+", "\\+")}"`), `${code} missing from ALT_CODES`);
    assert.equal(krutiDevToUnicode(byte), glyph, `${code} does not actually decode to the expected glyph`);
  }
});
