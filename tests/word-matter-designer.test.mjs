import assert from"node:assert/strict";import test from"node:test";import{readFile}from"node:fs/promises";

const read=path=>readFile(new URL(`../${path}`,import.meta.url),"utf8");
const ADMIN="app/admin/word-efficiency-tests/";
const EDITOR_DIR=ADMIN+"design/document/";

test("the test form has a compact Working Document card instead of the .docx upload or an embedded editor",async()=>{
 const page=await read(ADMIN+"tests-page.tsx");
 assert.match(page,/import \{ WorkingMatterDesigner \} from "\.\/working-matter-designer";/);
 assert.match(page,/<WorkingMatterDesigner key=\{String\(editing\?\.id\?\?"new"\)\} editId=\{editing\?\.id\?\?null\} initialSnapshot=\{current\?\.working_matter_snapshot\?\?null\}\/>/);
 assert.doesNotMatch(page,/WorkingMatterDocxFields/);
 assert.doesNotMatch(page,/workingMatterFile/);
 const card=await read(ADMIN+"working-matter-designer.tsx");
 assert.doesNotMatch(card,/RichDocumentEditor/,"the editor is on its own page, not in the form");
 assert.match(card,/Open Document Editor/);
 assert.match(card,/\/admin\/word-efficiency-tests\/design\/document\?/);
});

test("the document is typed on its own full-screen page in the real editor with the restricted capabilities",async()=>{
 const[page,client]=await Promise.all([read(EDITOR_DIR+"page.tsx"),read(EDITOR_DIR+"working-matter-editor-page.tsx")]);
 assert.match(page,/await requireAdmin\(\)/);
 assert.match(page,/working_matter_snapshot/);
 assert.match(client,/<RichDocumentEditor/);
 assert.match(client,/mode="authoring"/);
 assert.match(client,/capabilities=\{capabilities\}/);
 assert.match(client,/designerCapabilities\(\)/);
 assert.match(client,/\bfullHeight\b/);
 assert.match(client,/className="matter-designer flex h-dvh flex-col/);
 assert.match(client,/randomText=\{\{ language: \(\) => language \}\}/);
 const editor=await read("app/typing/word-efficiency/[language]/[testId]/workspace/rich-document-editor.tsx");
 assert.match(editor,/\$\{fullHeight\?"h-full":submitPortalId\?"":"h-\[85dvh\]"\}/);
});

test("Save & return converts the document, parks it for the form and clears the work in progress; autosave only keeps work in progress",async()=>{
 const client=await read(EDITOR_DIR+"working-matter-editor-page.tsx");
 assert.match(client,/editorDocumentToMatter\(latest, language, PARAGRAPH_DEFAULTS_FOR_MATTER\)/);
 assert.match(client,/writeMatterDraft\(target, "staged", result\.matter\)/);
 assert.match(client,/clearMatterDraft\(target, "wip"\)/);
 assert.match(client,/router\.push\(backHref\)/);
 assert.match(client,/if \(result\.ok\) writeMatterDraft\(target, "wip", result\.matter\)/);
 assert.match(client,/readMatterDraft\(target, "wip"\)/);
 assert.match(client,/Leave without saving\?/);
});

test("the form picks up the saved document, needs one before the test can be saved, and keeps it in the test's language",async()=>{
 const card=await read(ADMIN+"working-matter-designer.tsx");
 assert.match(card,/<input ref=\{hidden\} type="hidden" name="workingMatterSnapshot" value=\{json\} readOnly \/>/);
 assert.match(card,/readMatterDraft\(target, "staged"\)/);
 assert.match(card,/form\.addEventListener\("submit", beforeSubmit, true\)/);
 assert.match(card,/if \(!matter\) \{[^]*event\.preventDefault\(\); event\.stopImmediatePropagation\(\)/);
 assert.match(card,/matter\.language !== language\) hidden\.current\.value = JSON\.stringify\(\{ \.\.\.matter, language \}\)/);
 // an untouched stored document is sent exactly as it was
 assert.match(card,/useState<WorkingMatterSnapshot \| null>\(initialSnapshot\)/);
});

test("going to the editor keeps the rest of the form, and a returning admin is not asked to restore the draft",async()=>{
 const[card,preserver]=await Promise.all([read(ADMIN+"working-matter-designer.tsx"),read(ADMIN+"draft-preserver.tsx")]);
 assert.match(card,/window\.dispatchEvent\(new Event\("word-efficiency:save-draft"\)\)/);
 assert.match(card,/samradhi-word-draft-auto-restore/);
 assert.match(preserver,/autoRestore=sessionStorage\.getItem\("samradhi-word-draft-auto-restore"\)==="1"/);
 assert.match(preserver,/if\(stored&&\(autoRestore\|\|confirm\(/);
});

test("saved test: the parked documents are cleared on the page the save returns to",async()=>{
 const[page,clear]=await Promise.all([read(ADMIN+"tests-page.tsx"),read(ADMIN+"clear-matter-drafts.tsx")]);
 assert.match(page,/A new immutable test version was saved\.<ClearMatterDrafts \/>/);
 assert.match(clear,/clearAllMatterDrafts\(\)/);
});

test("the save action reports a missing document in the designer's own words",async()=>{
 const actions=await read(ADMIN+"actions.ts");
 assert.match(actions,/Design%20the%20working%20document%20before%20saving/);
 assert.doesNotMatch(actions,/Upload%20Working%20Matter%20DOCX/);
});
