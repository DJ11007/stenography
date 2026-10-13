import assert from"node:assert/strict";import test from"node:test";import{readFile}from"node:fs/promises";

const read=path=>readFile(new URL(`../${path}`,import.meta.url),"utf8");
const WORD="app/typing/word-efficiency/[language]/[testId]/workspace/";
const EXCEL="app/typing/excel-efficiency/[language]/[testId]/workspace/";

test("the exam clock is anchored to the server: time left is worked out on the server from the attempt's own start and the chosen duration, never the student's PC clock",async()=>{
 for(const[dir,file]of[[WORD,"page.tsx"],[EXCEL,"page.tsx"]]){
  const page=await read(dir+file);
  assert.match(page,/selected_duration_seconds/);
  assert.match(page,/remainingSeconds/);
  assert.match(page,/Date\.now\(\)\s*-\s*new Date\(attempt\.started_at\)\.getTime\(\)/);
 }
 for(const[dir,file]of[[WORD,"word-workspace.tsx"],[EXCEL,"excel-workspace.tsx"]]){
  const workspace=await read(dir+file);
  assert.match(workspace,/useExamCountdown\(remainingSeconds\)/);
  assert.doesNotMatch(workspace,/Date\.now\(\)/,"the workspace must not read the PC clock");
  assert.doesNotMatch(workspace,/startedAt/);
 }
});

test("the countdown hook counts down with a monotonic timer and flags expiry slightly before zero so the automatic submit lands inside the deadline",async()=>{
 const chrome=await read("components/efficiency/exam-chrome.tsx");
 assert.match(chrome,/performance\.now\(\)/);
 assert.doesNotMatch(chrome.slice(chrome.indexOf("export function useExamCountdown"),chrome.indexOf("export function formatClock")),/Date\.now\(\)/);
 assert.match(chrome,/useExamCountdown\(remainingAtLoadSeconds: number, lead = 2\)/);
 assert.match(chrome,/expired: remaining <= lead/);
});

test("when the clock runs out the test submits itself (Word and Excel), retrying on a failed network call, with an in-page message if it still cannot",async()=>{
 const word=await read(WORD+"rich-document-editor.tsx"),excel=await read(EXCEL+"rich-sheet-editor.tsx");
 assert.match(word,/if\(!autoSubmit\|\|mode!=="attempt"\|\|submitted\)return;/);
 assert.match(word,/for\(let attempt=0;attempt<6&&!cancelled;attempt\+\+\)\{if\(await submitNow\(true\)\|\|submittedRef\.current\)return;await sleep\(2500\)\}/);
 assert.match(excel,/if \(!autoSubmit \|\| submitted\) return;/);
 assert.match(excel,/for \(let attempt = 0; attempt < 6 && !cancelled; attempt\+\+\)/);
 for(const source of[word,excel])assert.match(source,/Time is up, but your test could not be submitted automatically/);
 assert.match(await read(WORD+"word-workspace.tsx"),/<RichDocumentEditor autoSubmit=\{expired\}/);
 assert.match(await read(EXCEL+"excel-workspace.tsx"),/autoSubmit=\{expired\}/);
});

test("no browser confirm()/alert() popups are used for submitting or leaving: they are in-page dialogs",async()=>{
 for(const file of[WORD+"rich-document-editor.tsx",WORD+"word-workspace.tsx",EXCEL+"rich-sheet-editor.tsx",EXCEL+"excel-workspace.tsx"]){
  const source=await read(file);
  const withoutOtherUses=source.replace(/restore=\(\)=>\{[^]*?\};/,"");
  assert.doesNotMatch(withoutOtherUses.replace(/if\(confirm\("Restore the last successful autosave\?[^]*?\)\)/,""),/[^.\w]confirm\("(Submit|Leave)/,file);
  assert.doesNotMatch(source,/alert\(/,file);
 }
 const chrome=await read("components/efficiency/exam-chrome.tsx");
 assert.match(chrome,/role="alertdialog"/);
 assert.match(await read(WORD+"rich-document-editor.tsx"),/<ConfirmDialog open=\{confirmSubmitOpen\} title="Submit your test\?"/);
 assert.match(await read(WORD+"rich-document-editor.tsx"),/<ConfirmDialog open=\{submitProblem!==null\} title="Could not submit"/);
 assert.match(await read(EXCEL+"rich-sheet-editor.tsx"),/<ConfirmDialog open=\{confirmSubmitOpen\} title="Submit your test\?"/);
 assert.match(await read(WORD+"word-workspace.tsx"),/<ConfirmDialog open=\{leaveOpen\} title="Leave the test\?"/);
 assert.match(await read(EXCEL+"excel-workspace.tsx"),/<ConfirmDialog open=\{leaveOpen\} title="Leave the test\?"/);
});

test("a manual submit that fails is explained in an in-page message; an 'already submitted' answer goes to the result instead of showing an error",async()=>{
 const word=await read(WORD+"rich-document-editor.tsx"),excel=await read(EXCEL+"rich-sheet-editor.tsx");
 assert.match(word,/if\(!auto\)setSubmitProblem\(message\)/);
 assert.match(word,/\/already submitted\/i\.test\(result\.error\)/);
 assert.match(excel,/if \(!auto\) setSubmitProblem\(message\)/);
 assert.match(excel,/\/already submitted\/i\.test\(result\.error\)/);
});

test("both workspaces offer a Full Screen toggle that hides the browser bars (Fullscreen API) and shows its state",async()=>{
 const chrome=await read("components/efficiency/exam-chrome.tsx");
 assert.match(chrome,/document\.documentElement\.requestFullscreen\(\)/);
 assert.match(chrome,/document\.exitFullscreen\(\)/);
 assert.match(chrome,/fullscreenchange/);
 assert.match(await read(WORD+"word-workspace.tsx"),/<FullscreenButton\/>/);
 assert.match(await read(EXCEL+"excel-workspace.tsx"),/<FullscreenButton \/>/);
});

test("the ribbon scales its groups to the available width instead of showing a bottom scrollbar that hides groups and dialog launchers",async()=>{
 const ribbon=await read("components/word-efficiency/word-editor-ribbon.tsx");
 assert.match(ribbon,/new ResizeObserver\(measure\)/);
 assert.match(ribbon,/Math\.max\(0\.62,/);
 assert.match(ribbon,/row\.style\.zoom = String\(next\)/);
 assert.match(ribbon,/style=\{fit < 1 \? \{ height: Math\.ceil\(88 \* fit\) \} : undefined\}/);
});
