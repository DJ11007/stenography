import assert from"node:assert/strict";import test from"node:test";import{readFile}from"node:fs/promises";import{PGlite}from"@electric-sql/pglite";
import{editorDocumentToMatter,blankWorkingMatter}from"../lib/word-matter-from-editor.ts";

const run=(text,extra={})=>({text,bold:false,italic:false,underline:false,strike:false,doubleStrike:false,superscript:false,subscript:false,fontFamily:"Segoe UI",fontSize:12,color:"020618",highlight:null,...extra});
const block=(runs,extra={})=>({id:"block-0",type:"paragraph",alignment:"left",runs,attrs:{},...extra});
const doc=blocks=>({schemaVersion:"2",blocks,pageLayout:{},operations:[],savedAt:"2026-01-01T00:00:00.000Z"});

async function validator(){
 const sql=await readFile(new URL("../supabase/migrations/202608260027_word_efficiency_working_matter_tables.sql",import.meta.url),"utf8");
 const start=sql.indexOf("create or replace function public.assert_word_efficiency_working_matter");
 const end=sql.indexOf("end $$;",start)+"end $$;".length;
 const db=new PGlite();await db.exec(sql.slice(start,end));
 return async matter=>{try{await db.query("select public.assert_word_efficiency_working_matter($1::jsonb)",[JSON.stringify(matter)]);return"ok"}catch(error){return error.message}};
}

test("a designed document becomes a working matter that the database validator accepts",async()=>{
 const check=await validator();
 const result=editorDocumentToMatter(doc([
  block([run("First paragraph, "),run("bold part",{bold:true}),run(" and more.")],{alignment:"justify",attrs:{marginLeft:"0.5in",lineHeight:"1.5",marginBottom:"6pt"}}),
  block([run("Item one")],{type:"list-item"}),block([run("Item two")],{type:"list-item"}),
  block([run("Heading",{bold:true,fontSize:16,color:"C00000",highlight:"FFFF00",fontFamily:"Arial"})],{alignment:"center"}),
  {id:"t",type:"table",alignment:"left",runs:[],attrs:{rows:[["a","b"],["c","d"]]}},
 ]),"English");
 assert.equal(result.ok,true);
 assert.equal(await check(result.matter),"ok");
 const p=result.matter.paragraphs;
 assert.equal(p[0].paragraphNumber,1);assert.equal(p[0].alignment,"justify");assert.equal(p[0].leftIndent,0.5);assert.equal(p[0].lineSpacing,1.5);assert.equal(p[0].spaceAfter,6);
 assert.deepEqual(p[0].runs.map(r=>[r.text,r.bold]),[["First paragraph, ",false],["bold part",true],[" and more.",false]]);
 assert.equal(p[1].type,"list-item");assert.equal(p[1].listGroup,p[2].listGroup);assert.equal(p[1].paragraphNumber,null);
 assert.equal(p[3].paragraphNumber,2);assert.equal(p[3].runs[0].color,"C00000");assert.equal(p[3].runs[0].highlight,"FFFF00");assert.equal(p[3].runs[0].fontFamily,"Arial");assert.equal(p[3].runs[0].fontSize,16);
 assert.deepEqual(p[4],{id:"matter-p-5",type:"table",rows:[["a","b"],["c","d"]]});
 assert.equal(result.matter.formattingSummary.tables,1);assert.equal(result.matter.formattingSummary.listItems,2);assert.equal(result.matter.formattingSummary.justifiedParagraphs,1);
});

test("default text colour and unapproved fonts are not stored as formatting; Calibri (Body) becomes Calibri",async()=>{
 const check=await validator();
 const result=editorDocumentToMatter(doc([block([run("plain"),run("calibri",{fontFamily:"Calibri (Body)"}),run("fancy",{fontFamily:"Garamond",color:"000000"})])]),"English");
 assert.equal(result.ok,true);assert.equal(await check(result.matter),"ok");
 const runs=result.matter.paragraphs[0].runs;
 assert.deepEqual(runs.map(r=>[r.text,r.fontFamily,r.color]),[["plain",null,null],["calibri","Calibri",null],["fancy",null,null]]);
});

