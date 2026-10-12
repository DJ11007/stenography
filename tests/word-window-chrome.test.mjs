import assert from"node:assert/strict";import test from"node:test";import{readFile}from"node:fs/promises";

const read=path=>readFile(new URL(`../${path}`,import.meta.url),"utf8");
const editorPath="app/typing/word-efficiency/[language]/[testId]/workspace/rich-document-editor.tsx";

test("the editor is wrapped in a Word 2013-style window: title bar, rulers, workspace and status bar",async()=>{
 const editor=await read(editorPath);
 assert.match(editor,/<WordTitleBar canEdit=\{!submitted\} canUndo=\{isWordCommandEnabled\(capabilities,"undo"\)\} canRedo=\{isWordCommandEnabled\(capabilities,"redo"\)\} onSave=\{\(\)=>\{void saveNow\(\)\}\} onUndo=\{\(\)=>run\("undo"\)\} onRedo=\{\(\)=>run\("redo"\)\}/);
 assert.match(editor,/<div ref=\{scrollRef\} className="word-workspace"/);
 assert.match(editor,/<WordRuler metrics=\{metrics\} indent=\{indent\}/);
 assert.match(editor,/<WordVerticalRuler height=\{metrics\.height\}/);
 assert.match(editor,/<WordStatusBar page=\{stats\.page\} pages=\{stats\.pages\} words=\{stats\.words\}/);
});

test("ruler, page and word numbers come from the live editor, not fixed values",async()=>{
 const editor=await read(editorPath);
 assert.match(editor,/paddingLeft/);
 assert.match(editor,/el\.innerText/);
 assert.match(editor,/querySelectorAll\(":scope > hr"\)/);
 assert.match(editor,/getComputedStyle\(block\)/);
});

// Real bug caught while building this: allowed() PERFORMS the command it is asked about
// (increaseIndent indents the paragraph, and every call also records the operation), so
// calling it while rendering re-indented the paragraph on every render.
test("render-time capability checks use isWordCommandEnabled, never allowed()",async()=>{
 const editor=await read(editorPath);
 assert.match(editor,/editable=\{!submitted&&isWordCommandEnabled\(capabilities,"increaseIndent"\)\}/);
 const jsx=editor.slice(editor.indexOf("return <section ref={viewport}"));
 assert.doesNotMatch(jsx,/\ballowed\(/);
});

test("dragging a ruler indent marker writes the same paragraph fields as the Paragraph dialog",async()=>{
 const editor=await read(editorPath);
 const apply=editor.slice(editor.indexOf("const applyRulerIndent="),editor.indexOf("const applyRulerIndent=")+900);
 for(const field of["marginLeft","marginRight","specialIndentMode","specialIndentAmount","textIndent"])assert.match(apply,new RegExp(field));
 assert.match(apply,/"firstLine":"hanging"/);
 assert.match(apply,/if\(commit\)changed\(\)/);
});

test("window buttons and help icon are decorative; the ribbon-display toggle and QAT actions are real",async()=>{
 const chrome=await read("components/word-efficiency/word-window-chrome.tsx");
 assert.match(chrome,/<span className="word-window-buttons" aria-hidden>/);
 assert.match(chrome,/<span className="word-titlebar-icon" aria-hidden title="Help">/);
 assert.match(chrome,/onClick=\{onToggleRibbon\}/);
 assert.match(chrome,/onClick=\{onSave\}/);
});
