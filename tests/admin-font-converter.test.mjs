import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { unicodeToKrutiDev, detectHindiTextFormat } from "../lib/hindi-font-converter.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

// Real reported bug: declaring Source format = "Unicode Hindi" and then
// typing/pasting plain English (e.g. testing raw Kruti Dev keys like
// "a s d f g h ' ; l k j" without switching Source to "Kruti Dev 010"
// first) silently corrupted ordinary punctuation. unicodeToKrutiDev's
// apostrophe/semicolon remapping (curly-quote normalization, ";" -> "("
// so a literal semicolon doesn't collide with the Kruti Dev key that
// draws य) is correct and necessary for REAL Hindi prose that happens to
// contain that punctuation -- but wrong to apply to text that was never
// Hindi at all. detectHindiTextFormat returns "unknown" for such text (no
// Devanagari, no legacy-signal match), so this pins down the underlying
// mechanism the admin tool's fix relies on.
test("unicodeToKrutiDev silently rewrites plain-English punctuation when misapplied to non-Hindi text -- confirms why the admin tool must block this case", () => {
  const input = "a s d f g h ' ; l k j";
  assert.equal(detectHindiTextFormat(input), "unknown");
  const output = unicodeToKrutiDev(input);
  assert.notEqual(output, input, "documents the exact corruption the admin tool's new validation check now prevents from reaching a user");
});

test("the Font & Text Converter blocks converting Source=Unicode Hindi when the text has no actual Devanagari, and points the admin at Kruti Dev 010 mode instead", async () => {
  const component = await read("app/admin/font-converter/font-converter.tsx");
  assert.match(component, /if\(source==="unicode"&&detected==="unknown"\)throw new Error\("This doesn't look like Hindi text -- no Devanagari characters found\. If you're testing Kruti Dev keystrokes directly, switch Source format to \\"Kruti Dev 010\\" instead\."\);/);
});

// Real requirement: this check must NOT block the symmetric case -- a
// Source declared "Kruti Dev 010" whose text detects as "unknown" is the
// NORMAL, expected case for real (if short) Kruti Dev keystrokes, since
// the LEGACY_SIGNAL heuristic only matches specific multi-character
// patterns, not every valid short sequence. Blocking that direction too
// would break the "direct Kruti Dev 010 keyboard typing" workflow this
// same admin tool is meant to support.
test("the new validation check is asymmetric -- it does not block Source=Kruti Dev 010 text that detects as \"unknown\"", async () => {
  const component = await read("app/admin/font-converter/font-converter.tsx");
  assert.doesNotMatch(component, /source==="krutidev"&&detected==="unknown"/);
});
