import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { isWordCommandEnabled, normalizeWordEditorCapabilities, recommendedWordEditorCapabilities, validateWordEditorCapabilities, WORD_EDITOR_RIBBON } from "../lib/word-editor-capabilities.ts";
import { validateWordEditorDocument } from "../lib/word-editor-document.ts";
const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const run = overrides => ({ text: "Safe", bold: false, italic: false, underline: false, strike: false, superscript: false, subscript: false, fontFamily: "Arial", fontSize: 12, color: null, highlight: null, doubleStrike: false, href: null, bookmark: null, field: null, ...overrides });
const pageLayout = { padding: null, maxWidth: null, aspectRatio: null, columnCount: null, backgroundColor: null, border: null, watermark: null };
const v2 = overrides => ({ schemaVersion: "2", blocks: [{ id: "block-1", type: "paragraph", alignment: "left", runs: [run()], attrs: { lineNumbers: false, dropCap: false } }], pageLayout, operations: [], savedAt: new Date().toISOString(), ...overrides });

test("reduced ribbon tab order and exact groups are explicit", () => {
  assert.deepEqual(WORD_EDITOR_RIBBON.map(tab => tab.id), ["File", "Home", "Insert", "Design", "Page Layout", "View"]);
  const groups = Object.fromEntries(WORD_EDITOR_RIBBON.map(tab => [tab.id, tab.groups.map(group => group.label)]));
  assert.deepEqual(groups.File, []);
  assert.deepEqual(groups.Home, ["Clipboard", "Font", "Paragraph", "Editing"]);
  assert.deepEqual(groups.Insert, ["Pages", "Tables", "Illustrations", "Links", "Header & Footer", "Text", "Symbols"]);
  assert.deepEqual(groups.Design, ["Page Background"]);
  assert.deepEqual(groups["Page Layout"], ["Page Setup"]);
  assert.deepEqual(groups.View, ["Document Views", "Show/Hide", "Zoom"]);
});

test("reduced ribbon contains exactly the specified option labels",()=>{const actual=Object.fromEntries(WORD_EDITOR_RIBBON.map(tab=>[tab.id,Object.fromEntries(tab.groups.map(group=>[group.label,group.options.map(item=>item.label)]))]));assert.deepEqual(actual,{File:{},Home:{Clipboard:["Undo","Redo","Paste","Cut","Copy","Format Painter"],Font:["Font family","Font size","Increase font size","Decrease font size","Change case","Bold","Italic","Underline","Strikethrough","Subscript","Superscript","Text effects","Text highlight color","Font color","Font Settings…"],Paragraph:["Bullets","Numbering","Multilevel list","Decrease indent","Increase indent","Sort","Show/hide formatting marks","Align left","Center","Align right","Justify","Line spacing","Shading","Borders","Paragraph Settings…"],Editing:["Find","Replace","Select"]},Insert:{Pages:["Cover Page","Blank Page","Page Break"],Tables:["Table"],Illustrations:["Pictures","Online Pictures","Shapes"],Links:["Hyperlink","Bookmark","Cross-reference"],"Header & Footer":["Header","Footer","Page Number"],Text:["Drop Cap","Date & Time"],Symbols:["Symbol"]},Design:{"Page Background":["Watermark","Page Color","Page Borders"]},"Page Layout":{"Page Setup":["Margins","Orientation","Size","Columns","Breaks","Line Numbers"]},View:{"Document Views":["Print Layout","Full Screen Reading","Web Layout","Outline","Draft"],"Show/Hide":["Ruler","Gridlines","Document Map"],Zoom:["100%","One Page","Two Pages"]}})});

test("flat capabilities normalize without mutating the source and effective parents are enforced", () => {
  const flat = { tabs: ["Home"], commands: ["bold", "insertUnorderedList"], fonts: ["Arial"], fontSizeMin: 10, fontSizeMax: 20 };
  const before = JSON.stringify(flat); const caps = normalizeWordEditorCapabilities(flat);
  assert.equal(JSON.stringify(flat), before); assert.equal(caps.schemaVersion, "2");
  assert.equal(isWordCommandEnabled(caps, "bold"), true); assert.equal(isWordCommandEnabled(caps, "bullets"), true); assert.equal(isWordCommandEnabled(caps, "insertTable"), false);
  caps.tabs.Home.enabled = false; assert.equal(isWordCommandEnabled(caps, "bold"), false);
  caps.tabs.Home.enabled = true; caps.tabs.Home.groups.font.enabled = false; assert.equal(isWordCommandEnabled(caps, "bold"), false);
});

test("schema-v2 capabilities reject unknown membership and unsupported commands", () => {
  const valid = recommendedWordEditorCapabilities(); assert.deepEqual(validateWordEditorCapabilities(valid), valid);
  const unknownTab = structuredClone(valid); unknownTab.tabs.Evil = { enabled: true, groups: {} }; assert.throws(() => validateWordEditorCapabilities(unknownTab), /tab/i);
  const unknownGroup = structuredClone(valid); unknownGroup.tabs.Home.groups.evil = { enabled: true, options: {} }; assert.throws(() => validateWordEditorCapabilities(unknownGroup), /group/i);
  const unknownOption = structuredClone(valid); unknownOption.tabs.Home.groups.font.options.evil = true; assert.throws(() => validateWordEditorCapabilities(unknownOption), /option/i);
  const chart = structuredClone(valid); chart.tabs.Insert.groups.illustrations.options.chart = true; assert.throws(() => validateWordEditorCapabilities(chart), /option/i);
});

