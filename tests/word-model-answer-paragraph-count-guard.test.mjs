import assert from"node:assert/strict";import test from"node:test";import{readFile}from"node:fs/promises";

test("the Model Answer page refuses to save a question that changed the number of paragraphs, before anything is stored",async()=>{
 const editor=await readFile(new URL("../app/admin/word-efficiency-tests/[testId]/model-answer/model-answer-editor.tsx",import.meta.url),"utf8");
 assert.match(editor,/function countParagraphs\(document: unknown\): number \| null/);
 assert.match(editor,/if \(expected !== null && actual !== expected\) \{/);
 assert.match(editor,/A paragraph was added, deleted, split or merged/);
 assert.ok(editor.indexOf("A paragraph was added, deleted, split or merged")<editor.indexOf("await saveWordEfficiencyModelAnswer(versionId, cleanDocument)"));
});
