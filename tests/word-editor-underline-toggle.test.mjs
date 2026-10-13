import assert from"node:assert/strict";import test from"node:test";import{readFile}from"node:fs/promises";import{Window}from"happy-dom";
import{selectionFullyUnderlined,stripUnderline}from"../lib/word-editor-dom.ts";

function setup(html){const window=new Window();const document=window.document;document.body.innerHTML=`<div id="root">${html}</div>`;globalThis.document=document;globalThis.NodeFilter=window.NodeFilter;
 const root=document.getElementById("root");const range=document.createRange();range.selectNodeContents(root);return{root,range,document}}

const styledSpan='<span data-underline-style="single" style="text-decoration-line: underline; text-decoration-style: solid">Some marked text</span>';

test("a paragraph underlined once is detected as fully underlined, so the next click removes it",()=>{
 const{root,range}=setup(`<p>${styledSpan}</p>`);
 assert.equal(selectionFullyUnderlined(root,range),true);
 assert.equal(stripUnderline(root,range),true);
 assert.equal(root.querySelector("[data-underline-style]"),null);
 assert.doesNotMatch(root.innerHTML,/underline/);
 assert.equal(selectionFullyUnderlined(root,range),false,"after removing, the next click will apply it again");
});

test("an <u> underline (and nested bold/italic inside it) is removed too, keeping the text",()=>{
 const{root,range}=setup("<p><u><b><i>Bold italic marked</i></b></u></p>");
 assert.equal(selectionFullyUnderlined(root,range),true);
 assert.equal(stripUnderline(root,range),true);
 assert.equal(root.querySelector("u"),null);
 assert.equal(root.textContent,"Bold italic marked");
 assert.ok(root.querySelector("b i"),"bold and italic survive");
});

test("text that is only partly underlined, or not at all, is NOT fully underlined (the click applies instead of removing)",()=>{
 const{root,range}=setup(`<p>${styledSpan} and plain text</p>`);
 assert.equal(selectionFullyUnderlined(root,range),false);
 const none=setup("<p>plain only</p>");
 assert.equal(selectionFullyUnderlined(none.root,none.range),false);
});

test("a selection that spans two underlined paragraphs is fully underlined and both are cleared",()=>{
 const{root,range}=setup(`<p>${styledSpan}</p><p><u>Second paragraph</u></p>`);
 assert.equal(selectionFullyUnderlined(root,range),true);
 stripUnderline(root,range);
 assert.doesNotMatch(root.innerHTML,/underline|<u>/);
});

test("the toolbar U button and Ctrl+U are wired to the toggle",async()=>{
 const[ribbon,editor]=await Promise.all([readFile(new URL("../components/word-efficiency/word-editor-ribbon.tsx",import.meta.url),"utf8"),readFile(new URL("../app/typing/word-efficiency/[language]/[testId]/workspace/rich-document-editor.tsx",import.meta.url),"utf8")]);
 assert.match(ribbon,/onChange\?\.\("toggle",lastStyle\)/);
 assert.match(editor,/if\(action==="toggle"\)\{/);
 assert.match(editor,/selectionFullyUnderlined\(editor\.current,toggleRange\)/);
 assert.match(editor,/key==="u"\)\{event\.preventDefault\(\);runRef\.current\("underline"\);return\}/);
 assert.match(editor,/underline:\(\)=>underline\("toggle","single"\)/);
});
