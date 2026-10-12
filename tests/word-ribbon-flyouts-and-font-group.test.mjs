import assert from"node:assert/strict";import test from"node:test";import{readFile}from"node:fs/promises";

const read=path=>readFile(new URL(`../${path}`,import.meta.url),"utf8");
const ribbonPath="components/word-efficiency/word-editor-ribbon.tsx";

test("Undo and Redo live on the title bar only; Cut, Copy and Format Painter are icon-only",async()=>{
 const[ribbon,css]=await Promise.all([read(ribbonPath),read("app/globals.css")]);
 assert.match(ribbon,/group\.id === "clipboard"\) options = options\.filter\(option => option\.id !== "undo" && option\.id !== "redo"\)/);
 assert.match(css,/\[data-ribbon-option="paste"\]\) \.word-ribbon-tool > span \{ position: absolute; width: 1px/);
 assert.match(css,/color: #1f1f1f/);
});

test("every ribbon flyout stacks above the ruler and title bar and is dismissed by an outside click or Escape",async()=>{
 const[ribbon,css]=await Promise.all([read(ribbonPath),read("app/globals.css")]);
 for(const cls of["word-font-gallery","word-size-gallery","word-color-palette","word-underline-gallery","word-gallery-menu"])assert.match(css,new RegExp(`\\.${cls} \\{[^}]*z-index: 1000`));
 assert.match(ribbon,/function useDismiss\(/);
 assert.equal((ribbon.match(/useDismiss\(open,/g)||[]).length,3);
});

test("flyouts are only clamped after being placed under their trigger (no jump to the screen corner)",async()=>{
 const ribbon=await read(ribbonPath);
 assert.match(ribbon,/if \(!open \|\| position\.position !== "fixed"\) return;/);
 assert.match(ribbon,/window\.addEventListener\("scroll", place, true\)/);
});

test("Font group dropdowns have large arrows on a yellow background and roomier cells",async()=>{
 const[ribbon,css]=await Promise.all([read(ribbonPath),read("app/globals.css")]);
 assert.match(ribbon,/className="word-combo-arrow"/);
 assert.match(ribbon,/word-ribbon-tool word-gallery-trigger/);
 assert.match(css,/background: transparent; color: #222; font-size: 15px;/);
 assert.match(css,/grid-template-rows: repeat\(2, 30px\); gap: 5px 3px/);
 assert.match(css,/\.word-ribbon-tool:hover:not\(:disabled\) \{ border-color: #e5b92a; background: #fff1b3; \}/);
});

test("colour palettes offer only named standard colours (with Pink) and show each name on hover",async()=>{
 const ribbon=await read(ribbonPath);
 const standard=ribbon.match(/export const STANDARD_COLORS=\[(.*?)\];/)[1];
 for(const name of["Dark Red","Red","Orange","Yellow","Light Green","Green","Light Blue","Blue","Dark Blue","Purple","Pink"])assert.match(standard,new RegExp(`name:"${name}"`));
 assert.equal((standard.match(/name:/g)||[]).length,11);
 assert.match(ribbon,/HIGHLIGHT_COLORS=\[\{name:"Yellow"[^\]]*name:"Pink",value:"#ff00ff"/);
 assert.match(ribbon,/title=\{color\.name\}/);
 assert.doesNotMatch(ribbon.slice(ribbon.indexOf("function ColorSplitButton"),ribbon.indexOf("const UNDERLINE_STYLES")),/SAFE_COLORS/);
});
