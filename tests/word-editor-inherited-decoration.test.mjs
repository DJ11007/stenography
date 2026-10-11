import assert from"node:assert/strict";import test from"node:test";import{readFile}from"node:fs/promises";import{Window}from"happy-dom";import{inheritedTextDecoration}from"../lib/word-editor-dom.ts";

function textNodeIn(html,selector="#p"){const document=new Window().document;document.body.innerHTML=html;const root=document.querySelector(selector);let node=root;while(node.firstChild)node=node.firstChild;return{textNode:node,root}}

// The exact corrupting shape: the toolbar U button wraps text in a plain <u>, and
// with bold + italic applied the text node's own parent is an <i> INSIDE it.
// text-decoration is not inherited, so the immediate parent reports "none".
test("underline is found when a <u> wraps bold and italic elements around the text",()=>{
 const{textNode,root}=textNodeIn('<div><p id="p"><u><b><i>When you create pictures</i></b></u></p></div>');
 assert.deepEqual(inheritedTextDecoration(textNode,root),{underline:true,strike:false,doubleStrike:false});
});

test("strikethrough via <s>, <strike> and <del> is found through nested formatting",()=>{
 for(const tag of["s","strike","del"]){
  const{textNode,root}=textNodeIn(`<p id="p"><${tag}><b>text</b></${tag}></p>`);
  assert.deepEqual(inheritedTextDecoration(textNode,root),{underline:false,strike:true,doubleStrike:false},tag);
 }
});

test("inline text-decoration on any ancestor span counts, including line-through and underline together",()=>{
 const{textNode,root}=textNodeIn('<p id="p"><span style="text-decoration: underline line-through"><i>text</i></span></p>');
 assert.deepEqual(inheritedTextDecoration(textNode,root),{underline:true,strike:true,doubleStrike:false});
 const second=textNodeIn('<p id="p"><span style="text-decoration-line: underline"><b>text</b></span></p>');
 assert.deepEqual(inheritedTextDecoration(second.textNode,second.root),{underline:true,strike:false,doubleStrike:false});
});

test("plain bold or italic text reports no decoration",()=>{
 const{textNode,root}=textNodeIn('<p id="p"><b><i>text</i></b></p>');
 assert.deepEqual(inheritedTextDecoration(textNode,root),{underline:false,strike:false,doubleStrike:false});
});

test("decorations outside the block are not attributed to its text",()=>{
 const{textNode,root}=textNodeIn('<u><p id="p"><b>text</b></p></u>');
 assert.deepEqual(inheritedTextDecoration(textNode,root),{underline:false,strike:false,doubleStrike:false});
});

test("a double strikethrough wrapped around bold text is a double strike, not an ordinary one",()=>{
 const{textNode,root}=textNodeIn('<p id="p"><span style="text-decoration-line: line-through; text-decoration-style: double"><b>text</b></span></p>');
 assert.deepEqual(inheritedTextDecoration(textNode,root),{underline:false,strike:false,doubleStrike:true});
 const marked=textNodeIn('<p id="p"><span data-double-strike="true" style="text-decoration-line: line-through"><i>text</i></span></p>');
 assert.deepEqual(inheritedTextDecoration(marked.textNode,marked.root),{underline:false,strike:false,doubleStrike:true});
});

test("makeBlock uses the ancestor-aware helper for both underline and strike, keeping the old signals",async()=>{
 const source=await readFile(new URL("../app/typing/word-efficiency/[language]/[testId]/workspace/rich-document-editor.tsx",import.meta.url),"utf8");
 assert.match(source,/inherited=inheritedTextDecoration\(node,element\),underline=decoration\.includes\("underline"\)\|\|Boolean\(underlineNode\)\|\|inherited\.underline,/);
 assert.match(source,/strike:\(decoration\.includes\("line-through"\)\|\|inherited\.strike\)&&!doubleStrike/);
 assert.match(source,/\|\|inherited\.doubleStrike,/);
});
