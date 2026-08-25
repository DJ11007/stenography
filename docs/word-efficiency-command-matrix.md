# Word Efficiency command matrix

Audit date: 2026-08-25. This matrix describes the implementation before the functional repair. `Covered` means a PostgreSQL or executable unit test exercises behavior; `Contract only` means tests inspect source text; `None` means no meaningful runtime coverage.

| Command ID | Tab / group | Intended Word 2013 behavior | Scope | Structured fields changed | Autosave | Grading | Current implementation status | Runtime test status |
|---|---|---|---|---|---|---|---|---|
| `paste` | Home / Clipboard | Insert clipboard plain text | selection | run text | yes | yes | Partial: safe plain text and selection restore; browser permission dependent | Contract only |
| `cut` | Home / Clipboard | Copy then delete selection | selection | run text | yes | yes | Partial: safe API/fallback | Contract only |
| `copy` | Home / Clipboard | Copy selection without mutation | selection | none | no | no | Functional; safe API/fallback | Contract only |
| `formatPainter` | Home / Clipboard | Copy reviewed character formatting to destination | selection | run marks/font/color | yes | yes | Functional: two-stage capture/apply with preserved ranges (`rich-document-editor.tsx`, `word-editor-dom.ts`) | `word-editor-dom.test.mjs` Format Painter |
| `fontName` | Home / Font | Apply approved font | selection/run | `fontFamily` | yes | yes | Partial: selection works; theme aliases map to physical font | Contract only |
| `fontSize` | Home / Font | Apply exact point size | selection/run | `fontSize` | yes | yes | Functional: exact bounded point-size wrapper (`word-editor-ribbon.tsx`, `word-editor-dom.ts`) | `word-editor-dom.test.mjs` exact point styles |
| `increaseFontSize` | Home / Font | Increase selected text to next allowed point size | selection/run | `fontSize` | yes | yes | Functional: next configured bounded point size | `word-editor-dom.test.mjs` exact point styles plus focused command contract |
| `decreaseFontSize` | Home / Font | Decrease selected text to previous allowed point size | selection/run | `fontSize` | yes | yes | Functional: previous configured bounded point size | `word-editor-dom.test.mjs` exact point styles plus focused command contract |
| `changeCase` | Home / Font | Cycle selected text case | selection/run | text | yes | yes | Functional explicit Range transformation (`word-editor-dom.ts`) | `word-editor-dom.test.mjs` case conversion |
| `clearCharacterFormatting` | Home / Font | Remove selected character formatting only | selection/run | run marks/font/color | yes | yes | Functional explicit Range clearing without paragraph rewrites | `word-editor-dom.test.mjs` clear formatting |
| `bold` | Home / Font | Toggle bold | selection/run | `bold` | yes | yes | Functional through execCommand | Contract only |
| `italic` | Home / Font | Toggle italic | selection/run | `italic` | yes | yes | Functional through execCommand | Contract only |
| `underline` | Home / Font | Apply selected underline style/settings | selection/run | `underline`, `underlineStyle`, `underlineColor`, `underlineThickness`, `underlineWordsOnly` | yes | yes | Functional for a contiguous selection; complex ranges partial | Covered |
| `strikeThrough` | Home / Font | Toggle single strikethrough | selection/run | `strike` | yes | yes | Functional after margin-preservation repair | Covered |
| `textEffects` | Home / Font | Apply double strikethrough in this exam subset | selection/run | `doubleStrike` | yes | yes | Functional after separate double-strike repair | Covered |
| `subscript` | Home / Font | Toggle subscript | selection/run | `subscript` | yes | yes | Functional through execCommand | Contract only |
| `superscript` | Home / Font | Toggle superscript | selection/run | `superscript` | yes | yes | Functional through execCommand | Contract only |
| `highlightColor` | Home / Font | Apply selected highlight color | selection/run | `highlight` | yes | yes | Functional safe palette | Contract only |
| `fontColor` | Home / Font | Apply selected text color | selection/run | `color` | yes | yes | Functional safe palette | Contract only |
| `bullets` | Home / Paragraph | Toggle bullets for all selected paragraphs | paragraph/list | block `type`, `listStyle` | yes | yes | Partial: browser list command; serializer flattens list structure | Contract only |
| `numbering` | Home / Paragraph | Toggle numbering for selected paragraphs | paragraph/list | block `type`, `listStyle` | yes | yes | Partial: browser list command | Contract only |
| `multilevelList` | Home / Paragraph | Apply supported multilevel/upper-Roman list | paragraph/list | block `type`, `listStyle` | yes | yes | Partial: only nearest generated list receives style | Contract only |
| `decreaseIndent` | Home / Paragraph | Decrease indent on every selected paragraph | paragraph | `marginLeft` | yes | yes | Functional selected-block scope; unit-aware and clamped | `word-editor-dom.test.mjs` indent |
| `increaseIndent` | Home / Paragraph | Increase indent on every selected paragraph | paragraph | `marginLeft` | yes | yes | Functional selected-block scope; unit-aware | `word-editor-dom.test.mjs` indent |
| `sort` | Home / Paragraph | Sort selected paragraphs/list items | paragraph/list | block order | yes | yes | Partial: helper operates on selected blocks | Contract only |
| `formattingMarks` | Home / Paragraph | Toggle nonprinting mark display | view-only | none | no | no | Functional view state | Contract only |
| `alignLeft` | Home / Paragraph | Left-align every selected paragraph | paragraph | `alignment` | yes | yes | Functional selected-block scope (`selectedEditorBlocks`) | `word-editor-dom.test.mjs` multi-paragraph formatting |
| `alignCenter` | Home / Paragraph | Center every selected paragraph | paragraph | `alignment` | yes | yes | Functional selected-block scope | `word-editor-dom.test.mjs` multi-paragraph formatting |
| `alignRight` | Home / Paragraph | Right-align every selected paragraph | paragraph | `alignment` | yes | yes | Functional selected-block scope | `word-editor-dom.test.mjs` multi-paragraph formatting |
| `justify` | Home / Paragraph | Justify every selected paragraph | paragraph | `alignment` | yes | yes | Functional selected-block scope | `word-editor-dom.test.mjs` multi-paragraph formatting |
| `lineSpacing` | Home / Paragraph | Set line spacing for every selected paragraph | paragraph | `lineHeight` | yes | yes | Functional selected-block scope | `word-editor-dom.test.mjs` multi-paragraph formatting |
| `paragraphSpacing` | Home / Paragraph dialog | Set before/after spacing | paragraph | `marginTop`, `marginBottom` | yes | yes | Functional selected-block command path; not directly exposed by current ribbon | focused paragraph helper coverage |
| `shading` | Home / Paragraph | Apply paragraph shading | paragraph | `backgroundColor` | yes | yes | Functional selected-block scope with approved CSS color | `word-editor-dom.test.mjs` multi-paragraph formatting |
| `borders` | Home / Paragraph | Apply/remove paragraph border | paragraph | `border` | yes | yes | Functional selected-block scope | `word-editor-dom.test.mjs` multi-paragraph formatting |
| `find` | Home / Editing | Find next matching text without mutation | document/view | none | no | no | Partial: reports presence but does not select next match | Contract only |
| `replace` | Home / Editing | Replace matching text in selected/document scope | document | run text | yes | yes | Functional text-node replacement preserving block elements and measurements | `word-editor-dom.test.mjs` replace |
| `selectAll` | Home / Editing | Select entire editable document | document selection | none | no | no | Functional explicit Range selection; excluded from operation history/autosave | Focused command contract |
| `coverPage` | Insert / Pages | Insert supported editable cover page | block/page | cover-page block and page break | yes | yes | Functional structured block identity/save/restore | `word-editor-structure.test.mjs` identity round-trip |
| `blankPage` | Insert / Pages | Insert blank page break and paragraph | block/page | page-break and paragraph blocks | yes | yes | Functional structured blank-page kind/save/restore | structure and v2 validator tests |
| `pageBreak` | Insert / Pages | Insert page break | block/page | page-break `kind` | yes | yes | Functional structured save/restore | `word-editor-structure.test.mjs` |
| `insertTable` | Insert / Tables | Insert editable table | table | table `rows` | yes | yes | Functional editable 2x2 insertion with structured row/cell round-trip | `word-editor-structure.test.mjs` table round-trip |
| `tableRowsColumns` | Insert / Tables dialog | Add/remove selected row or column | table/cell | table `rows` | yes | yes | Partial and prompt-only; always uses trailing row/column | None |
| `deleteTable` | Insert / Tables dialog | Delete selected table | table | remove table block | yes | yes | Implemented but not exposed by current ribbon | None |
| `insertPicture` | Insert / Illustrations | Insert bounded safe local picture | block | image attrs | yes | yes | Functional bounded metadata and structured restoration | `word-editor-structure.test.mjs` safe images |
| `onlinePictures` | Insert / Illustrations | Insert reviewed safe remote picture | block | image attrs | yes | yes | Partial helper; persisted schema permits data/local asset only | Contract only |
| `shapes` | Insert / Illustrations | Insert supported editable shape | block | shape block attrs/runs | yes | yes | Functional structured block round-trip | `word-editor-structure.test.mjs` identity round-trip |
| `hyperlink` | Insert / Links | Apply safe link to selection | selection/run | `href` | yes | yes | Functional safe-link metadata save/restore | v2 validator plus structured integration test |
| `bookmark` | Insert / Links | Insert named bookmark | selection/run | `bookmark` | yes | yes | Functional metadata save/restore | v2 validator plus structured integration test |
| `crossReference` | Insert / Links | Insert internal bookmark reference | selection/run | `href` | yes | yes | Functional safe internal-reference save/restore | v2 validator plus structured integration test |
| `header` | Insert / Header & Footer | Insert editable document header | block | header block | yes | yes | Functional structured block round-trip | `word-editor-structure.test.mjs` identity round-trip |
| `footer` | Insert / Header & Footer | Insert editable document footer | block | footer block | yes | yes | Functional structured block round-trip | `word-editor-structure.test.mjs` identity round-trip |
| `pageNumber` | Insert / Header & Footer | Insert supported page-number field | selection/run | `field` | yes | yes | Functional field metadata save/restore (static page field rendering) | structured integration and v2 validation |
| `dropCap` | Insert / Text | Apply drop cap to selected/first paragraph character | paragraph/run | `dropCap`, text runs | yes | yes | Broken persistence: serializer checks marker but restoration omits it | Contract only |
| `dateTime` | Insert / Text | Insert current date/time text | selection/run | text / `field` | yes | yes | Partial: inserts text but no field metadata | Contract only |
| `symbol` | Insert / Symbols | Insert selected Unicode symbol | selection/run | text / `field` | yes | yes | Partial: inserts text but no field metadata | Contract only |
| `watermark` | Design / Page Background | Set document watermark | page/document | `pageLayout.watermark` | yes | yes | Partial: direct dataset change does not call autosave | Contract only |
| `pageColor` | Design / Page Background | Set safe page color | page/document | `pageLayout.backgroundColor` | yes | yes | Functional safe value path | Contract only |
| `pageBorders` | Design / Page Background | Set page border | page/document | `pageLayout.border` | yes | yes | Functional fixed style | Contract only |
| `margins` | Page Layout / Page Setup | Set page margins | page/document | `pageLayout.padding` | yes | yes | Partial: one uniform margin only | Contract only |
| `orientation` | Page Layout / Page Setup | Toggle portrait/landscape | page/document | `pageLayout.aspectRatio` | yes | yes | Functional subset | Contract only |
| `pageSize` | Page Layout / Page Setup | Select A4/Letter size | page/document | `pageLayout.maxWidth` | yes | yes | Functional subset | Contract only |
| `columns` | Page Layout / Page Setup | Set one to three columns | page/document | `pageLayout.columnCount` | yes | yes | Functional subset | Contract only |
| `sectionBreak` | Page Layout / Page Setup | Insert supported next-page section break | block/page | section-break `kind` | yes | yes | Functional structured save/restore | `word-editor-structure.test.mjs` break round-trip |
| `lineNumbers` | Page Layout / Page Setup | Toggle paragraph line numbering | paragraph/document | `lineNumbers` | yes | yes | Partial: selected-block state serializes; restoration styling still needs final DOM check | Contract only |
| `printLayout` | View / Document Views | Print layout | view-only | none | no | no | Functional view state | Contract only |
| `fullScreenReading` | View / Document Views | Read-only full-screen view | view-only | none | no | no | Partial: full screen but editor remains content-editable | Contract only |
| `webLayout` | View / Document Views | Web layout | view-only | none | no | no | Functional view state | Contract only |
| `outlineView` | View / Document Views | Outline presentation | view-only | none | no | no | Partial: mode class/state only | Contract only |
| `draftView` | View / Document Views | Draft presentation | view-only | none | no | no | Partial: shadow change only | Contract only |
| `ruler` | View / Show | Toggle ruler | view-only | none | no | no | Functional view state | Contract only |
| `gridlines` | View / Show | Toggle layout gridlines | view-only | none | no | no | Functional view state | Contract only |
| `documentMap` | View / Show | Toggle navigation/document map | view-only | none | no | no | Functional subset | Contract only |
| `thumbnails` | View / Show | Toggle page thumbnails | view-only | none | no | no | Broken: state changes but no thumbnails are rendered | Contract only |
| `zoom` | View / Zoom | Open/set zoom | view-only | none | no | no | Partial: injected control maps directly to 100% | Contract only |
| `zoom100` | View / Zoom | Set 100% zoom | view-only | none | no | no | Functional view state | Contract only |
| `onePage` | View / Zoom | Fit one page | view-only | none | no | no | Partial: fixed 85% rather than measured fit | Contract only |
| `twoPages` | View / Zoom | Fit two pages | view-only | none | no | no | Partial: fixed 60%; does not render two pages | Contract only |
| `pageWidth` | View / Zoom | Fit page width | view-only | none | no | no | Partial: fixed 110% rather than measured fit | Contract only |
| File: submit | File | Submit and permanently lock final document | document/attempt | final snapshot and attempt state | n/a | initiates grading | Functional and database locked | Covered |
| File: restore autosave | File | Restore last valid autosave before submission | document | complete snapshot | yes after subsequent edit | no direct | Partial: browser-session-only reference | Contract only |
| File: print/download | File | Safe exam-authorized output only | document/view | none | no | no | Unsupported and intentionally not shown | None |

## Cross-cutting implementation status

- The persisted JSON model is bounded, but many DOM insertion commands do not round-trip into their declared block/run types.
- Legacy `document.execCommand` remains only for commands still marked Partial; exact point sizing, multi-paragraph paragraph scope, formatting painter, case conversion, clearing, indentation, replacement, and Select All now use explicit Range/block operations.
- View-only and selection-only commands are excluded from saved operation history and do not schedule autosave.
- Database capability comparison covers structured features, timing, ownership, autosave, normal submission, and grace submission. Migration 013 must remain additive and must not rewrite stored history.
- Grading retains secure teacher fallback and immutable publication. Explicit rules are authored independently of question prose with exact target, expected operation/value, allocated marks, and optional partial marks. Migration 014 stores one immutable rule per version/question and locks it after attempt preparation. `evaluateWordGradingRule` compares immutable original/final snapshots and reports unrelated leaf changes; focused tests cover exact, partial, unrelated-change, and no-free-text-inference behavior.
- Student results show “Submitted — evaluation pending” before publication and question-wise marks only after publication; draft grading and private notes remain hidden.
