import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../app/typing/games/wordtris/wordtris-game.tsx", import.meta.url), "utf8");

test("Hindi WordTris warns about Caps Lock and a Unicode Hindi keyboard instead of silently dropping keys", () => {
  assert.match(source, /setCapsLock\(event\.getModifierState\("CapsLock"\)\)/);
  assert.match(source, /Caps Lock is ON -- turn it OFF/);
  assert.ok(source.includes("const DEVANAGARI_TYPED = /[\\u0900-\\u097F]/;"));
  assert.match(source, /if \(language === "hindi" && DEVANAGARI_TYPED\.test\(value\)\) setUnicodeKeyboard\(true\);/);
  assert.match(source, /Switch it to English \(ENG\)/);
});

test("a rejected key shakes the readout", () => {
  assert.match(source, /if \(!isShrinking && value && !isValidPrefix\(value\)\) \{[\s\S]{0,200}setInputShake\(true\);/);
});

test("phone keyboards cannot capitalise or autocorrect Kruti Dev keys", () => {
  assert.match(source, /autoCapitalize="off"\s+autoCorrect="off"\s+autoComplete="off"/);
});

test("Kruti Dev letters with no key show their Windows Alt code (Windows-1252 byte)", () => {
  const map = { "Å": "Alt+0197", "ª": "Alt+0170", "Ø": "Alt+0216", "Ù": "Alt+0217", "¡": "Alt+0161", "ë": "Alt+0235", "‚": "Alt+0130" };
  const cp = Object.fromEntries([...source.matchAll(/"(.)": (\d+)/g)].map((m) => [m[1], Number(m[2])]));
  for (const [char, expected] of Object.entries(map)) {
    const code = cp[char] ?? char.codePointAt(0);
    assert.equal(`Alt+0${code}`, expected, char);
  }
  assert.match(source, /Next letter: hold <kbd>Alt<\/kbd>/);
});
