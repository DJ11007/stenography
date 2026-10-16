"use client";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ConfirmDialog } from "@/components/efficiency/exam-chrome";
import { selectionFullyUnderlined, stripUnderline } from "@/lib/word-editor-dom";
import { generateRandomParagraphs, parseRandCommand } from "@/lib/word-random-text";
import { WordRuler, WordStatusBar, WordTitleBar, WordVerticalRuler, PX_PER_INCH, type RulerIndent, type RulerMetrics } from "@/components/word-efficiency/word-window-chrome";
import { useRouter } from "next/navigation";
import type { MatterParagraph, WorkingMatterSnapshot } from "@/lib/word-docx";
import { APPROVED_WORD_FONTS, isWordCommandEnabled, normalizeWordEditorCapabilities, WORD_EDITOR_RIBBON, type WordEditorTab } from "@/lib/word-editor-capabilities";
import { SAFE_COLORS, WordEditorRibbon } from "@/components/word-efficiency/word-editor-ribbon";
import { autosaveWordDocument, submitWordDocument } from "../../../actions";
import { insertOnlinePicture, sortSelectedBlocks } from "@/lib/word-editor-browser-tools";
import { applyCellFormat, readCellFormat, type CellFormat } from "@/lib/word-table-format";
import { DEFAULT_PEN, DEFAULT_STYLE_OPTIONS, TABLE_STYLE_OPTION_KEYS, applyBorders, autoFit, columnWidths, cycleTextDirection, deleteCellShift, deleteColumn, deleteRow, distributeColumns, distributeRows, evaluateFormula, insertColumn, insertRow, mergeCells, normalizeTable, paragraphsToTable, penValue, readTableAttrs, renderTableAttrs, rowHeights, selectionRect, setCellBorder, setCellMargins, setColumnWidth, setRowHeight, setShading, setStyleOption, setTableAlign, setTableStyle, setTextDirection, slotOf, sortTableBy, splitCell, splitTable, tableCellMargins, tableGrid, tableToParagraphs, insertCellShift, setTableWidth, tableWidth, setTableIndent, tableIndent, setTableWrap, setCellSpacing, cellSpacing, setRowHeightRule, setRowCanSplit, setCellOptions, cellOptions, setTableAltText, BORDER_WIDTHS, type BorderCommand, type BorderSide, type Pen, type TableStyleOptionKey } from "@/lib/word-table-model";
import { PageLayoutGroups, type PageLayoutAction, type PageLayoutState } from "@/components/word-efficiency/word-page-layout";
import { ViewGroups } from "@/components/word-efficiency/word-view-tab";
import { MARGIN_PRESETS, PAPER_SIZES, PAPER_WIDTH_PX, DEFAULT_PAGE_SETUP, paddingText, paperFromWidth, parsePadding, renderedPadding, type MarginsCm, type PageSetupValues } from "@/lib/word-page-setup";
import { TableDesignGroups, TableLayoutGroups, type TableToolsAction, type TableToolsState } from "@/components/word-efficiency/word-table-tools";
import { canonicalWordMeasurement } from "@/lib/word-editor-measurements";
import { adjustParagraphIndent, changeEditorRangeCase, clearEditorRangeFormatting, clearInnerRunStyles, expandListBlocks, inheritedHighlight, inheritedTextDecoration, parseInches, reattachOrphanedListItems, selectedEditorBlocks, snapshotPaintStyle, wrapEditorRange, type EditorRunStyles } from "@/lib/word-editor-dom";
import { createEditorBlock, editorBlockAttrs, editorBlockType, expandListElements, regroupListElements } from "@/lib/word-editor-structure";
import { buildDocumentText, expandReplacement, findMatches, formatOnlyMatches, matchSatisfiesFormat, rangeForMatch, type FindEngineOptions, type Segment, type TextMatch } from "@/lib/word-find-engine";
import { PageSetupDialog2013, BordersShadingDialog2013, CellOptionsDialog2013, InsertCellsDialog2013, bordersPreset, shadingResultColor, type BorderEdgeKey, type CellOptionsValues, type TableOptionsValues, ConvertTextToTableDialog2013, ConvertToTextDialog2013, DateTimeDialog2013, DeleteCellsDialog2013, DropCapDialog2013, FindReplaceDialog2013, FontDialog2013, FormulaDialog2013, InsertTableDialog2013, PageNumberFormatDialog2013, ParagraphDialog2013, SortDialog2013, SplitCellsDialog2013, SymbolDialog2013, TableOptionsDialog2013, TablePropertiesDialog2013, Word13Chrome, formatFormulaResult, type BordersShadingValues, type PageNumberFormatValues, type SortValues, type TablePropertiesValues } from "@/components/word-efficiency/word-2013-dialogs";
import { nextWordFontSize } from "@/lib/word-font-sizes";
import { DATE_LANGUAGES, FOOTER_STYLES, HEADER_STYLES, PAGE_NUMBER_FORMATS as WORD_PAGE_NUMBER_FORMATS, PAGE_NUMBER_GALLERIES, QUICK_TABLES, SPECIAL_CHARACTERS, SYMBOL_SUBSETS, CUSTOM_HEADER_FOOTER_KEY, dateTimeFormats, formatPageNumber, loadCustomHeaderFooterStyles, pageNumberLabel, recentSymbols, rememberSymbol, symbolsInSubset } from "@/lib/word-insert-gallery";

type ViewState = { zoom:number; ruler:boolean; gridlines:boolean; documentMap:boolean; thumbnails:boolean; formattingMarks:boolean; statusBar:boolean; mode:"print"|"reading"|"web"|"outline"|"draft" };
const ATTEMPT_AUTOSAVE_INTERVAL_MS=20_000;
const DEFAULT_VIEW:ViewState={zoom:100,ruler:true,gridlines:false,documentMap:false,thumbnails:false,formattingMarks:false,statusBar:true,mode:"print"};
const TABLE_TOOL_ACTIONS:[string,string][]=[["add-row-above","Insert Above"],["add-row-below","Insert Below"],["add-column-left","Insert Left"],["add-column-right","Insert Right"],["remove-row","Delete Row"],["remove-column","Delete Column"],["remove-table","Delete Table"]];
const BORDER_SIDE_KEYWORDS=new Set(["all","outside","top","bottom","left","right"]);const BORDER_CSS="1px solid #0e7490";
function applyBorderStyle(html:HTMLElement,kind:string){html.style.borderTop=html.style.borderRight=html.style.borderBottom=html.style.borderLeft=html.style.border="";if(kind==="all"||kind==="outside")html.style.border=BORDER_CSS;else if(kind==="top")html.style.borderTop=BORDER_CSS;else if(kind==="bottom")html.style.borderBottom=BORDER_CSS;else if(kind==="left")html.style.borderLeft=BORDER_CSS;else if(kind==="right")html.style.borderRight=BORDER_CSS;else html.style.border=kind}
type DialogState={kind:"symbol"}|{kind:"dateTime"}|{kind:"tableProperties";values:TablePropertiesValues;tab?:"table"|"row"|"column"|"cell"|"alt";options:TableOptionsValues;cellOptions:CellOptionsValues;borders:BordersShadingValues}|{kind:"splitCells";canMerge:boolean}|{kind:"tableOptions";values:TableOptionsValues}|{kind:"insertCells"}|{kind:"pageSetup";tab:"margins"|"paper"|"layout";values:PageSetupValues;borders:BordersShadingValues}|{kind:"tableSort";columns:number;headerNames:string[]}|{kind:"convertToText"}|{kind:"convertTextToTable";rows:number;texts:string[]}|{kind:"tableFormula";initial:string}|{kind:"deleteCells"}|{kind:"bordersShading";initial:BordersShadingValues;tab?:"borders"|"page"|"shading"}|({kind:"pageNumberFormat"}&PageNumberFormatValues)|{kind:"insertTable"}|{kind:"insertTableCustom"}|{kind:"tableEdit"}|{kind:"margins";top:string;right:string;bottom:string;left:string}|{kind:"watermark";text:string}|{kind:"pageColor";value:string}|{kind:"columns";value:string}|{kind:"pageSize";value:string}|{kind:"lineSpacingOptions";before:string;after:string;specialIndentMode:string;specialIndentAmount:string}|{kind:"findReplace";mode:"find"|"replace"|"goto";query:string;replacement:string;matchCase:boolean;wholeWord:boolean;wildcards:boolean;matchPrefix:boolean;matchSuffix:boolean;ignorePunctuation:boolean;ignoreWhitespace:boolean;formatHighlight:boolean;bookmarks:string[];hadSelection:boolean}|{kind:"zoom";value:string}|{kind:"sort";value:string}|{kind:"pageNumber";position:string;alignment:string;style:string;format:string;startAt:string}|{kind:"headerFooterGallery";which:"header"|"footer";hasExisting:boolean;customStyles:{name:string;preview:string;html:string}[]}|{kind:"dropCapOptions";position:string;fontFamily:string;lines:string;distance:string}|{kind:"font";bold:boolean;italic:boolean;fontFamily:string;fontSize:string;color:string;underlineStyle:string;underlineColor:string;strike:boolean;doubleStrike:boolean;superscript:boolean;subscript:boolean;smallCaps:boolean;allCaps:boolean;hidden:boolean;outline:boolean;emboss:boolean;charScale:string;charSpacing:string;charPosition:string;kerningEnabled:boolean;kerningMin:string}|{kind:"paragraph";alignment:string;marginLeft:string;marginRight:string;specialIndentMode:string;specialIndentAmount:string;spaceBefore:string;spaceAfter:string;lineSpacing:string;hyphens:boolean;lineNumbers:boolean};
// Next.js rotates the id every Server Action is called by at each deploy
// (see node_modules/next/dist/docs/01-app/02-guides/server-actions.md,
// "Deployment considerations"), so a page a student already had open when
// a new version went live is still holding an old, now-unrecognized id --
// this is what "Server Action "<id>" was not found on the server" means.
// It isn't a data problem and nothing was lost; the fix is just a fresh
// page load, which is exactly the "surface the error as a retry path"
// guidance those docs give -- so this is detected and turned into an
// actionable refresh prompt instead of a cryptic hash and a doc link.
function isStaleServerActionError(error:unknown){return error instanceof Error&&/Server Action ".*" was not found on the server/.test(error.message)}
// preview is plain text for display only -- content is the real HTML that
// gets inserted. The gallery preview never renders raw HTML markup at
// all (custom-saved or built-in), so nothing saved into localStorage by
// "Save Selection to Gallery" can be re-executed just by opening the
// gallery again.
const HEADER_FOOTER_STYLES:{name:string;preview:string;content:string}[]=[
 {name:"Blank",preview:"[Type text]",content:"[Type text]"},
 {name:"Blank (Three Columns)",preview:"[Type text]   [Type text]   [Type text]",content:'<span style="display:inline-block;width:33%">[Type text]</span><span style="display:inline-block;width:33%;text-align:center">[Type text]</span><span style="display:inline-block;width:33%;text-align:right">[Type text]</span>'},
 {name:"Alphabet",preview:"[Type the document title] (underlined)",content:'<span style="display:block;border-bottom:2px solid #94a3b8;padding-bottom:4px;font-weight:700">[Type the document title]</span>'},
 {name:"Annual",preview:`[Type the document title] · ${new Date().getFullYear()}`,content:`<span style="display:block;border-bottom:1px solid #cbd5e1;padding-bottom:4px">[Type the document title] &middot; ${new Date().getFullYear()}</span>`},
];
const PAGE_NUMBER_STYLES:{id:string;label:string}[]=[{id:"plain",label:"Plain Number"},{id:"pageX",label:"Page X"},{id:"accentBar",label:"Accent Bar"}];
const PAGE_NUMBER_FORMATS:{id:string;label:string;render:(n:number)=>string}[]=[
 {id:"1",label:"1, 2, 3, …",render:n=>String(n)},
 {id:"a",label:"a, b, c, …",render:n=>toAlpha(n).toLowerCase()},
 {id:"A",label:"A, B, C, …",render:n=>toAlpha(n).toUpperCase()},
 {id:"i",label:"i, ii, iii, …",render:n=>toRoman(n).toLowerCase()},
 {id:"I",label:"I, II, III, …",render:n=>toRoman(n).toUpperCase()},
];
function toAlpha(n:number){let value="",remaining=Math.max(1,Math.round(n));while(remaining>0){remaining--;value=String.fromCharCode(65+(remaining%26))+value;remaining=Math.floor(remaining/26)}return value}
function toRoman(n:number){const table:[number,string][]=[[1000,"M"],[900,"CM"],[500,"D"],[400,"CD"],[100,"C"],[90,"XC"],[50,"L"],[40,"XL"],[10,"X"],[9,"IX"],[5,"V"],[4,"IV"],[1,"I"]];let remaining=Math.max(1,Math.round(n)),value="";for(const[amount,symbol]of table)while(remaining>=amount){value+=symbol;remaining-=amount}return value}
function pageNumberText(style:string,format:string,startAt:string){const number=PAGE_NUMBER_FORMATS.find(item=>item.id===format)?.render(Math.max(1,Number(startAt)||1))??String(Math.max(1,Number(startAt)||1));return style==="pageX"?`Page ${number}`:style==="accentBar"?`— ${number} —`:number}
// (top,right,bottom,left) in mm, matching applyMargins's parameter order --
// the same real Word preset values shown in the Margins gallery screenshot.
// Mirrored has no true facing-page model here, so inside/outside collapse
// to left/right (harmless since this tool has no multi-page spreads).
const MARGIN_PRESET_VALUES:Record<string,[string,string,string,string]>={normal:["25.4","25.4","25.4","25.4"],narrow:["12.7","12.7","12.7","12.7"],moderate:["25.4","19.1","25.4","19.1"],wide:["25.4","50.8","25.4","50.8"],mirrored:["25.4","25.4","25.4","31.8"],office2003:["25.4","31.8","25.4","31.8"]};
// Approximate page-width-only px equivalents (96dpi) of the real Word paper
// sizes -- this tool has no distinct page height (continuous scroll), so
// only width is genuinely applied.
const PAGE_SIZE_WIDTHS:Record<string,number>=PAPER_WIDTH_PX;

