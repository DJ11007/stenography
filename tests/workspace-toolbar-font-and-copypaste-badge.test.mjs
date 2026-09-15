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

// A real student attempt still disables paste/drop/cut into the typing
// area (see the textarea's onPaste/onDrop/onCut handlers below), but that
// is not something worth a permanent badge in the toolbar for every
// student on every attempt -- it's the default, unremarkable behavior.
// The admin-preview badge stays: seeing "Copy-Paste Enabled" during your
// own preview is a genuinely unusual state worth calling out, since a
// real student attempt never allows it.
test("the toolbar has no Copy-Paste: Disabled badge (paste/drop stay silently disabled); the admin-preview badge still shows when copy-paste actually is enabled", async () => {
  const editor = await read(EXAM_PATH);
  assert.doesNotMatch(editor, />Copy-Paste: Disabled<\/span>/);
  assert.match(editor, />Admin Preview: Copy-Paste Enabled<\/span>/);
  assert.match(editor, /\{adminPreview && <span title="[^"]+" className="[^"]+">Admin Preview: Copy-Paste Enabled<\/span>\}/);
  assert.match(editor, /onPaste=\{\(event\) => \{ if \(!adminPreview\) event\.preventDefault\(\); \}\}/);
  assert.match(editor, /onDrop=\{\(event\) => \{ if \(!adminPreview\) event\.preventDefault\(\); \}\}/);
});
