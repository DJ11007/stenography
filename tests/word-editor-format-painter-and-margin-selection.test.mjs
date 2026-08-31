import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const EDITOR = "app/typing/word-efficiency/[language]/[testId]/workspace/rich-document-editor.tsx";

test("Format Painter is a real single-click-once / double-click-sticky toggle, not the old two-click-to-apply flow", async () => {
  const editor = await read(EDITOR);
  assert.match(editor, /\[paintMode,setPaintMode\]=useState<"off"\|"once"\|"sticky">\("off"\)/);
  assert.match(editor, /const activateFormatPainter=\(sticky:boolean\)=>\{/);
  assert.match(editor, /if\(paintMode!=="off"\)\{paintStyle\.current=null;setPaintMode\("off"\);setMessage\("Format Painter turned off\."\);return\}/);
  assert.match(editor, /setPaintMode\(sticky\?"sticky":"once"\)/);
  // the old dead map entry (formatPainter capturing style a second time, requiring an extra click) must be gone
  assert.doesNotMatch(editor, /formatPainter:\(\)=>\{const selection=getSelection\(\)\?\.anchorNode\?\.parentElement/);
});

test("Format Painter auto-applies on the next click or selection instead of requiring the button to be clicked again", async () => {
  const editor = await read(EDITOR);
  assert.match(editor, /target\.addEventListener\("mouseup",onMouseUp\)/);
  assert.match(editor, /selection\.modify\("move","backward","word"\);selection\.modify\("extend","forward","word"\)/);
  assert.match(editor, /if\(paintMode==="once"\)\{paintStyle\.current=null;setPaintMode\("off"\);setMessage\("Formatting applied\."\)\}/);
  assert.match(editor, /else setMessage\("Formatting applied\. Format Painter is still active\."\)/);
});

test("the ribbon distinguishes a single click (one-shot) from a double click (sticky) on the Format Painter button", async () => {
  const ribbon = await read("components/word-efficiency/word-editor-ribbon.tsx");
  assert.match(ribbon, /if\(option\.id==="formatPainter"\)\{const disabled=preview\|\|Boolean\(option\.unsupported\);/);
  assert.match(ribbon, /onCommand\?\.\(event\.detail>=2\?"formatPainterSticky":"formatPainter"\)/);
});

test("formatPainterSticky reuses the existing formatPainter capability, so no new command ID or migration was needed", async () => {
  const editor = await read(EDITOR);
  assert.match(editor, /formatPainterSticky:"formatPainter"/);
  const capabilities = await read("lib/word-editor-capabilities.ts");
  assert.doesNotMatch(capabilities, /formatPainterSticky/);
});

test("Escape cancels an active Format Painter and resets paintMode", async () => {
  const editor = await read(EDITOR);
  assert.match(editor, /if\(event\.key==="Escape"&&paintStyle\.current\)\{paintStyle\.current=null;setPaintMode\("off"\);setMessage\("Format Painter cancelled\."\);return\}/);
});

test("clicking in the page's left margin selects a line (1 click), paragraph (2), or whole document (3) -- the selection-bar feature real Word has and browsers don't", async () => {
  const editor = await read(EDITOR);
  assert.match(editor, /const handleEditorMouseDown=\(event:MouseEvent<HTMLDivElement>\)=>\{/);
  assert.match(editor, /if\(event\.clientX<rect\.left\|\|event\.clientX-rect\.left>=paddingLeft\)return;/);
  assert.match(editor, /const selectByMargin=\(count:number,clientY:number,rect:DOMRect,paddingLeft:number\)=>\{/);
  assert.match(editor, /if\(count>=3\)\{[\s\S]{0,120}range\.selectNodeContents\(editor\.current\)/);
  assert.match(editor, /selection\.modify\("move","backward","lineboundary"\);selection\.modify\("extend","forward","lineboundary"\)/);
  assert.match(editor, /onMouseDown=\{handleEditorMouseDown\}/);
});

test("margin clicks use time+proximity based counting (not native dblclick) so a tall paragraph's margin still counts as one double click", async () => {
  const editor = await read(EDITOR);
  assert.match(editor, /marginClick=useRef<\{count:number;time:number;y:number\}>\(\{count:0,time:0,y:-9999\}\)/);
  assert.match(editor, /sameSpot=Math\.abs\(event\.clientY-state\.y\)<40/);
  assert.match(editor, /state\.count=sameSpot&&now-state\.time<500\?state\.count\+1:1/);
});
