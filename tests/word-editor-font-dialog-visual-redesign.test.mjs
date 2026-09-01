import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const EDITOR_PATH = "app/typing/word-efficiency/[language]/[testId]/workspace/rich-document-editor.tsx";

test("Font color and Underline color use the same rich swatch-grid picker as the ribbon's color split-buttons, not a native OS color input", async () => {
  const editor = await read(EDITOR_PATH);
  assert.match(editor, /<ColorSwatchField label="Font color" value=\{values\.color\} onChange=\{value=>set\("color",value\)\}\/>/);
  assert.match(editor, /<ColorSwatchField label="Underline color" value=\{values\.underlineColor\} onChange=\{value=>set\("underlineColor",value\)\}\/>/);
  assert.doesNotMatch(editor, /Font color<input className="input mt-1" type="color"/);
});

test("ColorSwatchField reuses the ribbon's exact SAFE_COLORS palette and .word-color-palette styling, imported rather than duplicated", async () => {
  const editor = await read(EDITOR_PATH);
  assert.match(editor, /import \{ SAFE_COLORS, WordEditorRibbon \} from "@\/components\/word-efficiency\/word-editor-ribbon"/);
  assert.match(editor, /className="word-color-palette"/);
  const ribbon = await read("components/word-efficiency/word-editor-ribbon.tsx");
  assert.match(ribbon, /export const SAFE_COLORS=/);
});

test("Underline style is a visual line-sample gallery (matching the ribbon's underline gallery), not a plain text <select>", async () => {
  const editor = await read(EDITOR_PATH);
  assert.match(editor, /<UnderlineStyleField value=\{values\.underlineStyle\} onChange=\{value=>set\("underlineStyle",value\)\}\/>/);
  assert.match(editor, /className="word-underline-gallery"/);
  assert.doesNotMatch(editor, /Underline style<select className="input mt-1" value=\{values\.underlineStyle\}/);
});

test("every underline style the schema supports (including double, dot-dash, and dot-dot-dash, previously missing from the dialog) is selectable", async () => {
  const editor = await read(EDITOR_PATH);
  assert.match(editor, /const DIALOG_UNDERLINE_STYLES=\["single","double","thick","dotted","dashed","dot-dash","dot-dot-dash","wavy","words-only"\]/);
});

test("Outline and Emboss are real checkboxes in the Font dialog, applying genuine CSS effects (text-stroke hollow fill / raised shadow), not placeholders", async () => {
  const editor = await read(EDITOR_PATH);
  assert.match(editor, /checked=\{values\.outline\} onChange=\{event=>set\("outline",event\.target\.checked\)\}\/>Outline/);
  assert.match(editor, /checked=\{values\.emboss\} onChange=\{event=>set\("emboss",event\.target\.checked\)\}\/>Emboss/);
  assert.match(editor, /webkitTextStroke:values\.outline\?`1px \$\{values\.color\|\|"#000000"\}`:undefined/);
  assert.match(editor, /textShadow:values\.emboss\?"1px 1px 0 rgba\(255,255,255,\.85\),-1px -1px 0 rgba\(0,0,0,\.55\)":undefined/);
});

test("outline/emboss survive a save-and-reload round trip: the DOM reconstruction path (renderSnapshot) re-applies the same effect, and serialization (makeBlock) reads the stroke color back instead of the transparent fill color", async () => {
  const editor = await read(EDITOR_PATH);
  assert.match(editor, /if\(run\.outline\)\{span\.dataset\.outline="true";span\.style\.color="transparent";span\.style\.webkitTextStroke=`1px \$\{run\.color\?`#\$\{run\.color\}`:"#000000"\}`\}/);
  assert.match(editor, /if\(run\.emboss\)\{span\.dataset\.emboss="true";span\.style\.color="#808080";span\.style\.textShadow="1px 1px 0 rgba\(255,255,255,\.85\),-1px -1px 0 rgba\(0,0,0,\.55\)"\}/);
  assert.match(editor, /color:outlineNode\?approvedColor\(getComputedStyle\(outlineNode\)\.webkitTextStrokeColor\):approvedColor\(style\.color\)/);
});
