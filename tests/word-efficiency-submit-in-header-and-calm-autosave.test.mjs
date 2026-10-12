import assert from"node:assert/strict";import test from"node:test";import{readFile}from"node:fs/promises";

const dir="app/typing/word-efficiency/[language]/[testId]/workspace/";
const read=path=>readFile(new URL(`../${path}`,import.meta.url),"utf8");

test("the student workspace puts the Submit button in the header right after the Active badge",async()=>{
 const workspace=await read(dir+"word-workspace.tsx");
 assert.match(workspace,/"Active"\}<\/span><span id="word-submit-slot"/);
 assert.match(workspace,/<RichDocumentEditor submitPortalId="word-submit-slot" [^>]*submitLabel="Submit" /);
});

test("with a portal id the editor renders Submit into the header slot and no bottom bar",async()=>{
 const editor=await read(dir+"rich-document-editor.tsx");
 assert.match(editor,/submitSlot\?createPortal\(/);
 assert.match(editor,/,submitSlot\):submitPortalId\?null:<footer/);
 // the admin Model Answer editor passes no portal id and keeps its own footer
 const admin=await read("app/admin/word-efficiency-tests/[testId]/model-answer/model-answer-editor.tsx");
 assert.doesNotMatch(admin,/submitPortalId/);
});

test("student attempts are not autosaved after every edit, so undo/redo is left alone",async()=>{
 const editor=await read(dir+"rich-document-editor.tsx");
 assert.match(editor,/const ATTEMPT_AUTOSAVE_INTERVAL_MS=30_000;/);
 const changed=editor.slice(editor.indexOf(" const changed=()=>"),editor.indexOf(" const changed=()=>")+900);
 // the attempt path only marks the document dirty and schedules ONE save, without pushing it back on each edit
 assert.match(changed,/dirtyRef\.current=true;if\(!autosaveTimer\.current\)autosaveTimer\.current=setTimeout\(/);
 assert.match(changed,/ATTEMPT_AUTOSAVE_INTERVAL_MS/);
 assert.doesNotMatch(changed.split('if(mode==="authoring")')[1].split("return}")[1],/setStatus\(/);
 // authoring keeps its quick debounce
 assert.match(changed,/mode==="authoring"\).*,800\)/s);
});

test("unsaved work is flushed when the tab is hidden or the page is left, and before the final submit clears the timer",async()=>{
 const editor=await read(dir+"rich-document-editor.tsx");
 assert.match(editor,/document\.addEventListener\("visibilitychange",onVisibility\);window\.addEventListener\("pagehide",flush\)/);
 assert.match(editor,/if\(autosaveTimer\.current\)\{clearTimeout\(autosaveTimer\.current\);autosaveTimer\.current=null\}setStatus\(oneTimeSubmit/);
});
