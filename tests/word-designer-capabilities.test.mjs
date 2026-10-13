import assert from"node:assert/strict";import test from"node:test";
import{designerCapabilities,DESIGNER_FONTS}from"../lib/word-designer-capabilities.ts";
import{validateWordEditorCapabilities,APPROVED_WORD_FONTS,WORD_EDITOR_RIBBON}from"../lib/word-editor-capabilities.ts";

const enabled=caps=>{const on=[];for(const[t,tab]of Object.entries(caps.tabs))for(const[g,group]of Object.entries(tab.groups))for(const[o,v]of Object.entries(group.options))if(v)on.push(`${t}.${g}.${o}`);return on};

test("the designer has every Clipboard, Font, Paragraph and Editing option the student has, including the Font and Paragraph dialogs",()=>{
 const on=enabled(designerCapabilities());
 const home=WORD_EDITOR_RIBBON.find(tab=>tab.id==="Home");
 for(const group of home.groups)for(const option of group.options)assert.ok(on.includes(`Home.${group.id}.${option.id}`),`Home.${group.id}.${option.id}`);
 for(const must of["Home.font.fontDialog","Home.paragraph.paragraphDialog","Home.font.subscript","Home.font.superscript","Home.font.textEffects","Home.paragraph.shading","Home.paragraph.borders","Home.paragraph.multilevelList","Insert.tables.insertTable"])assert.ok(on.includes(must),must);
});

test("things a working document cannot hold stay out: pictures, page breaks, headers, columns, backgrounds",()=>{
 const caps=designerCapabilities(),on=enabled(caps);
 for(const mustNot of["Insert.illustrations.insertPicture","Insert.pages.pageBreak","Insert.headerFooter.header","Page Layout.pageSetup.columns","Design.pageBackground.watermark"])assert.ok(!on.includes(mustNot),mustNot);
 assert.equal(caps.tabs.Design.enabled,false);assert.equal(caps.tabs["Page Layout"].enabled,false);assert.equal(caps.tabs.Home.enabled,true);
});

test("the designer capabilities pass the editor's own validator and use only fonts the matter format allows",()=>{
 const caps=designerCapabilities();
 assert.doesNotThrow(()=>validateWordEditorCapabilities(caps));
 for(const font of DESIGNER_FONTS)assert.ok(APPROVED_WORD_FONTS.includes(font));
 assert.deepEqual(caps.fonts,DESIGNER_FONTS);
});