// Optional authoring-mode props let this exact editor be reused for admin
// "Model Answer" authoring (see app/admin/word-efficiency-tests/model-answer)
// without touching the default student-attempt behavior at all: every new
// prop defaults to the original hardcoded action/label/confirm/lock, so a
// caller that omits them (every existing student workspace) behaves
// byte-for-byte as before.
export function RichDocumentEditor({attemptId,original,initialDocument,capabilities:rawCapabilities,locked,mode="attempt",autosaveAction,submitAction,submitLabel="Submit Final Document",submitConfirmMessage="Submit your final document? You cannot edit it afterward.",oneTimeSubmit=true,submitPortalId,autoSubmit=false,documentLanguage="English (U.S.)",snapshotRef,randomText,fullHeight=false,paragraphDefaults,onReady,onSaved,questionBar}:{
 // Shown between the ribbon and the page (the exam's current question).
 questionBar?:ReactNode;attemptId:string;original:WorkingMatterSnapshot;initialDocument?:unknown;capabilities:unknown;locked:boolean;mode?:"attempt"|"authoring";autosaveAction?:typeof autosaveWordDocument;submitAction?:typeof submitWordDocument;submitLabel?:string;submitConfirmMessage?:string|null;oneTimeSubmit?:boolean;submitPortalId?:string;autoSubmit?:boolean;documentLanguage?:string;snapshotRef?:{current:(()=>unknown)|null};randomText?:{language:()=>"English"|"Hindi"};fullHeight?:boolean;paragraphDefaults?:{spaceAfter:number;lineHeight:number};onReady?:(snapshot:ReturnType<typeof toSnapshot>)=>void;onSaved?:(snapshot:ReturnType<typeof toSnapshot>)=>void}){
 const router=useRouter();
 // Load the result page in the background while the test is open, so after Submit it opens at once.
 useEffect(()=>{if(oneTimeSubmit&&mode==="attempt")router.prefetch(`/typing/word-efficiency/results/${attemptId}`)},[oneTimeSubmit,mode,attemptId,router]);
 const capabilities=useMemo(()=>normalizeWordEditorCapabilities(rawCapabilities),[rawCapabilities]);
 const visibleTabs=WORD_EDITOR_RIBBON.filter(tab=>capabilities.tabs[tab.id].enabled);
 const editor=useRef<HTMLDivElement>(null),imageInput=useRef<HTMLInputElement>(null),autosaveTimer=useRef<ReturnType<typeof setTimeout>|null>(null),scrollRef=useRef<HTMLDivElement>(null),chromeRef=useRef<()=>void>(()=>{}),chromeScheduled=useRef(false),saveNowRef=useRef<()=>Promise<void>>(async()=>{}),dirtyRef=useRef(false),submittedRef=useRef(locked),lastAutosave=useRef<ReturnType<typeof toSnapshot>|null>(null),savedRange=useRef<Range|null>(null),paintStyle=useRef<EditorRunStyles|null>(null),viewport=useRef<HTMLElement>(null),dialogTableRef=useRef<{table:HTMLTableElement;rowIndex:number;cellIndex:number}|null>(null),runRef=useRef<(id:string)=>void>(()=>{}),marginClick=useRef<{count:number;time:number;y:number}>({count:0,time:0,y:-9999});
 // Captured once, the moment the Find and Replace dialog opens (while the
 // document selection is still live) -- distinct from savedRange, which
 // serves toolbar formatting actions and can be overwritten while the
 // dialog is open. Typing into the dialog's own "Find what"/"Replace with"
 // inputs moves focus (and getSelection()) away from the document, so
 // find/replace must remember the scope up front rather than re-reading
 // getSelection() when Find Next/Replace/Replace All are actually clicked.
 const findScopeRange=useRef<Range|null>(null);
 const[tab,setTab]=useState<WordEditorTab>(visibleTabs.find(item=>item.id==="Home")?.id??visibleTabs[0]?.id??"Home"),[status,setStatus]=useState("Ready"),[submitted,setSubmitted]=useState(locked),[finalSubmitting,setFinalSubmitting]=useState(false),[view,setView]=useState<ViewState>(DEFAULT_VIEW),[message,setMessage]=useState(""),[showOriginal,setShowOriginal]=useState(false),[query,setQuery]=useState(""),[thumbnails,setThumbnails]=useState<{id:string;targetId:string;nodes:HTMLElement[]}[]>([]),[dialog,setDialog]=useState<DialogState|null>(null),[currentFont,setCurrentFont]=useState<string|undefined>(undefined),[insideTable,setInsideTable]=useState(false),[paintMode,setPaintMode]=useState<"off"|"once"|"sticky">("off"),[insideHeaderFooter,setInsideHeaderFooter]=useState<"header"|"footer"|null>(null),[showDocumentText,setShowDocumentText]=useState(true),[headerFooterToolsSelected,setHeaderFooterToolsSelected]=useState(false),[tableToolsTab,setTableToolsTab]=useState<string|null>(null),[tableMode,setTableMode]=useState<"off"|"draw"|"erase"|"paint"|"sample">("off"),[pageRev,setPageRev]=useState(0),[lastShading,setLastShading]=useState<string|null>(null),[lastBorder,setLastBorder]=useState<BorderCommand>("all"),[tablePen,setTablePen]=useState<Pen>(DEFAULT_PEN),[showGridlines,setShowGridlines]=useState(true),[tableRev,setTableRev]=useState(0),[staleDeploy,setStaleDeploy]=useState(false),[ribbonCollapsed,setRibbonCollapsed]=useState(false),[metrics,setMetrics]=useState<RulerMetrics&{marginTop:number;marginBottom:number;height:number}>({pageWidth:794,marginLeft:56,marginRight:56,marginTop:56,marginBottom:56,height:1123}),[indent,setIndent]=useState<RulerIndent>({left:0,first:0,right:0}),[stats,setStats]=useState({words:0,pages:1,page:1});
 // Real Word: entering a header/footer automatically switches the ribbon to
 // Header & Footer Tools > Design; leaving it (Close, or clicking into the
 // body) automatically switches back. Only fires on the true/false edge so
 // a manual switch to a regular tab while still inside the header/footer
 // (allowed, matching real Word) isn't immediately undone by every re-render.
 const wasInsideHeaderFooter=useRef(false);
 useEffect(()=>{
  const nowInside=Boolean(insideHeaderFooter);
  if(nowInside&&!wasInsideHeaderFooter.current)setHeaderFooterToolsSelected(true);
  if(!nowInside&&wasInsideHeaderFooter.current)setHeaderFooterToolsSelected(false);
  wasInsideHeaderFooter.current=nowInside;
 },[insideHeaderFooter]);
 useEffect(()=>{try{const saved=localStorage.getItem(`word-editor-view:${attemptId}`);if(saved)setView({...DEFAULT_VIEW,...JSON.parse(saved)})}catch{}},[attemptId]);
 useEffect(()=>{try{localStorage.setItem(`word-editor-view:${attemptId}`,JSON.stringify(view))}catch{}},[attemptId,view]);
 useEffect(()=>()=>{if(autosaveTimer.current)clearTimeout(autosaveTimer.current)},[]);
 useEffect(()=>{submittedRef.current=submitted},[submitted]);
 // Lets a host (the admin document designer) read the editor's CURRENT document at any moment,
 // e.g. when its form is submitted, instead of waiting for the next autosave.
 useEffect(()=>{if(!snapshotRef)return;snapshotRef.current=()=>editor.current?toSnapshot(editor.current):null;return()=>{snapshotRef.current=null}},[snapshotRef]);
 useEffect(()=>{if(mode==="authoring")return;const flush=()=>{if(dirtyRef.current&&!submittedRef.current)void saveNowRef.current()};const onVisibility=()=>{if(document.visibilityState==="hidden")flush()};document.addEventListener("visibilitychange",onVisibility);window.addEventListener("pagehide",flush);return()=>{document.removeEventListener("visibilitychange",onVisibility);window.removeEventListener("pagehide",flush)}},[mode]);
 const[submitSlot,setSubmitSlot]=useState<HTMLElement|null>(null);
 useEffect(()=>{if(submitPortalId)setSubmitSlot(document.getElementById(submitPortalId))},[submitPortalId]);
 useEffect(()=>{const el=editor.current;if(!el)return;const observer=new ResizeObserver(()=>chromeRef.current());observer.observe(el);chromeRef.current();return()=>observer.disconnect()},[]);
 useEffect(()=>{chromeRef.current()},[view.zoom,view.mode,view.ruler]);
 useEffect(()=>{if(mode==="authoring"&&editor.current)onReady?.(toSnapshot(editor.current))},[]);// eslint-disable-line react-hooks/exhaustive-deps -- captures the pristine as-rendered baseline once, before initialDocument (if any) overwrites the DOM below
 useEffect(()=>{if(initialDocument&&typeof initialDocument==="object"&&Array.isArray((initialDocument as {blocks?:unknown}).blocks)){const snapshot=initialDocument as ReturnType<typeof toSnapshot>;renderStructuredSnapshot(editor.current,snapshot);lastAutosave.current=snapshot}},[initialDocument]);
 // selectionchange fires many times for a single user action -- a ribbon
 // click that runs document.execCommand, a click on text, arrow-key
 // navigation can each produce several events in a row. getComputedStyle
 // below forces the browser to flush layout synchronously, so running the
 // full measurement on every one of those events (instead of once) is
 // exactly the kind of per-click layout thrashing that made ribbon clicks
 // feel slow to react, worse the longer the working document gets.
 // Coalescing to at most one measurement per animation frame keeps a
 // single click down to a single forced layout.
 useEffect(()=>{let scheduled=false;const measure=()=>{scheduled=false;const selection=getSelection();if(selection?.rangeCount&&editor.current?.contains(selection.anchorNode)){savedRange.current=selection.getRangeAt(0).cloneRange();const node=selection.anchorNode,parent=node instanceof Element?node:node?.parentElement;if(parent){const family=approvedFont(getComputedStyle(parent).fontFamily);if(family)setCurrentFont(family);setInsideTable(Boolean(parent.closest("table")));{const nextCell=parent.closest("td,th")as HTMLTableCellElement|null;const focus=selection.focusNode,focusCell=(focus instanceof Element?focus:focus?.parentElement)?.closest("td,th")as HTMLTableCellElement|null??null;if(nextCell!==activeCellRef.current||focusCell!==focusCellRef.current){activeCellRef.current=nextCell;focusCellRef.current=focusCell;setTableRev(value=>value+1)}}{let block:Element|null=parent;while(block&&block.parentElement!==editor.current)block=block.parentElement;if(block){const style=getComputedStyle(block),number=(value:string)=>Number.parseFloat(value)||0;const next={left:number(style.marginLeft),first:number(style.textIndent),right:number(style.marginRight)};setIndent(prev=>prev.left===next.left&&prev.first===next.first&&prev.right===next.right?prev:next)}}const headerFooter=parent.closest("header,footer");setInsideHeaderFooter(headerFooter?headerFooter.tagName.toLowerCase()as"header"|"footer":null)}}};const remember=()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(measure)};document.addEventListener("selectionchange",remember);const cancel=(event:globalThis.KeyboardEvent)=>{if(event.key==="Escape"&&paintStyle.current){paintStyle.current=null;setPaintMode("off");setMessage("Format Painter cancelled.");return}if(!editor.current?.contains(document.activeElement)&&document.activeElement!==editor.current)return;const key=event.key.toLowerCase();if((event.ctrlKey||event.metaKey)&&!event.shiftKey&&!event.altKey&&key==="u"){event.preventDefault();runRef.current("underline");return}if((event.ctrlKey||event.metaKey)&&!event.shiftKey&&key==="z"){event.preventDefault();runRef.current("undo");return}if((event.ctrlKey||event.metaKey)&&(key==="y"||(event.shiftKey&&key==="z"))){event.preventDefault();runRef.current("redo")}};document.addEventListener("keydown",cancel);return()=>{document.removeEventListener("selectionchange",remember);document.removeEventListener("keydown",cancel)}},[]);
 useEffect(()=>{const exactSize=(event:Event)=>{const size=(event as CustomEvent<number>).detail;if(Number.isFinite(size)&&size>=capabilities.fontSizeMin&&size<=capabilities.fontSizeMax)withCellsRef.current(()=>applyRunStyles({fontSize:`${size}pt`}))};window.addEventListener("word-editor-font-size",exactSize);return()=>window.removeEventListener("word-editor-font-size",exactSize)},[capabilities.fontSizeMin,capabilities.fontSizeMax]);
 useEffect(()=>{if(view.thumbnails)buildThumbnails()},[view.thumbnails,status]);
 const allowed=(id:string)=>{const capabilityId=({zoom:"zoom100",thumbnails:"documentMap",pageWidth:"twoPages",formatPainterSticky:"formatPainter"}as Record<string,string>)[id]??id,viewOnly=new Set(["selectAll","formattingMarks","printLayout","fullScreenReading","webLayout","outlineView","draftView","ruler","gridlines","documentMap","thumbnails","zoom","zoom100","onePage","twoPages","pageWidth","undo","redo"]);const clearDependencies=["fontName","fontSize","bold","italic","underline","strikeThrough","subscript","superscript","textEffects","highlightColor","fontColor"],clearFormatting=id==="clearCharacterFormatting",ok=clearFormatting?clearDependencies.every(command=>isWordCommandEnabled(capabilities,command)):isWordCommandEnabled(capabilities,capabilityId);if(ok&&editor.current){if(!clearFormatting&&!viewOnly.has(id)){const used=new Set((editor.current.dataset.operations??"").split(",").filter(Boolean));used.add(capabilityId);editor.current.dataset.operations=[...used].slice(0,256).join(",")}if(id==="selectAll"){const range=document.createRange(),selection=getSelection();range.selectNodeContents(editor.current);selection?.removeAllRanges();selection?.addRange(range);savedRange.current=range;return false}if(id==="formatPainter"||id==="formatPainterSticky"){activateFormatPainter(id==="formatPainterSticky");return false}if(id==="increaseFontSize"){applyFontStep(1);return false}if(id==="decreaseFontSize"){applyFontStep(-1);return false}if(id==="textEffects"){applyDoubleStrike();return false}if(id==="clearCharacterFormatting"||id==="clearSelectionFormatting"){restoreSelection();const selection=getSelection();if(selection?.rangeCount){const range=clearEditorRangeFormatting(selection.getRangeAt(0));if(range){savedRange.current=range;changed()}}return false}if(id==="changeCase"){restoreSelection();const selection=getSelection();if(selection?.rangeCount){const source=selection.getRangeAt(0).toString(),mode=source===source.toLocaleUpperCase()?"lower":source===source.toLocaleLowerCase()?"title":"upper",range=changeEditorRangeCase(selection.getRangeAt(0),mode);if(range){savedRange.current=range;changed()}}return false}if(id==="increaseIndent"||id==="decreaseIndent"){if(adjustParagraphIndent(selectedBlocks(),id==="increaseIndent"?1:-1))changed();return false}if(["alignLeft","alignCenter","alignRight","justify"].includes(id)){const alignment=({alignLeft:"left",alignCenter:"center",alignRight:"right",justify:"justify"}as Record<string,string>)[id],blocks=selectedBlocks();for(const block of blocks)block.style.textAlign=alignment;if(blocks.length)changed();return false}if(id==="shading"){const value=approvedCssColor(promptValue("Paragraph shading color:","#ffff00"));if(value){for(const block of selectedBlocks())block.style.backgroundColor=value;changed()}return false}if(id==="multilevelList"){exec("insertOrderedList");const list=getSelection()?.anchorNode?.parentElement?.closest("ol");if(list)list.style.listStyleType="upper-roman";changed();return false}if(id==="sort"){setDialog({kind:"sort",value:"Ascending"});return false}if(id==="onlinePictures"){void insertOnlinePicture(editor.current,changed,setMessage);return false}}return ok};
 const saveNow=async()=>{if(autosaveTimer.current){clearTimeout(autosaveTimer.current);autosaveTimer.current=null}if(!editor.current||submittedRef.current)return;dirtyRef.current=false;const snapshot=toSnapshot(editor.current);setStatus("Saving…");try{const result=await(autosaveAction??autosaveWordDocument)(attemptId,snapshot);if(!result.ok){setStatus(result.error);return}lastAutosave.current=snapshot;setStatus("Saved")}catch(error){if(isStaleServerActionError(error)){setStaleDeploy(true);setStatus("A newer version of this page was published. Refresh to continue -- your last saved autosave is safe.");return}setStatus(process.env.NODE_ENV==="development"&&error instanceof Error?`Autosave failed: ${error.message}`:"Autosave failed")}};
 saveNowRef.current=saveNow;
 // Student attempts are NOT saved after every edit: each save re-reads the DOM and
 // sets React state, and keeping that out of the typing path leaves the browser's
 // native undo/redo stack alone. A save is scheduled once per quiet window (it is
 // not pushed back by further edits), plus on tab hide / page unload. The Model
 // Answer editor (authoring) keeps its quick debounce.
 // Admin document designer: every ordinary paragraph gets Word's default spacing (space after, line height) unless
 // the author set one, so typed, pasted and generated paragraphs are separated like in Word -- in the editor AND in
 // the saved working document.
 const applyParagraphDefaults=()=>{if(!paragraphDefaults||!editor.current)return;for(const child of Array.from(editor.current.children)){if(child.tagName!=="P")continue;const element=child as HTMLElement;if(!element.style.marginBottom)element.style.marginBottom=`${paragraphDefaults.spaceAfter}pt`;if(!element.style.lineHeight)element.style.lineHeight=String(paragraphDefaults.lineHeight)}};
 const changed=()=>{if(submitted)return;applyParagraphDefaults();if(!chromeScheduled.current){chromeScheduled.current=true;requestAnimationFrame(()=>{chromeScheduled.current=false;chromeRef.current()})}if(mode==="authoring"){setStatus("Unsaved changes");if(autosaveTimer.current)clearTimeout(autosaveTimer.current);autosaveTimer.current=setTimeout(()=>{void saveNowRef.current()},800);return}dirtyRef.current=true;if(!autosaveTimer.current)autosaveTimer.current=setTimeout(()=>{autosaveTimer.current=null;void saveNowRef.current()},ATTEMPT_AUTOSAVE_INTERVAL_MS)};
 // Word-window chrome: ruler margins, page/word counts and the current page are read from
 // the live editor DOM, never invented.
 const syncChrome=()=>{const el=editor.current;if(!el)return;const cs=getComputedStyle(el),px=(value:string)=>Number.parseFloat(value)||0;const pageWidth=el.offsetWidth,height=el.offsetHeight,zoomScale=view.zoom/100;
  const next={pageWidth,marginLeft:px(cs.paddingLeft),marginRight:px(cs.paddingRight),marginTop:px(cs.paddingTop),marginBottom:px(cs.paddingBottom),height};
  setMetrics(prev=>prev.pageWidth===next.pageWidth&&prev.marginLeft===next.marginLeft&&prev.marginRight===next.marginRight&&prev.marginTop===next.marginTop&&prev.marginBottom===next.marginBottom&&prev.height===next.height?prev:next);
  const text=(el.innerText||"").trim(),words=text?text.split(/\s+/).length:0,pageHeight=pageWidth*(Math.abs(pageWidth-816)<6?11/8.5:297/210),pages=Math.max(el.querySelectorAll(":scope > hr").length+1,Math.ceil((height-2)/pageHeight)||1);
  const area=scrollRef.current;let page=1;if(area&&pages>1){const offset=area.getBoundingClientRect().top+area.clientHeight/3-el.getBoundingClientRect().top;page=Math.min(pages,Math.max(1,Math.floor(offset/(pageHeight*zoomScale))+1))}
  setStats(prev=>prev.words===words&&prev.pages===pages&&prev.page===page?prev:{words,pages,page})};
 chromeRef.current=syncChrome;
 const applyRulerIndent=(next:RulerIndent,commit:boolean)=>{const blocks=selectedBlocks();if(!blocks.length)return;for(const block of blocks){block.style.marginLeft=`${next.left/PX_PER_INCH}in`;block.style.marginRight=`${next.right/PX_PER_INCH}in`;if(Math.abs(next.first)<0.5){delete block.dataset.specialIndentMode;delete block.dataset.specialIndentAmount;block.style.textIndent=""}else{const amount=`${Math.abs(next.first)/PX_PER_INCH}in`;block.dataset.specialIndentMode=next.first>0?"firstLine":"hanging";block.dataset.specialIndentAmount=amount;block.style.textIndent=next.first>0?amount:`-${amount}`}}setIndent(next);if(commit)changed()};
 const restoreSelection=()=>{if(savedRange.current){const selection=getSelection();selection?.removeAllRanges();selection?.addRange(savedRange.current)}};
 const buildThumbnails=()=>{if(!editor.current)return;const children=[...editor.current.children]as HTMLElement[];const groups:HTMLElement[][]=[[]];for(const child of children){if(child.tagName==="HR")groups.push([]);groups[groups.length-1].push(child)}setThumbnails(groups.filter(group=>group.length).map((group,index)=>({id:`thumb-${index}`,targetId:group[0].id,nodes:group.map(element=>element.cloneNode(true)as HTMLElement)})))};
 const measuredFit=(mode:"width"|"height"|"twoPage")=>{const container=scrollRef.current??viewport.current,pageWidthPx=794;if(!container)return 100;if(mode==="width")return bounded(String(Math.round((container.clientWidth-32)/pageWidthPx*100)),25,200);if(mode==="twoPage")return bounded(String(Math.round((container.clientWidth-48)/(pageWidthPx*2)*100)),15,150);const pageHeightPx=editor.current?.scrollHeight||1123;return bounded(String(Math.round((container.clientHeight-32)/pageHeightPx*100)),15,150)};
 // document.execCommand's DOM-mutation algorithm has a long-standing
 // Chromium quirk: applying an inline style command (bold/italic/
 // underline/etc.) to a selection that spans a WHOLE block element --
 // exactly what selectByMargin's margin-click paragraph selection
 // produces -- can split that block into two, leaving one of the two
 // genuinely empty. Caught live TWICE now, two different ways: first, a
 // brand-new empty <p> inserted as an extra sibling (fixed by comparing
 // element references against a before-snapshot); then, reported again
 // on Underline specifically -- this time execCommand reused the
 // ORIGINAL <p>'s own element (same id, same reference) as the empty
 // half and put all the real text in a newly created clone right after
 // it, which a same-reference check waves through as "that one was
 // already here, not new" even though its content just vanished. Either
 // direction shifts every later paragraph's array position by one in
 // THIS document only -- fatal for position-based grading (see
 // word-document-diff.ts's diffBlock), which addresses paragraphs by
 // index and assumes the student's and the model answer's block arrays
 // line up one-to-one. Rather than trying to track which specific
 // element execCommand decided to keep -- an implementation detail this
 // has already been wrong about once -- key off the one signal that's
 // reliable either way: the number of top-level blocks. If it grew, a
 // split happened, and any block that's now completely empty (text,
 // image, table, rule) is the side effect, whichever element it
 // happens to be, existing reference or brand new; remove exactly as
 // many as the count grew by, so a document that legitimately already
 // had an empty paragraph elsewhere is left alone. undo/redo are
 // exempted since swapping in/out many blocks -- including ones that
 // are legitimately, intentionally empty -- is their whole job.
 const pruneStrayEmptyBlocks=(beforeCount:number)=>{
  if(!editor.current)return;
  let excess=editor.current.children.length-beforeCount;
  if(excess<=0)return;
  const isPrunable=(child:Element)=>{
   if(child.tagName==="HR"||child.tagName==="TABLE"||child.tagName==="FIGURE")return false;
   if(child.querySelector("img,table,hr"))return false;
   return(child.textContent??"").replace(/​/g,"").trim()===""
  };
  for(const child of[...editor.current.children]){
   if(excess<=0)break;
   if(!isPrunable(child))continue;
   child.remove();
   excess--;
  }
 };
 // Real reported bug: selecting a whole bullet/numbered line the normal
 // way (triple-click) and clicking Underline -- the same whole-block-
 // selection case pruneStrayEmptyBlocks exists for -- has a second,
 // worse Chromium execCommand failure mode, confirmed live: it unwraps
 // the ENTIRE <ul>/<ol>, turning every sibling <li> into a direct child
 // of the editor root instead of staying nested, and replaces the
 // actually-selected <li> with a bare formatting <span> that has no
 // list-item-ness at all ("jkl(*"-style silent corruption, but for list
 // structure instead of text). pruneStrayEmptyBlocks can't catch this --
 // none of the newly-orphaned top-level children are empty, they're the
 // list's own real content, so its emptiness check waves them through.
 // Left alone, the list silently stops being one block in the saved
 // document; it becomes several, which is exactly the position-based-
 // grading hazard pruneStrayEmptyBlocks's own comment above describes.
 // reattachOrphanedListItems (lib/word-editor-dom.ts) repairs it.
 const exec=(name:string,value?:string)=>{editor.current?.focus();restoreSelection();const safeValue=name==="fontName"?value?.replace(/ \((?:Headings|Body)\)$/u,""):value;const beforeCount=name==="undo"||name==="redo"||!editor.current?null:editor.current.children.length;document.execCommand(name,false,safeValue);if(beforeCount!==null){pruneStrayEmptyBlocks(beforeCount);if(editor.current)reattachOrphanedListItems(editor.current)}changed()};
 const selectedBlocks=()=>{restoreSelection();const selection=getSelection();if(!editor.current||!selection?.rangeCount)return[];const range=selection.getRangeAt(0);return expandListBlocks(selectedEditorBlocks(editor.current,range),range)};
 // Real reported bug (most students lost Q8 "font size 18.5" this way): the
 // ribbon's size box wrapped the selection in an outer span, but every Working
 // Matter run carries its own inline font-size, which won -- the text stayed
 // 12pt. The properties being set are cleared inside the new span, as the
 // Font dialog does.
 const applyRunStyles=(styles:EditorRunStyles)=>{editor.current?.focus();restoreSelection();const selection=getSelection();if(!selection?.rangeCount)return;const wrapped=wrapEditorRange(selection.getRangeAt(0),styles);if(wrapped){for(const span of wrapped.spans)clearInnerRunStyles(span,Object.keys(styles).filter(key=>styles[key as keyof EditorRunStyles]!=null));savedRange.current=wrapped.range;changed()}};
 // Grow/Shrink start from the size of the first selected character (as Word does), not the
 // paragraph a whole-paragraph selection is anchored on.
 const applyFontStep=(direction:1|-1)=>{restoreSelection();const selection=getSelection(),node=selection?.rangeCount?firstSelectedText(selection.getRangeAt(0))??selection.anchorNode:null,parent=node instanceof Element?node:node?.parentElement,current=Number.parseFloat(parent?getComputedStyle(parent).fontSize:"11")*.75,size=nextWordFontSize(current,direction,capabilities.fontSizeMin,capabilities.fontSizeMax);if(size)applyRunStyles({fontSize:`${size}pt`})};
 // Real Word: a single click on Format Painter copies the current selection's
 // formatting and applies it exactly once to the next click/selection, then
 // turns itself off. A double click keeps it active indefinitely -- apply as
 // many times as needed -- until Format Painter is clicked again (either
 // variant) to turn it off. Clicking either button while already active
 // always turns it off, matching Word's own toggle behavior.
 const activateFormatPainter=(sticky:boolean)=>{
  if(paintMode!=="off"){paintStyle.current=null;setPaintMode("off");setMessage("Format Painter turned off.");return}
  restoreSelection();
  const selection=getSelection(),node=selection?.anchorNode,parent=node instanceof Element?node:node?.parentElement;
  if(!selection?.rangeCount||!parent||selection.isCollapsed){setMessage("Select formatted text first, then choose Format Painter.");return}
  paintStyle.current=snapshotPaintStyle(getComputedStyle(parent));
  setPaintMode(sticky?"sticky":"once");
  setMessage(sticky?"Format Painter active. Click or select text as many times as you like, then choose Format Painter again to stop.":"Format Painter active. Click or select text once to apply the copied formatting.");
 };
 // Real Word: clicking (no drag) with the paint cursor applies the copied
 // formatting to the whole word under the cursor; dragging a selection
 // applies it to exactly that range.
 useEffect(()=>{
  if(paintMode==="off"||!editor.current)return;
  const target=editor.current;
  const onMouseUp=()=>{
   if(!paintStyle.current)return;
   const selection=getSelection();
   if(!selection?.rangeCount||!target.contains(selection.anchorNode))return;
   let range=selection.getRangeAt(0);
   if(range.collapsed){
    try{selection.modify("move","backward","word");selection.modify("extend","forward","word");range=selection.getRangeAt(0)}catch{return}
    if(range.collapsed)return;
   }
   const wrapped=wrapEditorRange(range,paintStyle.current);
   if(wrapped){savedRange.current=wrapped.range;changed()}
   if(paintMode==="once"){paintStyle.current=null;setPaintMode("off");setMessage("Formatting applied.")}
   else setMessage("Formatting applied. Format Painter is still active.");
  };
  target.addEventListener("mouseup",onMouseUp);
  return()=>target.removeEventListener("mouseup",onMouseUp);
 },[paintMode]);
 // The "selection bar": clicking in the page's left margin selects a whole
 // line (single click), paragraph (double), or document (triple) -- the
 // Word-specific counterpart to double/triple-clicking directly on text
 // (which already selects a word/paragraph via native browser behavior, no
 // code needed for that half). Click counting is our own (time + rough Y
 // proximity) rather than the native dblclick/detail mechanism, since a
 // tall paragraph's margin spans many pixels and a real double-click there
 // should still count even if the two clicks land a little apart vertically.
 const handleEditorMouseDown=(event:MouseEvent<HTMLDivElement>)=>{
  if(submitted||!editor.current)return;
  const rect=editor.current.getBoundingClientRect();
  const paddingLeft=Number.parseFloat(getComputedStyle(editor.current).paddingLeft)||0;
  if(event.clientX<rect.left||event.clientX-rect.left>=paddingLeft)return;
  event.preventDefault();
  const now=Date.now(),state=marginClick.current,sameSpot=Math.abs(event.clientY-state.y)<40;
  state.count=sameSpot&&now-state.time<500?state.count+1:1;
  state.time=now;state.y=event.clientY;
  selectByMargin(((state.count-1)%3)+1,event.clientY,rect,paddingLeft);
 };
 const selectByMargin=(count:number,clientY:number,rect:DOMRect,paddingLeft:number)=>{
  if(!editor.current)return;
  editor.current.focus();
  const selection=getSelection();
  if(!selection)return;
  if(count>=3){
   const range=document.createRange();range.selectNodeContents(editor.current);
   selection.removeAllRanges();selection.addRange(range);savedRange.current=range;
   setMessage("Whole document selected.");
   return;
  }
  const probeX=rect.left+paddingLeft+2;
  const withCaretApi=document as Document&{caretPositionFromPoint?:(x:number,y:number)=>{offsetNode:Node;offset:number}|null;caretRangeFromPoint?:(x:number,y:number)=>Range|null};
  let node:Node|null=null,offset=0;
  const position=withCaretApi.caretPositionFromPoint?.(probeX,clientY);
  if(position){node=position.offsetNode;offset=position.offset}
  else{const legacy=withCaretApi.caretRangeFromPoint?.(probeX,clientY);if(legacy){node=legacy.startContainer;offset=legacy.startOffset}}
  if(!node||!editor.current.contains(node))return;
  const collapsed=document.createRange();collapsed.setStart(node,offset);collapsed.setEnd(node,offset);
  selection.removeAllRanges();selection.addRange(collapsed);
  if(count===1){
   try{selection.modify("move","backward","lineboundary");selection.modify("extend","forward","lineboundary")}catch{}
   setMessage("Line selected.");
  }else{
   const anchor=node instanceof Element?node:node.parentElement;
   const block=anchor?[...editor.current.children].find(child=>child.contains(anchor))as HTMLElement|undefined:undefined;
   if(block){const range=document.createRange();range.selectNodeContents(block);selection.removeAllRanges();selection.addRange(range)}
   setMessage("Paragraph selected.");
  }
  if(selection.rangeCount)savedRange.current=selection.getRangeAt(0);
 };
 // The U button is a real toggle (like Word): if every character of the selection is already
 // underlined, clicking it removes the underline; otherwise it applies the chosen style.
 // Real reported bug, caught live via a real graded attempt: applying an
 // underline style to a triple-click-selected WHOLE paragraph right before
 // a list produced a range whose end boundary sat at the very START of the
 // next block (the list's first item), not the end of the clicked
 // paragraph -- a real, live-reproduced browser selection quirk, not
 // specific to this test's content. This function's own hand-rolled
 // surroundContents()/extractContents() span-wrapping had no protection
 // against that: it fully swallowed the next block (leaving a duplicate,
 // emptied clone of it) INSIDE the new underline span -- invisible on
 // screen, but fatal for the model-answer auto-grading this editor also
 // has to support, since a grading rule's target path is an absolute block
 // index and this shifts every later paragraph's identity. An earlier
 // attempt at this fix added a pruneStrayEmptyBlocks repair here, but that
 // only catches an EXTRA top-level sibling -- this exact failure mode
 // nests the duplicate INSIDE the wrapper span instead, so the top-level
 // block count never changes and nothing was left to prune. Now delegates
 // to wrapEditorRange (the same helper Bold/Italic-via-color/Format
 // Painter already share), which clamps the range to the block it started
 // in before ever calling surroundContents/extractContents -- fixing the
 // vulnerability at its one shared source instead of patching each caller.
 const underline=(action:string,value?:string)=>{editor.current?.focus();restoreSelection();const selection=getSelection();if(!selection?.rangeCount||selection.isCollapsed)return;if(action==="toggle"){const toggleRange=selection.getRangeAt(0);if(editor.current&&selectionFullyUnderlined(editor.current,toggleRange)){if(stripUnderline(editor.current,toggleRange)){const kept=getSelection();if(kept)savedRange.current=toggleRange.cloneRange();changed();return}}return underline(value&&value!=="none"?value:"single")}const range=selection.getRangeAt(0),anchor=selection.anchorNode instanceof Element?selection.anchorNode:selection.anchorNode?.parentElement,current=anchor?.closest("[data-underline-style]")as HTMLElement|null;
 // Every underlined piece the selection touches (the selection often starts just before the
 // underline span, in its <b>/<i> wrapper, where closest() finds nothing).
 const underlined=current?[current]:editor.current?[...editor.current.querySelectorAll<HTMLElement>("[data-underline-style]")].filter(item=>range.intersectsNode(item)):[];if(action==="none"){document.execCommand("underline",false);if(current){delete current.dataset.underlineStyle;delete current.dataset.underlineColor;delete current.dataset.underlineThickness;delete current.dataset.underlineWordsOnly;current.style.textDecoration="none"}changed();return}if(action==="color"&&value&&/^#[0-9a-f]{6}$/i.test(value)){for(const item of underlined){item.dataset.underlineColor=value;item.style.textDecorationColor=value}if(underlined.length)changed();return}if(action==="thickness"&&value&&/^[1-5]$/.test(value)){for(const item of underlined){item.dataset.underlineThickness=value;item.style.textDecorationThickness=`${value}px`}if(underlined.length)changed();return}// "words-only" with a value is the Words only checkbox (changes existing underlines); without one it is
 // the Words only underline STYLE, which must create the underline like any other style.
 if(action==="words-only"&&value!==undefined){for(const item of underlined){item.dataset.underlineWordsOnly=value==="true"?"true":"false";if(value==="true")item.dataset.underlineStyle="words-only"}if(underlined.length)changed();return}const wrapped=wrapEditorRange(range,{textDecorationLine:"underline",textDecorationStyle:underlineCssStyle(action),textDecorationThickness:action==="thick"?"3px":"auto"},{underlineStyle:action,underlineWordsOnly:String(action==="words-only"),underlineThickness:action==="thick"?"3":""});if(wrapped){savedRange.current=wrapped.range;changed()}};
 // Same surroundContents()/extractContents() block-swallowing vulnerability
 // as underline() above, just never migrated to wrapEditorRange when that
 // fix landed. Delegated now so this caller gets the same clamp-to-block
 // protection instead of carrying its own copy of the fixed bug.
 const applyDoubleStrike=()=>{editor.current?.focus();restoreSelection();const selection=getSelection();if(!selection?.rangeCount||selection.isCollapsed)return;const range=selection.getRangeAt(0),wrapped=wrapEditorRange(range,{textDecorationLine:"line-through",textDecorationStyle:"double"},{doubleStrike:"true"});if(wrapped){savedRange.current=wrapped.range;changed()}};
 const insertSafe=(html:string)=>exec("insertHTML",html);
 // A symbol, date or page number is its own field: the browser would put the
 // next insert (or typing) inside a field the cursor touches, so step out of it
 // before and after inserting one.
 const caretOutOfField=()=>{const selection=getSelection();if(!selection?.rangeCount||!editor.current)return;const range=selection.getRangeAt(0);const node=range.startContainer;const field=(node.nodeType===1?node as Element:node.parentElement)?.closest("[data-field]");if(!field||!editor.current.contains(field))return;const after=document.createRange();after.setStartAfter(field);after.collapse(true);selection.removeAllRanges();selection.addRange(after);savedRange.current=after};
 const insertField=(html:string)=>{editor.current?.focus();restoreSelection();caretOutOfField();exec("insertHTML",html);caretOutOfField()};
 // Admin document designer only: typing =rand() or =rand(6,3) in an otherwise empty paragraph and pressing Enter
 // replaces that paragraph with generated paragraphs (default 5 of 4 lines; =rand(paragraphs,lines)).
 const handleRandKey=(event:KeyboardEvent<HTMLDivElement>)=>{
  if(!randomText||event.key!=="Enter"||event.shiftKey||submitted||!editor.current)return;
  const selection=getSelection();if(!selection?.rangeCount||!selection.isCollapsed)return;
  let block:Node|null=selection.anchorNode;while(block&&block.parentNode!==editor.current)block=block.parentNode;
  // Usually the paragraph holding the caret; if the text was typed straight into the page (no paragraph yet), that bare text.
  if(!(block instanceof Text)&&!(block instanceof HTMLElement&&/^(P|DIV)$/.test(block.tagName)))return;
  const command=parseRandCommand(block.textContent??"");if(!command)return;
  event.preventDefault();
  const html=generateRandomParagraphs(command.paragraphs,command.lines,randomText.language()).map(text=>`<p>${escapeHtml(text)}</p>`).join("");
  const range=document.createRange();range.selectNode(block);selection.removeAllRanges();selection.addRange(range);savedRange.current=range;
  exec("insertHTML",html);
 };
 const promptValue=(label:string,initial="")=>window.prompt(label,initial)?.trim()??"";
 const clipboard=async(action:"copy"|"cut"|"paste")=>{const range=savedRange.current?.cloneRange();if(action==="paste"){try{const text=await navigator.clipboard.readText();if(range)savedRange.current=range;editor.current?.focus();restoreSelection();document.execCommand("insertText",false,text);setMessage("Pasted plain text.");changed()}catch(error){setMessage(error instanceof DOMException&&error.name==="NotAllowedError"?"Use Ctrl+V to paste text from your clipboard.":"Paste failed.")}return}if(!range||range.collapsed){setMessage(`Nothing selected to ${action}.`);return}const text=range.toString();try{if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(text);else{restoreSelection();if(!document.execCommand(action,false))throw new Error("Clipboard fallback failed");setMessage(action==="cut"?"Cut to clipboard.":"Copied to clipboard.");if(action==="cut")changed();return}savedRange.current=range;restoreSelection();if(action==="cut"){range.deleteContents();changed()}setMessage(action==="cut"?"Cut to clipboard.":"Copied to clipboard.")}catch{savedRange.current=range;restoreSelection();if(document.execCommand(action,false)){setMessage(action==="cut"?"Cut to clipboard.":"Copied to clipboard.");if(action==="cut")changed()}else setMessage(`${action==="cut"?"Cut":"Copy"} failed.`)}};
 const run=(id:string)=>{if(submitted||!allowed(id))return;const map:Record<string,()=>void>={undo:()=>exec("undo"),redo:()=>exec("redo"),cut:()=>{void clipboard("cut")},copy:()=>{void clipboard("copy")},paste:()=>{void clipboard("paste")},increaseFontSize:()=>exec("increaseFontSize"),decreaseFontSize:()=>exec("decreaseFontSize"),bold:()=>exec("bold"),italic:()=>exec("italic"),underline:()=>underline("toggle","single"),strikeThrough:()=>exec("strikeThrough"),doubleStrikeThrough:()=>insertSafe("<span style=\"text-decoration-line:line-through;text-decoration-style:double\">"+escapeHtml(getSelection()?.toString()||"")+"</span>"),superscript:()=>exec("superscript"),subscript:()=>exec("subscript"),changeCase:()=>replaceSelection(changeCase(getSelection()?.toString()??"")),clearCharacterFormatting:()=>exec("removeFormat"),bullets:()=>exec("insertUnorderedList"),numbering:()=>exec("insertOrderedList"),romanNumbering:()=>{exec("insertOrderedList");const list=getSelection()?.anchorNode?.parentElement?.closest("ol");if(list)list.style.listStyleType="upper-roman";changed()},decreaseIndent:()=>exec("outdent"),increaseIndent:()=>exec("indent"),alignLeft:()=>exec("justifyLeft"),alignCenter:()=>exec("justifyCenter"),alignRight:()=>exec("justifyRight"),justify:()=>exec("justifyFull"),selectAll:()=>exec("selectAll"),clearParagraphFormatting:()=>{exec("formatBlock","p");exec("justifyLeft")},pageBreak:()=>insertSafe('<hr data-block-type="page-break" class="my-8 border-t-2 border-dashed border-cyan-500">'),blankPage:()=>insertSafe('<hr data-block-type="page-break"><p><br></p>'),coverPage:()=>insertSafe('<section data-block-type="cover-page"><h1>Document title</h1><p>Subtitle</p></section><hr data-block-type="page-break">'),insertTable:()=>setDialog({kind:"insertTable"}),tableRowsColumns:()=>openTableEditDialog(),deleteTable:()=>tableActionAtCursor("remove-table"),insertPicture:()=>imageInput.current?.click(),localClipArt:()=>insertSafe('<figure data-block-type="image" data-local-asset="samradhi-mark"><div role="img" aria-label="Samradhi Classes study emblem" class="rounded-xl border-2 border-cyan-700 p-5 text-center font-bold text-cyan-900">SC · Learn · Practise · Succeed</div><figcaption>Samradhi Classes</figcaption></figure>'),shapes:()=>insertSafe('<span data-block-type="shape" class="inline-block rounded-full border-4 border-cyan-700 px-8 py-4">Shape</span>'),textBox:()=>insertSafe('<aside data-block-type="text-box" class="my-3 border-2 border-cyan-700 p-4">Text box</aside>'),hyperlink:()=>safeLink(),bookmark:()=>{const name=safeId(promptValue("Bookmark name:"));if(name)insertSafe(`<span id="bookmark-${name}" data-bookmark="${name}">🔖</span>`)},crossReference:()=>{const name=safeId(promptValue("Bookmark to reference:"));if(name)insertSafe(`<a href="#bookmark-${name}">See ${escapeHtml(name)}</a>`)},header:()=>setDialog({kind:"headerFooterGallery",which:"header",hasExisting:Boolean(editor.current?.querySelector("header")),customStyles:loadCustomHeaderFooterStyles("header")}),footer:()=>setDialog({kind:"headerFooterGallery",which:"footer",hasExisting:Boolean(editor.current?.querySelector("footer")),customStyles:loadCustomHeaderFooterStyles("footer")}),pageNumber:()=>setDialog({kind:"pageNumber",position:insideHeaderFooter==="header"?"top":"bottom",alignment:"center",style:"plain",format:"1",startAt:"1"}),dateTime:()=>setDialog({kind:"dateTime"}),horizontalLine:()=>insertSafe('<hr data-block-type="horizontal-rule">'),symbol:()=>setDialog({kind:"symbol"}),specialCharacters:()=>setDialog({kind:"symbol"}),sectionBreak:()=>insertSafe('<hr data-block-type="section-break" class="my-8 border-double">'),lineNumbers:()=>toggleEditorClass("editor-line-numbers"),hyphenation:()=>toggleStyle("hyphens","auto"),wordCount:()=>counts(),characterCount:()=>counts(),spelling:()=>{if(editor.current){editor.current.spellcheck=!editor.current.spellcheck;setMessage(`Spelling indicator ${editor.current.spellcheck?"enabled":"disabled"}.`)}},showOriginal:()=>setShowOriginal(value=>!value),compareCurrent:()=>compare(),restoreAutosave:()=>restore(),clearSelectionFormatting:()=>exec("removeFormat"),printLayout:()=>viewMode("print"),fullScreenReading:()=>viewMode("reading"),webLayout:()=>viewMode("web"),outlineView:()=>viewMode("outline"),draftView:()=>viewMode("draft"),ruler:()=>toggleView("ruler"),gridlines:()=>toggleView("gridlines"),documentMap:()=>toggleView("documentMap"),thumbnails:()=>toggleView("thumbnails"),formattingMarks:()=>toggleView("formattingMarks"),viewFormattingMarks:()=>toggleView("formattingMarks"),statusBar:()=>toggleView("statusBar"),zoom100:()=>setView(v=>({...v,zoom:100})),onePage:()=>setView(v=>({...v,zoom:measuredFit("height")})),twoPages:()=>setView(v=>({...v,zoom:measuredFit("twoPage")})),pageWidth:()=>setView(v=>({...v,zoom:measuredFit("width")})),find:()=>find(false),replace:()=>find(true),reviewFind:()=>find(false),reviewReplace:()=>find(true),leftIndent:()=>measure("marginLeft","Left indent in inches:",0),rightIndent:()=>measure("marginRight","Right indent in inches:",0),layoutIndents:()=>measure("marginLeft","Left indent in inches:",0),lineSpacing:()=>measure("lineHeight","Line spacing:",1.15),layoutLineSpacing:()=>measure("lineHeight","Line spacing:",1.15),paragraphSpacing:()=>setDialog({kind:"lineSpacingOptions",before:"0",after:"8",specialIndentMode:"none",specialIndentAmount:"0.5"}),layoutSpacing:()=>setDialog({kind:"lineSpacingOptions",before:"0",after:"8",specialIndentMode:"none",specialIndentAmount:"0.5"}),shading:()=>color("backColor"),borders:()=>toggleStyle("border","1px solid #0e7490"),watermark:()=>setDialog({kind:"watermark",text:editor.current?.dataset.watermark||"DRAFT"}),pageColor:()=>setDialog({kind:"pageColor",value:"#ffffff"}),pageBorders:()=>pageStyle("border","2px solid #155e75"),zoom:()=>setDialog({kind:"zoom",value:String(view.zoom)}),fontDialog:()=>{const selection=getSelection();const node=selection?.rangeCount?firstSelectedText(selection.getRangeAt(0))??selection.anchorNode:null;const parent=node instanceof Element?node:node?.parentElement;const style=parent?getComputedStyle(parent):null;const underlineNode=parent?.closest("[data-underline-style]")as HTMLElement|undefined;const charScaleNode=parent?.closest("[data-char-scale]")as HTMLElement|undefined;const charSpacingNode=parent?.closest("[data-char-spacing]")as HTMLElement|undefined;const charPositionNode=parent?.closest("[data-char-position]")as HTMLElement|undefined;const kerningNode=parent?.closest("[data-kerning-enabled]")as HTMLElement|undefined;setDialog({kind:"font",bold:style?Number(style.fontWeight)>=600:false,italic:style?.fontStyle==="italic",fontFamily:approvedFont(style?.fontFamily??"")??"",fontSize:style?String(Math.round(Number.parseFloat(style.fontSize)*.75*2)/2):"11",color:approvedColor(style?.color??"")?`#${approvedColor(style?.color??"")}`:"#000000",underlineStyle:style?.textDecorationLine.includes("underline")?underlineNode?.dataset.underlineStyle??"single":"none",underlineColor:underlineNode?.dataset.underlineColor?`#${underlineNode.dataset.underlineColor.replace("#","")}`:"",strike:Boolean(style?.textDecorationLine.includes("line-through")&&style.textDecorationStyle!=="double"),doubleStrike:Boolean(style?.textDecorationLine.includes("line-through")&&style.textDecorationStyle==="double"),superscript:style?.verticalAlign==="super",subscript:style?.verticalAlign==="sub",smallCaps:Boolean(parent?.closest('[data-small-caps="true"]')),allCaps:Boolean(parent?.closest('[data-all-caps="true"]')),hidden:Boolean(parent?.closest('[data-hidden="true"]')),outline:Boolean(parent?.closest('[data-outline="true"]')),emboss:Boolean(parent?.closest('[data-emboss="true"]')),charScale:charScaleNode?.dataset.charScale??"100",charSpacing:charSpacingNode?.dataset.charSpacing??"0",charPosition:charPositionNode?.dataset.charPosition??"0",kerningEnabled:kerningNode?.dataset.kerningEnabled==="true",kerningMin:kerningNode?.dataset.kerningMin??"0"})},paragraphDialog:()=>{const block=selectedBlocks()[0];setDialog({kind:"paragraph",alignment:block?.style.textAlign||"left",marginLeft:String(block?Math.abs(parseInches(block.style.marginLeft)):0),marginRight:String(block?Math.abs(parseInches(block.style.marginRight)):0),specialIndentMode:block?.dataset.specialIndentMode??"none",specialIndentAmount:block?.dataset.specialIndentAmount?String(Math.abs(parseInches(block.dataset.specialIndentAmount))):"0.5",spaceBefore:String(block?Math.abs(Number.parseFloat(block.style.marginTop))||0:0),spaceAfter:String(block?(block.style.marginBottom?Math.abs(Number.parseFloat(block.style.marginBottom))||0:shownSpacing(block).after):8),lineSpacing:block?.style.lineHeight||(block?shownSpacing(block).line:"1.15"),hyphens:block?.style.hyphens==="auto",lineNumbers:Boolean(block?.classList.contains("editor-line-numbers"))})}};map[id]?.();};
 useEffect(()=>{runRef.current=run});
 const toggleView=(key:keyof ViewState)=>setView(current=>({...current,[key]:!current[key]}));const viewMode=(mode:ViewState["mode"])=>setView(current=>({...current,mode}));
 const replaceSelection=(text:string)=>exec("insertText",text);const toggleEditorClass=(name:string)=>{const blocks=selectedBlocks();for(const block of blocks)block.classList.toggle(name);if(blocks.length)changed()};const pageStyle=(key:keyof CSSStyleDeclaration,value:string)=>{if(editor.current)(editor.current.style[key] as string)=value;changed()};const toggleStyle=(key:keyof CSSStyleDeclaration,value:string)=>{const blocks=selectedBlocks();for(const block of blocks)(block.style[key]as string)=(block.style[key]as string)?"":value;if(blocks.length)changed()};
 const measure=(key:"marginLeft"|"marginRight"|"lineHeight",label:string,fallback:number)=>{const value=bounded(promptValue(label,String(fallback)),key==="lineHeight"?.5:0,key==="lineHeight"?5:10),blocks=selectedBlocks();for(const block of blocks)block.style[key]=key==="lineHeight"?String(value):`${value}in`;if(blocks.length)changed()};
 const color=(command:string)=>{const value=promptValue("Enter a safe hex color:","#fff59d");if(/^#[0-9a-f]{6}$/i.test(value))exec(command,value)};
 // ---- Find and Replace (Word 2013 behaviour; see lib/word-find-engine.ts) ----
 const highlightApi=():{set:(name:string,value:unknown)=>void;delete:(name:string)=>void}|null=>{const css=(globalThis as unknown as{CSS?:{highlights?:{set:(name:string,value:unknown)=>void;delete:(name:string)=>void}}}).CSS;return css?.highlights??null};
 const paintHighlight=(name:string,ranges:Range[])=>{const api=highlightApi(),Ctor=(globalThis as unknown as{Highlight?:new(...ranges:Range[])=>unknown}).Highlight;if(!api||!Ctor)return;if(ranges.length)api.set(name,new Ctor(...ranges));else api.delete(name)};
 const clearFindHighlights=()=>{paintHighlight("word-find-all",[]);paintHighlight("word-find-current",[]);paintHighlight("word-find-selected",[])};
 const collectMatches=(needle:string,options:FindEngineOptions,scope:"selection"|"document")=>{
  const root=editor.current;if(!root)return{matches:[] as TextMatch[],segments:[] as Segment[],text:""};
  const{text,segments}=buildDocumentText(root);
  let matches:TextMatch[]=!needle&&options.format?formatOnlyMatches(segments,root,options.format):findMatches(text,needle,options);
  if(needle&&options.format){const format=options.format;matches=matches.filter(match=>matchSatisfiesFormat(segments,root,match.index,match.length,format))}
  const scopeRange=scope==="selection"?findScopeRange.current:null;
  if(scopeRange)matches=matches.filter(match=>{const range=rangeForMatch(segments,match.index,match.length);return Boolean(range)&&scopeRange.compareBoundaryPoints(Range.START_TO_START,range!)<=0&&scopeRange.compareBoundaryPoints(Range.END_TO_END,range!)>=0});
  return{matches,segments,text}
 };
 const selectMatch=(range:Range)=>{const selection=getSelection();selection?.removeAllRanges();selection?.addRange(range);savedRange.current=range.cloneRange();paintHighlight("word-find-current",[range.cloneRange()]);const target=range.startContainer instanceof Element?range.startContainer:range.startContainer.parentElement;target?.scrollIntoView({block:"center"})};
 // Returns the user-facing message for the dialog.
 const findNext=(needle:string,options:FindEngineOptions,scope:"selection"|"document"):string=>{
  if(!editor.current)return"";
  const{matches,segments}=collectMatches(needle,options,scope);
  const where=scope==="selection"?" in the selection":"";
  if(!matches.length)return`Search text not found${where}.`;
  const active=(()=>{const selection=getSelection();return selection?.rangeCount&&editor.current.contains(selection.anchorNode)?selection.getRangeAt(0):savedRange.current})();
  const ranges=matches.map(match=>rangeForMatch(segments,match.index,match.length));
  let pick=-1;
  if(options.direction==="up"){for(let i=ranges.length-1;i>=0;i--){const range=ranges[i];if(range&&(!active||active.compareBoundaryPoints(Range.END_TO_START,range)>=0)){pick=i;break}}if(pick<0&&options.direction==="up")return`Reached the beginning of the document${where}.`}
  else{for(let i=0;i<ranges.length;i++){const range=ranges[i];if(range&&(!active||active.compareBoundaryPoints(Range.START_TO_END,range)<=0)){pick=i;break}}if(pick<0){if(options.direction==="down")return`Reached the end of the document${where}.`;pick=ranges.findIndex(Boolean)}}
  const chosen=ranges[pick];if(!chosen)return`Search text not found${where}.`;
  selectMatch(chosen);
  return`Found match ${pick+1} of ${matches.length}${where}.`
 };
 // Word 2013's Find In (Main Document / Current Selection) SELECTS every match -- grey, like a
 // selection, not Reading Highlight's yellow -- and reports "Word found N items matching this
 // criteria." Browsers allow only one selection range, so the matches are painted as a selection
 // and the real selection is put on the first one.
 const selectAllMatches=(needle:string,options:FindEngineOptions,scope:"selection"|"document"):string=>{
  const{matches,segments}=collectMatches(needle,options,scope);
  const ranges=matches.map(match=>rangeForMatch(segments,match.index,match.length)).filter((range):range is Range=>Boolean(range));
  clearFindHighlights();
  if(!ranges.length)return`Search text not found${scope==="selection"?" in the selection":""}.`;
  paintHighlight("word-find-selected",ranges);
  const selection=getSelection();selection?.removeAllRanges();selection?.addRange(ranges[0].cloneRange());savedRange.current=ranges[0].cloneRange();
  return`Word found ${ranges.length} item${ranges.length===1?"":"s"} matching this criteria.`
 };
 const highlightAll=(needle:string,options:FindEngineOptions,scope:"selection"|"document"):string=>{
  const{matches,segments}=collectMatches(needle,options,scope);
  const ranges=matches.map(match=>rangeForMatch(segments,match.index,match.length)).filter((range):range is Range=>Boolean(range));
  if(!ranges.length){clearFindHighlights();return"Search text not found."}
  paintHighlight("word-find-all",ranges);
  return`${ranges.length} match${ranges.length===1?"":"es"} highlighted.`
 };
 // Replace one match with the (expanded) replacement text, through the editor's own commands so
 // formatting is inherited and undo works. A ^p in the replacement becomes a real paragraph break.
 const replaceMatch=(range:Range,replacementText:string)=>{
  const selection=getSelection();selection?.removeAllRanges();selection?.addRange(range);savedRange.current=range.cloneRange();
  const parts=replacementText.split(/([\r\v\f])/);
  let first=true;
  for(const part of parts){
   if(part==="\r"){exec("insertParagraph");first=false;continue}
   if(part==="\v"){exec("insertLineBreak");first=false;continue}
   if(part==="\f"){insertSafe('<hr data-block-type="page-break" class="my-8 border-t-2 border-dashed border-cyan-500">');first=false;continue}
   if(part)exec("insertText",part);else if(first&&!range.collapsed)exec("delete");
   first=false
  }
 };
 const runFindNext=(needle:string,options:FindEngineOptions,scope:"selection"|"document"):string=>{if(!needle&&!options.format)return"Type something in Find what.";return findNext(needle,options,scope)};
 const runReplaceOne=(needle:string,replacement:string,options:FindEngineOptions,scope:"selection"|"document"):string=>{
  if(!needle&&!options.format)return"Type something in Find what.";
  if(submitted)return"";
  const{matches,segments,text}=collectMatches(needle,options,scope);
  const selection=getSelection();const active=selection?.rangeCount&&editor.current?.contains(selection.anchorNode)?selection.getRangeAt(0):null;
  if(active){for(const match of matches){const range=rangeForMatch(segments,match.index,match.length);if(range&&active.compareBoundaryPoints(Range.START_TO_START,range)===0&&active.compareBoundaryPoints(Range.END_TO_END,range)===0){replaceMatch(range,expandReplacement(replacement,{text:text.slice(match.index,match.index+match.length),groups:match.groups},options));break}}}
  return findNext(needle,options,scope)
 };
 const runReplaceAll=(needle:string,replacement:string,options:FindEngineOptions,scope:"selection"|"document"):string=>{
  if(!needle&&!options.format)return"Type something in Find what.";
  if(!editor.current||submitted)return"";
  clearFindHighlights();
  const{matches,segments,text}=collectMatches(needle,options,scope);
  if(!matches.length)return`Search text not found${scope==="selection"?" in the selection":""}.`;
  // Last match first, so earlier positions stay valid while the document changes.
  const plan=matches.map(match=>({range:rangeForMatch(segments,match.index,match.length),text:expandReplacement(replacement,{text:text.slice(match.index,match.index+match.length),groups:match.groups},options)}));
  let count=0;
  for(let i=plan.length-1;i>=0;i--){const item=plan[i];if(!item.range)continue;replaceMatch(item.range,item.text);count++}
  return`Replaced ${count} occurrence${count===1?"":"s"}${scope==="selection"?" in the selection":""}.`
 };
 const find=(replace:boolean)=>{
  const bookmarks=editor.current?[...editor.current.querySelectorAll("[data-bookmark]")].map(element=>(element as HTMLElement).dataset.bookmark).filter((value):value is string=>Boolean(value)):[];
  // Captured now, while the document's own selection is still live -- by
  // the time the admin types into this dialog's inputs and clicks Find
  // Next/Replace/Replace All, getSelection() no longer reflects it.
  const selection=getSelection();
  const scopeRange=selection&&selection.rangeCount&&!selection.isCollapsed&&editor.current&&editor.current.contains(selection.anchorNode)&&editor.current.contains(selection.focusNode)?selection.getRangeAt(0).cloneRange():null;
  findScopeRange.current=scopeRange;
  setDialog({kind:"findReplace",mode:replace?"replace":"find",query,replacement:"",matchCase:false,wholeWord:false,wildcards:false,matchPrefix:false,matchSuffix:false,ignorePunctuation:false,ignoreWhitespace:false,formatHighlight:false,bookmarks,hadSelection:Boolean(scopeRange)});
 };
 const goToTarget=(kind:string,value:string)=>{
  if(!editor.current)return;
  if(kind==="page"){
   const marks=[...editor.current.querySelectorAll('[data-block-type="page-break"]')]as HTMLElement[];
   const page=Math.max(1,Math.round(Number(value))||1);
   if(page<=1){editor.current.scrollIntoView({block:"start",behavior:"smooth"});setMessage("Moved to page 1.");return}
   const mark=marks[page-2];
   if(!mark){setMessage(marks.length?`This document only has ${marks.length+1} pages.`:"This document has no manual page breaks.");return}
   mark.scrollIntoView({block:"start",behavior:"smooth"});setMessage(`Moved to page ${page}.`);
   return;
  }
  if(kind==="table"){
   const tables=[...editor.current.querySelectorAll("table")]as HTMLElement[];
   const index=Math.max(1,Math.round(Number(value))||1)-1;
   const table=tables[index];
   if(!table){setMessage(tables.length?`This document only has ${tables.length} table${tables.length===1?"":"s"}.`:"This document has no tables.");return}
   table.scrollIntoView({block:"center",behavior:"smooth"});setMessage(`Moved to table ${index+1}.`);
   return;
  }
  if(kind==="bookmark"){
   if(!value){setMessage("Choose a bookmark.");return}
   const target=editor.current.querySelector(`[data-bookmark="${CSS.escape(value)}"]`)as HTMLElement|null;
   if(!target){setMessage(`Bookmark "${value}" was not found.`);return}
   target.scrollIntoView({block:"center",behavior:"smooth"});setMessage(`Moved to bookmark "${value}".`);
   return;
  }
  setMessage("This item isn't applicable to this exam tool's document model.");
 };
 const applyLineSpacingOptions=(before:string,after:string,specialIndentMode:string,specialIndentAmount:string)=>{const b=bounded(before,0,500),a=bounded(after,0,500),amount=bounded(specialIndentAmount,0,10),blocks=selectedBlocks();for(const block of blocks){block.style.marginTop=`${b}pt`;block.style.marginBottom=`${a}pt`;if(specialIndentMode==="none"){delete block.dataset.specialIndentMode;delete block.dataset.specialIndentAmount;block.style.textIndent=""}else{block.dataset.specialIndentMode=specialIndentMode;block.dataset.specialIndentAmount=`${amount}in`;block.style.textIndent=specialIndentMode==="hanging"?`-${amount}in`:`${amount}in`}}setDialog(null);if(blocks.length)changed()};
 const counts=()=>{const text=editor.current?.innerText??"";setMessage(`${text.trim().split(/\s+/u).filter(Boolean).length} words · ${text.length} characters.`)};const compare=()=>{const before=original.paragraphs.map(matterText).join(" ");const after=editor.current?.innerText??"";setMessage(`${Math.abs(after.length-before.length)} character difference from the original matter.`)};
 const restore=()=>{if(!lastAutosave.current){setMessage("No autosave is available in this browser session.");return}if(confirm("Restore the last successful autosave? Current unsaved changes will be replaced.")){renderStructuredSnapshot(editor.current,lastAutosave.current);setStatus("Restored last autosave")}};
 const safeLink=()=>{const href=promptValue("Link URL (https, http, mailto, or #bookmark):","https://");if(!/^(?:https?:\/\/|mailto:|#)[^\s]+$/i.test(href)){setMessage("That link protocol is not allowed.");return}const label=getSelection()?.toString()||href;insertSafe(`<a href="${escapeHtml(href)}" rel="noopener noreferrer">${escapeHtml(label)}</a>`)};
 const openTableEditDialog=()=>{const anchor=getSelection()?.anchorNode?.parentElement;const table=anchor?.closest("table")as HTMLTableElement|null;if(!table){setMessage("Place the cursor inside a table first.");return}const cell=anchor?.closest("td,th")as HTMLTableCellElement|null;const row=cell?.closest("tr")as HTMLTableRowElement|null;dialogTableRef.current={table,rowIndex:row?row.rowIndex:table.rows.length-1,cellIndex:cell?cell.cellIndex:(table.rows[0]?.cells.length??1)-1};setDialog({kind:"tableEdit"})};
 const applyTableAction=(table:HTMLTableElement,rowIndex:number,cellIndex:number,action:string)=>{if(action==="add-row-above"||action==="add-row-below"){const cells=table.rows[0]?.cells.length??1;const newRow=table.insertRow(action==="add-row-above"?rowIndex:rowIndex+1);for(let index=0;index<cells;index++)newRow.insertCell().textContent="Cell"}else if(action==="remove-row"&&table.rows.length>1){table.deleteRow(rowIndex)}else if(action==="add-column-left"||action==="add-column-right"){for(const tableRow of table.rows)tableRow.insertCell(action==="add-column-left"?cellIndex:cellIndex+1).textContent="Cell"}else if(action==="remove-column"&&(table.rows[0]?.cells.length??0)>1){for(const tableRow of table.rows)if(tableRow.cells.length>cellIndex)tableRow.deleteCell(cellIndex)}else if(action==="remove-table"){table.remove();setInsideTable(false)}changed()};
 const runTableEdit=(action:string)=>{const context=dialogTableRef.current;setDialog(null);if(!context)return;applyTableAction(context.table,context.rowIndex,context.cellIndex,action)};
 // Word 2013's Table Tools: Select Row / Column / Table, and the Layout tab's
 // 3x3 Alignment grid. A browser selection is one contiguous range, so a column
 // (or any set of cells) cannot be selected natively -- the chosen cells are
 // remembered here, shaded like a selection, and every formatting command,
 // colour, font, size and the Font dialog is then applied to each of them in
 // turn. Clicking or typing in the document clears it, as in Word.
 const cellSelection=useRef<HTMLTableCellElement[]>([]);
 const activeCellRef=useRef<HTMLTableCellElement|null>(null),focusCellRef=useRef<HTMLTableCellElement|null>(null),dialogTableCtx=useRef<{table:HTMLTableElement;cell:HTMLTableCellElement;cells:HTMLTableCellElement[]}|null>(null),convertParagraphs=useRef<HTMLElement[]>([]);
 const setCellSelection=(cells:HTMLTableCellElement[])=>{for(const cell of cellSelection.current)cell.classList.remove("word-cell-selected");cellSelection.current=cells;for(const cell of cells)cell.classList.add("word-cell-selected")};
 const cursorCell=()=>{restoreSelection();const node=getSelection()?.anchorNode;const element=node instanceof Element?node:node?.parentElement;return element?.closest("td,th")as HTMLTableCellElement|null};
 const selectTablePart=(kind:"row"|"column"|"table")=>{const cell=cursorCell();const table=cell?.closest("table")as HTMLTableElement|null;if(!cell||!table){setMessage("Place the cursor inside a table first.");return}const row=cell.parentElement as HTMLTableRowElement;const cells=kind==="row"?[...row.cells]:kind==="column"?[...table.rows].map(tableRow=>tableRow.cells[cell.cellIndex]).filter((item):item is HTMLTableCellElement=>Boolean(item)):[...table.rows].flatMap(tableRow=>[...tableRow.cells]);setCellSelection(cells);const range=document.createRange();range.selectNodeContents(cells[0]);savedRange.current=range;const selection=getSelection();selection?.removeAllRanges();selection?.addRange(range);setMessage(`${kind==="row"?"Row":kind==="column"?"Column":"Table"} selected (${cells.length} cell${cells.length===1?"":"s"}). Formatting now applies to every selected cell.`)};
 // Runs a formatting action once per selected cell (or once, normally).
 const withCells=(apply:()=>void)=>{const cells=cellSelection.current.filter(cell=>cell.isConnected);if(!cells.length){apply();return}for(const cell of cells){const range=document.createRange();range.selectNodeContents(cell);savedRange.current=range;const selection=getSelection();selection?.removeAllRanges();selection?.addRange(range);apply()}const range=document.createRange();range.selectNodeContents(cells[0]);savedRange.current=range};
 const withCellsRef=useRef(withCells);useEffect(()=>{withCellsRef.current=withCells});
 const CELL_FORMAT_COMMANDS=new Set(["increaseFontSize","decreaseFontSize","bold","italic","underline","strikeThrough","doubleStrikeThrough","superscript","subscript","clearCharacterFormatting","clearSelectionFormatting","alignLeft","alignCenter","alignRight","justify"]);
 const runCommand=(id:string)=>CELL_FORMAT_COMMANDS.has(id)?withCells(()=>run(id)):run(id);
 const alignCells=(vertical:"top"|"middle"|"bottom",horizontal:"left"|"center"|"right")=>{let cells=cellSelection.current.filter(cell=>cell.isConnected);if(!cells.length){restoreSelection();const selection=getSelection();const range=selection?.rangeCount?selection.getRangeAt(0):null;const root=range?(range.commonAncestorContainer.nodeType===1?range.commonAncestorContainer as Element:range.commonAncestorContainer.parentElement):null;const inRange=range&&root?[...(root.closest("table")??root).querySelectorAll("td,th")].filter(cell=>range.intersectsNode(cell))as HTMLTableCellElement[]:[];const here=cursorCell();cells=inRange.length?inRange:here?[here]:[]}if(!cells.length){setMessage("Place the cursor inside a table first.");return}for(const cell of cells){cell.style.verticalAlign=vertical;cell.style.textAlign=horizontal;for(const inner of cell.querySelectorAll<HTMLElement>("[style]"))inner.style.textAlign=""}changed()};
 const tableActionAtCursor=(action:string)=>{restoreSelection();const anchor=getSelection()?.anchorNode?.parentElement;const table=anchor?.closest("table")as HTMLTableElement|null;if(!table){setMessage("Place the cursor inside a table first.");return}const cell=anchor?.closest("td,th")as HTMLTableCellElement|null;const row=cell?.closest("tr")as HTMLTableRowElement|null;applyTableAction(table,row?row.rowIndex:table.rows.length-1,cell?cell.cellIndex:(table.rows[0]?.cells.length??1)-1,action)};
 const insertTableWithSize=(rows:number,cols:number,layout:string="fixed",afterBlock?:Element|null)=>{const row=`<tr>${Array.from({length:cols},()=>'<td class="border p-2">Cell</td>').join("")}</tr>`;const style=layout==="fixed"?"table-layout:fixed":"table-layout:auto";const width=layout==="fixed"?"":"width:100%;";const html=`<table data-block-type="table" data-table-layout="${layout}" class="my-3 border-collapse" style="${style};${width}"><tbody>${Array.from({length:rows},()=>row).join("")}</tbody></table>`;
  // A table is never put inside a table cell (nested tables can't be saved):
  // with the cursor in a table, or a block given (Draw Table on the page), the new
  // table goes right after that table/block, as its own block.
  restoreSelection();const anchor=getSelection()?.anchorNode;const inCell=(anchor instanceof Element?anchor:anchor?.parentElement)?.closest("td,th");let host:Element|null=afterBlock??(inCell?inCell.closest("table"):null);
  if(host&&editor.current){while(host&&host.parentElement!==editor.current)host=host.parentElement;const template=document.createElement("template");template.innerHTML=html;const table=template.content.firstElementChild as HTMLTableElement;if(host)host.after(table);else editor.current.append(table);const range=document.createRange();range.selectNodeContents(table.rows[0].cells[0]);range.collapse(true);savedRange.current=range;changed()}else insertSafe(html);setDialog(null)};
 // ---- Word 2013 PAGE LAYOUT tab (Page Setup, Paragraph, Arrange) ----
 const LAST_CUSTOM_KEY="word-last-custom-margins";
 const lastCustomMargins=():MarginsCm|null=>{try{const raw=localStorage.getItem(LAST_CUSTOM_KEY);return raw?parsePadding(raw):null}catch{return null}};
 const rememberCustom=(margins:MarginsCm)=>{if(MARGIN_PRESETS.some(preset=>(["top","bottom","left","right"]as const).every(key=>Math.abs(preset.margins[key]-margins[key])<0.006)))return;try{localStorage.setItem(LAST_CUSTOM_KEY,paddingText(margins))}catch{}};
 const pageOrientation=()=>editor.current?.style.aspectRatio.replace(/\s/g,"")==="1.414/1"?"landscape":"portrait";
 const pageSetupValues=():PageSetupValues=>{const page=editor.current;const m=currentMargins();const paper=paperFromWidth(Number.parseFloat(page?.style.maxWidth??"")||null);const widthCm=(Number.parseFloat(page?.style.maxWidth??"")||794)*2.54/96;return{...DEFAULT_PAGE_SETUP,...m,gutter:Number(page?.dataset.gutter??0)/10,gutterPosition:page?.dataset.gutterPosition==="top"?"top":"left",orientation:pageOrientation(),multiplePages:page?.dataset.mirrorMargins==="true"?"mirror":"normal",paper:paper?.id??(page?.style.maxWidth?"custom":"a4"),width:paper?.width??Math.round(widthCm*100)/100,height:paper?.height??Math.round(widthCm*1.414*100)/100,lineNumbers:Boolean(page?.querySelector(".editor-line-numbers"))}};
 const pageBlocks=()=>[...(editor.current?.querySelectorAll<HTMLElement>(":scope > p, :scope > ul > li, :scope > ol > li")??[])];
 const pageBorderValues=():BordersShadingValues=>{const page=editor.current?.style.border??"";const match=/^(\d+(?:\.\d+)?)px (solid|double|dotted|dashed) (?:#([0-9a-f]{6})|rgb\((\d+), (\d+), (\d+)\))$/i.exec(page);const hex=match?(match[3]??[match[4],match[5],match[6]].map(v=>Number(v).toString(16).padStart(2,"0")).join("")).toUpperCase():"000000";return{setting:"none",edges:{top:false,bottom:false,left:false,right:false,insideH:false,insideV:false,diagonalDown:false,diagonalUp:false},style:"solid",color:"000000",width:0.5,applyTo:"table",fill:null,pattern:"clear",patternColor:null,shadingApplyTo:"cell",pageSetting:match?"box":"none",pageStyle:(match?.[2]as BordersShadingValues["pageStyle"])??"solid",pageColor:hex,pageWidth:match?Math.min(...BORDER_WIDTHS.filter(width=>Math.round(width*4/3)>=Number(match[1])),6):0.5}};
 const applyPageBorder=(values:BordersShadingValues)=>{const px=Math.max(values.pageStyle==="double"?3:1,Math.round(values.pageWidth*4/3));const css=values.pageSetting==="none"?"":`${px}px ${values.pageStyle} #${values.pageColor}`;if(editor.current&&editor.current.style.border!==css)pageStyle("border",css)};
 const openPageSetup=(tab:"margins"|"paper"|"layout")=>{if(submitted)return;setDialog({kind:"pageSetup",tab,values:pageSetupValues(),borders:pageBorderValues()})};
 const applyPageSetup=(values:PageSetupValues)=>{setDialog(null);const page=editor.current;if(!page)return;
  const margins={top:values.top,bottom:values.bottom,left:values.left,right:values.right};
  setPageMargins(margins,{cm:values.gutter,position:values.multiplePages==="mirror"?"left":values.gutterPosition});rememberCustom(margins);
  if(values.multiplePages==="mirror")page.dataset.mirrorMargins="true";else delete page.dataset.mirrorMargins;
  const preset=PAPER_SIZES.find(size=>size.id===values.paper);
  if(preset){if(page.style.maxWidth!==`${PAPER_WIDTH_PX[preset.id]}px`)pageStyle("maxWidth",`${PAPER_WIDTH_PX[preset.id]}px`);const ratio=values.orientation==="landscape"?"1.414 / 1":"1 / 1.414";if(page.style.aspectRatio.replace(/\s/g,"")!==ratio.replace(/\s/g,""))pageStyle("aspectRatio",ratio)}
  else{const w=values.orientation==="landscape"?values.height:values.width,h=values.orientation==="landscape"?values.width:values.height;pageStyle("maxWidth",`${Math.round(w*96/2.54)}px`);pageStyle("aspectRatio",`${Math.round(w*100)/100} / ${Math.round(h*100)/100}`)}
  const numbered=Boolean(page.querySelector(".editor-line-numbers"));if(values.lineNumbers!==numbered){for(const block of pageBlocks())block.classList.toggle("editor-line-numbers",values.lineNumbers);changed()}
  noteOperation("margins")};
 const noteOperation=(id:string)=>{if(editor.current){const used=new Set((editor.current.dataset.operations??"").split(",").filter(Boolean));used.add(id);editor.current.dataset.operations=[...used].slice(0,256).join(",")}};
 const currentBlock=()=>selectedBlocks()[0]??null;
 const ptOf=(value:string)=>{const number=Number.parseFloat(value);return Number.isFinite(number)?(value.endsWith("px")?number*0.75:number):0};
 const pageLayoutState=():PageLayoutState=>{const block=currentBlock();const style=block?getComputedStyle(block):null;const can=(id:string)=>isWordCommandEnabled(capabilities,id);return{margins:parsePadding(editor.current?.dataset.margins||editor.current?.style.padding),lastCustom:lastCustomMargins(),orientation:pageOrientation(),paper:paperFromWidth(Number.parseFloat(editor.current?.style.maxWidth??"")||null)?.id??(editor.current?.style.maxWidth?null:"a4"),columns:Number(editor.current?.style.columnCount)||1,indentLeft:style?Math.round(ptOf(style.marginLeft)*2.54/72*100)/100:0,indentRight:style?Math.round(ptOf(style.marginRight)*2.54/72*100)/100:0,spaceBefore:style?Math.round(ptOf(style.marginTop)*10)/10:0,spaceAfter:style?Math.round(ptOf(style.marginBottom)*10)/10:0,enabled:{margins:can("margins"),orientation:can("orientation"),pageSize:can("pageSize"),columns:can("columns"),breaks:can("sectionBreak"),lineNumbers:can("lineNumbers"),paragraph:can("paragraphDialog")}}};
 const onPageLayout=(action:PageLayoutAction,value="")=>{if(submitted)return;setTimeout(()=>setPageRev(rev=>rev+1),0);
  const gate:Record<PageLayoutAction,string>={margins:"margins",marginsLast:"margins",pageSetup:"margins",orientation:"orientation",pageSize:"pageSize",columns:"columns",breaks:"sectionBreak",lineNumbers:"lineNumbers",hyphenation:"lineNumbers",indentLeft:"paragraphDialog",indentRight:"paragraphDialog",spaceBefore:"paragraphDialog",spaceAfter:"paragraphDialog",paragraphDialog:"paragraphDialog"};
  if(!isWordCommandEnabled(capabilities,gate[action]))return;
  if(action==="margins"){const preset=MARGIN_PRESETS.find(item=>item.id===value);if(preset){setPageMargins(preset.margins);noteOperation("margins")}return}
  if(action==="marginsLast"){const last=lastCustomMargins();if(last){setPageMargins(last);noteOperation("margins")}return}
  if(action==="pageSetup"){openPageSetup(value==="paper"?"paper":value==="layout"?"layout":"margins");return}
  if(action==="orientation"){onValueCommand("orientation",value);return}
  if(action==="pageSize"){onValueCommand("pageSize",value);return}
  if(action==="columns"){if(value==="more")onValueCommand("columnsAction","custom");else onValueCommand("columns",value);return}
  if(action==="breaks"){if(value==="page")run("pageBreak");else if(value==="nextPage")run("sectionBreak");else if(value==="textWrapping"){restoreSelection();document.execCommand("insertLineBreak");changed()}return}
  if(action==="lineNumbers"){const blocks=value==="suppress"?selectedBlocks():pageBlocks();for(const block of blocks)block.classList.toggle("editor-line-numbers",value==="continuous");if(blocks.length){noteOperation("lineNumbers");changed()}return}
  if(action==="hyphenation"){for(const block of pageBlocks())block.style.hyphens=value==="auto"?"auto":"";noteOperation("hyphenation");changed();return}
  if(action==="paragraphDialog"){run("paragraphDialog");return}
  const blocks=selectedBlocks();if(!blocks.length){setMessage("Place the cursor in a paragraph first.");return}
  const number=Number(value);if(!Number.isFinite(number))return;
  for(const block of blocks){if(action==="indentLeft")block.style.marginLeft=`${number}cm`;if(action==="indentRight")block.style.marginRight=`${number}cm`;if(action==="spaceBefore")block.style.marginTop=`${number}pt`;if(action==="spaceAfter")block.style.marginBottom=`${number}pt`}
  noteOperation("paragraphDialog");changed()};
 // ---- Word 2013 TABLE TOOLS (Design + Layout tabs) ----
 // The cell the cursor is in, and the cells a command applies to: the Select-ed
 // cells, else every cell the selection touches, else the cursor's cell.
 const tableCell=()=>{const cell=activeCellRef.current;return cell?.isConnected?cell:cursorCell()};
 const tableCells=():HTMLTableCellElement[]=>{const chosen=cellSelection.current.filter(cell=>cell.isConnected);if(chosen.length)return chosen;const cell=tableCell();const table=cell?.closest("table");const selection=getSelection();const range=selection?.rangeCount?selection.getRangeAt(0):savedRange.current;if(table&&range&&!range.collapsed){
  // Like Word, a drag from one cell to another selects the RECTANGLE between
  // them -- a browser selection runs in reading order, so it would also take
  // the rest of the first row and the start of the last one.
  const at=(node:Node)=>(node instanceof Element?node:node.parentElement)?.closest("td,th")as HTMLTableCellElement|null;
  const first=at(range.startContainer),last=at(range.endContainer);
  if(first&&last&&first!==last&&first.closest("table")===table&&last.closest("table")===table){const grid=tableGrid(table as HTMLTableElement);const rect=selectionRect(grid,[first,last]);if(rect){const inside=new Set<HTMLTableCellElement>();for(let r=rect.r1;r<=rect.r2;r++)for(let c=rect.c1;c<=rect.c2;c++){const slot=grid.at[r][c];if(slot)inside.add(slot.cell)}return[...inside]}}
  const cells=[...table.querySelectorAll("td,th")].filter(item=>range.intersectsNode(item))as HTMLTableCellElement[];if(cells.length)return cells}return cell?[cell]:[]};
 const tableDone=(table?:HTMLTableElement|null)=>{if(table?.isConnected)normalizeTable(table);setTableRev(value=>value+1);changed()};
 const withTable=(apply:(table:HTMLTableElement,cell:HTMLTableCellElement)=>void)=>{const cell=tableCell();const table=cell?.closest("table")as HTMLTableElement|null;if(!cell||!table){setMessage("Place the cursor inside a table first.");return}apply(table,cell)};
 const CM=2.54/96,r2=(value:number)=>Math.round(value*100)/100;
 const measuredRow=(table:HTMLTableElement,r:number)=>r2((table.rows[r]?.getBoundingClientRect().height??0)*CM)||0.6;
 const measuredCol=(table:HTMLTableElement,c:number)=>{const slot=tableGrid(table).at.map(row=>row[c]).find(item=>item&&item.colSpan===1);return r2((slot?.cell.getBoundingClientRect().width??0)*CM)||2.5};
 const tableWidthCm=(table:HTMLTableElement)=>r2(table.getBoundingClientRect().width*CM)||16;
 const tableOptionsValues=(table:HTMLTableElement):TableOptionsValues=>{const spacing=cellSpacing(table);return{...tableCellMargins(table),spacingOn:spacing!==null,spacing:spacing??0,autoResize:table.dataset.tableLayout!=="fixed"}};
 const cellOptionsValues=(table:HTMLTableElement,cell:HTMLTableCellElement):CellOptionsValues=>{const own=cellOptions(cell);return{sameAsTable:own.margins===null,margins:own.margins??tableCellMargins(table),wrapText:own.wrapText,fitText:own.fitText}};
 const bordersValues=(cell:HTMLTableCellElement,cells:HTMLTableCellElement[]):BordersShadingValues=>{const page=editor.current?.style.border??"";const pageMatch=/^(\d+(?:\.\d+)?)px (solid|double|dotted|dashed) #([0-9a-f]{6})$/i.exec(page.replace(/rgb\((\d+), (\d+), (\d+)\)/,(_,r,g,b)=>"#"+[r,g,b].map(v=>Number(v).toString(16).padStart(2,"0")).join("")));return{setting:"all",edges:bordersPreset("all"),style:tablePen.style==="none"?"solid":tablePen.style,color:tablePen.color,width:tablePen.width,applyTo:cells.length>1?"cell":"table",fill:cell.dataset.shading??null,pattern:"clear",patternColor:null,shadingApplyTo:"cell",pageSetting:pageMatch?"box":"none",pageStyle:(pageMatch?.[2]as BordersShadingValues["pageStyle"])??"solid",pageColor:pageMatch?.[3]?.toUpperCase()??"000000",pageWidth:pageMatch?Math.min(...BORDER_WIDTHS.filter(width=>Math.round(width*4/3)>=Number(pageMatch[1])),6):0.5}};
 const tablePropertiesValues=(table:HTMLTableElement,cell:HTMLTableCellElement):TablePropertiesValues=>{const grid=tableGrid(table),slot=slotOf(grid,cell);const heights=rowHeights(table),widths=columnWidths(table),width=tableWidth(table);return{widthOn:Boolean(width),width:width?.width??tableWidthCm(table),widthUnit:width?.unit??"cm",tableAlign:(table.dataset.tableAlign as "center"|"right")??"left",indent:tableIndent(table),wrap:table.dataset.tableWrap==="around"?"around":"none",rows:[...table.rows].map((tr,r)=>({heightOn:heights[r]!=null,height:heights[r]??measuredRow(table,r),rule:tr.dataset.heightRule==="exactly"?"exactly":"atLeast",canSplit:tr.dataset.cantSplit!=="true"})),rowIndex:slot?.row??0,repeatHeader:table.dataset.repeatHeader==="true",columns:Array.from({length:grid.cols},(_,c)=>({widthOn:widths[c]!=null,width:widths[c]??measuredCol(table,c),unit:"cm" as const})),columnIndex:slot?.col??0,cellWidthOn:slot?widths[slot.col]!=null:false,cellWidth:slot?widths[slot.col]??measuredCol(table,slot.col):2.5,cellUnit:"cm",cellVAlign:(cell.style.verticalAlign as "top"|"middle"|"bottom")||"top",title:table.dataset.altTitle??"",description:table.dataset.altDescription??""}};
 const openTableProperties=(table:HTMLTableElement,cell:HTMLTableCellElement,cells:HTMLTableCellElement[],tab?:"table"|"row"|"column"|"cell"|"alt")=>{dialogTableCtx.current={table,cell,cells};setDialog({kind:"tableProperties",tab,values:tablePropertiesValues(table,cell),options:tableOptionsValues(table),cellOptions:cellOptionsValues(table,cell),borders:bordersValues(cell,cells)})};
 const tableToolsState=():TableToolsState=>{const cell=tableCell();const table=cell?.closest("table")as HTMLTableElement|null;const options=Object.fromEntries(TABLE_STYLE_OPTION_KEYS.map(key=>[key,table?.dataset[key]!==undefined?table.dataset[key]==="true":DEFAULT_STYLE_OPTIONS[key]]))as Record<TableStyleOptionKey,boolean>;const grid=table?tableGrid(table):null;const slot=grid&&cell?slotOf(grid,cell):null;return{tableStyle:table?.dataset.tableStyle??null,styleOptions:options,pen:tablePen,gridlines:showGridlines,mode:tableMode,repeatHeader:table?.dataset.repeatHeader==="true",rowHeight:table&&slot?rowHeights(table)[slot.row]??measuredRow(table,slot.row):null,colWidth:table&&slot?columnWidths(table)[slot.col]??measuredCol(table,slot.col):null,canMerge:tableCells().length>1,cellAlign:cell?`${cell.style.verticalAlign||"top"}:${["center","right"].includes(cell.style.textAlign)?cell.style.textAlign:"left"}`:undefined,lastShading,lastBorder}};
 const onTableTool=(action:TableToolsAction,value="")=>{
  if(submitted)return;
  const used=new Set((editor.current?.dataset.operations??"").split(",").filter(Boolean));used.add("insertTable");if(editor.current)editor.current.dataset.operations=[...used].slice(0,256).join(",");
  if(action==="gridlines"){setShowGridlines(on=>!on);return}
  if(action==="draw"||action==="erase"||action==="borderPainter"){const mode=action==="borderPainter"?"paint":action;setTableMode(current=>current===mode?"off":mode);setMessage(mode==="draw"?"Draw Table: drag across a cell to split it into rows, down a cell to split it into columns, or drag on the page for a new table. Press Esc to stop.":mode==="erase"?"Eraser: click near the line between two cells to remove it. Press Esc to stop.":"Border Painter: click near a cell's edge to apply the current border. Press Esc to stop.");return}
  if(action==="penStyle"){setTablePen(pen=>({...pen,style:value as Pen["style"]}));return}
  if(action==="penWidth"){setTablePen(pen=>({...pen,width:Number(value)||0.5}));return}
  if(action==="penColor"){setTablePen(pen=>({...pen,color:value||"000000",style:pen.style==="none"?"solid":pen.style}));return}
  if(action==="borderSampler"){setTableMode(current=>current==="sample"?"off":"sample");setMessage("Border Sampler: click a cell's edge to pick up its border style, then click edges to paint it. Press Esc to stop.");return}
  if(action==="borderStyle"){const [style,width,color]=value.split("-");setTablePen({style:style==="single"?"solid":style as Pen["style"],width:Number(width),color});setTableMode("paint");setMessage("Border Painter is on: click near a cell's edge to apply this border. Press Esc to stop.");return}
  withTable((table,cell)=>{
   const grid=tableGrid(table),slot=slotOf(grid,cell);if(!slot)return;
   const cells=tableCells();
   const rect=selectionRect(grid,cells)??{r1:slot.row,c1:slot.col,r2:slot.row+slot.rowSpan-1,c2:slot.col+slot.colSpan-1};
   const rowsOf=()=>Array.from({length:rect.r2-rect.r1+1},(_,i)=>rect.r1+i),colsOf=()=>Array.from({length:rect.c2-rect.c1+1},(_,i)=>rect.c1+i);
   switch(action){
    case "styleOption":{const[key,on]=value.split(":");setStyleOption(table,key as TableStyleOptionKey,on==="true");return tableDone(table)}
    case "tableStyle":setTableStyle(table,value||null);return tableDone(table);
    case "shading":for(const item of cells)setShading(item,value||null);setLastShading(value||null);return tableDone(table);
    case "borders":applyBorders(table,cells,value as BorderCommand,tablePen.style==="none"?{...tablePen,style:"solid"}:tablePen);setLastBorder(value as BorderCommand);return tableDone(table);
    case "bordersDialog":dialogTableCtx.current={table,cell,cells};setDialog({kind:"bordersShading",initial:bordersValues(cell,cells)});return;
    case "select":{if(value==="cell"){setCellSelection([cell]);const range=document.createRange();range.selectNodeContents(cell);savedRange.current=range;const selection=getSelection();selection?.removeAllRanges();selection?.addRange(range);setTableRev(v=>v+1);return}selectTablePart(value as "row"|"column"|"table");setTableRev(v=>v+1);return}
    case "properties":openTableProperties(table,cell,cells,value==="cellSize"?"row":undefined);return;
    case "delete":if(value==="table"){table.remove();setInsideTable(false);setCellSelection([]);return tableDone(null)}if(value==="row"){for(const r of rowsOf().reverse())if(table.isConnected)deleteRow(table,r)}else{for(const c of colsOf().reverse())if(table.isConnected)deleteColumn(table,c)}setCellSelection([]);if(!table.isConnected)setInsideTable(false);return tableDone(table);
    case "deleteCellsDialog":dialogTableCtx.current={table,cell,cells};setDialog({kind:"deleteCells"});return;
    case "insert":{const ok=value==="above"?insertRow(table,rect.r1,"above"):value==="below"?insertRow(table,rect.r2,"below"):value==="left"?insertColumn(table,rect.c1,"left"):insertColumn(table,rect.c2,"right");if(!ok)setMessage("A table can have at most 50 rows and 20 columns.");return tableDone(table)}
    case "merge":{const error=mergeCells(table,cells);if(error){setMessage(error);return}setCellSelection([]);return tableDone(table)}
    case "splitCellsDialog":dialogTableCtx.current={table,cell,cells};setDialog({kind:"splitCells",canMerge:cells.length>1});return;
    case "insertCellsDialog":dialogTableCtx.current={table,cell,cells};setDialog({kind:"insertCells"});return;
    case "splitTable":{if(slot.row===0){setMessage("Place the cursor in the row that should start the second table (not the first row).");return}splitTable(table,slot.row);return tableDone(table)}
    case "autofit":autoFit(table,value as "auto"|"window"|"fixed");return tableDone(table);
    case "rowHeight":setRowHeight(table,rowsOf(),Number(value));return tableDone(table);
    case "colWidth":setColumnWidth(table,colsOf(),Number(value));table.setAttribute("data-table-layout","fixed");return tableDone(table);
    case "distributeRows":distributeRows(table);return tableDone(table);
    case "distributeColumns":distributeColumns(table);table.setAttribute("data-table-layout","fixed");return tableDone(table);
    case "align":{const[vertical,horizontal]=value.split(":")as["top"|"middle"|"bottom","left"|"center"|"right"];for(const item of cells){item.style.verticalAlign=vertical;item.style.textAlign=horizontal;for(const inner of item.querySelectorAll<HTMLElement>("[style]"))inner.style.textAlign=""}return tableDone(table)}
    case "textDirection":{const next=cycleTextDirection(cell);for(const item of cells)if(item!==cell)setTextDirection(item,next);return tableDone(table)}
    case "cellMargins":dialogTableCtx.current={table,cell,cells};setDialog({kind:"tableOptions",values:tableOptionsValues(table)});return;
    case "sortDialog":dialogTableCtx.current={table,cell,cells};setDialog({kind:"tableSort",columns:grid.cols,headerNames:grid.at[0].map(item=>(item?.cell.textContent??"").trim())});return;
    case "repeatHeader":if(table.dataset.repeatHeader==="true")delete table.dataset.repeatHeader;else table.dataset.repeatHeader="true";setMessage(table.dataset.repeatHeader?"Repeat Header Rows is on: the first row repeats at the top of each page the table continues onto.":"Repeat Header Rows is off.");return tableDone(table);
    case "convertToText":dialogTableCtx.current={table,cell,cells};setDialog({kind:"convertToText"});return;
    case "formula":{dialogTableCtx.current={table,cell,cells};const above=slot.row>0&&grid.at.slice(0,slot.row).some(row=>/\d/.test(row[slot.col]?.cell.textContent??""));setDialog({kind:"tableFormula",initial:above?"=SUM(ABOVE)":"=SUM(LEFT)"});return}
   }
  });
 };
 // The answer of a table dialog (opened above with dialogTableCtx).
 const applyTableOptions=(table:HTMLTableElement,values:TableOptionsValues)=>{setCellMargins(table,{top:values.top,bottom:values.bottom,left:values.left,right:values.right});setCellSpacing(table,values.spacingOn?values.spacing:null);const fixed=table.dataset.tableLayout==="fixed";if(values.autoResize&&fixed)autoFit(table,"auto");if(!values.autoResize&&!fixed)autoFit(table,"fixed")};
 const applyCellOptions=(table:HTMLTableElement,cells:HTMLTableCellElement[],values:CellOptionsValues)=>{for(const item of cells)setCellOptions(item,{margins:values.sameAsTable?null:values.margins,wrapText:values.wrapText,fitText:values.fitText})};
 const EDGE_COMMANDS:Record<BorderEdgeKey,BorderCommand>={top:"top",bottom:"bottom",left:"left",right:"right",insideH:"insideH",insideV:"insideV",diagonalDown:"diagonalDown",diagonalUp:"diagonalUp"};
 const applyBordersShading=(table:HTMLTableElement,cells:HTMLTableCellElement[],values:BordersShadingValues)=>{
  const pen:Pen={style:values.style,width:values.width,color:values.color};setTablePen(pen);
  const all=[...table.querySelectorAll("td,th")]as HTMLTableCellElement[];
  const targets=values.applyTo==="table"?all:cells;
  applyBorders(table,targets,"none",pen);
  for(const edge of Object.keys(EDGE_COMMANDS)as BorderEdgeKey[])if(values.edges[edge])applyBorders(table,targets,EDGE_COMMANDS[edge],values.setting==="grid"&&["top","bottom","left","right"].includes(edge)?{...pen,width:Math.max(pen.width,1.5)}:pen);
  const fill=shadingResultColor(values);for(const item of values.shadingApplyTo==="table"?all:cells)setShading(item,fill);
  const pagePx=Math.max(values.pageStyle==="double"?3:1,Math.round(values.pageWidth*4/3));
  if(editor.current){const css=values.pageSetting==="none"?"":`${pagePx}px ${values.pageStyle} #${values.pageColor}`;if(editor.current.style.border!==css)pageStyle("border",css)}
 };
 // The answer of a table dialog (opened above with dialogTableCtx). keepOpen: a sub-dialog
 // (Table Properties > Options… / Borders and Shading… / Cell Options…) answered over its parent.
 const onTableDialog=(kind:string,result:unknown,keepOpen=false)=>{
  const context=dialogTableCtx.current;
  if(!keepOpen)setDialog(null);
  if(kind==="convertTextToTable"){const{separator,columns,layout}=result as{separator:string;columns:number;layout:string};const paragraphs=convertParagraphs.current.filter(item=>item.isConnected);const table=paragraphsToTable(paragraphs,separator,columns);if(table){autoFit(table,layout as "auto"|"window"|"fixed");if(layout==="window")table.setAttribute("data-table-layout","window");tableDone(table)}return}
  if(!context||!context.table.isConnected)return;
  const{table,cell,cells}=context;
  if(kind==="tableProperties"){const values=result as TablePropertiesValues;const grid=tableGrid(table),slot=slotOf(grid,cell);
   const toCm=(width:number,unit:"cm"|"pct")=>unit==="pct"?r2(tableWidthCm(table)*width/100):width;
   setTableWidth(table,values.widthOn?values.width:null,values.widthUnit);
   setTableAlign(table,values.tableAlign);setTableIndent(table,values.tableAlign==="left"?values.indent:0);setTableAlign(table,values.tableAlign);setTableWrap(table,values.wrap);
   values.rows.forEach((row,r)=>{setRowHeight(table,[r],row.heightOn?row.height:null);setRowHeightRule(table,[r],row.heightOn?row.rule:"atLeast");setRowCanSplit(table,[r],row.canSplit)});
   if(values.repeatHeader)table.dataset.repeatHeader="true";else delete table.dataset.repeatHeader;
   values.columns.forEach((column,c)=>{const current=columnWidths(table)[c]??null;const next=column.widthOn?toCm(column.width,column.unit):null;if(next!==current)setColumnWidth(table,[c],next)});
   if(slot&&values.cellWidthOn){const cols=[...new Set(cells.map(item=>slotOf(grid,item)?.col).filter((c):c is number=>c!==undefined))];setColumnWidth(table,cols.length?cols:[slot.col],toCm(values.cellWidth,values.cellUnit))}
   if(columnWidths(table).every(width=>width===null))table.style.tableLayout="";else table.setAttribute("data-table-layout","fixed");
   for(const item of cells)item.style.verticalAlign=values.cellVAlign;
   setTableAltText(table,values.title,values.description);
   return tableDone(table)}
  if(kind==="tableOptions"){applyTableOptions(table,result as TableOptionsValues);return tableDone(table)}
  if(kind==="cellOptions"){applyCellOptions(table,cells,result as CellOptionsValues);return tableDone(table)}
  if(kind==="splitCells"){const{columns,rows,mergeFirst}=result as{columns:number;rows:number;mergeFirst:boolean};let target=cell;if(mergeFirst&&cells.length>1){const error=mergeCells(table,cells);if(error){setMessage(error);return}target=cells.find(item=>item.isConnected)??cell}const error=splitCell(table,target,columns,rows);if(error)setMessage(error);setCellSelection([]);return tableDone(table)}
  if(kind==="insertCells"){const choice=result as "right"|"down"|"row"|"column";const grid=tableGrid(table),slot=slotOf(grid,cell);if(!slot)return;if(choice==="row"){if(!insertRow(table,slot.row,"above"))setMessage("A table can have at most 50 rows.")}else if(choice==="column"){if(!insertColumn(table,slot.col,"left"))setMessage("A table can have at most 20 columns.")}else{const error=insertCellShift(table,cell,choice);if(error)setMessage(error)}return tableDone(table)}
  if(kind==="tableSort"){const values=result as SortValues;const keys=values.keys.filter((key,i)=>key.column!==null&&(i===0||values.keys[i-1].column!==null)).map(key=>({column:key.column as number,type:key.type,order:key.order}));const error=sortTableBy(table,keys,{hasHeader:values.hasHeader,caseSensitive:values.caseSensitive,columnOnly:values.columnOnly});if(error)setMessage(error);return tableDone(table)}
  if(kind==="convertToText"){tableToParagraphs(table,result as string);setInsideTable(false);setCellSelection([]);return tableDone(null)}
  if(kind==="tableFormula"){const{formula,format}=result as{formula:string;format:string};const answer=evaluateFormula(table,cell,formula);if("error" in answer){setMessage(answer.error);return}cell.textContent=formatFormulaResult(answer.value,format);setMessage(`${formula.toUpperCase()} = ${cell.textContent}`);return tableDone(table)}
  if(kind==="deleteCells"){const choice=result as "left"|"up"|"row"|"column";const grid=tableGrid(table),slot=slotOf(grid,cell);if(!slot)return;if(choice==="row")deleteRow(table,slot.row);else if(choice==="column")deleteColumn(table,slot.col);else{const error=deleteCellShift(table,cell,choice);if(error)setMessage(error)}if(!table.isConnected)setInsideTable(false);return tableDone(table)}
  if(kind==="bordersShading"){applyBordersShading(table,cells,result as BordersShadingValues);return tableDone(table)}
 };
 // Draw Table / Eraser / Border Painter: act on the cell under the mouse.
 const drawStart=useRef<{x:number;y:number;cell:HTMLTableCellElement|null}|null>(null);
 const nearestSide=(cell:HTMLTableCellElement,x:number,y:number):BorderSide=>{const box=cell.getBoundingClientRect();const distances:[BorderSide,number][]=[["top",y-box.top],["bottom",box.bottom-y],["left",x-box.left],["right",box.right-x]];return distances.sort((a,b)=>a[1]-b[1])[0][0]};
 const neighbour=(table:HTMLTableElement,cell:HTMLTableCellElement,side:BorderSide)=>{const grid=tableGrid(table),slot=slotOf(grid,cell);if(!slot)return null;const r=side==="top"?slot.row-1:side==="bottom"?slot.row+slot.rowSpan:slot.row,c=side==="left"?slot.col-1:side==="right"?slot.col+slot.colSpan:slot.col;return grid.at[r]?.[c]?.cell??null};
 const tableModeMouseDown=(event:MouseEvent<HTMLDivElement>)=>{event.preventDefault();const cell=(event.target as Element).closest("td,th")as HTMLTableCellElement|null;drawStart.current={x:event.clientX,y:event.clientY,cell};const table=cell?.closest("table")as HTMLTableElement|null;
  if(tableMode==="erase"&&cell&&table){const other=neighbour(table,cell,nearestSide(cell,event.clientX,event.clientY));if(!other){setMessage("That is the table's outside edge -- there is no cell beyond it to join.");return}const error=mergeCells(table,[cell,other]);if(error)setMessage("This line can't be erased: the two cells don't form a rectangle.");else tableDone(table);drawStart.current=null;return}
  if(tableMode==="sample"&&cell){const side=nearestSide(cell,event.clientX,event.clientY);const key=({top:"borderTop",right:"borderRight",bottom:"borderBottom",left:"borderLeft"}as const)[side];const saved=cell.dataset[key];let pen:Pen;if(saved&&saved!=="none"){const[style,width,color]=saved.split(" ");pen={style:style as Pen["style"],width:Number(width),color}}else{const css=getComputedStyle(cell);const prop=({top:"Top",right:"Right",bottom:"Bottom",left:"Left"}as const)[side];const px=Number.parseFloat(css.getPropertyValue(`border-${side}-width`))||1;const style=css.getPropertyValue(`border-${side}-style`);const rgb=css.getPropertyValue(`border-${side}-color`).match(/\d+/g)?.slice(0,3).map(Number)??[0,0,0];void prop;pen={style:(["double","dotted","dashed"].includes(style)?style:"solid")as Pen["style"],width:BORDER_WIDTHS.reduce((best,w)=>Math.abs(w*4/3-px)<Math.abs(best*4/3-px)?w:best,0.5),color:rgb.map(v=>v.toString(16).padStart(2,"0")).join("").toUpperCase()}}setTablePen(pen);setTableMode("paint");setMessage("Border style picked up. Border Painter is on: click cell edges to apply it. Press Esc to stop.");drawStart.current=null;return}
  if(tableMode==="paint"&&cell&&table){const side=nearestSide(cell,event.clientX,event.clientY);const value=penValue(tablePen);setCellBorder(cell,side,value);const other=neighbour(table,cell,side);if(other)setCellBorder(other,({top:"bottom",bottom:"top",left:"right",right:"left"}as const)[side],value);tableDone(table);drawStart.current=null}};
 const tableModeMouseUp=(event:MouseEvent<HTMLDivElement>)=>{const start=drawStart.current;drawStart.current=null;if(tableMode!=="draw"||!start)return;const dx=event.clientX-start.x,dy=event.clientY-start.y;if(Math.hypot(dx,dy)<12)return;
  if(start.cell){const table=start.cell.closest("table")as HTMLTableElement;const error=Math.abs(dx)>=Math.abs(dy)?splitCell(table,start.cell,1,(start.cell.rowSpan||1)+1):splitCell(table,start.cell,(start.cell.colSpan||1)+1,1);if(error)setMessage(error);else tableDone(table);return}
  const rows=Math.max(1,Math.min(10,Math.round(Math.abs(dy)/28))),cols=Math.max(1,Math.min(8,Math.round(Math.abs(dx)/90)));const under=document.elementFromPoint(start.x,start.y);let block:Element|null=under&&editor.current?.contains(under)&&under!==editor.current?under:null;while(block&&block.parentElement!==editor.current)block=block.parentElement;insertTableWithSize(rows,cols,"fixed",block??editor.current?.lastElementChild??null);setMessage(`Drew a ${cols} × ${rows} table. Drag inside its cells to split them further.`)};
 useEffect(()=>{if(tableMode==="off")return;const key=(event:globalThis.KeyboardEvent)=>{if(event.key==="Escape"){setTableMode("off");setMessage("")}};document.addEventListener("keydown",key);return()=>document.removeEventListener("keydown",key)},[tableMode]);
 const tableToolsTabs=insideTable&&!submitted?[{id:"table-design",label:"Design",contextLabel:"Table Tools",groups:<TableDesignGroups key={tableRev} state={tableToolsState()} on={onTableTool}/>},{id:"table-layout",label:"Layout",contextLabel:"Table Tools",groups:<TableLayoutGroups key={tableRev} state={tableToolsState()} on={onTableTool}/>}]:[];
 const insertSymbol=(value:string)=>{setDialog(null);if(value)rememberSymbol(value);if(value)insertField(`<span data-field="symbol">${escapeHtml(value)}</span>`)};
 const applyPageNumber=(position:string,alignment:string,style:string,format:string,startAt:string)=>{setDialog(null);insertSafe(`<span data-field="page-number|${position}|${alignment}" class="rounded border border-dashed border-cyan-500 bg-cyan-50 px-1 text-xs font-bold text-cyan-800" contenteditable="false">${escapeHtml(pageNumberText(style,format,startAt))}</span>`)};
 const removePageNumbers=()=>{setDialog(null);if(!editor.current)return;const fields=[...editor.current.querySelectorAll('[data-field^="page-number"]')];if(!fields.length){setMessage("This document has no page numbers.");return}for(const field of fields)field.remove();changed();setMessage(`Removed ${fields.length} page number${fields.length===1?"":"s"}.`)};
 // Insert > Page Number: Top/Bottom of Page put the number in the header/footer
 // (replacing what was there, as Word does); Current Position puts it at the cursor.
 const pageNumberFormat=useRef<PageNumberFormatValues>({format:"1",includeChapter:false,continueNumbering:true,startAt:1});
 const pageNumberValue=()=>formatPageNumber(pageNumberFormat.current.continueNumbering?1:pageNumberFormat.current.startAt,pageNumberFormat.current.format);
 const pageNumberSpan=(position:string,design:{style:string;alignment:string})=>`<span data-field="page-number|${position}|${design.alignment}" data-number-style="${design.style}" class="rounded border border-dashed border-cyan-500 bg-cyan-50 px-1 text-xs font-bold text-cyan-800" contenteditable="false">${escapeHtml(pageNumberLabel(design.style,pageNumberValue()))}</span>`;
 const placePageNumber=(where:string,designId:string)=>{
  const design=(PAGE_NUMBER_GALLERIES as Record<string,{id:string;style:string;alignment:string}[]>)[where]?.find(item=>item.id===designId);
  if(!design||!editor.current)return;
  if(where==="current"){insertField(pageNumberSpan("current",design));return}
  const which=where==="bottom"?"footer":"header";
  const html=pageNumberSpan(where==="bottom"?"bottom":"top",design);
  let element=editor.current.querySelector(which)as HTMLElement|null;
  if(element)element.innerHTML=html;else element=insertHeaderFooter(which,html);
  if(element)element.style.textAlign=design.alignment;
  changed();
  focusHeaderFooter(which);
 };
 const applyPageNumberFormat=(values:PageNumberFormatValues)=>{
  setDialog(null);
  pageNumberFormat.current=values;
  const fields=[...(editor.current?.querySelectorAll<HTMLElement>('[data-field^="page-number"]')??[])];
  for(const field of fields){const text=field.textContent??"";const style=field.dataset.numberStyle??(/of/.test(text)?"pageOfX":/^Page/.test(text)?"pageX":/\|/.test(text)?"accentBar":"plain");field.textContent=pageNumberLabel(style,pageNumberValue())}
  if(fields.length)changed();
 };
 const headerFooterMenu=(which:"header"|"footer",value:string)=>{
  if(value==="edit"){editHeaderFooter(which);return}
  if(value==="remove"){if(!editor.current?.querySelector(which)){setMessage(`This document has no ${which}.`);return}removeHeaderFooter(which);return}
  if(value==="save"){saveCustomHeaderFooterStyle(which);return}
  const[kind,index]=value.split(":");
  const list=kind==="custom"?loadCustomHeaderFooterStyles(which).map(item=>item.html):(which==="header"?HEADER_STYLES:FOOTER_STYLES).map(item=>item.html);
  const html=list[Number(index)];
  if(html!==undefined)applyHeaderFooterStyle(which,html);
 };
 const insertQuickTable=(id:string)=>{
  const table=QUICK_TABLES.find(item=>item.id===id);
  if(!table)return;
  const rows=table.rows.map((row,index)=>`<tr>${row.map(cell=>`<td class="border p-2">${cell?index===0?`<strong>${escapeHtml(cell)}</strong>`:escapeHtml(cell):"<br>"}</td>`).join("")}</tr>`).join("");
  insertSafe(`<table data-block-type="table" data-table-layout="window" class="my-3 border-collapse" style="table-layout:auto;width:100%;"><tbody>${rows}</tbody></table>`);
 };
 const insertDateTime=(text:string)=>{setDialog(null);if(text)insertField(`<span data-field="date-time">${escapeHtml(text)}</span>`)};
 // Real Word applies Drop Cap to the current paragraph's first character --
 // no explicit drag-selection is required, matching the annotation that it
 // should work as soon as the cursor is anywhere in a paragraph with text.
 // selectedBlocks() already resolves a collapsed cursor to its containing
 // block (same mechanism the Paragraph dialog relies on), so this needs no
 // separate "is there a selection" check the old implementation had.
 const dropCapParagraph=()=>selectedBlocks().find(block=>block.tagName==="P")??null;
 const applyDropCap=(mode:string,fontFamily:string,lines:string,distance:string)=>{
  setDialog(null);
  const block=dropCapParagraph();
  if(!block){setMessage("Place the cursor in a paragraph with text to apply Drop Cap.");return}
  const existing=block.querySelector('[data-drop-cap="true"]')as HTMLElement|null;
  if(existing){const text=document.createTextNode(existing.textContent??"");existing.replaceWith(text);block.normalize()}
  if(mode==="none"){delete block.dataset.dropCapLines;delete block.dataset.dropCapDistance;delete block.dataset.dropCapMargin;changed();return}
  const first=textNodes(block)[0];
  if(!first||!(first.textContent??"").trim()){setMessage("Place the cursor in a paragraph with text to apply Drop Cap.");return}
  const characters=[...(first.textContent as string)],character=characters[0],rest=characters.slice(1).join("");
  const linesValue=bounded(lines,1,10),distanceValue=Math.max(0,Math.min(2,Number(distance)||0));
  const cap=document.createElement("span");
  cap.dataset.dropCap="true";
  if(fontFamily&&(APPROVED_WORD_FONTS as readonly string[]).includes(fontFamily))cap.style.fontFamily=fontFamily;
  cap.style.float="left";cap.style.lineHeight=".8";cap.style.fontSize=`${linesValue}em`;cap.style.marginRight=`${distanceValue}in`;
  if(mode==="margin"){cap.dataset.dropCapMargin="true";cap.style.marginLeft=`-${linesValue*0.5+distanceValue}in`}
  cap.textContent=character;
  if(rest)first.textContent=rest;else(first as ChildNode).remove();
  block.insertBefore(cap,block.firstChild);
  block.dataset.dropCapLines=String(linesValue);
  block.dataset.dropCapDistance=String(distanceValue);
  if(mode==="margin")block.dataset.dropCapMargin="true";else delete block.dataset.dropCapMargin;
  changed();
 };
 // Real Word: while editing a header/footer, the document body dims (unless
 // "Show Document Text" is unchecked to keep it) and Header/Footer Tools >
 // Design appears -- the closest equivalent our continuous-scroll editor can
 // genuinely support, since we don't model real page-by-page pagination.
 useEffect(()=>{if(!editor.current)return;const dim=Boolean(insideHeaderFooter)&&!showDocumentText;for(const child of[...editor.current.children])if(child.tagName!=="HEADER"&&child.tagName!=="FOOTER")(child as HTMLElement).style.opacity=dim?"0.35":""},[insideHeaderFooter,showDocumentText]);
 const focusHeaderFooter=(which:"header"|"footer",element?:HTMLElement|null)=>{
  const target=element??(editor.current?.querySelector(which)as HTMLElement|null);
  if(!target)return;
  target.scrollIntoView({block:"center",behavior:"smooth"});
  target.focus();
  const range=document.createRange();range.selectNodeContents(target);range.collapse(false);
  const selection=getSelection();selection?.removeAllRanges();selection?.addRange(range);
  savedRange.current=range;
  setInsideHeaderFooter(which);
 };
 // Real Word always puts the header at the very top of the page and the
 // footer at the very bottom, regardless of where the cursor happened to
 // be -- inserting via the cursor-based insertSafe (like every other
 // Insert-tab command) would drop it wherever the user last clicked in the
 // body. Prepending/appending directly as a real DOM sibling of the other
 // blocks is what actually pushes the body content down/up around it,
 // since they're all just stacked block elements in normal flow -- no
 // extra layout math needed.
 const insertHeaderFooter=(which:"header"|"footer",innerHtml:string)=>{
  if(!editor.current)return null;
  const wrapperClass=which==="header"?"mb-3 border-b-2 border-dashed border-cyan-500 pb-2":"mt-3 border-t-2 border-dashed border-cyan-500 pt-2";
  const element=document.createElement(which);
  element.dataset.blockType=which;
  element.className=wrapperClass;
  element.innerHTML=innerHtml;
  if(which==="header")editor.current.prepend(element);else editor.current.append(element);
  return element;
 };
 // A truly empty element (no text node, no innerHTML at all) is what makes
 // the CSS-only "Header"/"Footer" ghost placeholder in globals.css show up
 // -- it's rendered via :empty::before, so it's never real saved content,
 // unlike the "[Type text]" placeholder the built-in gallery styles insert.
 const editHeaderFooter=(which:"header"|"footer")=>{
  setDialog(null);
  if(!editor.current)return;
  let element=editor.current.querySelector(which)as HTMLElement|null;
  if(!element){element=insertHeaderFooter(which,"");changed()}
  focusHeaderFooter(which,element);
 };
 const applyHeaderFooterStyle=(which:"header"|"footer",innerHtml:string)=>{
  if(!editor.current)return;
  const existing=editor.current.querySelector(which)as HTMLElement|null;
  if(existing)existing.innerHTML=innerHtml;else insertHeaderFooter(which,innerHtml);
  changed();
  setDialog(null);
  focusHeaderFooter(which);
 };
 const removeHeaderFooter=(which:"header"|"footer")=>{setDialog(null);const element=editor.current?.querySelector(which);if(element){element.remove();changed();setMessage(`${which==="header"?"Header":"Footer"} removed.`);if(insideHeaderFooter===which)setInsideHeaderFooter(null)}};
 const saveCustomHeaderFooterStyle=(which:"header"|"footer")=>{
  const element=editor.current?.querySelector(which)as HTMLElement|null;
  if(!element){setMessage(`Add a ${which} first.`);return}
  const name=promptValue(`Save this ${which} to the gallery as:`,"");
  if(!name)return;
  const list=loadCustomHeaderFooterStyles(which).filter(item=>item.name!==name);
  list.unshift({name:name.slice(0,60),preview:(element.textContent??"").slice(0,120),html:element.innerHTML.slice(0,5000)});
  try{localStorage.setItem(CUSTOM_HEADER_FOOTER_KEY[which],JSON.stringify(list.slice(0,20)))}catch{}
  setMessage(`Saved "${name}" to the ${which} gallery.`);
  setDialog(null);
 };
 const adjustHeaderFooterOffset=(which:"header"|"footer",value:string)=>{const element=editor.current?.querySelector(which)as HTMLElement|null;if(!element)return;const amount=bounded(value,0,10);element.style[which==="header"?"marginTop":"marginBottom"]=`${amount}in`;changed()};
 const closeHeaderFooter=()=>{
  if(!editor.current)return;
  editor.current.focus();
  const body=[...editor.current.children].find(child=>child.tagName!=="HEADER"&&child.tagName!=="FOOTER")as HTMLElement|undefined;
  if(body){const range=document.createRange();range.selectNodeContents(body);range.collapse(true);const selection=getSelection();selection?.removeAllRanges();selection?.addRange(range);savedRange.current=range}
  setInsideHeaderFooter(null);
  setMessage("Header and footer closed.");
 };
 const applyFontDialog=(values:{bold:boolean;italic:boolean;fontFamily:string;fontSize:string;color:string;underlineStyle:string;underlineColor:string;strike:boolean;doubleStrike:boolean;superscript:boolean;subscript:boolean;smallCaps:boolean;allCaps:boolean;hidden:boolean;outline:boolean;emboss:boolean;charScale:string;charSpacing:string;charPosition:string;kerningEnabled:boolean;kerningMin:string})=>{
  // Word applies only what was changed in the dialog: the font, size and colour
  // shown are just the first character's, and re-applying them restyled text
  // (e.g. turned a paragraph into Segoe UI) the student never meant to change.
  const initial=dialog?.kind==="font"?dialog:null;
  if(initial){if(values.fontFamily===initial.fontFamily)values={...values,fontFamily:""};if(values.fontSize===initial.fontSize)values={...values,fontSize:""};if(values.color===initial.color&&!values.outline&&!values.emboss)values={...values,color:""}}
  restoreSelection();const selection=getSelection();if(!selection?.rangeCount){setDialog(null);return}
  // With just a cursor (no selection) Word formats the word the cursor is in;
  // this used to silently do nothing, so the change seemed applied but wasn't.
  if(selection.isCollapsed){const word=wordRangeAt(selection.getRangeAt(0));if(!word){setDialog(null);setMessage("Select the text you want to format first.");return}selection.removeAllRanges();selection.addRange(word)}
  const size=Number(values.fontSize);
  const scale=bounded(values.charScale,1,600),spacing=bounded(values.charSpacing,-100,100),position=bounded(values.charPosition,-100,100),kerningMin=bounded(values.kerningMin,0,72);
  // Real Word: Outline hollows the glyph out entirely (fill becomes
  // transparent, only the stroke -- in the font's own color -- remains
  // visible), regardless of whatever font color was also chosen. Emboss
  // gives a stamped/raised look via a light+dark offset shadow pair and
  // mutes the fill to a mid-gray, since a strong fill color would drown
  // the shadow out. Both are genuine CSS effects, not placeholders.
  const wrapped=wrapEditorRange(selection.getRangeAt(0),{fontWeight:values.bold?"700":"400",fontStyle:values.italic?"italic":"normal",fontFamily:values.fontFamily||undefined,fontSize:Number.isFinite(size)&&size>0?`${size}pt`:undefined,color:values.outline?"transparent":values.emboss?"#808080":values.color||undefined,webkitTextStroke:values.outline?`1px ${values.color||"#000000"}`:undefined,textShadow:values.emboss?"1px 1px 0 rgba(255,255,255,.85),-1px -1px 0 rgba(0,0,0,.55)":undefined,textDecorationLine:values.underlineStyle!=="none"?"underline":"none",textDecorationStyle:values.underlineStyle==="none"?"solid":underlineCssStyle(values.underlineStyle),textDecorationColor:values.underlineStyle!=="none"&&values.underlineColor?values.underlineColor:undefined,verticalAlign:values.superscript?"super":values.subscript?"sub":undefined,fontVariant:values.smallCaps?"small-caps":undefined,textTransform:values.allCaps?"uppercase":undefined,opacity:values.hidden?"0.4":undefined,...(scale!==100?{display:"inline-block",transform:`scaleX(${scale/100})`,transformOrigin:"left"}:{}),...(spacing!==0?{letterSpacing:`${spacing}pt`}:{}),...(position!==0?{position:"relative",top:`${-position}pt`}:{}),fontKerning:values.kerningEnabled?"normal":undefined},{...(values.doubleStrike?{doubleStrike:"true"}:{}),...(values.smallCaps?{smallCaps:"true"}:{}),...(values.allCaps?{allCaps:"true"}:{}),...(values.hidden?{hidden:"true"}:{}),...(values.outline?{outline:"true"}:{}),...(values.emboss?{emboss:"true"}:{}),...(values.underlineStyle!=="none"?{underlineStyle:values.underlineStyle}:{}),...(values.underlineStyle!=="none"&&values.underlineColor?{underlineColor:values.underlineColor.replace("#","")}:{}),...(scale!==100?{charScale:String(scale)}:{}),...(spacing!==0?{charSpacing:String(spacing)}:{}),...(position!==0?{charPosition:String(position)}:{}),...(values.kerningEnabled?{kerningEnabled:"true",kerningMin:String(kerningMin)}:{})});
  if(wrapped){
   for(const target of wrapped.spans){
   clearInnerRunStyles(target,["fontWeight","fontStyle",...(values.fontFamily?["fontFamily"]:[]),...(Number.isFinite(size)&&size>0?["fontSize"]:[]),...(values.color||values.outline||values.emboss?["color"]:[]),...(spacing!==0?["letterSpacing"]:[])],{unwrapBold:!values.bold,unwrapItalic:!values.italic});
   // The strikethrough gets its own inner span: one shared text-decoration
   // drew a double strikethrough in the underline's colour and turned a
   // Dot-dot-dash underline into a double line (CSS has one style and one
   // colour per element). Word draws strikethrough in the font colour.
   if(values.strike||values.doubleStrike){const strike=document.createElement("span");strike.style.textDecorationLine="line-through";strike.style.textDecorationStyle=values.doubleStrike?"double":"solid";strike.style.textDecorationColor="currentColor";strike.append(...target.childNodes);target.append(strike)}
      }
savedRange.current=wrapped.range;changed();
  }
  setDialog(null);
 };
 const applyParagraphDialog=(values:{alignment:string;marginLeft:string;marginRight:string;specialIndentMode:string;specialIndentAmount:string;spaceBefore:string;spaceAfter:string;lineSpacing:string;hyphens:boolean;lineNumbers:boolean})=>{
  const blocks=selectedBlocks();
  if(!blocks.length){setDialog(null);return}
  const left=bounded(values.marginLeft,0,10),right=bounded(values.marginRight,0,10),before=bounded(values.spaceBefore,0,500),after=bounded(values.spaceAfter,0,500),indentAmount=bounded(values.specialIndentAmount,0,10);
  // Like Word, only what was changed in the dialog is applied. Re-applying
  // every box set settings nobody touched (a bulleted paragraph picked up
  // 1.5 line spacing just from setting its spacing after).
  const initial=dialog?.kind==="paragraph"?dialog:null;
  const changedField=(key:keyof typeof values)=>!initial||values[key]!==initial[key];
  for(const block of blocks){
   if(changedField("alignment"))block.style.textAlign=values.alignment;
   if(changedField("marginLeft"))block.style.marginLeft=`${left}in`;
   if(changedField("marginRight"))block.style.marginRight=`${right}in`;
   if(changedField("spaceBefore"))block.style.marginTop=`${before}pt`;
   if(changedField("spaceAfter"))block.style.marginBottom=`${after}pt`;
   if(changedField("lineSpacing"))block.style.lineHeight=values.lineSpacing;
   if(changedField("specialIndentMode")||changedField("specialIndentAmount")){
    if(values.specialIndentMode==="none"){delete block.dataset.specialIndentMode;delete block.dataset.specialIndentAmount;block.style.textIndent=""}
    else{block.dataset.specialIndentMode=values.specialIndentMode;block.dataset.specialIndentAmount=`${indentAmount}in`;block.style.textIndent=values.specialIndentMode==="hanging"?`-${indentAmount}in`:`${indentAmount}in`}
   }
   if(changedField("hyphens"))block.style.hyphens=values.hyphens?"auto":"";
   if(changedField("lineNumbers"))block.classList.toggle("editor-line-numbers",values.lineNumbers);
  }
  setDialog(null);
  changed();
 };
 // Margins are kept in data-margins (what is saved and graded); the page's real padding adds the
 // gutter (Page Setup > Gutter) on its side, so a margin answer is the same with or without one.
 const setPageMargins=(margins:MarginsCm,gutter?:{cm:number;position:"left"|"top"})=>{const page=editor.current;if(!page)return;const g=gutter??{cm:Number(page.dataset.gutter??0)/10,position:(page.dataset.gutterPosition==="top"?"top":"left")as "left"|"top"};const clamp=(value:number)=>Math.min(9.99,Math.max(0,value));const m={top:clamp(margins.top),bottom:clamp(margins.bottom),left:clamp(margins.left),right:clamp(margins.right)};page.dataset.margins=paddingText(m);if(g.cm>0){page.dataset.gutter=String(Math.round(g.cm*1000)/100);page.dataset.gutterPosition=g.position}else{delete page.dataset.gutter;delete page.dataset.gutterPosition}page.style.padding=g.cm>0?renderedPadding(m,g.cm,g.position):paddingText(m);changed()};
 const currentMargins=():MarginsCm=>parsePadding(editor.current?.dataset.margins||editor.current?.style.padding)??{top:2,right:2,bottom:2,left:2};
 const applyMargins=(top:string,right:string,bottom:string,left:string)=>{const cm=(value:string,fallback:number)=>{const number=Number.parseFloat(value);return Number.isFinite(number)?number/10:fallback};setDialog(null);setPageMargins({top:cm(top,2),right:cm(right,2),bottom:cm(bottom,2),left:cm(left,2)})};
 const applyWatermark=(text:string)=>{setDialog(null);editor.current?.setAttribute("data-watermark",text.slice(0,40));changed()};
 const applyPageColor=(value:string)=>{setDialog(null);if(/^#[0-9a-f]{6}$/i.test(value))pageStyle("backgroundColor",value)};
 const applyColumns=(value:string)=>{setDialog(null);pageStyle("columnCount",String(bounded(value,1,6)))};
 const applyPageSize=(value:string)=>{setDialog(null);const width=PAGE_SIZE_WIDTHS[value.toLowerCase()];if(width)pageStyle("maxWidth",`${width}px`)};
 const applyZoom=(value:string)=>{setDialog(null);setView(v=>({...v,zoom:bounded(value,10,500)}))};
 const applySort=(value:string)=>{setDialog(null);if(!editor.current)return;sortSelectedBlocks(editor.current,selectedBlocks(),value==="Descending"?"desc":"asc");changed()};
 const applyListStyle=(kind:"ul"|"ol",value:string)=>{
  restoreSelection();
  const blocks=selectedBlocks();
  const ids=blocks.map(block=>block.id).filter(Boolean);
  const findList=(block:HTMLElement)=>(block.matches(kind)?block:null)??(block.querySelector(kind)as HTMLElement|null)??(block.closest(kind)as HTMLElement|null);
  const inList=blocks.some(block=>findList(block));
  if(value==="none"){if(inList)exec(kind==="ul"?"insertUnorderedList":"insertOrderedList");return}
  if(!inList)exec(kind==="ul"?"insertUnorderedList":"insertOrderedList");
  const lists=new Set<HTMLElement>();
  for(const id of ids){const block=editor.current?.querySelector<HTMLElement>(`#${CSS.escape(id)}`);const list=block&&findList(block);if(list)lists.add(list)}
  const selectionList=getSelection()?.anchorNode?.parentElement?.closest(kind)as HTMLElement|null;
  if(selectionList)lists.add(selectionList);
  if(lists.size){
   for(const list of lists){
    // execCommand sometimes nests the new <ul>/<ol> inside the original block wrapper
    // instead of replacing it, which the save model can't see (only top-level <li>/<ul>/<ol>
    // editor children round-trip as list-item blocks) -- hoist it back out when that happens.
    let hoisted=list;
    while(hoisted.parentElement&&hoisted.parentElement!==editor.current)hoisted=hoisted.parentElement;
    if(hoisted!==list&&editor.current?.contains(hoisted))hoisted.replaceWith(list);
    list.dataset.listStyle=value;for(const item of list.children)(item as HTMLElement).dataset.listStyle=value;
   }
   changed();
  }
 };
 const onValueCommand=(id:string,value:string)=>{
  const capabilityId=({lineSpacingAction:"lineSpacing",dropCapAction:"dropCap",marginsAction:"margins",pageSizeAction:"pageSize",columnsAction:"columns"}as Record<string,string>)[id]??id;
  if(submitted||!isWordCommandEnabled(capabilities,capabilityId))return;
  if(editor.current){const used=new Set((editor.current.dataset.operations??"").split(",").filter(Boolean));used.add(capabilityId);editor.current.dataset.operations=[...used].slice(0,256).join(",")}
  if(id==="insertTable"){const grid=/^grid:(\d+)x(\d+)$/.exec(value);if(grid)insertTableWithSize(Number(grid[1]),Number(grid[2]));else if(value==="dialog")setDialog({kind:"insertTableCustom"});else if(value==="draw"){setTableMode("draw");setMessage("Draw Table: drag on the page to draw a table, or drag inside a cell to split it. Press Esc to stop.")}else if(value==="convert"){const paragraphs=selectedBlocks().filter(block=>block.tagName==="P"||block.tagName==="LI");if(!paragraphs.length){setMessage("Select the paragraphs to convert first (text separated by tabs or commas).");return}convertParagraphs.current=paragraphs;setDialog({kind:"convertTextToTable",rows:paragraphs.length,texts:paragraphs.map(block=>block.textContent??"")})}else if(value==="excel"){insertTableWithSize(5,4,"fixed");setTimeout(()=>{const tables=[...(editor.current?.querySelectorAll("table")??[])]as HTMLTableElement[];const table=tables.find(item=>!item.dataset.tableStyle&&[...item.rows].every(row=>[...row.cells].every(cell=>(cell.textContent??"")==="Cell")));if(table){setTableStyle(table,"grid-1-light");setStyleOption(table,"firstColumn",false);setStyleOption(table,"bandedRows",false);[...table.rows][0].querySelectorAll("td").forEach((cell,index)=>{cell.textContent=String.fromCharCode(65+index)});for(const row of [...table.rows].slice(1))for(const cell of row.cells)cell.replaceChildren(document.createElement("br"));tableDone(table)}setMessage("Excel Spreadsheet: inserted as a spreadsheet-style table (columns A–D). Use Layout > Formula for =SUM(ABOVE) and other totals.")},0)}else if(value.startsWith("quick:"))insertQuickTable(value.slice(6));return}
  if(id==="header"||id==="footer"){headerFooterMenu(id,value);return}
  if(id==="pageNumber"){if(value==="format")setDialog({kind:"pageNumberFormat",...pageNumberFormat.current});else if(value==="remove")removePageNumbers();else{const[where,design]=value.split(":");placePageNumber(where,design)}return}
  if(id==="symbol"){if(value==="more")setDialog({kind:"symbol"});else if(value.startsWith("char:"))insertSymbol(value.slice(5));return}
 if(id==="changeCase"){restoreSelection();const selection=getSelection();if(selection?.rangeCount){const range=changeEditorRangeCase(selection.getRangeAt(0),value as "upper"|"lower"|"title"|"sentence"|"toggle");if(range){savedRange.current=range;changed()}}return}
  if(id==="bullets"){applyListStyle("ul",value);return}
  if(id==="numbering"){applyListStyle("ol",value);return}
  if(id==="multilevelList"){applyListStyle("ol",value);return}
  if(id==="lineSpacing"){const blocks=selectedBlocks();for(const block of blocks)block.style.lineHeight=value;if(blocks.length)changed();return}
  if(id==="lineSpacingAction"){if(value==="options"){setDialog({kind:"lineSpacingOptions",before:"0",after:"8",specialIndentMode:"none",specialIndentAmount:"0.5"});return}const blocks=selectedBlocks();for(const block of blocks)block.style[value==="add-space-before"?"marginTop":"marginBottom"]=value==="add-space-before"?"12pt":"0pt";if(blocks.length)changed();return}
  if(id==="borders"){if(value==="horizontal-line"){insertSafe('<hr data-block-type="horizontal-rule">');return}const blocks=selectedBlocks();for(const block of blocks){applyBorderStyle(block,value);if(value==="none")delete block.dataset.borderKind;else block.dataset.borderKind=value}if(blocks.length)changed();return}
  if(id==="dropCap"){applyDropCap(value,"","3","0");return}
  if(id==="dropCapAction"){if(value==="options"){const block=dropCapParagraph();const existing=block?.querySelector('[data-drop-cap="true"]')as HTMLElement|null;setDialog({kind:"dropCapOptions",position:block?.dataset.dropCapMargin==="true"?"margin":existing?"dropped":"none",fontFamily:existing?.style.fontFamily?approvedFont(existing.style.fontFamily)??"":"",lines:block?.dataset.dropCapLines??"3",distance:block?.dataset.dropCapDistance??"0"})}return}
  if(id==="margins"){const preset=MARGIN_PRESET_VALUES[value];if(preset)applyMargins(...preset);return}
  if(id==="marginsAction"){if(value==="custom")openPageSetup("margins");return}
  if(id==="orientation"){setDialog(null);pageStyle("aspectRatio",value==="landscape"?"1.414 / 1":"1 / 1.414");return}
  if(id==="pageSize"){const width=PAGE_SIZE_WIDTHS[value];if(width){setDialog(null);pageStyle("maxWidth",`${width}px`)}return}
  if(id==="pageSizeAction"){if(value==="custom")setDialog({kind:"pageSize",value:"A4"});return}
  if(id==="columns"){setDialog(null);pageStyle("columnCount",value);return}
  if(id==="columnsAction"){if(value==="custom")setDialog({kind:"columns",value:editor.current?.style.columnCount||"1"});return}
 };
 // Real Word scales a freshly inserted picture down to a reasonable default
 // size instead of stretching it to the page width -- a phone photo (often
 // several thousand pixels wide) inserted with only max-width:100% filled
 // almost the entire page. Capping both dimensions (not just width) keeps
 // the aspect ratio, still never upscales a genuinely small image past its
 // natural size, and matches Word's own default insert size closely enough
 // (roughly 3.3in at 96dpi) to no longer dominate the page.
 const uploadImage=(file:File|null)=>{if(!file)return;if(!["image/png","image/jpeg","image/webp","image/gif"].includes(file.type)||file.size>512*1024){setMessage("Use a PNG, JPEG, WebP, or GIF image no larger than 512 KB.");return}const reader=new FileReader();reader.onload=()=>{const src=String(reader.result);if(/^data:image\/(?:png|jpeg|webp|gif);base64,/i.test(src))insertSafe(`<figure data-block-type="image"><img src="${src}" alt="Inserted picture" style="max-width:320px;max-height:320px;width:auto;height:auto"><figcaption>Inserted picture</figcaption></figure>`)};reader.readAsDataURL(file)};
 // finalSubmitting drives a full-screen overlay below -- without it, the
 // ONLY feedback during this await was the small "Autosave: Submitting…"
 // line in the footer status bar, easy to miss entirely under exam
 // pressure. Reported live: when the underlying save is slow (this same
 // network round trip, subject to the same Supabase-latency swings
 // documented in recordManagedAttempt), a student staring at an
 // unchanged document with no obvious "this is working" signal
 // reasonably concludes the page has frozen. The overlay doesn't make
 // the network call any faster, but it makes the wait unmistakable and
 // reassuring instead of ambiguous.
 // Final submit. Manual submit asks first with an in-page dialog (not the browser's confirm()),
 // and every failure is shown in an in-page message. When the exam clock runs out `autoSubmit`
 // flips to true and the test is submitted without any button press (see the effect below).
 const[confirmSubmitOpen,setConfirmSubmitOpen]=useState(false),[submitProblem,setSubmitProblem]=useState<string|null>(null),submitting=useRef(false);
 const submitNow=async(auto=false):Promise<boolean>=>{
  if(!editor.current||submitting.current)return false;
  submitting.current=true;
  if(autosaveTimer.current){clearTimeout(autosaveTimer.current);autosaveTimer.current=null}
  setStatus(oneTimeSubmit?"Submitting…":"Saving…");if(oneTimeSubmit)setFinalSubmitting(true);
  const fail=(message:string)=>{setStatus(message);setFinalSubmitting(false);submitting.current=false;if(!auto)setSubmitProblem(message);return false};
  try{
   const snapshot=toSnapshot(editor.current);const result=await(submitAction??submitWordDocument)(attemptId,snapshot);
   if(!result.ok){
    // Already finalised (e.g. the automatic submit won the race): just go to the result.
    if(oneTimeSubmit&&/already submitted/i.test(result.error)){setSubmitted(true);router.push(`/typing/word-efficiency/results/${attemptId}`);return true}
    return fail(result.error)
   }
   onSaved?.(snapshot);
   if(oneTimeSubmit){setSubmitted(true);setStatus("Test submitted successfully");router.push(`/typing/word-efficiency/results/${attemptId}`)}else{lastAutosave.current=snapshot;setStatus("Saved");submitting.current=false}
   return true
  }catch(error){
   if(isStaleServerActionError(error)){setStaleDeploy(true);return fail("A newer version of this page was published. Refresh the page, then submit again -- nothing was lost.")}
   return fail(process.env.NODE_ENV==="development"&&error instanceof Error?`Submission failed: ${error.message}`:"Submission failed. Check your internet connection and try again.")
  }
 };
 const submit=()=>{if(!editor.current||submitted)return;if(submitConfirmMessage)setConfirmSubmitOpen(true);else void submitNow(false)};
 useEffect(()=>{
  if(!autoSubmit||mode!=="attempt"||submitted)return;
  let cancelled=false;
  const sleep=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
  void(async()=>{
   // Wait a moment so the saved document has been drawn into the editor before it is read.
   await sleep(1200);
   for(let attempt=0;attempt<6&&!cancelled;attempt++){if(await submitNow(true)||submittedRef.current)return;await sleep(2500)}
   if(!cancelled)setSubmitProblem("Time is up, but your test could not be submitted automatically. Check your internet connection, then press Submit.");
  })();
  return()=>{cancelled=true};
 },[autoSubmit]); // eslint-disable-line react-hooks/exhaustive-deps -- runs once when the clock expires
 const hfKind=insideHeaderFooter;
 const headerFooterToolsGroups=hfKind?<>
  <section className="word-ribbon-group" data-ribbon-group="hfHeaderFooter">
   <div className="word-ribbon-options flex flex-wrap gap-1">
    <button type="button" className="word-ribbon-tool" onMouseDown={event=>event.preventDefault()} onClick={()=>run("header")}>Header ▾</button>
    <button type="button" className="word-ribbon-tool" onMouseDown={event=>event.preventDefault()} onClick={()=>run("footer")}>Footer ▾</button>
    <button type="button" className="word-ribbon-tool" onMouseDown={event=>event.preventDefault()} onClick={()=>run("pageNumber")}>Page Number ▾</button>
   </div>
   <span className="word-ribbon-group-name">Header &amp; Footer</span>
  </section>
  <section className="word-ribbon-group" data-ribbon-group="hfInsert">
   <div className="word-ribbon-options flex flex-wrap gap-1">
    <button type="button" className="word-ribbon-tool" onMouseDown={event=>event.preventDefault()} onClick={()=>run("dateTime")}>Date &amp; Time</button>
    <button type="button" className="word-ribbon-tool" disabled title="Reusable content blocks (Quick Parts) aren't modeled in this exam tool." onMouseDown={event=>event.preventDefault()}>Quick Parts ▾</button>
    <button type="button" className="word-ribbon-tool" onMouseDown={event=>event.preventDefault()} onClick={()=>run("insertPicture")}>Picture</button>
    <button type="button" className="word-ribbon-tool" disabled title="Clip art isn't available in this exam tool." onMouseDown={event=>event.preventDefault()}>Clip Art</button>
   </div>
   <span className="word-ribbon-group-name">Insert</span>
  </section>
  <section className="word-ribbon-group" data-ribbon-group="hfNavigation">
   <div className="word-ribbon-options flex flex-wrap gap-1">
    <button type="button" className="word-ribbon-tool" disabled title="Sections aren't modeled in this exam tool -- there is only ever one header and one footer." onMouseDown={event=>event.preventDefault()}>Previous Section</button>
    <button type="button" className="word-ribbon-tool" disabled title="Sections aren't modeled in this exam tool -- there is only ever one header and one footer." onMouseDown={event=>event.preventDefault()}>Next Section</button>
    <button type="button" className="word-ribbon-tool" disabled title="Sections aren't modeled in this exam tool -- there is only ever one header and one footer." onMouseDown={event=>event.preventDefault()}>Link to Previous</button>
    <button type="button" className="word-ribbon-tool" onMouseDown={event=>event.preventDefault()} onClick={()=>focusHeaderFooter(hfKind==="header"?"footer":"header")}>Go to {hfKind==="header"?"Footer":"Header"}</button>
   </div>
   <span className="word-ribbon-group-name">Navigation</span>
  </section>
  <section className="word-ribbon-group" data-ribbon-group="hfOptions">
   <div className="word-ribbon-options flex flex-col gap-1 text-xs">
    <label className="flex items-center gap-1" title="Requires true multi-page pagination, which this exam tool doesn't model."><input type="checkbox" disabled/>Different First Page</label>
    <label className="flex items-center gap-1" title="Requires true multi-page pagination, which this exam tool doesn't model."><input type="checkbox" disabled/>Different Odd &amp; Even Pages</label>
    <label className="flex items-center gap-1"><input type="checkbox" checked={showDocumentText} onChange={event=>setShowDocumentText(event.target.checked)}/>Show Document Text</label>
   </div>
   <span className="word-ribbon-group-name">Options</span>
  </section>
  <section className="word-ribbon-group" data-ribbon-group="hfPosition">
   <div className="word-ribbon-options flex flex-col gap-1 text-xs">
    <label className="flex items-center gap-1">{hfKind==="header"?"Header from Top:":"Footer from Bottom:"}<input type="number" min="0" max="10" step="0.1" defaultValue="0.5" onChange={event=>adjustHeaderFooterOffset(hfKind,event.target.value)} className="w-14 rounded border px-1 py-0.5"/>in</label>
    <label className="flex items-center gap-1 text-slate-400" title="Tab stops aren't modeled in this exam tool.">Insert Alignment Tab</label>
   </div>
   <span className="word-ribbon-group-name">Position</span>
  </section>
  <section className="word-ribbon-group" data-ribbon-group="hfClose">
   <button type="button" onMouseDown={event=>event.preventDefault()} onClick={closeHeaderFooter} className="rounded-lg bg-amber-700 px-3 py-2 text-xs font-black text-white hover:bg-amber-800">Close Header and Footer</button>
   <span className="word-ribbon-group-name">Close</span>
  </section>
 </>:null;
 return <section ref={viewport} className={`word-window relative flex min-h-0 flex-col overflow-hidden ${fullHeight?"h-full":submitPortalId?"":"h-[85dvh]"} ${view.mode==="reading"?"fixed inset-0 z-50":""}`}>{finalSubmitting&&<div role="status" aria-live="assertive" className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-4"><div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-2xl"><span className="mx-auto flex h-16 w-16 animate-pulse items-center justify-center rounded-full bg-cyan-100 text-3xl" aria-hidden>⏳</span><h2 className="mt-5 text-2xl font-black text-slate-900">Submitting your test…</h2><p className="mt-3 leading-7 text-slate-600">Please don&apos;t close this page or click Submit again. This can take a few moments -- your document is safe.</p></div></div>}<header className={`shrink-0 border-b bg-white ${ribbonCollapsed?"word-ribbon-collapsed":""}`}><WordTitleBar canEdit={!submitted} canUndo={isWordCommandEnabled(capabilities,"undo")} canRedo={isWordCommandEnabled(capabilities,"redo")} onSave={()=>{void saveNow()}} onUndo={()=>run("undo")} onRedo={()=>run("redo")} ribbonCollapsed={ribbonCollapsed} onToggleRibbon={()=>setRibbonCollapsed(value=>!value)}/><WordEditorRibbon customPanels={typeof window==="undefined"?undefined:tab==="Page Layout"?{"Page Layout":<PageLayoutGroups key={pageRev} state={pageLayoutState()} on={onPageLayout}/>}:tab==="View"?{View:<ViewGroups active={id=>active(id,view)} enabled={id=>isWordCommandEnabled(capabilities,({zoom:"zoom100",pageWidth:"twoPages"}as Record<string,string>)[id]??id)} run={run}/>}:undefined} capabilities={capabilities} activeTab={tab} onTabChange={value=>{setHeaderFooterToolsSelected(false);setTableToolsTab(null);setTab(value)}} activeOption={id=>id==="formatPainter"?paintMode!=="off":active(id,view)} onCommand={runCommand} currentFontFamily={currentFont} onFontChange={font=>withCells(()=>exec("fontName",font))} onFontSizeChange={size=>withCells(()=>exec("fontSize",String(Math.max(1,Math.min(7,Math.round(size/10))))))} onColorChange={(id,color)=>{if(id==="fontColor")withCells(()=>exec("foreColor",color==="automatic"?"#000000":color));else if(id==="highlightColor")withCells(()=>exec("backColor",color));else if(id==="shading"){const blocks=selectedBlocks();for(const block of blocks)block.style.backgroundColor=color==="transparent"?"":color;if(blocks.length)changed()}else run(id)}} onUnderlineChange={(action,value)=>withCells(()=>underline(action,value))} onValueCommand={onValueCommand} extraTabs={[...(hfKind?[{id:"hf-design",label:"Design",contextLabel:"Header & Footer Tools",groups:headerFooterToolsGroups}]:[]),...(insideTable&&!submitted?tableToolsTabs:[])]} activeExtraTab={headerFooterToolsSelected?"hf-design":insideTable?tableToolsTab:null} onExtraTabSelect={id=>{if(id==="hf-design")setHeaderFooterToolsSelected(true);else{setHeaderFooterToolsSelected(false);setTableToolsTab(id)}}}/>{questionBar}{message&&<p aria-live="polite" className="border-t bg-cyan-50 px-4 py-1 text-xs font-bold text-cyan-950">{message}</p>}</header>
 <div ref={scrollRef} className="word-workspace" onScroll={()=>chromeRef.current()}><div className="flex min-h-full gap-3 px-3 pb-6 pt-0 sm:px-6">{view.documentMap&&<aside aria-label="Document map" className="w-48 shrink-0 rounded-xl bg-white p-3 text-xs shadow"><strong>Document map</strong>{original.paragraphs.map(p=><a key={p.id} href={`#${p.id}`} className="mt-2 block truncate">{matterText(p)}</a>)}</aside>}{view.thumbnails&&<aside aria-label="Thumbnails" className="w-36 shrink-0 overflow-y-auto rounded-xl bg-white p-2 shadow"><strong className="mb-2 block px-1 text-xs">Thumbnails</strong>{thumbnails.map((group,index)=><button key={group.id} type="button" onClick={()=>document.getElementById(group.targetId)?.scrollIntoView({block:"start",behavior:"smooth"})} aria-label={`Page ${index+1}`} className="word-thumbnail-page mb-2 block w-full" style={{aspectRatio:"210 / 297"}}><ThumbnailPreview nodes={group.nodes}/></button>)}</aside>}{showOriginal&&<aside aria-label="Original matter" className="w-72 shrink-0 overflow-auto rounded-xl bg-cyan-50 p-4 text-sm shadow"><strong>Immutable original matter</strong>{original.paragraphs.map(p=><p key={p.id} className="mt-2">{matterText(p)}</p>)}</aside>}<div className={`relative mx-auto ${view.mode==="web"?"w-full":""} ${view.gridlines?"bg-[linear-gradient(#cbd5e1_1px,transparent_1px),linear-gradient(90deg,#cbd5e1_1px,transparent_1px)] bg-[size:20px_20px]":""}`}>{view.ruler&&<div className="word-ruler-row"><div className="flex" style={{zoom:`${view.zoom}%`}}><span aria-hidden style={{width:18,flex:"none"}}/><WordRuler metrics={metrics} indent={indent} editable={!submitted&&isWordCommandEnabled(capabilities,"increaseIndent")} zoom={view.zoom} onIndent={applyRulerIndent}/></div></div>}<div className="word-page-frame mt-1">{view.ruler&&<div aria-hidden style={{zoom:`${view.zoom}%`,flex:"none"}}><WordVerticalRuler height={metrics.height} marginTop={metrics.marginTop} marginBottom={metrics.marginBottom}/></div>}<div ref={editor} role="textbox" aria-multiline="true" aria-label="Working Document Matter editor" contentEditable={!submitted&&view.mode!=="reading"} suppressContentEditableWarning spellCheck onInput={changed} onKeyDown={event=>{if(cellSelection.current.length&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&(event.key.length===1||event.key==='Backspace'||event.key==='Delete'||event.key==='Enter'))setCellSelection([]);handleRandKey(event)}} onMouseDown={event=>{if(tableMode!=="off"&&!submitted){tableModeMouseDown(event);return}if(cellSelection.current.length)setCellSelection([]);handleEditorMouseDown(event)}} onMouseUp={event=>{if(tableMode!=="off"&&!submitted)tableModeMouseUp(event)}} className={`word-document-page min-h-[70dvh] w-[794px] max-w-full bg-white p-8 text-slate-950 outline-none sm:p-24 ${view.formattingMarks?"show-formatting-marks":""} ${view.mode==="draft"?"shadow-none":""} ${paintMode!=="off"?"cursor-format-painter":""} ${showGridlines?"word-show-gridlines":""} ${tableMode!=="off"?`word-table-mode-${tableMode}`:""}`} style={{zoom:`${view.zoom}%`}}>{original.paragraphs.map(paragraph=>paragraph.type==="table"?<table id={paragraph.id} key={paragraph.id} data-block-type="table" className="my-3 w-full border-collapse"><tbody>{paragraph.rows.map((row,rowIndex)=><tr key={rowIndex}>{row.map((cell,cellIndex)=><td key={cellIndex} contentEditable={!submitted&&view.mode!=="reading"} suppressContentEditableWarning className="border p-2">{cell}</td>)}</tr>)}</tbody></table>:paragraph.type==="list-item"?<li id={paragraph.id} key={paragraph.id} data-list-group={paragraph.listGroup??""}>{paragraph.runs.map((run,index)=><Run key={index} run={run}/>)}</li>:<p id={paragraph.id} key={paragraph.id} data-paragraph-number={paragraph.paragraphNumber??undefined} style={{textAlign:paragraph.alignment,marginLeft:`${paragraph.leftIndent}in`,marginRight:`${paragraph.rightIndent}in`,lineHeight:paragraph.lineSpacing,marginTop:`${paragraph.spaceBefore}pt`,marginBottom:`${paragraph.spaceAfter}pt`}}>{paragraph.runs.map((run,index)=><Run key={index} run={run}/>)}</p>)}</div></div></div></div></div>
<ConfirmDialog open={confirmSubmitOpen} title="Submit your test?" message={submitConfirmMessage} confirmLabel="Yes, submit" cancelLabel="Not yet" onCancel={()=>setConfirmSubmitOpen(false)} onConfirm={()=>{setConfirmSubmitOpen(false);void submitNow(false)}}/>
 <ConfirmDialog open={submitProblem!==null} title="Could not submit" message={submitProblem} confirmLabel="OK" cancelLabel={null} tone="primary" onCancel={()=>setSubmitProblem(null)} onConfirm={()=>setSubmitProblem(null)}/>
 <WordStatusBar page={stats.page} pages={stats.pages} words={stats.words} language={documentLanguage} mode={view.mode} onMode={viewMode} zoom={view.zoom} onZoom={value=>applyZoom(String(value))} status={submitPortalId&&status!=="Ready"?status:undefined} actions={submitSlot||submitPortalId?undefined:<>{staleDeploy&&<button type="button" onClick={()=>window.location.reload()} className="word-statusbar-button word-statusbar-refresh">Refresh page</button>}<button type="button" disabled={submitted} onClick={submit} className="word-statusbar-button" title={`Autosave: ${status}`}>{submitLabel}</button></>}/>
 <input ref={imageInput} className="sr-only" tabIndex={-1} type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={event=>uploadImage(event.target.files?.[0]??null)}/>{submitSlot?createPortal(<>{staleDeploy&&<button type="button" onClick={()=>window.location.reload()} className="rounded-xl bg-amber-500 px-3 py-2 text-xs font-black text-slate-950 outline-none hover:bg-amber-400 focus-visible:ring-2 focus-visible:ring-white">Refresh page</button>}<button type="button" disabled={submitted} onClick={submit} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-black text-white outline-none hover:bg-red-500 focus-visible:ring-2 focus-visible:ring-white disabled:bg-slate-500">{submitLabel}</button></>,submitSlot):null}{dialog&&<CommandDialog dialog={dialog} onPageSetup={applyPageSetup} onPageBorder={applyPageBorder} onClose={()=>setDialog(null)} onOpenCustomTable={()=>setDialog({kind:"insertTableCustom"})} onInsertTable={insertTableWithSize} onSymbol={insertSymbol} onMargins={applyMargins} onWatermark={applyWatermark} onPageColor={applyPageColor} onColumns={applyColumns} onPageSize={applyPageSize} onTableEdit={runTableEdit} onLineSpacingOptions={applyLineSpacingOptions} onFindNext={runFindNext} onReplaceOne={runReplaceOne} onReplaceAll={runReplaceAll} onHighlightAll={highlightAll} onSelectAll={selectAllMatches} onClearHighlight={clearFindHighlights} onGoTo={goToTarget} onZoom={applyZoom} onSort={applySort} onPageNumber={applyPageNumber} onRemovePageNumbers={removePageNumbers} onFont={values=>withCells(()=>applyFontDialog(values))} onParagraph={applyParagraphDialog} onHeaderFooterPick={applyHeaderFooterStyle} onHeaderFooterEdit={editHeaderFooter} onHeaderFooterRemove={removeHeaderFooter} onHeaderFooterSave={saveCustomHeaderFooterStyle} onPageNumberFormat={applyPageNumberFormat} onDateTime={insertDateTime} onTableDialog={onTableDialog} onDropCap={applyDropCap}/>}</section>;
}

function active(id:string,view:ViewState){return(id==="ruler"&&view.ruler)||(id==="gridlines"&&view.gridlines)||(id==="documentMap"&&view.documentMap)||(id==="thumbnails"&&view.thumbnails)||(["formattingMarks","viewFormattingMarks"].includes(id)&&view.formattingMarks)||(id==="statusBar"&&view.statusBar)||(id==="printLayout"&&view.mode==="print")||(id==="fullScreenReading"&&view.mode==="reading")||(id==="webLayout"&&view.mode==="web")||(id==="outlineView"&&view.mode==="outline")||(id==="draftView"&&view.mode==="draft")}
// The word around a collapsed cursor, as Word's Font dialog uses it.
function wordRangeAt(range:Range){const node=range.startContainer;if(node.nodeType!==Node.TEXT_NODE)return null;const text=node.textContent??"";let start=range.startOffset,end=range.startOffset;while(start>0&&/[\p{L}\p{N}'’-]/u.test(text[start-1]))start--;while(end<text.length&&/[\p{L}\p{N}'’-]/u.test(text[end]))end++;if(start===end)return null;const word=document.createRange();word.setStart(node,start);word.setEnd(node,end);return word}
const TABLE_DIALOG_KINDS=new Set(["pageSetup","tableProperties","splitCells","tableOptions","tableSort","convertToText","convertTextToTable","tableFormula","deleteCells","bordersShading","insertCells"]);
function CommandDialog({dialog,onPageSetup,onPageBorder,onClose,onOpenCustomTable,onInsertTable,onSymbol,onMargins,onWatermark,onPageColor,onColumns,onPageSize,onTableEdit,onLineSpacingOptions,onFindNext,onReplaceOne,onReplaceAll,onHighlightAll,onSelectAll,onClearHighlight,onGoTo,onZoom,onSort,onPageNumber,onRemovePageNumbers,onFont,onParagraph,onHeaderFooterPick,onHeaderFooterEdit,onHeaderFooterRemove,onHeaderFooterSave,onDropCap,onPageNumberFormat,onDateTime,onTableDialog}:{dialog:DialogState;onTableDialog:(kind:string,result:unknown,keepOpen?:boolean)=>void;onPageSetup:(values:PageSetupValues)=>void;onPageBorder:(values:BordersShadingValues)=>void;onPageNumberFormat:(values:PageNumberFormatValues)=>void;onDateTime:(text:string)=>void;onClose:()=>void;onOpenCustomTable:()=>void;onInsertTable:(rows:number,cols:number,layout?:string)=>void;onSymbol:(value:string)=>void;onMargins:(top:string,right:string,bottom:string,left:string)=>void;onWatermark:(value:string)=>void;onPageColor:(value:string)=>void;onColumns:(value:string)=>void;onPageSize:(value:string)=>void;onTableEdit:(action:string)=>void;onLineSpacingOptions:(before:string,after:string,specialIndentMode:string,specialIndentAmount:string)=>void;onFindNext:(needle:string,options:FindEngineOptions,scope:"selection"|"document")=>string;onReplaceOne:(needle:string,replacement:string,options:FindEngineOptions,scope:"selection"|"document")=>string;onReplaceAll:(needle:string,replacement:string,options:FindEngineOptions,scope:"selection"|"document")=>string;onHighlightAll:(needle:string,options:FindEngineOptions,scope:"selection"|"document")=>string;onSelectAll:(needle:string,options:FindEngineOptions,scope:"selection"|"document")=>string;onClearHighlight:()=>void;onGoTo:(kind:string,value:string)=>void;onZoom:(value:string)=>void;onSort:(value:string)=>void;onPageNumber:(position:string,alignment:string,style:string,format:string,startAt:string)=>void;onRemovePageNumbers:()=>void;onFont:(values:Extract<DialogState,{kind:"font"}>)=>void;onParagraph:(values:Extract<DialogState,{kind:"paragraph"}>)=>void;onHeaderFooterPick:(which:"header"|"footer",innerHtml:string)=>void;onHeaderFooterEdit:(which:"header"|"footer")=>void;onHeaderFooterRemove:(which:"header"|"footer")=>void;onHeaderFooterSave:(which:"header"|"footer")=>void;onDropCap:(mode:string,fontFamily:string,lines:string,distance:string)=>void}){
 if(typeof document==="undefined")return null;
 // Real Word dialogs are movable by holding their title bar. Every dialog
 // here shares this one drag handle instead of each Form implementing its
 // own, so dragging works the same way everywhere -- offset resets to
 // centered each time a *new* dialog opens, since CommandDialog remounts
 // fresh whenever `dialog` changes.
 const[offset,setOffset]=useState({x:0,y:0});
 const drag=useRef<{startX:number;startY:number;originX:number;originY:number}|null>(null);
 const startDrag=(event:MouseEvent<HTMLDivElement>)=>{
  event.preventDefault();
  drag.current={startX:event.clientX,startY:event.clientY,originX:offset.x,originY:offset.y};
  const onMove=(moveEvent:globalThis.MouseEvent)=>{if(!drag.current)return;setOffset({x:drag.current.originX+(moveEvent.clientX-drag.current.startX),y:drag.current.originY+(moveEvent.clientY-drag.current.startY)})};
  const onUp=()=>{drag.current=null;window.removeEventListener("mousemove",onMove);window.removeEventListener("mouseup",onUp)};
  window.addEventListener("mousemove",onMove);
  window.addEventListener("mouseup",onUp);
 };
 const escape=(event:KeyboardEvent<HTMLDivElement>)=>{if(event.key==="Escape")onClose()};
 const word13=dialog.kind==="findReplace"||dialog.kind==="font"||dialog.kind==="paragraph"||dialog.kind==="symbol"||dialog.kind==="insertTableCustom"||dialog.kind==="dropCapOptions"||dialog.kind==="pageNumberFormat"||dialog.kind==="dateTime"||TABLE_DIALOG_KINDS.has(dialog.kind);
 const word13Title=({findReplace:"Find and Replace",font:"Font",paragraph:"Paragraph",symbol:"Symbol",insertTableCustom:"Insert Table",dropCapOptions:"Drop Cap",pageNumberFormat:"Page Number Format",dateTime:"Date and Time",tableProperties:"Table Properties",splitCells:"Split Cells",tableOptions:"Table Options",tableSort:"Sort",convertToText:"Convert Table To Text",convertTextToTable:"Convert Text to Table",tableFormula:"Formula",deleteCells:"Delete Cells",bordersShading:"Borders and Shading",insertCells:"Insert Cells",pageSetup:"Page Setup"}as Record<string,string>)[dialog.kind];
 if(word13)return createPortal(<div role="presentation" className={`fixed inset-0 z-[60] flex items-center justify-center p-2 ${dialog.kind==="findReplace"?"pointer-events-none":"bg-slate-950/30"}`} onMouseDown={dialog.kind==="findReplace"?undefined:onClose}>
  <div role="dialog" aria-modal={dialog.kind!=="findReplace"} aria-label={word13Title} className="pointer-events-auto max-h-full overflow-visible" style={{transform:`translate(${offset.x}px,${offset.y}px)`}} onMouseDown={event=>event.stopPropagation()} onKeyDown={escape}>
   <Word13Chrome.Provider value={{onClose,startDrag}}>
    {dialog.kind==="findReplace"&&<FindReplaceDialog2013 dialog={dialog} onFindNext={onFindNext} onReplaceOne={onReplaceOne} onReplaceAll={onReplaceAll} onHighlightAll={onHighlightAll} onSelectAll={onSelectAll} onClearHighlight={onClearHighlight} onGoTo={onGoTo}/>}
    {dialog.kind==="font"&&<FontDialog2013 values={dialog} onSubmit={values=>onFont({...values,kind:"font"})}/>}
    {dialog.kind==="paragraph"&&<ParagraphDialog2013 values={dialog} onSubmit={values=>onParagraph({...values,kind:"paragraph"})}/>}
    {dialog.kind==="insertTableCustom"&&<InsertTableDialog2013 onSubmit={onInsertTable}/>}
    {dialog.kind==="symbol"&&<SymbolDialog2013 subsets={SYMBOL_SUBSETS} symbolsIn={symbolsInSubset} specials={SPECIAL_CHARACTERS} recent={recentSymbols()} onInsert={onSymbol}/>}
    {dialog.kind==="dropCapOptions"&&<DropCapDialog2013 values={dialog} onSubmit={values=>onDropCap(values.position,values.fontFamily,values.lines,values.distance)}/>}
    {dialog.kind==="pageNumberFormat"&&<PageNumberFormatDialog2013 values={dialog} formats={WORD_PAGE_NUMBER_FORMATS} onSubmit={onPageNumberFormat}/>}
    {dialog.kind==="dateTime"&&<DateTimeDialog2013 formats={language=>dateTimeFormats(new Date(),language)} languages={DATE_LANGUAGES} onSubmit={onDateTime}/>}
    {dialog.kind==="tableProperties"&&<TablePropertiesDialog2013 values={dialog.values} initialTab={dialog.tab} onSubmit={values=>onTableDialog("tableProperties",values)}
      renderOptions={close=><TableOptionsDialog2013 values={dialog.options} onSubmit={values=>{onTableDialog("tableOptions",values,true);close()}}/>}
      renderBordersShading={close=><BordersShadingDialog2013 initial={dialog.borders} widths={BORDER_WIDTHS} onSubmit={values=>{onTableDialog("bordersShading",values,true);close()}}/>}
      renderCellOptions={close=><CellOptionsDialog2013 values={dialog.cellOptions} onSubmit={values=>{onTableDialog("cellOptions",values,true);close()}}/>}/>}
    {dialog.kind==="splitCells"&&<SplitCellsDialog2013 canMerge={dialog.canMerge} onSubmit={(columns,rows,mergeFirst)=>onTableDialog("splitCells",{columns,rows,mergeFirst})}/>}
    {dialog.kind==="insertCells"&&<InsertCellsDialog2013 onSubmit={choice=>onTableDialog("insertCells",choice)}/>}
    {dialog.kind==="pageSetup"&&<PageSetupDialog2013 values={dialog.values} initialTab={dialog.tab} onSubmit={onPageSetup} renderBorders={close=><BordersShadingDialog2013 initial={dialog.borders} initialTab="page" widths={BORDER_WIDTHS} onSubmit={values=>{onPageBorder(values);close()}}/>}/>}
    {dialog.kind==="tableOptions"&&<TableOptionsDialog2013 values={dialog.values} onSubmit={values=>onTableDialog("tableOptions",values)}/>}
    {dialog.kind==="tableSort"&&<SortDialog2013 columns={dialog.columns} headerNames={dialog.headerNames} onSubmit={values=>onTableDialog("tableSort",values)}/>}
    {dialog.kind==="convertToText"&&<ConvertToTextDialog2013 onSubmit={separator=>onTableDialog("convertToText",separator)}/>}
    {dialog.kind==="convertTextToTable"&&<ConvertTextToTableDialog2013 rows={dialog.rows} guessColumns={separator=>separator==="\n"?1:Math.max(1,...dialog.texts.map(text=>text.split(separator).length))} onSubmit={(separator,columns,layout)=>onTableDialog("convertTextToTable",{separator,columns,layout})}/>}
    {dialog.kind==="tableFormula"&&<FormulaDialog2013 initial={dialog.initial} onSubmit={(formula,format)=>onTableDialog("tableFormula",{formula,format})}/>}
    {dialog.kind==="deleteCells"&&<DeleteCellsDialog2013 onSubmit={choice=>onTableDialog("deleteCells",choice)}/>}
    {dialog.kind==="bordersShading"&&<BordersShadingDialog2013 initial={dialog.initial} initialTab={dialog.tab} widths={BORDER_WIDTHS} onSubmit={values=>onTableDialog("bordersShading",values)}/>}
   </Word13Chrome.Provider>
  </div></div>,document.body);
 return createPortal(<div role="presentation" className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/40 p-4" onMouseDown={onClose}><div role="dialog" aria-modal="true" className={`w-full rounded-2xl bg-white p-5 shadow-2xl ${dialog.kind==="headerFooterGallery"?"max-w-lg":dialog.kind==="pageNumber"?"max-w-md":"max-w-sm"}`} style={{transform:`translate(${offset.x}px,${offset.y}px)`}} onMouseDown={event=>event.stopPropagation()} onKeyDown={escape}>
  <div className="-mx-5 -mt-5 mb-3 flex cursor-move items-center justify-center rounded-t-2xl bg-slate-100 py-1.5" title="Drag to move" onMouseDown={startDrag}><span aria-hidden className="h-1 w-10 rounded-full bg-slate-300"/></div>
  {dialog.kind==="insertTable"&&<TableSizePicker onPick={onInsertTable} onCustom={onOpenCustomTable}/>}
  {dialog.kind==="margins"&&<MarginsForm dialog={dialog} onSubmit={onMargins}/>}
  {dialog.kind==="watermark"&&<TextForm label="Watermark text" initial={dialog.text} onSubmit={onWatermark}/>}
  {dialog.kind==="lineSpacingOptions"&&<LineSpacingOptionsForm dialog={dialog} onSubmit={onLineSpacingOptions}/>}
  {dialog.kind==="pageColor"&&<ColorForm label="Page color" initial={dialog.value} onSubmit={onPageColor}/>}
  {dialog.kind==="columns"&&<ChoiceForm label="Columns" options={["1","2","3","4","5","6"]} initial={dialog.value} onSubmit={onColumns}/>}
  {dialog.kind==="pageSize"&&<ChoiceForm label="Page size" options={["Letter","Legal","Statement","Executive","A4","A5","B5"]} initial={dialog.value} onSubmit={onPageSize}/>}
  {dialog.kind==="tableEdit"&&<TableEditForm onPick={onTableEdit}/>}
  {dialog.kind==="zoom"&&<ZoomForm dialog={dialog} onSubmit={onZoom}/>}
  {dialog.kind==="sort"&&<ChoiceForm label="Sort" options={["Ascending","Descending"]} initial={dialog.value} onSubmit={onSort}/>}
  {dialog.kind==="pageNumber"&&<PageNumberForm dialog={dialog} onSubmit={onPageNumber} onRemove={onRemovePageNumbers}/>}
  {dialog.kind==="headerFooterGallery"&&<HeaderFooterGalleryForm dialog={dialog} onPick={onHeaderFooterPick} onEdit={onHeaderFooterEdit} onRemove={onHeaderFooterRemove} onSave={onHeaderFooterSave}/>}
  <button type="button" onMouseDown={event=>event.preventDefault()} onClick={onClose} className="mt-4 w-full rounded-lg bg-slate-100 px-4 py-2 text-sm font-bold">Close</button>
 </div></div>,document.body);
}
function PageNumberForm({dialog,onSubmit,onRemove}:{dialog:{position:string;alignment:string;style:string;format:string;startAt:string};onSubmit:(position:string,alignment:string,style:string,format:string,startAt:string)=>void;onRemove:()=>void}){
 const[position,setPosition]=useState(dialog.position),[alignment,setAlignment]=useState(dialog.alignment),[style,setStyle]=useState(dialog.style),[format,setFormat]=useState(dialog.format),[startAt,setStartAt]=useState(dialog.startAt);
 return <div>
  <h3 className="font-black">Page Number</h3>
  <label className="mt-3 block text-xs font-bold">Position<div className="mt-1 flex flex-wrap gap-2">{[["top","Top of Page"],["bottom","Bottom of Page"],["current","Current Position"]].map(([value,label])=><button key={value} type="button" onMouseDown={event=>event.preventDefault()} onClick={()=>setPosition(value)} className={`rounded-lg border px-3 py-2 text-sm font-bold ${position===value?"border-blue-700 bg-blue-50 text-blue-800":"border-slate-200"}`}>{label}</button>)}</div></label>
  <label className="mt-3 block text-xs font-bold">Style<div className="mt-1 grid grid-cols-3 gap-2">{PAGE_NUMBER_STYLES.map(item=><button key={item.id} type="button" onMouseDown={event=>event.preventDefault()} onClick={()=>setStyle(item.id)} className={`rounded-lg border p-2 text-center ${style===item.id?"border-blue-700 bg-blue-50":"border-slate-200"}`}><span className="block text-xs font-bold">{item.label}</span><span className="mt-1 block rounded border border-dashed p-1 text-[11px] text-slate-500">{pageNumberText(item.id,format,startAt)}</span></button>)}</div></label>
  <label className="mt-3 block text-xs font-bold">Alignment<div className="mt-1 flex flex-wrap gap-2">{["left","center","right"].map(option=><button key={option} type="button" onMouseDown={event=>event.preventDefault()} onClick={()=>setAlignment(option)} className={`rounded-lg border px-3 py-2 text-sm font-bold capitalize ${alignment===option?"border-blue-700 bg-blue-50 text-blue-800":"border-slate-200"}`}>{option}</button>)}</div></label>
  <div className="mt-4 border-t pt-3"><p className="text-xs font-black uppercase tracking-wide text-slate-500">Format Page Numbers</p>
   <div className="mt-2 grid grid-cols-2 gap-3">
    <label className="text-xs font-bold">Number format<select className="input mt-1" value={format} onChange={event=>setFormat(event.target.value)}>{PAGE_NUMBER_FORMATS.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
    <label className="text-xs font-bold">Start at<input className="input mt-1" type="number" min="1" max="9999" value={startAt} onChange={event=>setStartAt(event.target.value)}/></label>
   </div>
  </div>
  <div className="mt-4 flex flex-wrap gap-2">
   <button type="button" onMouseDown={event=>event.preventDefault()} onClick={()=>onSubmit(position,alignment,style,format,startAt)} className="flex-1 rounded-lg bg-blue-700 px-4 py-2 text-sm font-black text-white">Insert</button>
   <button type="button" onMouseDown={event=>event.preventDefault()} onClick={onRemove} className="rounded-lg border border-red-300 px-4 py-2 text-sm font-black text-red-700 hover:bg-red-50">Remove Page Numbers</button>
  </div>
 </div>;
}
function HeaderFooterGalleryForm({dialog,onPick,onEdit,onRemove,onSave}:{dialog:{which:"header"|"footer";hasExisting:boolean;customStyles:{name:string;preview:string;html:string}[]};onPick:(which:"header"|"footer",innerHtml:string)=>void;onEdit:(which:"header"|"footer")=>void;onRemove:(which:"header"|"footer")=>void;onSave:(which:"header"|"footer")=>void}){
 const label=dialog.which==="header"?"Header":"Footer";
 return <div>
  <h3 className="font-black">{label}</h3>
  <p className="mt-1 text-xs font-black uppercase tracking-wide text-slate-500">Built-In</p>
  <div className="mt-2 grid gap-2">{HEADER_FOOTER_STYLES.map(item=><button key={item.name} type="button" onMouseDown={event=>event.preventDefault()} onClick={()=>onPick(dialog.which,item.content)} className="rounded-lg border border-slate-200 p-3 text-left hover:bg-cyan-50"><span className="block text-xs font-black text-blue-800">{item.name}</span><span className="mt-2 block rounded border border-dashed border-slate-300 p-2 text-xs text-slate-500">{item.preview}</span></button>)}</div>
  {dialog.customStyles.length>0&&<><p className="mt-4 text-xs font-black uppercase tracking-wide text-slate-500">Custom</p><div className="mt-2 grid gap-2">{dialog.customStyles.map(item=><button key={item.name} type="button" onMouseDown={event=>event.preventDefault()} onClick={()=>onPick(dialog.which,item.html)} className="rounded-lg border border-slate-200 p-3 text-left hover:bg-cyan-50"><span className="block text-xs font-black text-blue-800">{item.name}</span><span className="mt-2 block rounded border border-dashed border-slate-300 p-2 text-xs text-slate-500">{item.preview||"(no preview)"}</span></button>)}</div></>}
  <div className="mt-4 flex flex-col gap-1 border-t pt-3">
   <button type="button" onMouseDown={event=>event.preventDefault()} onClick={()=>onEdit(dialog.which)} className="rounded-lg px-3 py-2 text-left text-sm font-bold hover:bg-cyan-50">Edit {label}</button>
   {dialog.hasExisting&&<button type="button" onMouseDown={event=>event.preventDefault()} onClick={()=>onRemove(dialog.which)} className="rounded-lg px-3 py-2 text-left text-sm font-bold text-red-700 hover:bg-red-50">Remove {label}</button>}
   {dialog.hasExisting&&<button type="button" onMouseDown={event=>event.preventDefault()} onClick={()=>onSave(dialog.which)} className="rounded-lg px-3 py-2 text-left text-sm font-bold hover:bg-cyan-50">Save Selection to {label} Gallery…</button>}
  </div>
 </div>;
}
// Real Word's Font dialog picks font/underline color from a swatch grid
// (Theme Colors + Standard Colors), not a native OS color picker -- reuses
// the exact same safe palette and .word-color-palette styling already
// used by the ribbon's color split-buttons, so the grid is visually
// identical wherever it appears. "" means Automatic/no override, matching
// how the rest of this dialog already treats an empty color string.
function ColorSwatchField({label,value,onChange}:{label:string;value:string;onChange:(value:string)=>void}){
 const[open,setOpen]=useState(false);
 return <div className="relative">
  <span className="text-xs font-bold">{label}</span>
  <button type="button" onMouseDown={event=>event.preventDefault()} onClick={()=>setOpen(current=>!current)} className="input mt-1 flex w-full items-center gap-2 text-left text-sm" aria-haspopup="menu" aria-expanded={open}>
   <span className="h-4 w-4 shrink-0 rounded border border-slate-400" style={{backgroundColor:value||"transparent"}} aria-hidden/>
   <span className="flex-1 truncate">{value?value.toUpperCase():"Automatic"}</span>
   <span aria-hidden>▾</span>
  </button>
  {open&&<div role="menu" aria-label={`${label} colors`} className="word-color-palette">
   {SAFE_COLORS.map(color=><button key={color} type="button" role="menuitem" aria-label={color} onMouseDown={event=>event.preventDefault()} onClick={()=>{onChange(color);setOpen(false)}} style={{backgroundColor:color}}/>)}
   <button type="button" role="menuitem" onMouseDown={event=>event.preventDefault()} onClick={()=>{onChange("");setOpen(false)}} style={{gridColumn:"1 / -1",marginTop:4,padding:"4px 2px",fontSize:10,fontWeight:700,background:"#fff",border:"1px solid #999",borderRadius:2}}>Automatic</button>
  </div>}
 </div>;
}
const DIALOG_UNDERLINE_STYLES=["single","double","thick","dotted","dashed","dot-dash","dot-dot-dash","wavy","words-only"] as const;
function underlineDialogLabel(style:string){return({none:"(none)",single:"Single",double:"Double",thick:"Thick",dotted:"Dotted",dashed:"Dashed","dot-dash":"Dot-dash","dot-dot-dash":"Dot-dot-dash",wavy:"Wavy","words-only":"Words only"}as Record<string,string>)[style]??style}
// Matches the ribbon's own underline gallery (same line-sample markup and
// .word-underline-gallery/.word-underline-sample CSS) instead of a plain
// text <select> -- real Word shows the actual line style, not just its
// name, and now every style the schema supports (not just a subset) is
// selectable here.
function UnderlineStyleField({value,onChange}:{value:string;onChange:(value:string)=>void}){
 const[open,setOpen]=useState(false);
 return <div className="relative">
  <span className="text-xs font-bold">Underline style</span>
  <button type="button" onMouseDown={event=>event.preventDefault()} onClick={()=>setOpen(current=>!current)} className="input mt-1 flex w-full items-center justify-between text-left text-sm" aria-haspopup="listbox" aria-expanded={open}>
   <span>{underlineDialogLabel(value)}</span><span aria-hidden>▾</span>
  </button>
  {open&&<div role="listbox" aria-label="Underline style" className="word-underline-gallery">
   {DIALOG_UNDERLINE_STYLES.map(style=><button key={style} type="button" role="option" aria-selected={value===style} className="word-underline-sample" data-underline-sample={style} onMouseDown={event=>event.preventDefault()} onClick={()=>{onChange(style);setOpen(false)}}><span aria-hidden/></button>)}
   <button type="button" role="option" aria-selected={value==="none"} className="word-underline-text-command" onMouseDown={event=>event.preventDefault()} onClick={()=>{onChange("none");setOpen(false)}}>None</button>
  </div>}
 </div>;
}
function TableSizePicker({onPick,onCustom}:{onPick:(rows:number,cols:number)=>void;onCustom:()=>void}){const[hover,setHover]=useState({rows:2,cols:2});return <div><h3 className="font-black">Insert table</h3><div className="mt-3 grid grid-cols-6 gap-1" onMouseLeave={()=>setHover({rows:2,cols:2})}>{Array.from({length:6},(_,rowIndex)=>Array.from({length:6},(_,colIndex)=><button key={`${rowIndex}-${colIndex}`} type="button" onMouseDown={event=>event.preventDefault()} onMouseEnter={()=>setHover({rows:rowIndex+1,cols:colIndex+1})} onClick={()=>onPick(rowIndex+1,colIndex+1)} className={`h-6 w-6 border ${rowIndex<hover.rows&&colIndex<hover.cols?"bg-cyan-500":"bg-slate-100"}`}/>))}</div><p className="mt-2 text-xs font-bold text-slate-500">{hover.rows} × {hover.cols} table</p><button type="button" onMouseDown={event=>event.preventDefault()} onClick={onCustom} className="mt-3 w-full rounded-lg border px-4 py-2 text-left text-sm font-bold hover:bg-cyan-50">Insert Table…</button></div>}
function MarginsForm({dialog,onSubmit}:{dialog:{top:string;right:string;bottom:string;left:string};onSubmit:(top:string,right:string,bottom:string,left:string)=>void}){const[top,setTop]=useState(dialog.top),[right,setRight]=useState(dialog.right),[bottom,setBottom]=useState(dialog.bottom),[left,setLeft]=useState(dialog.left);return <div><h3 className="font-black">Margins (mm)</h3><div className="mt-3 grid grid-cols-2 gap-3"><label className="text-xs font-bold">Top<input className="input mt-1" type="number" min="5" max="50" value={top} onChange={event=>setTop(event.target.value)}/></label><label className="text-xs font-bold">Right<input className="input mt-1" type="number" min="5" max="50" value={right} onChange={event=>setRight(event.target.value)}/></label><label className="text-xs font-bold">Bottom<input className="input mt-1" type="number" min="5" max="50" value={bottom} onChange={event=>setBottom(event.target.value)}/></label><label className="text-xs font-bold">Left<input className="input mt-1" type="number" min="5" max="50" value={left} onChange={event=>setLeft(event.target.value)}/></label></div><button type="button" onMouseDown={event=>event.preventDefault()} onClick={()=>onSubmit(top,right,bottom,left)} className="mt-4 w-full rounded-lg bg-blue-700 px-4 py-2 text-sm font-black text-white">Apply</button></div>}
function TextForm({label,initial,onSubmit}:{label:string;initial:string;onSubmit:(value:string)=>void}){const[value,setValue]=useState(initial);return <div><h3 className="font-black">{label}</h3><input className="input mt-3 w-full" value={value} maxLength={40} onChange={event=>setValue(event.target.value)}/><button type="button" onMouseDown={event=>event.preventDefault()} onClick={()=>onSubmit(value)} className="mt-4 w-full rounded-lg bg-blue-700 px-4 py-2 text-sm font-black text-white">Apply</button></div>}
const SAFE_PAGE_COLORS=["#ffffff","#fef3c7","#dbeafe","#dcfce7","#fee2e2","#f3e8ff"];
function ColorForm({label,initial,onSubmit}:{label:string;initial:string;onSubmit:(value:string)=>void}){const[value,setValue]=useState(initial);return <div><h3 className="font-black">{label}</h3><div className="mt-3 flex flex-wrap gap-2">{SAFE_PAGE_COLORS.map(color=><button key={color} type="button" aria-label={color} onMouseDown={event=>event.preventDefault()} onClick={()=>setValue(color)} className="h-8 w-8 rounded-lg border-2" style={{backgroundColor:color,borderColor:value===color?"#0369a1":"#e2e8f0"}}/>)}</div><button type="button" onMouseDown={event=>event.preventDefault()} onClick={()=>onSubmit(value)} className="mt-4 w-full rounded-lg bg-blue-700 px-4 py-2 text-sm font-black text-white">Apply</button></div>}
function ChoiceForm({label,options,initial,onSubmit}:{label:string;options:string[];initial:string;onSubmit:(value:string)=>void}){const[value,setValue]=useState(initial);return <div><h3 className="font-black">{label}</h3><div className="mt-3 flex gap-2">{options.map(option=><button key={option} type="button" onMouseDown={event=>event.preventDefault()} onClick={()=>setValue(option)} className={`rounded-lg border px-4 py-2 text-sm font-bold ${value===option?"border-blue-700 bg-blue-50 text-blue-800":"border-slate-200"}`}>{option}</button>)}</div><button type="button" onMouseDown={event=>event.preventDefault()} onClick={()=>onSubmit(value)} className="mt-4 w-full rounded-lg bg-blue-700 px-4 py-2 text-sm font-black text-white">Apply</button></div>}
function LineSpacingOptionsForm({dialog,onSubmit}:{dialog:{before:string;after:string;specialIndentMode:string;specialIndentAmount:string};onSubmit:(before:string,after:string,specialIndentMode:string,specialIndentAmount:string)=>void}){const[before,setBefore]=useState(dialog.before),[after,setAfter]=useState(dialog.after),[specialIndentMode,setSpecialIndentMode]=useState(dialog.specialIndentMode),[specialIndentAmount,setSpecialIndentAmount]=useState(dialog.specialIndentAmount);return <div><h3 className="font-black">Indents and Spacing</h3><div className="mt-3 grid grid-cols-2 gap-3"><label className="text-xs font-bold">Space before (pt)<input className="input mt-1" type="number" min="0" max="500" value={before} onChange={event=>setBefore(event.target.value)}/></label><label className="text-xs font-bold">Space after (pt)<input className="input mt-1" type="number" min="0" max="500" value={after} onChange={event=>setAfter(event.target.value)}/></label></div><div className="mt-3 grid grid-cols-2 gap-3"><label className="text-xs font-bold">Special indent<select className="input mt-1" value={specialIndentMode} onChange={event=>setSpecialIndentMode(event.target.value)}><option value="none">(none)</option><option value="firstLine">First line</option><option value="hanging">Hanging</option></select></label><label className="text-xs font-bold">By (inches)<input className="input mt-1" type="number" min="0" max="5" step="0.1" disabled={specialIndentMode==="none"} value={specialIndentAmount} onChange={event=>setSpecialIndentAmount(event.target.value)}/></label></div><button type="button" onMouseDown={event=>event.preventDefault()} onClick={()=>onSubmit(before,after,specialIndentMode,specialIndentAmount)} className="mt-4 w-full rounded-lg bg-blue-700 px-4 py-2 text-sm font-black text-white">Apply</button></div>}
const ZOOM_PRESETS=["200","150","100","75","50"];
function ZoomForm({dialog,onSubmit}:{dialog:{value:string};onSubmit:(value:string)=>void}){const[value,setValue]=useState(dialog.value);return <div><h3 className="font-black">Zoom</h3><div className="mt-3 flex flex-wrap gap-2">{ZOOM_PRESETS.map(preset=><button key={preset} type="button" onMouseDown={event=>event.preventDefault()} onClick={()=>setValue(preset)} className={`rounded-lg border px-3 py-2 text-sm font-bold ${value===preset?"border-blue-700 bg-blue-50 text-blue-800":"border-slate-200"}`}>{preset}%</button>)}</div><label className="mt-4 block text-xs font-bold">Percent (10–500)<input className="input mt-1 w-full" type="number" min="10" max="500" value={value} onChange={event=>setValue(event.target.value)}/></label><button type="button" onMouseDown={event=>event.preventDefault()} onClick={()=>onSubmit(value)} className="mt-4 w-full rounded-lg bg-blue-700 px-4 py-2 text-sm font-black text-white">OK</button></div>}
function TableEditForm({onPick}:{onPick:(action:string)=>void}){const actions:[string,string][]=[["add-row-above","Insert row above"],["add-row-below","Insert row below"],["remove-row","Delete row"],["add-column-left","Insert column left"],["add-column-right","Insert column right"],["remove-column","Delete column"]];return <div><h3 className="font-black">Table rows and columns</h3><div className="mt-3 grid gap-2">{actions.map(([action,label])=><button key={action} type="button" onMouseDown={event=>event.preventDefault()} onClick={()=>onPick(action)} className="rounded-lg border px-4 py-2 text-left text-sm font-bold hover:bg-cyan-50">{label}</button>)}</div></div>}
function ThumbnailPreview({nodes}:{nodes:HTMLElement[]}){const attach=(container:HTMLDivElement|null)=>{if(container){container.replaceChildren(...nodes.map(node=>node.cloneNode(true)as HTMLElement))}};return <div className="word-thumbnail-page-inner" style={{width:794,transform:"scale(0.145)"}} ref={attach}/>}
function matterText(paragraph:MatterParagraph){return paragraph.type==="table"?paragraph.rows.flat().join(" "):paragraph.runs.map(run=>run.text).join("")}
function Run({run}:{run:Extract<WorkingMatterSnapshot["paragraphs"][number],{type:"paragraph"|"list-item"}>["runs"][number]}){return <span style={{fontWeight:run.bold?700:undefined,fontStyle:run.italic?"italic":undefined,textDecoration:[run.underline?"underline":"",run.strike?"line-through":""].filter(Boolean).join(" ")||undefined,fontFamily:run.fontFamily??undefined,fontSize:run.fontSize?`${run.fontSize}pt`:undefined,color:run.color?`#${run.color}`:undefined,backgroundColor:run.highlight?`#${run.highlight}`:undefined}}>{run.text}</span>}

function toSnapshot(editor:HTMLDivElement){const elements=expandListElements([...editor.children]).slice(0,1000);const blocks=elements.map((element,index)=>canonicalizeBlockMeasurements(enrichBlock(makeStructuredBlock(element,`block-${index}`),element)));return{schemaVersion:"2",blocks:blocks.length?blocks:[canonicalizeBlockMeasurements(enrichBlock(emptyBlock(),editor))],pageLayout:{padding:editor.dataset.margins||editor.style.padding||null,gutter:editor.dataset.gutter?`${editor.dataset.gutter}mm`:null,gutterPosition:editor.dataset.gutter?(editor.dataset.gutterPosition==="top"?"top":"left"):null,maxWidth:editor.style.maxWidth||null,aspectRatio:editor.style.aspectRatio||null,columnCount:editor.style.columnCount||null,backgroundColor:approvedCssColor(editor.style.backgroundColor),border:editor.style.border||null,watermark:(editor.dataset.watermark??"").slice(0,40)||null},operations:(editor.dataset.operations??"").split(",").filter(Boolean).slice(0,256),savedAt:new Date().toISOString()}}
function canonicalizeBlockMeasurements<T extends{attrs:Record<string,unknown>}>(block:T){const attrs={...block.attrs};for(const key of["marginLeft","marginRight","marginTop","marginBottom"]as const)if(key in attrs){const value=canonicalWordMeasurement(attrs[key],"length");if(value)attrs[key]=value;else delete attrs[key]}if("lineHeight"in attrs){const lineHeight=canonicalWordMeasurement(attrs.lineHeight,"lineHeight");if(lineHeight)attrs.lineHeight=lineHeight;else delete attrs.lineHeight}return{...block,attrs}}
// The Font dialog shows the formatting of the selected text. A selection made
// with the keyboard, Select All or a script starts on an element (the
// paragraph itself), whose own style is the paragraph default -- the dialog
// then showed "Automatic"/dark text for red text and, on OK, applied that.
// Reading the first selected text node instead gives the text's real format.
function firstSelectedText(range:Range):Text|null{
 const root=range.commonAncestorContainer;
 if(root.nodeType===3)return root as Text;
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode:node=>range.intersectsNode(node)&&(node.textContent??"").trim()?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT});
 return walker.nextNode() as Text|null;
}
// makeBlock already reads double strikethrough from every ancestor (the Font
// dialog puts it on an OUTER span, around the span that carries the font);
// re-deriving it here from the text's immediate parent alone silently turned it
// off in the saved document, so a Model Answer's "double strikethrough" question
// was never detected.
function enrichBlock(block:ReturnType<typeof makeBlock>,element:Element){const nodes=textNodes(element);const runs=block.runs.map((run,index)=>{const parent=nodes[index]?.parentElement;const link=parent?.closest("a"),bookmark=parent?.closest("[data-bookmark]"),field=parent?.closest("[data-field]");return{...run,doubleStrike:"doubleStrike"in run&&typeof run.doubleStrike==="boolean"?run.doubleStrike:Boolean(parent&&getComputedStyle(parent).textDecorationStyle==="double"),href:link?.getAttribute("href")??null,bookmark:bookmark?.getAttribute("data-bookmark")??null,field:field?.getAttribute("data-field")??null}});const source=block.attrs as Record<string,unknown>;const common=["marginLeft","marginRight","lineHeight","marginTop","marginBottom","border","backgroundColor","hyphens"];const attrs:Record<string,unknown>={};if(block.type==="table"){for(const [key,value] of Object.entries(source))if(value!=null&&!common.includes(key))attrs[key]=value}else if(block.type==="image"){const image=element.querySelector("img");attrs.src=source.src;attrs.alt=source.alt??"";attrs.width=image?.naturalWidth||image?.width||1;attrs.height=image?.naturalHeight||image?.height||1;attrs.localAsset=element.hasAttribute("data-local-asset")}else if(block.type==="page-break"||block.type==="section-break")attrs.kind=block.type==="section-break"?"section-next-page":element.nextElementSibling?.textContent?.trim()?"page":"blank-page";else if(block.type!=="horizontal-rule"){for(const key of common)if(source[key]!=null)attrs[key]=source[key];if(block.type==="paragraph"){attrs.lineNumbers=element.classList.contains("editor-line-numbers");const dropCapNode=element.querySelector("[data-drop-cap]");attrs.dropCap=Boolean(dropCapNode);if(dropCapNode){const html=element as HTMLElement;if(html.dataset.dropCapLines)attrs.dropCapLines=Number(html.dataset.dropCapLines);if(html.dataset.dropCapDistance)attrs.dropCapDistance=Number(html.dataset.dropCapDistance);if(html.dataset.dropCapMargin==="true")attrs.dropCapMargin=true}}if(block.type==="list-item"){
  // This ran AFTER editorBlockAttrs (via makeStructuredBlock) had already
  // set attrs.listStyle correctly from element.dataset.listStyle -- the
  // one place applyListStyle (the Numbering ribbon dropdown's handler)
  // actually writes the chosen style, covering all 7 ORDERED_LIST_STYLES.
  // This unconditionally OVERWROTE that with its own, much narrower
  // check: only "upper-roman" was ever recognized (by testing the
  // enclosing <ol>'s CSS list-style-type, which applyListStyle never
  // sets -- only the older, unrelated multilevelList/romanNumbering
  // ribbon actions do), and every other style -- decimal-paren,
  // upper-alpha, lower-alpha-paren, lower-alpha, lower-roman, and even
  // upper-roman applied through the Numbering dropdown -- silently
  // collapsed to "decimal" or "bullet". Reproduced live: choosing
  // "I. II. III." (upper-roman) from the Numbering dropdown set
  // data-list-style="upper-roman" in the DOM immediately, survived
  // toSnapshot() correctly on inspection, yet the grading criterion this
  // question saved recorded "decimal" -- because enrichBlock ran right
  // after and clobbered it. Now prefers the explicit dataset value (on
  // the item itself, or its enclosing list) and only falls back to the
  // old CSS-based guess when neither is set, for lists built by that
  // older code path.
  const list=element.closest("ol,ul")as HTMLElement|null;
  const explicit=(element as HTMLElement).dataset.listStyle??list?.dataset.listStyle;
  attrs.listStyle=explicit??(list?.style.listStyleType==="upper-roman"?"upper-roman":list?"decimal":"bullet");
 }}return{...block,runs,attrs}}
function makeBlock(element:Element,id:string){const type=element.getAttribute("data-block-type")||(/^(LI)$/i.test(element.tagName)?"list-item":/^(TABLE)$/i.test(element.tagName)?"table":/^(FIGURE)$/i.test(element.tagName)?"image":/^(HR)$/i.test(element.tagName)?"page-break":"paragraph");const html=element instanceof HTMLElement?element:null;const alignment=html&&["left","center","right","justify"].includes(html.style.textAlign)?html.style.textAlign:"left";const attrs:Record<string,unknown>={};if(type==="table"){Object.assign(attrs,readTableAttrs(element as HTMLTableElement))}if(type==="image"){const img=element.querySelector("img");attrs.src=img?.getAttribute("src")??null;attrs.alt=(img?.getAttribute("alt")??"").slice(0,200)}const original=originalMeasurements(html);for(const key of["marginLeft","marginRight","lineHeight","marginTop","marginBottom","border","backgroundColor","hyphens"]as const){const current=html?.style[key];if(current)(attrs as Record<string,unknown>)[key]=measurementUnchanged(key,current,original[key])?original[key]:current}if(html?.dataset.borderKind)attrs.border=html.dataset.borderKind;if((type==="paragraph"||type==="list-item")&&html?.dataset.specialIndentMode){attrs.specialIndentMode=html.dataset.specialIndentMode;attrs.specialIndentAmount=html.dataset.specialIndentAmount??null}const runs=[];for(const node of textNodes(element)){const parent=node.parentElement;if(!parent||parent.closest('[contenteditable="false"]'))continue;const style=getComputedStyle(parent),decoration=style.textDecoration,decorationStyle=style.textDecorationStyle,vertical=style.verticalAlign,underlineNode=parent.closest("[data-underline-style]")as HTMLElement|null,doubleStrikeNode=parent.closest('[data-double-strike="true"]'),inherited=inheritedTextDecoration(node,element),underline=decoration.includes("underline")||Boolean(underlineNode)||inherited.underline,doubleStrike=Boolean(doubleStrikeNode)||decoration.includes("line-through")&&decorationStyle==="double"||inherited.doubleStrike,charScaleNode=parent.closest("[data-char-scale]")as HTMLElement|null,charSpacingNode=parent.closest("[data-char-spacing]")as HTMLElement|null,charPositionNode=parent.closest("[data-char-position]")as HTMLElement|null,kerningNode=parent.closest("[data-kerning-enabled]")as HTMLElement|null,outlineNode=parent.closest('[data-outline="true"]')as HTMLElement|null;runs.push({text:(node.textContent??"").slice(0,200000),bold:Number(style.fontWeight)>=600,italic:style.fontStyle==="italic",underline,underlineStyle:underline?underlineNode?.dataset.underlineStyle??"single":null,underlineColor:underlineNode?.dataset.underlineColor?.replace("#","").toUpperCase()??null,underlineThickness:underlineNode?.dataset.underlineThickness?Number(underlineNode.dataset.underlineThickness):underlineNode?.dataset.underlineStyle==="thick"?3:null,underlineWordsOnly:underlineNode?.dataset.underlineWordsOnly==="true"||underlineNode?.dataset.underlineStyle==="words-only",strike:(decoration.includes("line-through")||inherited.strike)&&!doubleStrike,doubleStrike,superscript:vertical==="super",subscript:vertical==="sub",smallCaps:Boolean(parent.closest('[data-small-caps="true"]')),allCaps:Boolean(parent.closest('[data-all-caps="true"]')),hidden:Boolean(parent.closest('[data-hidden="true"]')),outline:Boolean(outlineNode),emboss:Boolean(parent.closest('[data-emboss="true"]')),fontFamily:approvedFont(style.fontFamily),fontSize:approvedSize(style.fontSize),color:outlineNode?approvedColor(getComputedStyle(outlineNode).webkitTextStrokeColor):approvedColor(style.color),highlight:(/^T[DH]$/.test(parent.tagName)?null:approvedColor(style.backgroundColor))??approvedColor(inheritedHighlight(node,element)??""),charScale:charScaleNode?Number(charScaleNode.dataset.charScale):null,charSpacing:charSpacingNode?Number(charSpacingNode.dataset.charSpacing):null,charPosition:charPositionNode?Number(charPositionNode.dataset.charPosition):null,kerningEnabled:Boolean(kerningNode),kerningMin:kerningNode?.dataset.kerningMin?Number(kerningNode.dataset.kerningMin):null})}return{id,type,alignment,runs:runs.length?runs:[emptyRun()],attrs}}
function renderSnapshot(editor:HTMLDivElement|null,snapshot:ReturnType<typeof toSnapshot>){if(!editor)return;
 // toSnapshot() stamps editor.dataset.operations (the running list of
 // capability-gated commands the student has used) into every snapshot,
 // but until now nothing ever restored it back onto the editor element
 // when a snapshot was loaded -- so a page reload silently reset it to
 // empty. That's invisible during normal editing, but it broke the
 // post-deadline "submission must match the last valid autosave" check
 // (submit_word_efficiency_document, migration 202609071537): reloading
 // after the deadline, then clicking Submit with ZERO further edits,
 // still failed every time, because the freshly-computed toSnapshot()
 // now carried operations:[] while the stored autosave it was compared
 // against carried the real, non-empty list -- an un-satisfiable
 // mismatch, reproduced live. Restoring it here keeps toSnapshot() truly
 // idempotent across a render/reload round trip.
 editor.dataset.operations=(snapshot.operations??[]).join(",");
 editor.replaceChildren(...snapshot.blocks.map(block=>{const element=document.createElement(block.type==="list-item"?"li":block.type==="page-break"?"hr":block.type==="table"?"table":block.type==="image"?"figure":"p");element.id=block.id;const html=element as HTMLElement;
 // The initial JSX render (original.paragraphs.map(...)) sets textAlign
 // straight from paragraph.alignment, so a document whose Working Matter
 // is genuinely justified (this test's is -- confirmed via the admin
 // editor's own "JUSTIFY" paragraph preview) shows correctly aligned text
 // on first load. But renderSnapshot -- the path used every time a saved
 // document is loaded back in (after any save+reload, not just once) --
 // never read block.alignment at all, so every paragraph silently fell
 // back to the browser's own default ("left") the moment a document was
 // saved once and reopened. Reproduced live: comparing two consecutive
 // Model Answer questions' generated grading criteria showed EVERY
 // paragraph's alignment flagged as "changed to left", including ones
 // neither question touched -- the tell that "before" (still justified,
 // read from the pristine mount) and "after" (already collapsed to left
 // by this gap) genuinely differed for reasons unrelated to either
 // question's own edits, contaminating both with spurious criteria and
 // visibly un-justifying the whole document after the first save.
 if(block.alignment&&["left","center","right","justify"].includes(block.alignment))html.style.textAlign=block.alignment;
 const measurements:Record<string,unknown>={};for(const key of["marginLeft","marginRight","lineHeight","marginTop","marginBottom"]as const)if(block.attrs[key]!=null){const value=String(block.attrs[key]);html.style[key]=value;measurements[key]=block.attrs[key]}html.dataset.originalMeasurements=JSON.stringify(measurements);if(typeof block.attrs.border==="string"){applyBorderStyle(html,block.attrs.border);if(BORDER_SIDE_KEYWORDS.has(block.attrs.border))html.dataset.borderKind=block.attrs.border}if((block.type==="paragraph"||block.type==="list-item")&&block.attrs.specialIndentMode&&block.attrs.specialIndentMode!=="none"){html.dataset.specialIndentMode=String(block.attrs.specialIndentMode);if(block.attrs.specialIndentAmount){html.dataset.specialIndentAmount=String(block.attrs.specialIndentAmount);html.style.textIndent=block.attrs.specialIndentMode==="hanging"?`-${block.attrs.specialIndentAmount}`:String(block.attrs.specialIndentAmount)}}if(block.type==="table"&&Array.isArray(block.attrs.rows)){renderTableAttrs(element as HTMLTableElement,block.attrs)}else if(block.type==="image"&&typeof block.attrs.src==="string"&&safeImageSource(block.attrs.src)){const img=element.appendChild(document.createElement("img"));img.src=block.attrs.src;img.alt=String(block.attrs.alt??"");img.style.maxWidth="320px";img.style.maxHeight="320px";img.style.width="auto";img.style.height="auto"}else for(const run of block.runs){const span=document.createElement("span");span.style.fontWeight=run.bold?"700":"";span.style.fontStyle=run.italic?"italic":"";span.style.verticalAlign=run.superscript?"super":run.subscript?"sub":"";if(run.fontFamily)span.style.fontFamily=run.fontFamily;if(run.fontSize)span.style.fontSize=`${run.fontSize}pt`;if(run.color)span.style.color=`#${run.color}`;if(run.highlight)span.style.backgroundColor=run.highlight.startsWith("#")?run.highlight:`#${run.highlight}`;if(run.smallCaps){span.dataset.smallCaps="true";span.style.fontVariant="small-caps"}if(run.allCaps){span.dataset.allCaps="true";span.style.textTransform="uppercase"}if(run.hidden){span.dataset.hidden="true";span.style.opacity="0.4";span.style.textDecorationLine=[span.style.textDecorationLine,"underline"].filter(Boolean).join(" ");span.style.textDecorationStyle="dotted"}if(run.outline){span.dataset.outline="true";span.style.color="transparent";span.style.webkitTextStroke=`1px ${run.color?`#${run.color}`:"#000000"}`}if(run.emboss){span.dataset.emboss="true";span.style.color="#808080";span.style.textShadow="1px 1px 0 rgba(255,255,255,.85),-1px -1px 0 rgba(0,0,0,.55)"}if(run.charScale&&run.charScale!==100){span.dataset.charScale=String(run.charScale);span.style.display="inline-block";span.style.transform=`scaleX(${run.charScale/100})`;span.style.transformOrigin="left"}if(run.charSpacing){span.dataset.charSpacing=String(run.charSpacing);span.style.letterSpacing=`${run.charSpacing}pt`}if(run.charPosition){span.dataset.charPosition=String(run.charPosition);span.style.position="relative";span.style.top=`${-run.charPosition}pt`}if(run.kerningEnabled){span.dataset.kerningEnabled="true";span.style.fontKerning="normal";if(run.kerningMin)span.dataset.kerningMin=String(run.kerningMin)}const decorations=[];if(run.underline)decorations.push("underline");if(run.strike||run.doubleStrike)decorations.push("line-through");if(decorations.length)span.style.textDecorationLine=[span.style.textDecorationLine,...decorations].filter(Boolean).join(" ");if(run.doubleStrike){span.dataset.doubleStrike="true";span.style.textDecorationStyle="double"}if(run.underline){const style=run.underlineStyle??"single";span.dataset.underlineStyle=style;span.dataset.underlineWordsOnly=String(run.underlineWordsOnly===true);if(run.underlineColor){span.dataset.underlineColor=`#${run.underlineColor}`;span.style.textDecorationColor=`#${run.underlineColor}`}if(run.underlineThickness){span.dataset.underlineThickness=String(run.underlineThickness);span.style.textDecorationThickness=`${run.underlineThickness}px`}if(!run.doubleStrike&&!run.hidden)span.style.textDecorationStyle=underlineCssStyle(style)}span.textContent=run.text;element.appendChild(span)}if(block.type==="paragraph"){if(block.attrs.lineNumbers===true)html.classList.add("editor-line-numbers");if(block.attrs.dropCap===true){const lines=typeof block.attrs.dropCapLines==="number"?block.attrs.dropCapLines:3,distance=typeof block.attrs.dropCapDistance==="number"?block.attrs.dropCapDistance:0,margin=block.attrs.dropCapMargin===true;html.dataset.dropCapLines=String(lines);html.dataset.dropCapDistance=String(distance);if(margin)html.dataset.dropCapMargin="true";applyDropCapMarker(html,lines,distance,margin)}}return element}))}
function applyDropCapMarker(element:HTMLElement,lines=3,distance=0,margin=false){const first=element.querySelector("span");if(!first||!first.textContent)return;const characters=[...first.textContent],capCharacter=characters[0];if(!capCharacter)return;const rest=characters.slice(1).join("");const cap=document.createElement("span");cap.dataset.dropCap="true";cap.style.cssText=first.style.cssText;cap.style.float="left";cap.style.fontSize=`${lines}em`;cap.style.lineHeight=".8";cap.style.marginRight=`${distance}in`;if(margin){cap.dataset.dropCapMargin="true";cap.style.marginLeft=`-${lines*0.5+distance}in`}cap.textContent=capCharacter;if(rest)first.textContent=rest;else first.remove();element.insertBefore(cap,element.firstChild)}
function makeStructuredBlock(element:Element,id:string){const block=makeBlock(element,id),html=element as HTMLElement,type=editorBlockType(element);return{...block,type,attrs:{...block.attrs,...editorBlockAttrs(html,type)}}}
// Puts a saved page layout back on the page (margins, gutter, size, orientation, columns, colour,
// border, watermark). Before this, a reloaded answer silently reverted to the default page.
export function applySavedPageLayout(editor:HTMLDivElement,layout:Record<string,unknown>|null|undefined){if(!layout||typeof layout!=="object")return;const text=(key:string)=>typeof layout[key]==="string"?layout[key] as string:"";
 const margins=parsePadding(text("padding"));const gutterMm=Number.parseFloat(text("gutter"));const position=text("gutterPosition")==="top"?"top":"left";
 if(margins){editor.dataset.margins=text("padding");if(Number.isFinite(gutterMm)&&gutterMm>0){editor.dataset.gutter=String(gutterMm);editor.dataset.gutterPosition=position;editor.style.padding=renderedPadding(margins,gutterMm/10,position)}else editor.style.padding=text("padding")}
 if(text("maxWidth"))editor.style.maxWidth=text("maxWidth");if(text("aspectRatio"))editor.style.aspectRatio=text("aspectRatio");if(text("columnCount"))editor.style.columnCount=text("columnCount");
 if(text("backgroundColor"))editor.style.backgroundColor=text("backgroundColor").startsWith("#")?text("backgroundColor"):`#${text("backgroundColor")}`;if(text("border"))editor.style.border=text("border");if(text("watermark"))editor.setAttribute("data-watermark",text("watermark"))}
function renderStructuredSnapshot(editor:HTMLDivElement|null,snapshot:ReturnType<typeof toSnapshot>){renderSnapshot(editor,snapshot);if(!editor)return;applySavedPageLayout(editor,snapshot.pageLayout);snapshot.blocks.forEach((block,index)=>{if(!["paragraph","list-item","page-break"].includes(block.type)){const current=editor.children[index]as HTMLElement|undefined;if(current){const replacement=createEditorBlock(document,block);if(!["table","image","page-break","section-break"].includes(block.type))replacement.append(...current.childNodes);const measurements:Record<string,unknown>={};for(const key of["marginLeft","marginRight","lineHeight","marginTop","marginBottom"]as const)if(block.attrs[key]!=null)measurements[key]=block.attrs[key];replacement.dataset.originalMeasurements=JSON.stringify(measurements);current.replaceWith(replacement)}}const element=editor.children[index]as HTMLElement|undefined;if(!element||["table","image","page-break","section-break"].includes(block.type))return;const spans=[...element.querySelectorAll(":scope > span")];block.runs.forEach((run,runIndex)=>{const span=spans[runIndex]as HTMLElement|undefined;if(!span)return;if(run.bookmark)span.dataset.bookmark=run.bookmark;if(run.field)span.dataset.field=run.field;if(run.href){const link=document.createElement("a");link.href=run.href;span.replaceWith(link);link.append(span)}})});editor.replaceChildren(...regroupListElements([...editor.children]as HTMLElement[],snapshot.blocks,document))}
function originalMeasurements(element:HTMLElement|null){if(!element?.dataset.originalMeasurements)return{}as Record<string,unknown>;try{const value=JSON.parse(element.dataset.originalMeasurements);return value&&typeof value==="object"?value as Record<string,unknown>:{}as Record<string,unknown>}catch{return{}as Record<string,unknown>}}
function measurementUnchanged(key:string,current:string,original:unknown){if(original===undefined)return false;const kind=key==="lineHeight"?"lineHeight":"length";return canonicalWordMeasurement(current,kind)===canonicalWordMeasurement(original,kind)}
function underlineCssStyle(style:string):"solid"|"double"|"dotted"|"dashed"|"wavy"{return style==="double"?"double":style==="dotted"||style==="dot-dash"||style==="dot-dot-dash"?"dotted":style==="dashed"?"dashed":style==="wavy"?"wavy":"solid"}
function textNodes(element:Node){const walker=document.createTreeWalker(element,NodeFilter.SHOW_TEXT);const nodes:Text[]=[];let node=walker.nextNode();while(node&&nodes.length<20000){nodes.push(node as Text);node=walker.nextNode()}return nodes}
function emptyBlock(){return{id:"block-empty",type:"paragraph",alignment:"left",runs:[emptyRun()],attrs:{} as Record<string,unknown>}}function emptyRun(){return{text:"",bold:false,italic:false,underline:false,underlineStyle:null,underlineColor:null,underlineThickness:null,underlineWordsOnly:false,strike:false,superscript:false,subscript:false,smallCaps:false,allCaps:false,hidden:false,outline:false,emboss:false,fontFamily:null,fontSize:null,color:null,highlight:null,charScale:null,charSpacing:null,charPosition:null,kerningEnabled:false,kerningMin:null}}
function approvedFont(value:string){const font=value.replace(/["']/g,"").split(",")[0].trim();return(APPROVED_WORD_FONTS as readonly string[]).includes(font)?font:null}
// getComputedStyle(...).fontSize is always reported in px (the DOM's
// unconditional unit for computed style), but every run's fontSize is
// stored and later re-rendered as `${run.fontSize}pt` (see renderSnapshot).
// This must convert px -> pt (the same *.75 factor already used correctly
// by fontDialog() and applyFontStep() elsewhere in this file) before
// storing it -- without it, a run declared at 14pt round-trips through
// toSnapshot() as literally "18.6667", then gets rendered back as
// "18.6667pt" the next time the document is loaded/restored (autosave
// restore, reopening a saved Model Answer, Compare Current) -- ~33%
// larger every round-trip, compounding on repeated saves. This was the
// real cause of a reported bug: paragraphs visibly growing/shrinking
// while working on the Model Answer page.
// Half points are kept (Word allows 18.5 pt); whole-number rounding saved 18.5 as 19.
function approvedSize(value:string){const size=Math.round(Number.parseFloat(value)*.75*2)/2;return Number.isFinite(size)&&size>=1&&size<=1638?size:null}
// getComputedStyle().backgroundColor for any element with no background set
// at all -- which is every run that was never highlighted -- resolves to
// "rgba(0, 0, 0, 0)" (fully transparent black) in every browser. The old
// rgba regex captured only the R/G/B groups and ignored the trailing alpha
// channel, so that transparent default was parsed as opaque black and
// silently written into every run's `highlight` field on every autosave --
// turning ordinary, never-highlighted text into a solid black bar the
// moment the document was saved and reloaded. Reading the alpha group (when
// present) and treating alpha<=0 as "no color at all" fixes it for both
// background and text color alike.
// Real reported bug (EFFICIENCY TEST 2): a bulleted paragraph carries no
// inline line spacing / spacing after of its own, so the Paragraph dialog
// opened with "1" and 0 pt and, on OK, silently changed the paragraph's line
// spacing even when only "Spacing after" was edited. Prefill from what is
// shown instead, as Word does.
function shownSpacing(block:HTMLElement){const style=getComputedStyle(block);const size=Number.parseFloat(style.fontSize)||16;const height=Number.parseFloat(style.lineHeight);const line=Number.isFinite(height)&&height>0?String(Math.round(height/size*100)/100):"1.15";const after=Math.round((Number.parseFloat(style.marginBottom)||0)*0.75*10)/10;return{line,after}}
function approvedColor(value:string){const hex=value.match(/^#([0-9a-f]{6})$/i)?.[1];if(hex)return hex.toUpperCase();const rgba=value.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)$/i);if(!rgba)return null;if(rgba[4]!==undefined&&Number(rgba[4])<=0)return null;return rgba.slice(1,4).map(part=>Number(part).toString(16).padStart(2,"0")).join("").toUpperCase()}function approvedCssColor(value:string){return approvedColor(value)}
function escapeHtml(value:string){return value.replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]!))}function safeId(value:string){return value.replace(/[^a-z0-9_-]/gi,"").slice(0,50)}function bounded(value:string,min:number,max:number){const number=Number(value);return Number.isFinite(number)?Math.max(min,Math.min(max,number)):min}function changeCase(value:string){if(!value)return value;if(value===value.toUpperCase())return value.toLowerCase();if(value===value.toLowerCase())return value.replace(/\b\p{L}/gu,char=>char.toUpperCase());return value.toUpperCase()}function safeImageSource(value:string){return /^data:image\/(?:png|jpeg|webp|gif);base64,[a-z0-9+/=]+$/i.test(value)&&value.length<750000}