test("adjacent runs with the same formatting are merged, and a blank paragraph keeps one empty run",async()=>{
 const check=await validator();
 const result=editorDocumentToMatter(doc([block([run("Hel"),run("lo ")," ".length?run("world"):run("")]),block([run("")])]),"English");
 assert.equal(result.ok,true);assert.equal(await check(result.matter),"ok");
 assert.equal(result.matter.paragraphs[0].runs.length,1);assert.equal(result.matter.paragraphs[0].runs[0].text,"Hello world");
 assert.equal(result.matter.paragraphs[1].runs.length,1);assert.equal(result.matter.paragraphs[1].runs[0].text,"");
});

test("Hindi text and font are kept; pictures and page breaks are dropped with a warning",async()=>{
 const check=await validator();
 const result=editorDocumentToMatter(doc([block([run("नमस्ते दुनिया",{fontFamily:"Mangal"})]),{id:"i",type:"image",runs:[],attrs:{src:"x"}},{id:"b",type:"page-break",runs:[],attrs:{}}]),"Hindi");
 assert.equal(result.ok,true);assert.equal(await check(result.matter),"ok");
 assert.equal(result.matter.language,"Hindi");assert.equal(result.matter.paragraphs.length,1);assert.equal(result.matter.paragraphs[0].runs[0].fontFamily,"Mangal");
 assert.match(result.matter.warnings[0],/2 items/);
});

test("an empty or blank document is refused with a plain message instead of being saved",()=>{
 for(const input of[null,{},doc([]),doc([block([run("")]),block([run("   ")])])]){const result=editorDocumentToMatter(input,"English");assert.equal(result.ok,false);assert.match(result.error,/blank|empty|no text/)}
});

test("more than 550 paragraphs is refused (the database limit)",()=>{
 const result=editorDocumentToMatter(doc(Array.from({length:551},(_,i)=>block([run(`p${i}`)]))),"English");
 assert.equal(result.ok,false);
});

test("the blank starting document is itself a valid working matter shape",async()=>{
 const check=await validator();
 assert.equal(await check(blankWorkingMatter("English")),"ok");
});

test("effects the working document cannot store are dropped but listed in a warning, never silently",()=>{
 const result=editorDocumentToMatter(doc([block([run("x2",{superscript:true}),run("H2O",{subscript:true}),run("small",{smallCaps:true}),run("dbl",{doubleStrike:true})],{attrs:{specialIndentMode:"firstLine",border:"bottom",backgroundColor:"#ffff00"}})]),"English");
 assert.equal(result.ok,true);
 const warning=result.matter.warnings.find(item=>item.startsWith("Not kept"));
 assert.ok(warning);
 for(const part of["superscript","subscript","small caps","double strikethrough","first-line / hanging indents","paragraph borders","paragraph shading"])assert.ok(warning.includes(part),part);
 assert.equal(result.matter.paragraphs[0].runs.some(r=>r.strike),true,"double strike is kept as a single strike");
});

test("default paragraph spacing: a paragraph with no spacing set gets Word's 8 pt after and 1.15 lines, an explicit 0 stays 0, list items are not spaced",async()=>{
 const check=await validator();
 const result=editorDocumentToMatter(doc([block([run("plain")]),block([run("explicit zero")],{attrs:{marginBottom:"0pt",lineHeight:"1"}}),block([run("item")],{type:"list-item"})]),"English",{defaultSpaceAfter:8,defaultLineSpacing:1.15});
 assert.equal(result.ok,true);assert.equal(await check(result.matter),"ok");
 const[a,b,c]=result.matter.paragraphs;
 assert.equal(a.spaceAfter,8);assert.equal(a.lineSpacing,1.15);
 assert.equal(b.spaceAfter,0);assert.equal(b.lineSpacing,1);
 assert.equal(c.spaceAfter,0);
 const without=editorDocumentToMatter(doc([block([run("plain")])]),"English");
 assert.equal(without.matter.paragraphs[0].spaceAfter,0,"no defaults requested: unchanged behaviour");
});

test("the blank starting document is spaced like a Word paragraph",()=>{
 const blankMatter=blankWorkingMatter("English");
 assert.equal(blankMatter.paragraphs[0].spaceAfter,8);assert.equal(blankMatter.paragraphs[0].lineSpacing,1.15);
});
