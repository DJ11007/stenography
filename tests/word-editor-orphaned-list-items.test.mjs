import assert from"node:assert/strict";import test from"node:test";import{readFile}from"node:fs/promises";import{Window}from"happy-dom";import{reattachOrphanedListItems}from"../lib/word-editor-dom.ts";

// Real reported bug, reproduced live against the deployed word-efficiency
// editor: triple-clicking a bullet line (e.g. "Mathematics") to select it
// the normal way, then clicking Underline, made Chromium's execCommand
// unwrap the whole <ul> -- every sibling <li> became a direct child of the
// editor root, an empty <li> appeared where "Mathematics" used to be, and
// "Mathematics" itself became a bare underline <span> with no list-item-
// ness at all. This is the exact post-corruption DOM shape captured live.
function corruptedEditor(){
 const document=new Window().document;
 document.body.innerHTML='<div id="editor">'
  +'<p id="before">Before the list</p>'
  +'<li id="a" data-list-group="1">currentaffairs</li>'
  +'<li id="b" data-list-group="1">IndiaG.k</li>'
  +'<li id="empty" data-list-group="1"></li>'
  +'<span data-underline-style="single" data-underline-words-only="false">Mathematics</span>'
  +'<li id="d" data-list-group="1">Reasoning</li>'
  +'<li id="e" data-list-group="1">Science</li>'
  +'<p id="after">After the list</p>'
  +'</div>';
 return document.querySelector("#editor");
}

test("reattachOrphanedListItems rewraps orphaned top-level <li> elements (and a demoted formatting <span>) back into one <ul>, without touching unrelated blocks",()=>{
 const editor=corruptedEditor();
 reattachOrphanedListItems(editor);
 const children=[...editor.children];
 assert.deepEqual(children.map(c=>c.tagName),["P","UL","P"]);
 assert.equal(children[0].id,"before");
 assert.equal(children[2].id,"after");
 const list=children[1];
 const items=[...list.children];
 assert.deepEqual(items.map(i=>i.tagName),["LI","LI","LI","LI","LI","LI"]);
 assert.deepEqual(items.map(i=>i.textContent),["currentaffairs","IndiaG.k","","Mathematics","Reasoning","Science"]);
});

test("the promoted span keeps its underline formatting attributes as the new <li>'s content, and the empty phantom <li> is preserved rather than silently dropped",()=>{
 const editor=corruptedEditor();
 reattachOrphanedListItems(editor);
 const list=editor.querySelector("ul");
 const items=[...list.children];
 assert.deepEqual(items.map(i=>i.textContent),["currentaffairs","IndiaG.k","","Mathematics","Reasoning","Science"]);
 const mathsItem=items[3];
 assert.equal(mathsItem.tagName,"LI");
 const span=mathsItem.querySelector("span[data-underline-style]");
 assert.ok(span,"underline span should survive inside the promoted <li>");
 assert.equal(span.textContent,"Mathematics");
});

test("a document with no orphaned list items is left completely untouched",()=>{
 const document=new Window().document;
 document.body.innerHTML='<div id="editor"><p id="a">A</p><ul id="list"><li>One</li><li>Two</li></ul><p id="b">B</p></div>';
 const editor=document.querySelector("#editor");
 const before=editor.innerHTML;
 reattachOrphanedListItems(editor);
 assert.equal(editor.innerHTML,before);
});

test("an orphaned run directly adjacent to an existing list merges into it instead of creating a second list",()=>{
 const document=new Window().document;
 document.body.innerHTML='<div id="editor"><ul id="list" data-list-style="bullet"><li>One</li></ul><li id="stray">Two</li></div>';
 const editor=document.querySelector("#editor");
 reattachOrphanedListItems(editor);
 assert.deepEqual([...editor.children].map(c=>c.tagName),["UL"]);
 const list=editor.querySelector("ul");
 assert.deepEqual([...list.children].map(i=>i.textContent),["One","Two"]);
});

test("rich-document-editor.tsx calls reattachOrphanedListItems right after pruneStrayEmptyBlocks inside exec, for the same guard that excludes undo/redo",async()=>{
 const source=await readFile(new URL("../app/typing/word-efficiency/[language]/[testId]/workspace/rich-document-editor.tsx",import.meta.url),"utf8");
 assert.match(source,/import \{ adjustParagraphIndent, changeEditorRangeCase, clearEditorRangeFormatting, inheritedTextDecoration, parseInches, reattachOrphanedListItems, selectedEditorBlocks, snapshotPaintStyle, wrapEditorRange, type EditorRunStyles \} from "@\/lib\/word-editor-dom";/);
 assert.match(source,/if\(beforeCount!==null\)\{pruneStrayEmptyBlocks\(beforeCount\);if\(editor\.current\)reattachOrphanedListItems\(editor\.current\)\}/);
});
