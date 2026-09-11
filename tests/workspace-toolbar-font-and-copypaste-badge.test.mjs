import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const EXAM_PATH = "app/typing/_components/configurable-typing-exam.tsx";

// A reference stenography platform's live test screen shows inline -A/+A
// font-size buttons and a "Copy-Paste: Disabled" badge right on the test
// header, not tucked away in a settings popup. This project already
// disabled paste/drop/cut into the typing area (see the textarea's
// onPaste/onDrop/onCut handlers) and already had font-size adjustment
// buried in the Settings popup (FontSizeControls) -- these are quick
// toolbar shortcuts for the exact same state, not new behavior.
test("the toolbar offers quick -A/+A buttons for the typing area's font size, reusing the same changeTypingFontSize helper as the Settings popup", async () => {
  const editor = await read(EXAM_PATH);
  assert.match(editor, /import \{ changeTypingFontSize, defaultTypingFontPreferences, MAX_TYPING_FONT_SIZE, MIN_TYPING_FONT_SIZE, type TypingFontPreferences \} from "@\/lib\/typing-font-preferences";/);
  assert.match(editor, /onClick=\{\(\) => setFontPreferences\(changeTypingFontSize\(fontPreferences, "typing", -1\)\)\}/);
  assert.match(editor, /onClick=\{\(\) => setFontPreferences\(changeTypingFontSize\(fontPreferences, "typing", 1\)\)\}/);
  assert.match(editor, />-A<\/button>/);
  assert.match(editor, />\+A<\/button>/);
});

test("the toolbar shows a Copy-Paste: Disabled badge, documenting the typing textarea's existing paste/drop/cut prevention", async () => {
  const editor = await read(EXAM_PATH);
  assert.match(editor, />Copy-Paste: Disabled<\/span>/);
  assert.match(editor, /onPaste=\{\(event\) => event\.preventDefault\(\)\}/);
  assert.match(editor, /onDrop=\{\(event\) => event\.preventDefault\(\)\}/);
});
