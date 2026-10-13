import assert from"node:assert/strict";import test from"node:test";import{readFile}from"node:fs/promises";

const read=path=>readFile(new URL(`../${path}`,import.meta.url),"utf8");
const ADMIN="app/admin/word-efficiency-tests/";

test("the manage page lists tests and offers a Create Test button; the form lives on a separate design page",async()=>{
 const[manage,design,body]=await Promise.all([read(ADMIN+"page.tsx"),read(ADMIN+"design/page.tsx"),read(ADMIN+"tests-page.tsx")]);
 assert.match(manage,/view="manage"/);
 assert.match(design,/view="design"/);
 assert.match(body,/<Link href="\/admin\/word-efficiency-tests\/design"[^>]*>\+ Create Test<\/Link>/);
 // the form is only on the design page, the list only on the manage page
 assert.match(body,/\{view === "design" && \(\s*<section className="rounded-3xl bg-white p-5 shadow sm:p-7">/);
 assert.match(body,/\{view === "manage" && \(\s*<section>/);
 assert.match(body,/href=\{`\/admin\/word-efficiency-tests\/design\?edit=\$\{test\.id\}`\}/);
});

test("a failed save returns to the design page for the same test, and the model-answer page links back to it",async()=>{
 const[actions,model]=await Promise.all([read(ADMIN+"actions.ts"),read(ADMIN+"[testId]/model-answer/page.tsx")]);
 const save=actions.slice(actions.indexOf("export async function saveWordEfficiencyTest"),actions.indexOf("export async function setWordEfficiencyStatus"));
 assert.match(save,/const errorBase=`\/admin\/word-efficiency-tests\/design\?\$\{testId\?`edit=\$\{testId\}&`:""\}error=`;/);
 assert.doesNotMatch(save,/\/admin\/word-efficiency-tests\?error=/);
 assert.match(model,/href=\{`\/admin\/word-efficiency-tests\/design\?edit=\$\{test\.id\}`\}/);
});

test("=rand(paragraphs,lines) is wired into the designer only, on Enter in an otherwise empty paragraph",async()=>{
 const[editor,designer]=await Promise.all([read("app/typing/word-efficiency/[language]/[testId]/workspace/rich-document-editor.tsx"),read(ADMIN+"design/document/working-matter-editor-page.tsx")]);
 assert.match(editor,/const handleRandKey=\(event:KeyboardEvent<HTMLDivElement>\)=>\{/);
 assert.match(editor,/if\(!randomText\|\|event\.key!=="Enter"\|\|event\.shiftKey\|\|submitted\|\|!editor\.current\)return;/);
 assert.match(editor,/parseRandCommand\(block\.textContent\?\?""\)/);
 assert.match(editor,/onKeyDown=\{handleRandKey\}/);
 assert.match(designer,/randomText=\{\{ language: \(\) => language \}\}/);
 // not enabled anywhere else
 const others=[await read("app/typing/word-efficiency/[language]/[testId]/workspace/word-workspace.tsx"),await read(ADMIN+"[testId]/model-answer/model-answer-editor.tsx")];
 for(const source of others)assert.doesNotMatch(source,/randomText/);
});

test("the designer applies Word's default paragraph spacing in the editor itself, so what the admin sees is what is saved",async()=>{
 const[editor,page]=await Promise.all([read("app/typing/word-efficiency/[language]/[testId]/workspace/rich-document-editor.tsx"),read(ADMIN+"design/document/working-matter-editor-page.tsx")]);
 assert.match(editor,/const applyParagraphDefaults=\(\)=>\{if\(!paragraphDefaults\|\|!editor\.current\)return;/);
 assert.match(editor,/if\(!element\.style\.marginBottom\)element\.style\.marginBottom=`\$\{paragraphDefaults\.spaceAfter\}pt`/);
 assert.match(editor,/const changed=\(\)=>\{if\(submitted\)return;applyParagraphDefaults\(\);/);
 assert.match(page,/const PARAGRAPH_DEFAULTS = \{ spaceAfter: 8, lineHeight: 1\.15 \};/);
 assert.match(page,/paragraphDefaults=\{PARAGRAPH_DEFAULTS\}/);
 assert.match(page,/editorDocumentToMatter\(latest, language, PARAGRAPH_DEFAULTS_FOR_MATTER\)/);
});
