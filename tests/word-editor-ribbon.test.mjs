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
  assert.deepEqual(groups.View, ["Views", "Show", "Zoom"]);
});

test("reduced ribbon contains exactly the specified option labels",()=>{const actual=Object.fromEntries(WORD_EDITOR_RIBBON.map(tab=>[tab.id,Object.fromEntries(tab.groups.map(group=>[group.label,group.options.map(item=>item.label)]))]));assert.deepEqual(actual,{File:{},Home:{Clipboard:["Paste","Cut","Copy","Format Painter"],Font:["Font family","Font size","Increase font size","Decrease font size","Change case","Bold","Italic","Underline","Strikethrough","Subscript","Superscript","Text effects","Text highlight color","Font color"],Paragraph:["Bullets","Numbering","Multilevel list","Decrease indent","Increase indent","Sort","Show/hide formatting marks","Align left","Center","Align right","Justify","Line spacing","Shading","Borders"],Editing:["Find","Replace","Select"]},Insert:{Pages:["Cover Page","Blank Page","Page Break"],Tables:["Table"],Illustrations:["Pictures","Online Pictures","Shapes"],Links:["Hyperlink","Bookmark","Cross-reference"],"Header & Footer":["Header","Footer","Page Number"],Text:["Drop Cap","Date & Time"],Symbols:["Symbol"]},Design:{"Page Background":["Watermark","Page Color","Page Borders"]},"Page Layout":{"Page Setup":["Margins","Orientation","Size","Columns","Breaks","Line Numbers"]},View:{Views:["Read Mode","Print Layout","Web Layout","Outline","Draft"],Show:["Ruler","Gridlines","Navigation Pane"],Zoom:["100%","One Page","Multiple Pages"]}})});

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
  const migration = await read("supabase/migrations/202608240005_word_efficiency_hierarchical_editor_capabilities.sql");
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
  assert.match(adminAction, /validateWordEditorCapabilities/);
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
  assert.match(editor, /canonicalizeBlockMeasurements\(enrichBlock\(makeBlock/);
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

test("admin and student surfaces retain accessibility and immutable capability snapshots", async () => {
  const [admin, editor, shared, migration] = await Promise.all([read("app/admin/word-efficiency-tests/editor-capability-fields.tsx"), read("app/typing/word-efficiency/[language]/[testId]/workspace/rich-document-editor.tsx"), read("components/word-efficiency/word-editor-ribbon.tsx"), read("supabase/migrations/202608240005_word_efficiency_hierarchical_editor_capabilities.sql")]);
  for (const label of ["Select all supported", "Clear all", "Restore recommended defaults", "Admin-only live ribbon preview", "Allowed fonts"]) assert.match(admin, new RegExp(label));
  assert.match(admin, /<WordEditorRibbon[\s\S]*preview/); assert.match(editor, /<WordEditorRibbon/);
  for (const pattern of [/role="tablist"/, /role="tabpanel"/, /aria-label=\{option\.label\}/, /<RibbonIcon/, /WORD_EDITOR_RIBBON/]) assert.match(shared, pattern);
  for (const pattern of [/sticky bottom-0/, /dataset\.operations/, /operations:/]) assert.match(editor, pattern);
  assert.match(migration, /jsonb_build_object\('working_matter',matter,'editor_capabilities',caps,'initial_editor_document',initial_editor/);
});

test("shared compact ribbon matches the reference proportions and responsive contract",async()=>{const[css,shared]=await Promise.all([read("app/globals.css"),read("components/word-efficiency/word-editor-ribbon.tsx")]);assert.match(css,/\.word-ribbon-panel \{ height: 88px/);assert.match(css,/\.word-ribbon-tabs \{[^}]*min-height: 30px/);assert.match(css,/border-right: 1px solid/);assert.match(css,/font-family: "Segoe UI", Calibri, Arial/);assert.match(css,/@media \(max-width: 700px\)/);assert.match(shared,/defaultValue="Calibri \(Body\)"/);assert.match(shared,/defaultValue="11"/);assert.match(shared,/aria-haspopup=\{option\.menu \? "menu"/);assert.doesNotMatch(shared,/option\.icon/)});

test("shared ribbon hides disabled tabs groups and options without rendering empty groups",async()=>{const shared=await read("components/word-efficiency/word-editor-ribbon.tsx");assert.match(shared,/filter\(tab => capabilities\.tabs\[tab\.id\]\.enabled\)/);assert.match(shared,/filter\(option => capabilities\.tabs\[definition\.id\]\.groups\[group\.id\]\.options\[option\.id\]\)/);assert.match(shared,/group\.options\.length > 0/);assert.match(shared,/disabled=\{preview\}/);assert.doesNotMatch(shared,/<span key=\{item\.id\}/)});

test("ribbon tabs render names, switch definitions, and reject screenshot assets",async()=>{const[shared,css]=await Promise.all([read("components/word-efficiency/word-editor-ribbon.tsx"),read("app/globals.css")]);const source=`${shared}\n${css}`;for(const forbidden of[/studentImages/,/adminImages/,/imageNumber/,/\/images\/80/,/\/images\/111/,/word-ribbon-tab-icon/,/role="tab"[^>]*>[\s\S]{0,120}<img/i])assert.doesNotMatch(source,forbidden);assert.match(shared,/visibleTabs\.map\(tab => <button[\s\S]*\{tab\.id\.toUpperCase\(\)\}/);assert.match(shared,/onClick=\{\(\) => onTabChange\(tab\.id\)\}/);assert.match(shared,/WORD_EDITOR_RIBBON\.find\(tab => tab\.id === selectedTab\)/);assert.deepEqual(WORD_EDITOR_RIBBON.map(tab=>tab.id),["File","Home","Insert","Design","Page Layout","View"]);for(const tab of["Insert","Design","Page Layout","View"])assert.ok(WORD_EDITOR_RIBBON.find(item=>item.id===tab)?.groups.length)});
