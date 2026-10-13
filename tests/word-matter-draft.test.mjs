import assert from"node:assert/strict";import test from"node:test";

// A tiny in-memory localStorage so the helper can be exercised outside a browser.
function installStorage(){const data=new Map();globalThis.window={localStorage:{getItem:k=>data.has(k)?data.get(k):null,setItem:(k,v)=>void data.set(k,String(v)),removeItem:k=>void data.delete(k),get length(){return data.size},key:i=>[...data.keys()][i]??null}};
 Object.defineProperty(globalThis.window.localStorage,"__data",{value:data});return data}

const{readMatterDraft,writeMatterDraft,clearMatterDraft,clearAllMatterDrafts,describeMatter,isWorkingMatter}=await import("../lib/word-matter-draft.ts");
const matter=(extra={})=>({schemaVersion:"1",language:"English",paragraphs:[{id:"matter-p-1",type:"paragraph",paragraphNumber:1,listGroup:null,runs:[{text:"Hello brave new world",bold:false,italic:false,underline:false,strike:false,fontFamily:null,fontSize:null,color:null,highlight:null}],alignment:"left",leftIndent:0,rightIndent:0,lineSpacing:1,spaceBefore:0,spaceAfter:0},{id:"matter-p-2",type:"table",rows:[["a","b"]]}],formattingSummary:{},warnings:[],...extra});

test("a document is parked per test and per slot, and read back",()=>{
 installStorage();
 assert.equal(readMatterDraft("new","staged"),null);
 assert.equal(writeMatterDraft("new","staged",matter()),true);
 assert.equal(readMatterDraft("new","staged").paragraphs.length,2);
 assert.equal(readMatterDraft("new","wip"),null,"other slot untouched");
 assert.equal(readMatterDraft("test-1","staged"),null,"other test untouched");
});

test("clearing one slot, one test, or everything",()=>{
 installStorage();
 writeMatterDraft("a","staged",matter());writeMatterDraft("a","wip",matter());writeMatterDraft("b","staged",matter());
 clearMatterDraft("a","wip");assert.equal(readMatterDraft("a","wip"),null);assert.ok(readMatterDraft("a","staged"));
 clearMatterDraft("a");assert.equal(readMatterDraft("a","staged"),null);assert.ok(readMatterDraft("b","staged"));
 clearAllMatterDrafts();assert.equal(readMatterDraft("b","staged"),null);
});

test("junk in storage is ignored instead of breaking the page",()=>{
 const data=installStorage();
 data.set("samradhi-word-matter-staged:new","{not json");assert.equal(readMatterDraft("new","staged"),null);
 data.set("samradhi-word-matter-staged:new",JSON.stringify({paragraphs:[]}));assert.equal(readMatterDraft("new","staged"),null);
 data.set("samradhi-word-matter-staged:new",JSON.stringify({language:"French",paragraphs:[{}]}));assert.equal(readMatterDraft("new","staged"),null);
 assert.equal(isWorkingMatter(matter()),true);
});

test("without storage (private mode) nothing throws",()=>{
 globalThis.window={get localStorage(){throw new Error("blocked")}};
 assert.equal(readMatterDraft("new","staged"),null);assert.equal(writeMatterDraft("new","staged",matter()),false);
 assert.doesNotThrow(()=>clearAllMatterDrafts());
});

test("the card summary counts paragraphs, tables and words and previews the first lines",()=>{
 const summary=describeMatter(matter());
 assert.deepEqual({p:summary.paragraphs,t:summary.tables,w:summary.words},{p:2,t:1,w:6});
 assert.equal(summary.preview[0],"Hello brave new world");
});
