import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const RIBBON = "components/word-efficiency/word-editor-ribbon.tsx";

// Real reported bug: the font size ribbon control was a plain <select>
// limited to a fixed preset list ([8,9,10,...72]) -- there was no way to
// type an exact or decimal value like 2.5 or 18.5 at all. Fixed to an
// editable combobox (FontSizeBox): type any value in range, or pick a
// preset from the dropdown.
test("the font size control is an editable combobox, not a fixed-preset <select>", async () => {
  const ribbon = await read(RIBBON);
  assert.match(ribbon, /if \(option\.id === "fontSize"\) return <FontSizeBox /);
  assert.doesNotMatch(ribbon, /if \(option\.id === "fontSize"\) return <label[^>]*><span className="sr-only">\{option\.label\}<\/span><select/);
  const body = ribbon.slice(ribbon.indexOf("function FontSizeBox"), ribbon.indexOf("const RECENT_FONTS_KEY"));
  assert.match(body, /type="text"/);
  assert.match(body, /inputMode="decimal"/);
  // Typed values are parsed as floats (decimals allowed) and rounded to
  // the nearest half point, not forced to a fixed integer preset list.
  assert.match(body, /Number\.parseFloat\(raw\)/);
  assert.match(body, /Math\.round\(Math\.min\(max,\s*Math\.max\(min,\s*parsed\)\)\s*\*\s*2\)\s*\/\s*2/);
  // Clicking in selects the existing value, matching the same request
  // applied to the font size box too.
  assert.match(body, /event\.target\.select\(\)/);
});

// Real reported request: clicking into the font NAME box should select the
// current font name (so typing immediately replaces/searches it) and
// typing should filter the font list live -- matching real MS Word's
// editable combobox, not a button that only opens a separate blank search
// field.
test("the font family control is an editable combobox: select-all on focus, typed text filters the gallery live", async () => {
  const ribbon = await read(RIBBON);
  const body = ribbon.slice(ribbon.indexOf("function FontGallery"), ribbon.indexOf("function FontSection"));
  assert.doesNotMatch(body, /<button ref=\{buttonRef\}/);
  assert.match(body, /<input ref=\{inputRef\}/);
  assert.match(body, /role="combobox"/);
  assert.match(body, /onFocus=\{event=>\{setOpen\(true\);setQuery\(""\);event\.target\.select\(\);\}\}/);
  // Typing updates both the displayed text and the search query together --
  // a single box that is simultaneously the display and the search field.
  assert.match(body, /onChange=\{event=>\{setText\(event\.target\.value\);setQuery\(event\.target\.value\);\}\}/);
  // The separate always-blank "Search fonts" input inside the dropdown is
  // gone -- the box itself is now the only search field.
  assert.doesNotMatch(body, /placeholder="Search fonts"/);
});
