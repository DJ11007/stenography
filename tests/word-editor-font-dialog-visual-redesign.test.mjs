import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const EDITOR_PATH = "app/typing/word-efficiency/[language]/[testId]/workspace/rich-document-editor.tsx";

test("outline/emboss survive a save-and-reload round trip: the DOM reconstruction path (renderSnapshot) re-applies the same effect, and serialization (makeBlock) reads the stroke color back instead of the transparent fill color", async () => {
  const editor = await read(EDITOR_PATH);
  assert.match(editor, /if\(run\.outline\)\{span\.dataset\.outline="true";span\.style\.color="transparent";span\.style\.webkitTextStroke=`1px \$\{run\.color\?`#\$\{run\.color\}`:"#000000"\}`\}/);
  assert.match(editor, /if\(run\.emboss\)\{span\.dataset\.emboss="true";span\.style\.color="#808080";span\.style\.textShadow="1px 1px 0 rgba\(255,255,255,\.85\),-1px -1px 0 rgba\(0,0,0,\.55\)"\}/);
  assert.match(editor, /color:outlineNode\?approvedColor\(getComputedStyle\(outlineNode\)\.webkitTextStrokeColor\):approvedColor\(style\.color\)/);
});

const DIALOGS_PATH = "components/word-efficiency/word-2013-dialogs.tsx";

test("the Font dialog is the Word 2013 two-tab dialog: Font and Advanced, with Font/Style/Size lists, colours and effects", async () => {
  const dialogs = await read(DIALOGS_PATH);
  assert.match(dialogs, /<Window13 title="Font"/);
  assert.match(dialogs, /id: "font", label: <span><u>F<\/u>ont<\/span>/);
  assert.match(dialogs, /id: "advanced", label: <span>Ad<u>v<\/u>anced<\/span>/);
  for (const label of ["Font list", "Font style list", "Font size list"]) assert.match(dialogs, new RegExp(label));
  for (const label of ["Stri<u>k</u>ethrough", "Do<u>u</u>ble strikethrough", "Su<u>p</u>erscript", "Sub<u>s</u>cript", "Small caps", "All caps", "<u>H</u>idden"]) assert.match(dialogs, new RegExp(label));
  assert.match(dialogs, /Set As Default/);
  assert.match(dialogs, /Text Effects…/);
});

test("Font color and Underline color are named colour drop-downs; underline style lists every supported style", async () => {
  const dialogs = await read(DIALOGS_PATH);
  assert.match(dialogs, /<ColorSelect13 label="Font color"/);
  assert.match(dialogs, /<ColorSelect13 label="Underline color"/);
  for (const style of ["single", "words-only", "double", "thick", "dotted", "dashed", "dot-dash", "dot-dot-dash", "wavy"]) assert.ok(dialogs.includes(`["${style}", `), style);
});

test("Outline and Emboss stay real effects, reached through Text Effects…, with the same CSS effects", async () => {
  const dialogs = await read(DIALOGS_PATH);
  assert.match(dialogs, /checked=\{values\.outline\} onChange=\{checked => set\("outline", checked\)\}>Outline/);
  assert.match(dialogs, /checked=\{values\.emboss\} onChange=\{checked => set\("emboss", checked\)\}>Emboss/);
  assert.match(dialogs, /WebkitTextStroke: values\.outline/);
  assert.ok(dialogs.includes('textShadow: values.emboss ? "1px 1px 0 rgba(255,255,255,.85),-1px -1px 0 rgba(0,0,0,.55)"'));
});