test("TypeScript and database capability defaults have identical membership", async () => {
  const migration = await read("supabase/migrations/202608310044_word_efficiency_paragraph_dialog.sql");
  const sqlOptions = [...migration.slice(0, migration.indexOf("),groups as")).matchAll(/\('([^']+)','([^']+)','([^']+)',(true|false)\)/g)].map(match => `${match[1]}|${match[2]}|${match[3]}|${match[4]}`).sort();
  const tsOptions = WORD_EDITOR_RIBBON.flatMap(tab => tab.groups.flatMap(group => group.options.map(option => `${tab.id}|${group.id}|${option.id}|${!option.unsupported}`))).sort();
  assert.deepEqual(sqlOptions, tsOptions);
  assert.match(migration, /jsonb_build_array\('Calibri \(Body\)','Calibri','Arial','Times New Roman','Mangal'\).*'fontSizeMin',8,'fontSizeMax',72/s);
});

test("historical schema-v1 table-cell snapshots remain valid and strict", async () => {
  const historical = JSON.parse(await read("tests/fixtures/word-editor-historical-v1-table-cell.json"));
  assert.equal(validateWordEditorDocument(historical), historical);
  assert.throws(() => validateWordEditorDocument({ ...historical, extra: true }), /snapshot/i);
  assert.throws(() => validateWordEditorDocument({ ...historical, blocks: [{ ...historical.blocks[0], attrs: {} }] }), /block/i);
  assert.throws(() => validateWordEditorDocument({ ...historical, blocks: [{ ...historical.blocks[0], runs: [{ ...historical.blocks[0].runs[0], href: "https://example.com" }] }] }), /run/i);
});

test("schema-v2 rejects unknown block run and typed-attribute injection", () => {
  const valid = v2(); assert.equal(validateWordEditorDocument(valid), valid);
  assert.throws(() => validateWordEditorDocument({ ...v2(), surprise: true }), /snapshot/i);
  assert.throws(() => validateWordEditorDocument(v2({ blocks: [{ ...v2().blocks[0], surprise: true }] })), /block ID|block/i);
  assert.throws(() => validateWordEditorDocument(v2({ blocks: [{ ...v2().blocks[0], runs: [{ ...run(), onclick: "evil" }] }] })), /run/i);
  assert.throws(() => validateWordEditorDocument(v2({ blocks: [{ ...v2().blocks[0], attrs: { lineNumbers: false, dropCap: false, onclick: "evil" } }] })), /attributes/i);
  assert.throws(() => validateWordEditorDocument(v2({ blocks: [v2().blocks[0], { ...v2().blocks[0] }] })), /duplicate/i);
});

test("page margins accept one uniform value or four independent top/right/bottom/left values", () => {
  const withPadding = padding => v2({ pageLayout: { ...pageLayout, padding } });
  for (const padding of ["20mm", "5mm", "50mm", "12.5mm", "20mm 15mm 20mm 15mm", "5mm 5mm 5mm 5mm"]) assert.equal(validateWordEditorDocument(withPadding(padding)).schemaVersion, "2");
  for (const padding of ["20mm 15mm", "20mm 15mm 20mm", "20mm 15mm 20mm 15mm 20mm", "20px", "20mm 15mm 20mm 15px", "-5mm", "abc"]) assert.throws(() => validateWordEditorDocument(withPadding(padding)), /margins/i);
});

test("hyperlinks reject active and ambiguous protocols", () => {
  for (const href of ["javascript:alert(1)", "data:text/html,bad", "//evil.example/path", "vbscript:bad"]) assert.throws(() => validateWordEditorDocument(v2({ blocks: [{ ...v2().blocks[0], runs: [run({ href })] }] })), /hyperlink/i);
  for (const href of ["https://example.com/path", "http://example.com", "mailto:student@example.com", "#bookmark-safe"]) assert.equal(validateWordEditorDocument(v2({ blocks: [{ ...v2().blocks[0], runs: [run({ href })] }] })).schemaVersion, "2");
});

test("images enforce MIME payload dimensions count and total bounds", () => {
  const image = (id, payload = "aGVsbG8=") => ({ id, type: "image", alignment: "left", runs: [run()], attrs: { src: `data:image/png;base64,${payload}`, alt: "Safe", width: 320, height: 200, localAsset: false } });
  assert.equal(validateWordEditorDocument(v2({ blocks: [image("image-1")] })).schemaVersion, "2");
  assert.throws(() => validateWordEditorDocument(v2({ blocks: [image("image-svg")] }).blocks[0].attrs.src = "data:image/svg+xml;base64,PHN2Zz4="));
  const oversized = "A".repeat(700000); assert.throws(() => validateWordEditorDocument(v2({ blocks: [image("image-big", oversized)] })), /large|size/i);
  assert.throws(() => validateWordEditorDocument(v2({ blocks: [image("image-wide")].map(block => ({ ...block, attrs: { ...block.attrs, width: 7000 } })) })), /metadata/i);
  assert.throws(() => validateWordEditorDocument(v2({ blocks: Array.from({ length: 21 }, (_, index) => image(`image-${index}`)) })), /count/i);
});

test("migration preserves immutable rows and normalizes only at attempt read time", async () => {
  const migration = await read("supabase/migrations/202608240005_word_efficiency_hierarchical_editor_capabilities.sql");
  assert.doesNotMatch(migration, /update\s+public\.word_efficiency_versions/i);
  assert.doesNotMatch(migration, /update\s+public\.word_efficiency_attempts\s+set\s+snapshot/i);
  assert.match(migration, /normalize_word_efficiency_editor_capabilities\(v\.editor_capabilities\)/);
  assert.match(migration, /initial_editor_document/); assert.match(migration, /word_efficiency_initial_editor_document/);
  assert.match(migration, /table-cell/); assert.match(migration, /Unknown schema-v1 document field/);
});

test("migration iterators are unambiguous and function definitions are unique", async () => {
  const migration = await read("supabase/migrations/202608240005_word_efficiency_hierarchical_editor_capabilities.sql");
  assert.doesNotMatch(migration, /jsonb_object_keys\([^\n]+\)\s*[ktgobrcfid]\b/);
  assert.doesNotMatch(migration, /declare[^\n;]*(?:^|;)\s*(?:k|t|g|o|b|r|c|f|id)\s+/m);
  const definitions = [...migration.matchAll(/create or replace function\s+([^\n(]+)\s*\(([^)]*)\)/gi)]
    .map((match) => `${match[1].trim()}(${match[2].replace(/\s+/g, " ").trim()})`);
  assert.equal(new Set(definitions).size, definitions.length);
  assert.match(migration, /foreach field_name in array/);
  assert.match(migration, /as document_keys\(key_name\)where document_keys\.key_name/);
});

test("repair migration has one unambiguous definition for every repaired runtime function", async () => {
  const migration = await read("supabase/migrations/202608240006_repair_editor_capability_runtime_functions.sql");
  const required = [
    "assert_word_efficiency_editor_capabilities", "assert_word_efficiency_document_schema",
    "word_efficiency_document_feature", "assert_word_efficiency_capability_changes",
    "assert_word_efficiency_edited_document", "initialize_word_efficiency_document",
    "autosave_word_efficiency_document", "submit_word_efficiency_document",
  ];
  const definitions = [...migration.matchAll(/create or replace function\s+public\.([^\n(]+)\s*\(([^)]*)\)/gi)]
    .map((match) => `${match[1].trim()}(${match[2].replace(/\s+/g, " ").trim()})`);
  assert.equal(new Set(definitions).size, definitions.length);
  for (const functionName of required) assert.equal(definitions.filter((signature) => signature.startsWith(`${functionName}(`)).length, 1);
  assert.doesNotMatch(migration, /jsonb_(?:object_keys|each|array_elements)\([^\n]+\)\s*[ktgobrcfid](?:\s|$)/);
  assert.doesNotMatch(migration, /declare[^\n;]*(?:^|;)\s*(?:k|t|g|o|b|r|c|f|id)\s+/m);
  assert.doesNotMatch(migration, /\b(?:from|join)\s+jsonb_[^(]+\([^\n]+\)\s+(?:k|t|g|o|b|r|c|f)\b/i);
  assert.doesNotMatch(migration, /\bas\s+[a-z_]+\s*\((?:k|v|key|value)\s*(?:,|\))/i);
  assert.doesNotMatch(migration, /\.(?:key|value)\b/);
  assert.doesNotMatch(migration, /\bwhere\b[^\n]*\bv\b/i);
  assert.match(migration, /assert_word_efficiency_edited_document\(d jsonb,v uuid\)[\s\S]*version_id alias for \$2/);
  assert.doesNotMatch(migration, /update\s+public\.word_efficiency_(?:versions|attempts)\s+set\s+(?:editor_capabilities|snapshot)\b/i);
});

test("capability version flow snapshots exact v2 data and surfaces persistence and autosave errors", async () => {
  const [migration, adminAction, studentAction, editor] = await Promise.all([
    read("supabase/migrations/202608240007_word_efficiency_capability_version_flow.sql"),
    read("app/admin/word-efficiency-tests/actions.ts"),
    read("app/typing/word-efficiency/actions.ts"),
    read("app/typing/word-efficiency/[language]/[testId]/workspace/rich-document-editor.tsx"),
  ]);
  assert.match(migration, /New Word Efficiency versions require schema-v2 editor capabilities/);
  assert.match(migration, /'editor_capabilities',version_record\.editor_capabilities/);
  assert.match(migration, /prepared_capabilities is distinct from stored_capabilities/);
  assert.doesNotMatch(migration, /update\s+public\.word_efficiency_versions/i);
  assert.match(adminAction, /recommendedWordEditorCapabilities\(\)/);
  assert.match(adminAction, /editor capabilities were not persisted exactly/);
  assert.match(studentAction, /process\.env\.NODE_ENV==="development"[\s\S]*error\.message/);
  assert.match(editor, /setStatus\(result\.error\)/);
});

test("submission repair canonicalizes unchanged source styles and exposes development RPC diagnostics", async () => {
  const [migration, action, editor] = await Promise.all([
    read("supabase/migrations/202608240008_repair_word_efficiency_submission_baseline.sql"),
    read("app/typing/word-efficiency/actions.ts"),
    read("app/typing/word-efficiency/[language]/[testId]/workspace/rich-document-editor.tsx"),
  ]);
  assert.match(migration, /'schemaVersion','2'/);
  for (const field of ["marginLeft", "marginRight", "lineHeight", "marginTop", "marginBottom"]) assert.match(migration, new RegExp(`'${field}'`));
  assert.match(migration, /post-deadline submission must match the last valid autosave/);
  assert.match(migration, /final_document_snapshot is null/);
  for (const field of ["message", "code", "details", "hint"]) assert.match(action, new RegExp(`error\\.${field}|candidate\\?\\.${field}`));
  assert.match(action, /Word Efficiency submission RPC failed/);
  assert.match(editor, /if\(!result\.ok\)\{setStatus\(result\.error\)/);
});

test("browser measurement serializer and formatting commands retain autosave transitions", async () => {
  const [editor, measurements, migration] = await Promise.all([
    read("app/typing/word-efficiency/[language]/[testId]/workspace/rich-document-editor.tsx"),
    read("lib/word-editor-measurements.ts"),
    read("supabase/migrations/202608240009_repair_word_efficiency_measurement_canonicalization.sql"),
  ]);
  assert.match(editor, /canonicalizeBlockMeasurements\(enrichBlock\(makeStructuredBlock/);
  assert.match(editor, /const exec=.*changed\(\)/);
  for (const command of ["bold", "italic", "underline"]) assert.match(editor, new RegExp(`${command}:\\(\\)=>exec`));
  assert.match(editor, /setStatus\("Unsaved changes"\)[\s\S]*setStatus\("Saving…"\)[\s\S]*setStatus\("Saved"\)/);
  for (const unit of ["px", "pt", "in", "cm", "mm"]) assert.match(measurements, new RegExp(unit));
  assert.match(migration, /word_efficiency_canonical_measurement/);
  assert.match(migration, /measurement_number\*\.75/);
});

test("database capability diff protects disabled operations and original formatting", async () => {
  const migration = await read("supabase/migrations/202608240005_word_efficiency_hierarchical_editor_capabilities.sql");
  for (const pattern of [/student_id=auth\.uid\(\)/, /assert_word_efficiency_capability_changes/, /Disabled editor command/, /baseline:=coalesce/, /word_efficiency_document_feature/, /bold.*italic.*underline.*strike.*doubleStrike.*superscript.*subscript/s, /fontFamily.*fontSize.*color.*highlight/s, /alignment:left.*alignment:center.*alignment:right.*alignment:justify/s, /list:bullet.*list:decimal.*list:upper-roman/s]) assert.match(migration, pattern);
  assert.match(migration, /perform public\.assert_word_efficiency_capability_changes\(p_document,baseline,caps\)/);
});

test("every reduced content-changing option is server-enforced", async () => {
  const migration = await read("supabase/migrations/202608240005_word_efficiency_hierarchical_editor_capabilities.sql");
  for (const command of ["bold","italic","underline","strikeThrough","subscript","superscript","textEffects","bullets","numbering","multilevelList","decreaseIndent","increaseIndent","sort","alignLeft","alignCenter","alignRight","justify","lineSpacing","shading","borders","coverPage","blankPage","pageBreak","insertTable","insertPicture","onlinePictures","shapes","hyperlink","bookmark","crossReference","header","footer","pageNumber","dropCap","dateTime","symbol","watermark","pageColor","pageBorders","margins","orientation","pageSize","columns","sectionBreak","lineNumbers"]) assert.match(migration, new RegExp(`['\"]${command}['\"]`));
});

test("students always get full editor capabilities and admin no longer configures a per-test checklist", async () => {
  const [actions, workingMatterFields, editor, shared, migration] = await Promise.all([read("app/admin/word-efficiency-tests/actions.ts"), read("app/admin/word-efficiency-tests/working-matter-docx-fields.tsx"), read("app/typing/word-efficiency/[language]/[testId]/workspace/rich-document-editor.tsx"), read("components/word-efficiency/word-editor-ribbon.tsx"), read("supabase/migrations/202608240005_word_efficiency_hierarchical_editor_capabilities.sql")]);
  assert.match(actions, /recommendedWordEditorCapabilities\(\)/);
  assert.doesNotMatch(actions, /validateWordEditorCapabilities/);
  assert.doesNotMatch(workingMatterFields, /EditorCapabilityFields/);
  assert.match(editor, /<WordEditorRibbon/);
  for (const pattern of [/role="tablist"/, /role="tabpanel"/, /aria-label=\{option\.label\}/, /<RibbonIcon/, /WORD_EDITOR_RIBBON/]) assert.match(shared, pattern);
  for (const pattern of [/sticky bottom-0/, /dataset\.operations/, /operations:/]) assert.match(editor, pattern);
  assert.match(migration, /jsonb_build_object\('working_matter',matter,'editor_capabilities',caps,'initial_editor_document',initial_editor/);
});

test("shared compact ribbon matches the reference proportions and responsive contract",async()=>{const[css,shared]=await Promise.all([read("app/globals.css"),read("components/word-efficiency/word-editor-ribbon.tsx")]);assert.match(css,/\.word-ribbon-panel \{ height: 88px/);assert.match(css,/\.word-ribbon-tabs \{[^}]*min-height: 30px/);assert.match(css,/border-right: 1px solid/);assert.match(css,/font-family: "Segoe UI", Calibri, Arial/);assert.match(css,/@media \(max-width: 700px\)/);assert.match(shared,/useState\(currentFontFamily\|\|"Calibri \(Body\)"\)/);assert.match(shared,/useState\("11"\)/);assert.match(shared,/aria-haspopup=\{option\.menu \? "menu"/);assert.doesNotMatch(shared,/option\.icon/)});

test("Paragraph uses the compact two-row reference order without visible long labels",async()=>{const[css,shared]=await Promise.all([read("app/globals.css"),read("components/word-efficiency/word-editor-ribbon.tsx")]);const top=["bullets","numbering","multilevelList","decreaseIndent","increaseIndent","sort","formattingMarks"],bottom=["alignLeft","alignCenter","alignRight","justify","lineSpacing","shading","borders"];assert.match(css,/data-ribbon-group="paragraph"[^\n]*min-width: 212px/);assert.match(css,/grid-template-columns: repeat\(7,28px\)/);for(const[id,index]of top.map((id,index)=>[id,index+1]))assert.match(css,new RegExp(`data-ribbon-option="${id}"\\] \\{ grid-column: ${index}; grid-row: 1`));for(const[id,index]of bottom.map((id,index)=>[id,index+1]))assert.match(css,new RegExp(`data-ribbon-option="${id}"\\] \\{ grid-column: ${index}; grid-row: 2`));assert.match(css,/data-ribbon-group="paragraph"[^\n]*\.word-ribbon-tool > span:not\(\.word-ribbon-color-icon\)/);for(const id of["decreaseIndent","increaseIndent","sort","formattingMarks","shading","borders"])assert.match(shared,new RegExp(`id === "${id}"|\\["decreaseIndent","increaseIndent"\\]\\.includes\\(id\\)`));assert.match(shared,/aria-label=\{option\.label\}/);assert.match(shared,/title=\{option\.label\}/)});

test("Editing uses one compact vertical command column with a group launcher",async()=>{const[css,shared,editor]=await Promise.all([read("app/globals.css"),read("components/word-efficiency/word-editor-ribbon.tsx"),read("app/typing/word-efficiency/[language]/[testId]/workspace/rich-document-editor.tsx")]);assert.match(css,/data-ribbon-group="editing"[^\n]*min-width: 82px/);assert.match(css,/grid-template-columns: 68px; grid-template-rows: repeat\(3,19px\)/);for(const[id,row]of[["find",1],["replace",2],["selectAll",3]]){assert.match(css,new RegExp(`data-ribbon-option="${id}"\\] \\{ grid-column: 1; grid-row: ${row}`));assert.match(shared,new RegExp(`id === "${id}"`))}assert.match(css,/data-ribbon-group="editing"\]::after[^\n]*content: "↗"/);assert.match(shared,/aria-label=\{option\.label\}/);assert.match(shared,/title=\{option\.label\}/);for(const command of["find","replace","selectAll"])assert.match(editor,new RegExp(`${command}:\\(\\)=>`))});

test("Insert matches the reference mix of stacked and large vertical groups",async()=>{const[css,shared]=await Promise.all([read("app/globals.css"),read("components/word-efficiency/word-editor-ribbon.tsx")]);assert.match(css,/data-ribbon-group="pages"[^\n]*min-width: 104px/);assert.match(css,/data-ribbon-group="pages"\][^\n]*\.word-ribbon-options[^\n]*grid-template-columns: 94px; grid-template-rows: repeat\(3,19px\)/);assert.match(css,/data-ribbon-group="links"[^\n]*min-width: 116px/);for(const group of["tables","illustrations","headerFooter","symbols"])assert.match(css,new RegExp(`data-ribbon-group="${group}"`));assert.match(css,/data-ribbon-group="illustrations"\][^\n]*\.word-ribbon-options[^\n]*repeat\(3,46px\)/);assert.match(css,/data-ribbon-group="headerFooter"\][^\n]*\.word-ribbon-options[^\n]*repeat\(3,46px\)/);assert.match(css,/flex-direction: column; justify-content: center/);assert.match(css,/data-ribbon-option="dropCap"\][^\n]*grid-column: 1; grid-row: 1 \/ 4/);assert.match(css,/data-ribbon-option="dateTime"\][^\n]*grid-column: 2; grid-row: 2/);for(const id of["coverPage","blankPage","pageBreak","insertTable","insertPicture","onlinePictures","hyperlink","crossReference","header","footer","pageNumber","dropCap","dateTime","symbol"])assert.match(shared,new RegExp(`id === "${id}"|\\[[^\\]]*"${id}"[^\\]]*\\]\\.includes\\(id\\)`));assert.match(shared,/aria-haspopup=\{option\.menu \? "menu"/);assert.match(shared,/filter\(option => configured\.options\[option\.id\]\)/)});

test("Design uses one compact Page Background group with three large vertical controls",async()=>{const[css,shared,capabilities]=await Promise.all([read("app/globals.css"),read("components/word-efficiency/word-editor-ribbon.tsx"),read("lib/word-editor-capabilities.ts")]);assert.match(css,/data-ribbon-group="pageBackground"[^\n]*min-width: 154px/);assert.match(css,/data-ribbon-group="pageBackground"\][^\n]*\.word-ribbon-options[^\n]*grid-template-columns: repeat\(3,48px\); grid-template-rows: 57px/);assert.match(css,/data-ribbon-group="pageBackground"\][^\n]*\.word-ribbon-tool[^\n]*flex-direction: column; justify-content: center/);assert.match(css,/data-ribbon-option="pageColor"\][^\n]*\.word-ribbon-tool::after[^\n]*content: "▾"/);assert.match(capabilities,/id:"Design",groups:\[\{id:"pageBackground",label:"Page Background",options:\[option\("watermark"[^\n]*option\("pageColor"[^\n]*option\("pageBorders"/);for(const id of["watermark","pageColor","pageBorders"])assert.match(shared,new RegExp(`id === "${id}"`));assert.match(shared,/aria-label=\{option\.label\}/);assert.match(shared,/filter\(option => configured\.options\[option\.id\]\)/)});

test("Page Layout uses four large Page Setup controls and two stacked controls",async()=>{const[css,shared,capabilities]=await Promise.all([read("app/globals.css"),read("components/word-efficiency/word-editor-ribbon.tsx"),read("lib/word-editor-capabilities.ts")]);assert.match(css,/data-ribbon-group="pageSetup"[^\n]*min-width: 318px/);assert.match(css,/data-ribbon-group="pageSetup"\][^\n]*\.word-ribbon-options[^\n]*grid-template-columns: repeat\(4,49px\) 108px; grid-template-rows: repeat\(2,28px\)/);for(const[id,column]of[["margins",1],["orientation",2],["pageSize",3],["columns",4]])assert.match(css,new RegExp(`data-ribbon-option="${id}"\\] \\{ grid-column: ${column}; grid-row: 1 \\/ 3`));assert.match(css,/data-ribbon-option="sectionBreak"\] \{ grid-column: 5; grid-row: 1/);assert.match(css,/data-ribbon-option="lineNumbers"\] \{ grid-column: 5; grid-row: 2/);assert.match(css,/data-ribbon-group="pageSetup"\]::after[^\n]*content: "↗"/);assert.match(capabilities,/id:"Page Layout",groups:\[\{id:"pageSetup",label:"Page Setup",options:\[option\("margins"[^\n]*option\("orientation"[^\n]*option\("pageSize"[^\n]*option\("columns"[^\n]*option\("sectionBreak"[^\n]*option\("lineNumbers"/);for(const id of["margins","orientation","pageSize","columns","sectionBreak","lineNumbers"])assert.match(shared,new RegExp(`id === "${id}"`));assert.match(shared,/aria-haspopup=\{option\.menu \? "menu"/);assert.match(shared,/filter\(option => configured\.options\[option\.id\]\)/)});

test("View matches the reference groups, checkbox grid, and mixed Zoom layout",async()=>{const[css,shared,capabilities,editor]=await Promise.all([read("app/globals.css"),read("components/word-efficiency/word-editor-ribbon.tsx"),read("lib/word-editor-capabilities.ts"),read("app/typing/word-efficiency/[language]/[testId]/workspace/rich-document-editor.tsx")]);assert.match(capabilities,/label:"Document Views"/);assert.match(capabilities,/label:"Show\/Hide"/);assert.match(capabilities,/option\("printLayout","Print Layout"[^\n]*option\("fullScreenReading","Full Screen Reading"/);assert.match(shared,/MESSAGE_BAR_OPTION[^\n]*unsupported: "Message Bar is unavailable/);assert.match(shared,/aria-description=\{option\.unsupported\}/);for(const id of["messageBar","thumbnails","zoom","pageWidth"])assert.match(shared,new RegExp(`id: "${id}"`));assert.match(css,/data-ribbon-group="views"[^\n]*min-width: 246px/);assert.match(css,/data-ribbon-group="views"\][^\n]*\.word-ribbon-options[^\n]*repeat\(5,48px\)/);assert.match(css,/data-ribbon-group="show"\][^\n]*\.word-ribbon-options[^\n]*grid-template-columns: 88px 104px/);assert.match(css,/data-ribbon-option="messageBar"\] \{ grid-column: 1; grid-row: 3/);assert.match(css,/data-ribbon-option="thumbnails"\] \{ grid-column: 2; grid-row: 2/);assert.match(css,/data-ribbon-group="zoom"\][^\n]*\.word-ribbon-options[^\n]*grid-template-columns: 48px 48px 88px/);for(const command of["printLayout","fullScreenReading","webLayout","outlineView","draftView","ruler","gridlines","documentMap","thumbnails","zoom100","onePage","twoPages","pageWidth"])assert.match(editor,new RegExp(`${command}:\\(\\)=>`));assert.match(editor,/zoom:"zoom100",thumbnails:"documentMap",pageWidth:"twoPages"/)});

test("shared ribbon hides disabled tabs groups and options without rendering empty groups",async()=>{const shared=await read("components/word-efficiency/word-editor-ribbon.tsx");assert.match(shared,/filter\(tab => capabilities\.tabs\[tab\.id\]\.enabled\)/);assert.match(shared,/filter\(option => configured\.options\[option\.id\]\)/);assert.match(shared,/group\.options\.length > 0/);assert.match(shared,/disabled=\{preview\}/);assert.doesNotMatch(shared,/<span key=\{item\.id\}/)});

test("autosave restore, watermark autosave, drop cap and line-number restoration, and dated fields are wired",async()=>{
  const[workspace,editor]=await Promise.all([read("app/typing/word-efficiency/[language]/[testId]/workspace/word-workspace.tsx"),read("app/typing/word-efficiency/[language]/[testId]/workspace/rich-document-editor.tsx")]);
  assert.match(workspace,/initialDocument=\{initialDocument\}/);
  assert.match(editor,/lastAutosave\.current=snapshot/);
  assert.match(editor,/applyWatermark=\(text:string\)=>\{setDialog\(null\);editor\.current\?\.setAttribute\("data-watermark",text\.slice\(0,40\)\);changed\(\)\}/);
  assert.match(editor,/applyDropCapMarker/);
  assert.match(editor,/classList\.add\("editor-line-numbers"\)/);
  assert.match(editor,/data-field="date-time"/);
  assert.match(editor,/data-field="symbol"/);
  assert.match(editor,/findNext/);
  assert.doesNotMatch(editor,/dangerouslySetInnerHTML/);
});

test("table row/column edits target the cursor position and delete/spacing handlers remain reachable through existing commands",async()=>{
  const editor=await read("app/typing/word-efficiency/[language]/[testId]/workspace/rich-document-editor.tsx");
  assert.match(editor,/const cell=anchor\?\.closest\("td,th"\)/);
  assert.match(editor,/table\.insertRow\(action==="add-row-above"\?rowIndex:rowIndex\+1\)/);
  assert.match(editor,/deleteTable:\(\)=>tableActionAtCursor\("remove-table"\)/);
  assert.match(editor,/paragraphSpacing:\(\)=>setDialog\(\{kind:"lineSpacingOptions"/);
});

test("Insert Table offers a grid picker with a numeric dialog fallback, and a Table Tools bar exposes row/column/table commands at the cursor",async()=>{
  const editor=await read("app/typing/word-efficiency/[language]/[testId]/workspace/rich-document-editor.tsx");
  assert.match(editor,/function TableSizePicker\(\{onPick,onCustom\}:\{onPick:\(rows:number,cols:number\)=>void;onCustom:\(\)=>void\}\)/);
  assert.match(editor,/function InsertTableCustomForm\(\{onSubmit\}:\{onSubmit:\(rows:number,cols:number,layout\?:string\)=>void\}\)/);
  assert.match(editor,/AutoFit behavior/);
  assert.match(editor,/dialog\.kind==="insertTableCustom"&&<InsertTableCustomForm onSubmit=\{onInsertTable\}\/>/);
  assert.match(editor,/onOpenCustomTable=\{\(\)=>setDialog\(\{kind:"insertTableCustom"\}\)\}/);
  assert.match(editor,/const tableActionAtCursor=\(action:string\)=>/);
  assert.match(editor,/TABLE_TOOL_ACTIONS:\[string,string\]\[\]=\[\["add-row-above","Insert Above"\],\["add-row-below","Insert Below"\],\["add-column-left","Insert Left"\],\["add-column-right","Insert Right"\],\["remove-row","Delete Row"\],\["remove-column","Delete Column"\],\["remove-table","Delete Table"\]\]/);
  assert.match(editor,/insideTable&&!submitted&&<div role="toolbar" aria-label="Table Tools"/);
  assert.match(editor,/TABLE_TOOL_ACTIONS\.map\(\(\[action,label\]\)=><button key=\{action\} type="button" onMouseDown=\{event=>event\.preventDefault\(\)\} onClick=\{\(\)=>tableActionAtCursor\(action\)\}/);
  assert.match(editor,/setInsideTable\(Boolean\(parent\.closest\("table"\)\)\)/);
  assert.match(editor,/else if\(action==="remove-table"\)\{table\.remove\(\);setInsideTable\(false\)\}/);
});

test("change case, list styles, line spacing, shading, and borders drive real Office-style galleries instead of a single click or a prompt",async()=>{
  const[shared,editor]=await Promise.all([read("components/word-efficiency/word-editor-ribbon.tsx"),read("app/typing/word-efficiency/[language]/[testId]/workspace/rich-document-editor.tsx")]);
  assert.match(shared,/function GalleryMenu/);
  for(const label of["Sentence case.","lowercase","UPPERCASE","Capitalize Each Word","tOGGLE cASE"])assert.match(shared,new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));
  assert.match(shared,/CLEAR_LABEL/);
  assert.match(shared,/"Automatic"/);
  assert.match(shared,/No Color/);
  assert.match(shared,/No Fill/);
  assert.match(shared,/onValueCommand\?:\s*\(id:\s*string,\s*value:\s*string\)\s*=>\s*void/);
  assert.match(shared,/currentFontFamily/);
  assert.match(editor,/onValueCommand=\(id:string,value:string\)=>\{/);
  assert.match(editor,/id==="changeCase"/);
  assert.match(editor,/id==="lineSpacing"/);
  assert.match(editor,/id==="borders"/);
  assert.match(editor,/setCurrentFont/);
});

test("margins, watermark, page color, columns, page size, symbol, and table insert/edit drive an in-app dialog instead of window.prompt",async()=>{
  const editor=await read("app/typing/word-efficiency/[language]/[testId]/workspace/rich-document-editor.tsx");
  assert.match(editor,/if\(id==="marginsAction"\)\{if\(value==="custom"\)setDialog\(\{kind:"margins"/);
  assert.match(editor,/watermark:\(\)=>setDialog\(\{kind:"watermark"/);
  assert.match(editor,/pageColor:\(\)=>setDialog\(\{kind:"pageColor"/);
  assert.match(editor,/if\(id==="columnsAction"\)\{if\(value==="custom"\)setDialog\(\{kind:"columns"/);
  assert.match(editor,/if\(id==="pageSizeAction"\)\{if\(value==="custom"\)setDialog\(\{kind:"pageSize"/);
  assert.match(editor,/symbol:\(\)=>setDialog\(\{kind:"symbol"\}\)/);
  assert.match(editor,/insertTable:\(\)=>setDialog\(\{kind:"insertTable"\}\)/);
  assert.match(editor,/tableRowsColumns:\(\)=>openTableEditDialog\(\)/);
  assert.match(editor,/function CommandDialog/);
  assert.match(editor,/function TableSizePicker/);
  assert.match(editor,/function SymbolPicker/);
  assert.doesNotMatch(editor,/promptValue\("Watermark text/);
  assert.doesNotMatch(editor,/promptValue\("Enter a Unicode symbol/);
});

test("zoom opens a real percentage dialog instead of doing nothing, and is tracked as a view-only setting",async()=>{
  const editor=await read("app/typing/word-efficiency/[language]/[testId]/workspace/rich-document-editor.tsx");
  assert.match(editor,/zoom:\(\)=>setDialog\(\{kind:"zoom",value:String\(view\.zoom\)\}\)/);
  assert.match(editor,/dialog\.kind==="zoom"&&<ZoomForm dialog=\{dialog\} onSubmit=\{onZoom\}\/>/);
  assert.match(editor,/function ZoomForm/);
  assert.match(editor,/const applyZoom=\(value:string\)=>\{setDialog\(null\);setView\(v=>\(\{\.\.\.v,zoom:bounded\(value,10,500\)\}\)\)\}/);
  assert.match(editor,/viewOnly=new Set\(\["selectAll","formattingMarks","printLayout","fullScreenReading","webLayout","outlineView","draftView","ruler","gridlines","documentMap","thumbnails","zoom","zoom100","onePage","twoPages","pageWidth","undo","redo"\]\)/);
});

test("sort opens an Ascending/Descending dialog and only reorders the selected paragraphs, not the whole document unconditionally",async()=>{
  const editor=await read("app/typing/word-efficiency/[language]/[testId]/workspace/rich-document-editor.tsx");
  const tools=await read("lib/word-editor-browser-tools.ts");
  assert.match(editor,/if\(id==="sort"\)\{setDialog\(\{kind:"sort",value:"Ascending"\}\);return false\}/);
  assert.match(editor,/dialog\.kind==="sort"&&<ChoiceForm label="Sort" options=\{\["Ascending","Descending"\]\}/);
  assert.match(editor,/const applySort=\(value:string\)=>\{setDialog\(null\);if\(!editor\.current\)return;sortSelectedBlocks\(editor\.current,selectedBlocks\(\),value==="Descending"\?"desc":"asc"\);changed\(\)\}/);
  assert.match(tools,/const targets=selected\.length>1\?selected:all/);
  assert.match(tools,/editor\.replaceChildren\(\.\.\.final\)/);
});

test("bullets, numbering, and multilevel list galleries offer real Word-style format choices that actually persist",async()=>{
  const[shared,css,editor]=await Promise.all([read("components/word-efficiency/word-editor-ribbon.tsx"),read("app/globals.css"),read("app/typing/word-efficiency/[language]/[testId]/workspace/rich-document-editor.tsx")]);
  for(const value of["bullet-disc","bullet-circle","bullet-square","bullet-diamond","bullet-arrow","bullet-check"])assert.match(shared,new RegExp(`value:"${value}"`));
  for(const value of["decimal","decimal-paren","upper-roman","upper-alpha","lower-alpha-paren","lower-alpha","lower-roman"])assert.match(shared,new RegExp(`value:"${value}"`));
  assert.match(shared,/const MULTILEVEL_ITEMS=NUMBER_ITEMS/);
  assert.match(shared,/GALLERY_NOTES/);
  assert.match(shared,/nested outline levels/);
  assert.match(shared,/useLayoutEffect/);
  assert.match(shared,/className="word-gallery-menu"/);
  assert.match(css,/\.word-gallery-menu \{ position: fixed;/);
  for(const selector of[/ul\[data-list-style="bullet-diamond"\]/,/ul\[data-list-style="bullet-arrow"\]/,/ol\[data-list-style="decimal-paren"\] > li::marker/,/ol\[data-list-style="lower-alpha-paren"\] > li::marker/])assert.match(css,selector);
  assert.match(editor,/const applyListStyle=\(kind:"ul"\|"ol",value:string\)=>/);
  assert.match(editor,/if\(id==="bullets"\)\{applyListStyle\("ul",value\);return\}/);
  assert.match(editor,/if\(id==="numbering"\)\{applyListStyle\("ol",value\);return\}/);
  assert.match(editor,/if\(id==="multilevelList"\)\{applyListStyle\("ol",value\);return\}/);
  assert.match(editor,/list\.dataset\.listStyle=value/);
});

test("line spacing gallery exposes extra actions and Find/Replace opens a real dialog instead of window.prompt",async()=>{
  const[shared,editor]=await Promise.all([read("components/word-efficiency/word-editor-ribbon.tsx"),read("app/typing/word-efficiency/[language]/[testId]/workspace/rich-document-editor.tsx")]);
  assert.match(shared,/SPACING_ACTIONS=\[\{id:"options",label:"Line Spacing Options…"\}/);
  assert.match(shared,/actions=\{SPACING_ACTIONS\} onAction=\{id=>onValueCommand\?\.\("lineSpacingAction",id\)\}/);
  assert.match(editor,/kind:"lineSpacingOptions";before:string;after:string/);
  assert.match(editor,/kind:"findReplace";mode:"find"\|"replace"\|"goto";query:string;replacement:string/);
  assert.match(editor,/function LineSpacingOptionsForm/);
  assert.match(editor,/function FindReplaceForm/);
  assert.match(editor,/const find=\(replace:boolean\)=>\{[\s\S]*?setDialog\(\{kind:"findReplace"/);
  assert.match(editor,/const runFindNext=/);
  assert.match(editor,/const runReplaceOne=/);
  assert.match(editor,/const runReplaceAll=/);
  assert.doesNotMatch(editor,/promptValue\("Find text:"/);
  assert.doesNotMatch(editor,/promptValue\("Replace with:"/);
  assert.doesNotMatch(editor,/promptValue\("Space before/);
});

test("ribbon tabs render names, switch definitions, and reject screenshot assets",async()=>{const[shared,css]=await Promise.all([read("components/word-efficiency/word-editor-ribbon.tsx"),read("app/globals.css")]);const source=`${shared}\n${css}`;for(const forbidden of[/studentImages/,/adminImages/,/imageNumber/,/\/images\/80/,/\/images\/111/,/word-ribbon-tab-icon/,/role="tab"[^>]*>[\s\S]{0,120}<img/i])assert.doesNotMatch(source,forbidden);assert.match(shared,/visibleTabs\.map\(tab => <button[\s\S]*\{tab\.id\.toUpperCase\(\)\}/);assert.match(shared,/onClick=\{\(\) => onTabChange\(tab\.id\)\}/);assert.match(shared,/WORD_EDITOR_RIBBON\.find\(tab => tab\.id === selectedTab\)/);assert.deepEqual(WORD_EDITOR_RIBBON.map(tab=>tab.id),["File","Home","Insert","Design","Page Layout","View"]);for(const tab of["Insert","Design","Page Layout","View"])assert.ok(WORD_EDITOR_RIBBON.find(item=>item.id===tab)?.groups.length)});
