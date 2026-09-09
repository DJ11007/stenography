"use client";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import type { MatterParagraph, WorkingMatterSnapshot } from "@/lib/word-docx";
import { APPROVED_WORD_FONTS, isWordCommandEnabled, normalizeWordEditorCapabilities, WORD_EDITOR_RIBBON, type WordEditorTab } from "@/lib/word-editor-capabilities";
import { SAFE_COLORS, WordEditorRibbon } from "@/components/word-efficiency/word-editor-ribbon";
import { autosaveWordDocument, submitWordDocument } from "../../../actions";
import { insertOnlinePicture, sortSelectedBlocks } from "@/lib/word-editor-browser-tools";
import { canonicalWordMeasurement } from "@/lib/word-editor-measurements";
import { adjustParagraphIndent, changeEditorRangeCase, clearEditorRangeFormatting, parseInches, selectedEditorBlocks, snapshotPaintStyle, wrapEditorRange, type EditorRunStyles } from "@/lib/word-editor-dom";
import { createEditorBlock, editorBlockAttrs, editorBlockType, expandListElements, regroupListElements } from "@/lib/word-editor-structure";
import { buildFindRegex, DEFAULT_FIND_OPTIONS, type FindOptions } from "@/lib/word-find-replace";

type ViewState = { zoom:number; ruler:boolean; gridlines:boolean; documentMap:boolean; thumbnails:boolean; formattingMarks:boolean; statusBar:boolean; mode:"print"|"reading"|"web"|"outline"|"draft" };
const DEFAULT_VIEW:ViewState={zoom:100,ruler:true,gridlines:false,documentMap:false,thumbnails:false,formattingMarks:false,statusBar:true,mode:"print"};
const TABLE_TOOL_ACTIONS:[string,string][]=[["add-row-above","Insert Above"],["add-row-below","Insert Below"],["add-column-left","Insert Left"],["add-column-right","Insert Right"],["remove-row","Delete Row"],["remove-column","Delete Column"],["remove-table","Delete Table"]];
const BORDER_SIDE_KEYWORDS=new Set(["all","outside","top","bottom","left","right"]);const BORDER_CSS="1px solid #0e7490";
function applyBorderStyle(html:HTMLElement,kind:string){html.style.borderTop=html.style.borderRight=html.style.borderBottom=html.style.borderLeft=html.style.border="";if(kind==="all"||kind==="outside")html.style.border=BORDER_CSS;else if(kind==="top")html.style.borderTop=BORDER_CSS;else if(kind==="bottom")html.style.borderBottom=BORDER_CSS;else if(kind==="left")html.style.borderLeft=BORDER_CSS;else if(kind==="right")html.style.borderRight=BORDER_CSS;else html.style.border=kind}
type DialogState={kind:"symbol"}|{kind:"insertTable"}|{kind:"insertTableCustom"}|{kind:"tableEdit"}|{kind:"margins";top:string;right:string;bottom:string;left:string}|{kind:"watermark";text:string}|{kind:"pageColor";value:string}|{kind:"columns";value:string}|{kind:"pageSize";value:string}|{kind:"lineSpacingOptions";before:string;after:string;specialIndentMode:string;specialIndentAmount:string}|{kind:"findReplace";mode:"find"|"replace"|"goto";query:string;replacement:string;matchCase:boolean;wholeWord:boolean;wildcards:boolean;matchPrefix:boolean;matchSuffix:boolean;ignorePunctuation:boolean;ignoreWhitespace:boolean;formatHighlight:boolean;bookmarks:string[];hadSelection:boolean}|{kind:"zoom";value:string}|{kind:"sort";value:string}|{kind:"pageNumber";position:string;alignment:string;style:string;format:string;startAt:string}|{kind:"headerFooterGallery";which:"header"|"footer";hasExisting:boolean;customStyles:{name:string;preview:string;html:string}[]}|{kind:"dropCapOptions";position:string;fontFamily:string;lines:string;distance:string}|{kind:"font";bold:boolean;italic:boolean;fontFamily:string;fontSize:string;color:string;underlineStyle:string;underlineColor:string;strike:boolean;doubleStrike:boolean;superscript:boolean;subscript:boolean;smallCaps:boolean;allCaps:boolean;hidden:boolean;outline:boolean;emboss:boolean;charScale:string;charSpacing:string;charPosition:string;kerningEnabled:boolean;kerningMin:string}|{kind:"paragraph";alignment:string;marginLeft:string;marginRight:string;specialIndentMode:string;specialIndentAmount:string;spaceBefore:string;spaceAfter:string;lineSpacing:string;hyphens:boolean;lineNumbers:boolean};
function hasSearchHighlight(element:Element|null){if(!element)return false;const color=getComputedStyle(element).backgroundColor;return Boolean(color)&&color!=="rgba(0, 0, 0, 0)"&&color!=="transparent"}
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
const CUSTOM_HEADER_FOOTER_KEY:Record<"header"|"footer",string>={header:"word-editor-custom-headers",footer:"word-editor-custom-footers"};
function loadCustomHeaderFooterStyles(which:"header"|"footer"):{name:string;preview:string;html:string}[]{
 try{const raw=localStorage.getItem(CUSTOM_HEADER_FOOTER_KEY[which]);const value=raw?JSON.parse(raw):[];return Array.isArray(value)?value.filter((item):item is{name:string;preview:string;html:string}=>Boolean(item)&&typeof item.name==="string"&&typeof item.preview==="string"&&typeof item.html==="string").slice(0,20):[]}catch{return[]}
}
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
const PAGE_SIZE_WIDTHS:Record<string,number>={letter:816,legal:816,statement:528,executive:696,a4:794,a5:559,b5:688};

// Optional authoring-mode props let this exact editor be reused for admin
// "Model Answer" authoring (see app/admin/word-efficiency-tests/model-answer)
// without touching the default student-attempt behavior at all: every new
// prop defaults to the original hardcoded action/label/confirm/lock, so a
// caller that omits them (every existing student workspace) behaves
// byte-for-byte as before.
export function RichDocumentEditor({attemptId,original,initialDocument,capabilities:rawCapabilities,locked,mode="attempt",autosaveAction,submitAction,submitLabel="Submit Final Document",submitConfirmMessage="Submit your final document? You cannot edit it afterward.",oneTimeSubmit=true,onReady,onSaved}:{attemptId:string;original:WorkingMatterSnapshot;initialDocument?:unknown;capabilities:unknown;locked:boolean;mode?:"attempt"|"authoring";autosaveAction?:typeof autosaveWordDocument;submitAction?:typeof submitWordDocument;submitLabel?:string;submitConfirmMessage?:string|null;oneTimeSubmit?:boolean;onReady?:(snapshot:ReturnType<typeof toSnapshot>)=>void;onSaved?:(snapshot:ReturnType<typeof toSnapshot>)=>void}){
 const router=useRouter();
 const capabilities=useMemo(()=>normalizeWordEditorCapabilities(rawCapabilities),[rawCapabilities]);
 const visibleTabs=WORD_EDITOR_RIBBON.filter(tab=>capabilities.tabs[tab.id].enabled);
 const editor=useRef<HTMLDivElement>(null),imageInput=useRef<HTMLInputElement>(null),autosaveTimer=useRef<ReturnType<typeof setTimeout>|null>(null),lastAutosave=useRef<ReturnType<typeof toSnapshot>|null>(null),savedRange=useRef<Range|null>(null),paintStyle=useRef<EditorRunStyles|null>(null),viewport=useRef<HTMLElement>(null),dialogTableRef=useRef<{table:HTMLTableElement;rowIndex:number;cellIndex:number}|null>(null),runRef=useRef<(id:string)=>void>(()=>{}),marginClick=useRef<{count:number;time:number;y:number}>({count:0,time:0,y:-9999});
 // Captured once, the moment the Find and Replace dialog opens (while the
 // document selection is still live) -- distinct from savedRange, which
 // serves toolbar formatting actions and can be overwritten while the
 // dialog is open. Typing into the dialog's own "Find what"/"Replace with"
 // inputs moves focus (and getSelection()) away from the document, so
 // find/replace must remember the scope up front rather than re-reading
 // getSelection() when Find Next/Replace/Replace All are actually clicked.
 const findScopeRange=useRef<Range|null>(null);
 const[tab,setTab]=useState<WordEditorTab>(visibleTabs.find(item=>item.id==="Home")?.id??visibleTabs[0]?.id??"Home"),[status,setStatus]=useState("Ready"),[submitted,setSubmitted]=useState(locked),[finalSubmitting,setFinalSubmitting]=useState(false),[view,setView]=useState<ViewState>(DEFAULT_VIEW),[message,setMessage]=useState(""),[showOriginal,setShowOriginal]=useState(false),[query,setQuery]=useState(""),[thumbnails,setThumbnails]=useState<{id:string;targetId:string;nodes:HTMLElement[]}[]>([]),[dialog,setDialog]=useState<DialogState|null>(null),[currentFont,setCurrentFont]=useState<string|undefined>(undefined),[insideTable,setInsideTable]=useState(false),[paintMode,setPaintMode]=useState<"off"|"once"|"sticky">("off"),[insideHeaderFooter,setInsideHeaderFooter]=useState<"header"|"footer"|null>(null),[showDocumentText,setShowDocumentText]=useState(true),[headerFooterToolsSelected,setHeaderFooterToolsSelected]=useState(false),[staleDeploy,setStaleDeploy]=useState(false);
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
 useEffect(()=>{let scheduled=false;const measure=()=>{scheduled=false;const selection=getSelection();if(selection?.rangeCount&&editor.current?.contains(selection.anchorNode)){savedRange.current=selection.getRangeAt(0).cloneRange();const node=selection.anchorNode,parent=node instanceof Element?node:node?.parentElement;if(parent){const family=approvedFont(getComputedStyle(parent).fontFamily);if(family)setCurrentFont(family);setInsideTable(Boolean(parent.closest("table")));const headerFooter=parent.closest("header,footer");setInsideHeaderFooter(headerFooter?headerFooter.tagName.toLowerCase()as"header"|"footer":null)}}};const remember=()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(measure)};document.addEventListener("selectionchange",remember);const cancel=(event:globalThis.KeyboardEvent)=>{if(event.key==="Escape"&&paintStyle.current){paintStyle.current=null;setPaintMode("off");setMessage("Format Painter cancelled.");return}if(!editor.current?.contains(document.activeElement)&&document.activeElement!==editor.current)return;const key=event.key.toLowerCase();if((event.ctrlKey||event.metaKey)&&!event.shiftKey&&key==="z"){event.preventDefault();runRef.current("undo");return}if((event.ctrlKey||event.metaKey)&&(key==="y"||(event.shiftKey&&key==="z"))){event.preventDefault();runRef.current("redo")}};document.addEventListener("keydown",cancel);return()=>{document.removeEventListener("selectionchange",remember);document.removeEventListener("keydown",cancel)}},[]);
 useEffect(()=>{const exactSize=(event:Event)=>{const size=(event as CustomEvent<number>).detail;if(Number.isFinite(size)&&size>=capabilities.fontSizeMin&&size<=capabilities.fontSizeMax)applyRunStyles({fontSize:`${size}pt`})};window.addEventListener("word-editor-font-size",exactSize);return()=>window.removeEventListener("word-editor-font-size",exactSize)},[capabilities.fontSizeMin,capabilities.fontSizeMax]);
 useEffect(()=>{if(view.thumbnails)buildThumbnails()},[view.thumbnails,status]);
 const allowed=(id:string)=>{const capabilityId=({zoom:"zoom100",thumbnails:"documentMap",pageWidth:"twoPages",formatPainterSticky:"formatPainter"}as Record<string,string>)[id]??id,viewOnly=new Set(["selectAll","formattingMarks","printLayout","fullScreenReading","webLayout","outlineView","draftView","ruler","gridlines","documentMap","thumbnails","zoom","zoom100","onePage","twoPages","pageWidth","undo","redo"]);const clearDependencies=["fontName","fontSize","bold","italic","underline","strikeThrough","subscript","superscript","textEffects","highlightColor","fontColor"],clearFormatting=id==="clearCharacterFormatting",ok=clearFormatting?clearDependencies.every(command=>isWordCommandEnabled(capabilities,command)):isWordCommandEnabled(capabilities,capabilityId);if(ok&&editor.current){if(!clearFormatting&&!viewOnly.has(id)){const used=new Set((editor.current.dataset.operations??"").split(",").filter(Boolean));used.add(capabilityId);editor.current.dataset.operations=[...used].slice(0,256).join(",")}if(id==="selectAll"){const range=document.createRange(),selection=getSelection();range.selectNodeContents(editor.current);selection?.removeAllRanges();selection?.addRange(range);savedRange.current=range;return false}if(id==="formatPainter"||id==="formatPainterSticky"){activateFormatPainter(id==="formatPainterSticky");return false}if(id==="increaseFontSize"){applyFontStep(1);return false}if(id==="decreaseFontSize"){applyFontStep(-1);return false}if(id==="textEffects"){applyDoubleStrike();return false}if(id==="clearCharacterFormatting"||id==="clearSelectionFormatting"){restoreSelection();const selection=getSelection();if(selection?.rangeCount){const range=clearEditorRangeFormatting(selection.getRangeAt(0));if(range){savedRange.current=range;changed()}}return false}if(id==="changeCase"){restoreSelection();const selection=getSelection();if(selection?.rangeCount){const source=selection.getRangeAt(0).toString(),mode=source===source.toLocaleUpperCase()?"lower":source===source.toLocaleLowerCase()?"title":"upper",range=changeEditorRangeCase(selection.getRangeAt(0),mode);if(range){savedRange.current=range;changed()}}return false}if(id==="increaseIndent"||id==="decreaseIndent"){if(adjustParagraphIndent(selectedBlocks(),id==="increaseIndent"?1:-1))changed();return false}if(["alignLeft","alignCenter","alignRight","justify"].includes(id)){const alignment=({alignLeft:"left",alignCenter:"center",alignRight:"right",justify:"justify"}as Record<string,string>)[id],blocks=selectedBlocks();for(const block of blocks)block.style.textAlign=alignment;if(blocks.length)changed();return false}if(id==="shading"){const value=approvedCssColor(promptValue("Paragraph shading color:","#ffff00"));if(value){for(const block of selectedBlocks())block.style.backgroundColor=value;changed()}return false}if(id==="multilevelList"){exec("insertOrderedList");const list=getSelection()?.anchorNode?.parentElement?.closest("ol");if(list)list.style.listStyleType="upper-roman";changed();return false}if(id==="sort"){setDialog({kind:"sort",value:"Ascending"});return false}if(id==="onlinePictures"){void insertOnlinePicture(editor.current,changed,setMessage);return false}}return ok};
 const changed=()=>{if(submitted)return;setStatus("Unsaved changes");if(autosaveTimer.current)clearTimeout(autosaveTimer.current);autosaveTimer.current=setTimeout(async()=>{if(!editor.current)return;const snapshot=toSnapshot(editor.current);setStatus("Saving…");try{const result=await(autosaveAction??autosaveWordDocument)(attemptId,snapshot);if(!result.ok){setStatus(result.error);return}lastAutosave.current=snapshot;setStatus("Saved")}catch(error){if(isStaleServerActionError(error)){setStaleDeploy(true);setStatus("A newer version of this page was published. Refresh to continue -- your last saved autosave is safe.");return}setStatus(process.env.NODE_ENV==="development"&&error instanceof Error?`Autosave failed: ${error.message}`:"Autosave failed")}},800)};
 const restoreSelection=()=>{if(savedRange.current){const selection=getSelection();selection?.removeAllRanges();selection?.addRange(savedRange.current)}};
 const buildThumbnails=()=>{if(!editor.current)return;const children=[...editor.current.children]as HTMLElement[];const groups:HTMLElement[][]=[[]];for(const child of children){if(child.tagName==="HR")groups.push([]);groups[groups.length-1].push(child)}setThumbnails(groups.filter(group=>group.length).map((group,index)=>({id:`thumb-${index}`,targetId:group[0].id,nodes:group.map(element=>element.cloneNode(true)as HTMLElement)})))};
 const measuredFit=(mode:"width"|"height"|"twoPage")=>{const container=viewport.current,pageWidthPx=794;if(!container)return 100;if(mode==="width")return bounded(String(Math.round((container.clientWidth-32)/pageWidthPx*100)),25,200);if(mode==="twoPage")return bounded(String(Math.round((container.clientWidth-48)/(pageWidthPx*2)*100)),15,150);const pageHeightPx=editor.current?.scrollHeight||1123;return bounded(String(Math.round((container.clientHeight-32)/pageHeightPx*100)),15,150)};
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
 const exec=(name:string,value?:string)=>{editor.current?.focus();restoreSelection();const safeValue=name==="fontName"?value?.replace(/ \((?:Headings|Body)\)$/u,""):value;const beforeCount=name==="undo"||name==="redo"||!editor.current?null:editor.current.children.length;document.execCommand(name,false,safeValue);if(beforeCount!==null)pruneStrayEmptyBlocks(beforeCount);changed()};
 const selectedBlocks=()=>{restoreSelection();const selection=getSelection();return editor.current&&selection?.rangeCount?selectedEditorBlocks(editor.current,selection.getRangeAt(0)):[]};
 const applyRunStyles=(styles:EditorRunStyles)=>{editor.current?.focus();restoreSelection();const selection=getSelection();if(!selection?.rangeCount)return;const wrapped=wrapEditorRange(selection.getRangeAt(0),styles);if(wrapped){savedRange.current=wrapped.range;changed()}};
 const applyFontStep=(direction:1|-1)=>{restoreSelection();const node=getSelection()?.anchorNode,parent=node instanceof Element?node:node?.parentElement,current=Number.parseFloat(parent?getComputedStyle(parent).fontSize:"11")*.75,sizes=[8,9,10,11,12,14,16,18,20,24,28,32,36,48,72].filter(size=>size>=capabilities.fontSizeMin&&size<=capabilities.fontSizeMax),index=direction>0?sizes.findIndex(size=>size>current):sizes.findLastIndex(size=>size<current),size=index<0?(direction>0?sizes.at(-1):sizes[0]):sizes[index];if(size)applyRunStyles({fontSize:`${size}pt`})};
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
 const underline=(action:string,value?:string)=>{editor.current?.focus();restoreSelection();const selection=getSelection();if(!selection?.rangeCount||selection.isCollapsed)return;const range=selection.getRangeAt(0),anchor=selection.anchorNode instanceof Element?selection.anchorNode:selection.anchorNode?.parentElement,current=anchor?.closest("[data-underline-style]")as HTMLElement|null;if(action==="none"){document.execCommand("underline",false);if(current){delete current.dataset.underlineStyle;delete current.dataset.underlineColor;delete current.dataset.underlineThickness;delete current.dataset.underlineWordsOnly;current.style.textDecoration="none"}changed();return}if(action==="color"&&value&&/^#[0-9a-f]{6}$/i.test(value)){if(current){current.dataset.underlineColor=value;current.style.textDecorationColor=value;changed()}return}if(action==="thickness"&&value&&/^[1-5]$/.test(value)){if(current){current.dataset.underlineThickness=value;current.style.textDecorationThickness=`${value}px`;changed()}return}if(action==="words-only"){if(current){current.dataset.underlineWordsOnly=value==="true"?"true":"false";if(value==="true")current.dataset.underlineStyle="words-only";changed()}return}const span=document.createElement("span");span.dataset.underlineStyle=action;span.dataset.underlineWordsOnly=String(action==="words-only");span.dataset.underlineThickness=action==="thick"?"3":"";span.style.textDecorationLine="underline";span.style.textDecorationStyle=underlineCssStyle(action);span.style.textDecorationThickness=action==="thick"?"3px":"auto";try{range.surroundContents(span)}catch{span.append(range.extractContents());range.insertNode(span)}const selected=document.createRange();selected.selectNodeContents(span);savedRange.current=selected;changed()};
 const applyDoubleStrike=()=>{editor.current?.focus();restoreSelection();const selection=getSelection();if(!selection?.rangeCount||selection.isCollapsed)return;const range=selection.getRangeAt(0),span=document.createElement("span");span.dataset.doubleStrike="true";span.style.textDecorationLine="line-through";span.style.textDecorationStyle="double";try{range.surroundContents(span)}catch{span.append(range.extractContents());range.insertNode(span)}const selected=document.createRange();selected.selectNodeContents(span);savedRange.current=selected;changed()};
 const insertSafe=(html:string)=>exec("insertHTML",html);
 const promptValue=(label:string,initial="")=>window.prompt(label,initial)?.trim()??"";
 const clipboard=async(action:"copy"|"cut"|"paste")=>{const range=savedRange.current?.cloneRange();if(action==="paste"){try{const text=await navigator.clipboard.readText();if(range)savedRange.current=range;editor.current?.focus();restoreSelection();document.execCommand("insertText",false,text);setMessage("Pasted plain text.");changed()}catch(error){setMessage(error instanceof DOMException&&error.name==="NotAllowedError"?"Use Ctrl+V to paste text from your clipboard.":"Paste failed.")}return}if(!range||range.collapsed){setMessage(`Nothing selected to ${action}.`);return}const text=range.toString();try{if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(text);else{restoreSelection();if(!document.execCommand(action,false))throw new Error("Clipboard fallback failed");setMessage(action==="cut"?"Cut to clipboard.":"Copied to clipboard.");if(action==="cut")changed();return}savedRange.current=range;restoreSelection();if(action==="cut"){range.deleteContents();changed()}setMessage(action==="cut"?"Cut to clipboard.":"Copied to clipboard.")}catch{savedRange.current=range;restoreSelection();if(document.execCommand(action,false)){setMessage(action==="cut"?"Cut to clipboard.":"Copied to clipboard.");if(action==="cut")changed()}else setMessage(`${action==="cut"?"Cut":"Copy"} failed.`)}};
 const run=(id:string)=>{if(submitted||!allowed(id))return;const map:Record<string,()=>void>={undo:()=>exec("undo"),redo:()=>exec("redo"),cut:()=>{void clipboard("cut")},copy:()=>{void clipboard("copy")},paste:()=>{void clipboard("paste")},increaseFontSize:()=>exec("increaseFontSize"),decreaseFontSize:()=>exec("decreaseFontSize"),bold:()=>exec("bold"),italic:()=>exec("italic"),underline:()=>exec("underline"),strikeThrough:()=>exec("strikeThrough"),doubleStrikeThrough:()=>insertSafe("<span style=\"text-decoration-line:line-through;text-decoration-style:double\">"+escapeHtml(getSelection()?.toString()||"")+"</span>"),superscript:()=>exec("superscript"),subscript:()=>exec("subscript"),changeCase:()=>replaceSelection(changeCase(getSelection()?.toString()??"")),clearCharacterFormatting:()=>exec("removeFormat"),bullets:()=>exec("insertUnorderedList"),numbering:()=>exec("insertOrderedList"),romanNumbering:()=>{exec("insertOrderedList");const list=getSelection()?.anchorNode?.parentElement?.closest("ol");if(list)list.style.listStyleType="upper-roman";changed()},decreaseIndent:()=>exec("outdent"),increaseIndent:()=>exec("indent"),alignLeft:()=>exec("justifyLeft"),alignCenter:()=>exec("justifyCenter"),alignRight:()=>exec("justifyRight"),justify:()=>exec("justifyFull"),selectAll:()=>exec("selectAll"),clearParagraphFormatting:()=>{exec("formatBlock","p");exec("justifyLeft")},pageBreak:()=>insertSafe('<hr data-block-type="page-break" class="my-8 border-t-2 border-dashed border-cyan-500">'),blankPage:()=>insertSafe('<hr data-block-type="page-break"><p><br></p>'),coverPage:()=>insertSafe('<section data-block-type="cover-page"><h1>Document title</h1><p>Subtitle</p></section><hr data-block-type="page-break">'),insertTable:()=>setDialog({kind:"insertTable"}),tableRowsColumns:()=>openTableEditDialog(),deleteTable:()=>tableActionAtCursor("remove-table"),insertPicture:()=>imageInput.current?.click(),localClipArt:()=>insertSafe('<figure data-block-type="image" data-local-asset="samradhi-mark"><div role="img" aria-label="Samradhi Classes study emblem" class="rounded-xl border-2 border-cyan-700 p-5 text-center font-bold text-cyan-900">SC · Learn · Practise · Succeed</div><figcaption>Samradhi Classes</figcaption></figure>'),shapes:()=>insertSafe('<span data-block-type="shape" class="inline-block rounded-full border-4 border-cyan-700 px-8 py-4">Shape</span>'),textBox:()=>insertSafe('<aside data-block-type="text-box" class="my-3 border-2 border-cyan-700 p-4">Text box</aside>'),hyperlink:()=>safeLink(),bookmark:()=>{const name=safeId(promptValue("Bookmark name:"));if(name)insertSafe(`<span id="bookmark-${name}" data-bookmark="${name}">🔖</span>`)},crossReference:()=>{const name=safeId(promptValue("Bookmark to reference:"));if(name)insertSafe(`<a href="#bookmark-${name}">See ${escapeHtml(name)}</a>`)},header:()=>setDialog({kind:"headerFooterGallery",which:"header",hasExisting:Boolean(editor.current?.querySelector("header")),customStyles:loadCustomHeaderFooterStyles("header")}),footer:()=>setDialog({kind:"headerFooterGallery",which:"footer",hasExisting:Boolean(editor.current?.querySelector("footer")),customStyles:loadCustomHeaderFooterStyles("footer")}),pageNumber:()=>setDialog({kind:"pageNumber",position:insideHeaderFooter==="header"?"top":"bottom",alignment:"center",style:"plain",format:"1",startAt:"1"}),dateTime:()=>insertSafe(`<span data-field="date-time">${escapeHtml(new Date().toLocaleString())}</span>`),horizontalLine:()=>insertSafe('<hr data-block-type="horizontal-rule">'),symbol:()=>setDialog({kind:"symbol"}),specialCharacters:()=>setDialog({kind:"symbol"}),sectionBreak:()=>insertSafe('<hr data-block-type="section-break" class="my-8 border-double">'),lineNumbers:()=>toggleEditorClass("editor-line-numbers"),hyphenation:()=>toggleStyle("hyphens","auto"),wordCount:()=>counts(),characterCount:()=>counts(),spelling:()=>{if(editor.current){editor.current.spellcheck=!editor.current.spellcheck;setMessage(`Spelling indicator ${editor.current.spellcheck?"enabled":"disabled"}.`)}},showOriginal:()=>setShowOriginal(value=>!value),compareCurrent:()=>compare(),restoreAutosave:()=>restore(),clearSelectionFormatting:()=>exec("removeFormat"),printLayout:()=>viewMode("print"),fullScreenReading:()=>viewMode("reading"),webLayout:()=>viewMode("web"),outlineView:()=>viewMode("outline"),draftView:()=>viewMode("draft"),ruler:()=>toggleView("ruler"),gridlines:()=>toggleView("gridlines"),documentMap:()=>toggleView("documentMap"),thumbnails:()=>toggleView("thumbnails"),formattingMarks:()=>toggleView("formattingMarks"),viewFormattingMarks:()=>toggleView("formattingMarks"),statusBar:()=>toggleView("statusBar"),zoom100:()=>setView(v=>({...v,zoom:100})),onePage:()=>setView(v=>({...v,zoom:measuredFit("height")})),twoPages:()=>setView(v=>({...v,zoom:measuredFit("twoPage")})),pageWidth:()=>setView(v=>({...v,zoom:measuredFit("width")})),find:()=>find(false),replace:()=>find(true),reviewFind:()=>find(false),reviewReplace:()=>find(true),leftIndent:()=>measure("marginLeft","Left indent in inches:",0),rightIndent:()=>measure("marginRight","Right indent in inches:",0),layoutIndents:()=>measure("marginLeft","Left indent in inches:",0),lineSpacing:()=>measure("lineHeight","Line spacing:",1.15),layoutLineSpacing:()=>measure("lineHeight","Line spacing:",1.15),paragraphSpacing:()=>setDialog({kind:"lineSpacingOptions",before:"0",after:"8",specialIndentMode:"none",specialIndentAmount:"0.5"}),layoutSpacing:()=>setDialog({kind:"lineSpacingOptions",before:"0",after:"8",specialIndentMode:"none",specialIndentAmount:"0.5"}),shading:()=>color("backColor"),borders:()=>toggleStyle("border","1px solid #0e7490"),watermark:()=>setDialog({kind:"watermark",text:editor.current?.dataset.watermark||"DRAFT"}),pageColor:()=>setDialog({kind:"pageColor",value:"#ffffff"}),pageBorders:()=>pageStyle("border","2px solid #155e75"),zoom:()=>setDialog({kind:"zoom",value:String(view.zoom)}),fontDialog:()=>{const selection=getSelection();const node=selection?.rangeCount?selection.anchorNode:null;const parent=node instanceof Element?node:node?.parentElement;const style=parent?getComputedStyle(parent):null;const underlineNode=parent?.closest("[data-underline-style]")as HTMLElement|undefined;const charScaleNode=parent?.closest("[data-char-scale]")as HTMLElement|undefined;const charSpacingNode=parent?.closest("[data-char-spacing]")as HTMLElement|undefined;const charPositionNode=parent?.closest("[data-char-position]")as HTMLElement|undefined;const kerningNode=parent?.closest("[data-kerning-enabled]")as HTMLElement|undefined;setDialog({kind:"font",bold:style?Number(style.fontWeight)>=600:false,italic:style?.fontStyle==="italic",fontFamily:approvedFont(style?.fontFamily??"")??"",fontSize:style?String(Math.round(Number.parseFloat(style.fontSize)*.75)):"11",color:approvedColor(style?.color??"")?`#${approvedColor(style?.color??"")}`:"#000000",underlineStyle:style?.textDecorationLine.includes("underline")?underlineNode?.dataset.underlineStyle??"single":"none",underlineColor:underlineNode?.dataset.underlineColor?`#${underlineNode.dataset.underlineColor.replace("#","")}`:"",strike:Boolean(style?.textDecorationLine.includes("line-through")&&style.textDecorationStyle!=="double"),doubleStrike:Boolean(style?.textDecorationLine.includes("line-through")&&style.textDecorationStyle==="double"),superscript:style?.verticalAlign==="super",subscript:style?.verticalAlign==="sub",smallCaps:Boolean(parent?.closest('[data-small-caps="true"]')),allCaps:Boolean(parent?.closest('[data-all-caps="true"]')),hidden:Boolean(parent?.closest('[data-hidden="true"]')),outline:Boolean(parent?.closest('[data-outline="true"]')),emboss:Boolean(parent?.closest('[data-emboss="true"]')),charScale:charScaleNode?.dataset.charScale??"100",charSpacing:charSpacingNode?.dataset.charSpacing??"0",charPosition:charPositionNode?.dataset.charPosition??"0",kerningEnabled:kerningNode?.dataset.kerningEnabled==="true",kerningMin:kerningNode?.dataset.kerningMin??"0"})},paragraphDialog:()=>{const block=selectedBlocks()[0];setDialog({kind:"paragraph",alignment:block?.style.textAlign||"left",marginLeft:String(block?Math.abs(parseInches(block.style.marginLeft)):0),marginRight:String(block?Math.abs(parseInches(block.style.marginRight)):0),specialIndentMode:block?.dataset.specialIndentMode??"none",specialIndentAmount:block?.dataset.specialIndentAmount?String(Math.abs(parseInches(block.dataset.specialIndentAmount))):"0.5",spaceBefore:String(block?Math.abs(Number.parseFloat(block.style.marginTop))||0:0),spaceAfter:String(block?Math.abs(Number.parseFloat(block.style.marginBottom))||0:8),lineSpacing:block?.style.lineHeight||"1",hyphens:block?.style.hyphens==="auto",lineNumbers:Boolean(block?.classList.contains("editor-line-numbers"))})}};map[id]?.();};
 useEffect(()=>{runRef.current=run});
 const toggleView=(key:keyof ViewState)=>setView(current=>({...current,[key]:!current[key]}));const viewMode=(mode:ViewState["mode"])=>setView(current=>({...current,mode}));
 const replaceSelection=(text:string)=>exec("insertText",text);const toggleEditorClass=(name:string)=>{const blocks=selectedBlocks();for(const block of blocks)block.classList.toggle(name);if(blocks.length)changed()};const pageStyle=(key:keyof CSSStyleDeclaration,value:string)=>{if(editor.current)(editor.current.style[key] as string)=value;changed()};const toggleStyle=(key:keyof CSSStyleDeclaration,value:string)=>{const blocks=selectedBlocks();for(const block of blocks)(block.style[key]as string)=(block.style[key]as string)?"":value;if(blocks.length)changed()};
 const measure=(key:"marginLeft"|"marginRight"|"lineHeight",label:string,fallback:number)=>{const value=bounded(promptValue(label,String(fallback)),key==="lineHeight"?.5:0,key==="lineHeight"?5:10),blocks=selectedBlocks();for(const block of blocks)block.style[key]=key==="lineHeight"?String(value):`${value}in`;if(blocks.length)changed()};
 const color=(command:string)=>{const value=promptValue("Enter a safe hex color:","#fff59d");if(/^#[0-9a-f]{6}$/i.test(value))exec(command,value)};
 const findNext=(needle:string,options:FindOptions=DEFAULT_FIND_OPTIONS,scope:"selection"|"document"="document")=>{
  if(!editor.current)return false;
  const regex=buildFindRegex(needle,options);
  if(!regex)return false;
  const scopeRange=scope==="selection"?findScopeRange.current:null;
  const walker=document.createTreeWalker(editor.current,NodeFilter.SHOW_TEXT);const allNodes:Text[]=[];for(let node=walker.nextNode();node;node=walker.nextNode())allNodes.push(node as Text);
  const nodes=scopeRange?allNodes.filter(node=>scopeRange.intersectsNode(node)):allNodes;
  if(!nodes.length)return false;
  const bounds=(index:number)=>{const text=nodes[index].textContent??"";const lo=scopeRange&&nodes[index]===scopeRange.startContainer?scopeRange.startOffset:0;const hi=scopeRange&&nodes[index]===scopeRange.endContainer?scopeRange.endOffset:text.length;return{lo,hi}};
  const selection=getSelection();const active=selection?.rangeCount&&editor.current.contains(selection.anchorNode)?selection.getRangeAt(0):null;
  let startIndex=0,startOffset=bounds(0).lo;if(active){const at=nodes.indexOf(active.endContainer as Text);if(at>=0){startIndex=at;startOffset=Math.max(active.endOffset,bounds(at).lo)}}
  const searchNode=(index:number,fromOffset:number)=>{const text=nodes[index].textContent??"";const{lo,hi}=bounds(index);let offset=Math.max(fromOffset,lo);while(offset<=hi){const found=regex.exec(text.slice(offset,hi));if(!found)return null;const at=offset+found.index;if(at+found[0].length>hi)return null;if(!options.formatHighlight||hasSearchHighlight(nodes[index].parentElement))return{at,length:found[0].length};offset=at+Math.max(1,found[0].length)}return null};
  const search=(from:number,fromOffset:number,to:number)=>{for(let index=from;index<to;index++){const found=searchNode(index,index===from?fromOffset:bounds(index).lo);if(found)return{index,...found}}return null};
  const match=search(startIndex,startOffset,nodes.length)??search(0,bounds(0).lo,startIndex+1);
  if(!match)return false;
  const range=document.createRange();range.setStart(nodes[match.index],match.at);range.setEnd(nodes[match.index],match.at+match.length);
  selection?.removeAllRanges();selection?.addRange(range);savedRange.current=range;range.startContainer.parentElement?.scrollIntoView({block:"center"});
  return true;
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
 const runFindNext=(needle:string,options:FindOptions=DEFAULT_FIND_OPTIONS,scope:"selection"|"document"="document")=>{if(!needle){setMessage("Type something in Find what.");return}setQuery(needle);const found=findNext(needle,options,scope);setMessage(found?`Found "${needle}"${scope==="selection"?" in the selection":""}.`:`"${needle}" was not found${scope==="selection"?" in the selection":""}.`)};
 const runReplaceOne=(needle:string,replacement:string,options:FindOptions=DEFAULT_FIND_OPTIONS,scope:"selection"|"document"="document")=>{if(!needle)return;setQuery(needle);const selection=getSelection();const regex=buildFindRegex(needle,options);if(regex&&selection?.rangeCount&&!selection.isCollapsed){const text=selection.toString();const found=regex.exec(text);if(found&&found.index===0&&found[0].length===text.length)exec("insertText",replacement)}runFindNext(needle,options,scope)};
 const runReplaceAll=(needle:string,replacement:string,options:FindOptions=DEFAULT_FIND_OPTIONS,scope:"selection"|"document"="document")=>{
  if(!needle||!editor.current)return;
  setQuery(needle);
  const regex=buildFindRegex(needle,options,true);
  if(!regex){setMessage(`"${needle}" was not found.`);return}
  // scope comes from the "Find in" choice in the dialog, backed by the
  // range captured once when the dialog was opened (findScopeRange) --
  // not a fresh getSelection() read, which by now reflects the dialog's
  // own inputs, not the document. See findScopeRange's own comment.
  const scopeRange=scope==="selection"?findScopeRange.current:null;
  const walker=document.createTreeWalker(editor.current,NodeFilter.SHOW_TEXT);const nodes:Text[]=[];for(let node=walker.nextNode();node;node=walker.nextNode())nodes.push(node as Text);
  let count=0;
  for(const node of nodes){
   if(options.formatHighlight&&!hasSearchHighlight(node.parentElement))continue;
   if(scopeRange&&!scopeRange.intersectsNode(node))continue;
   const text=node.textContent??"";
   const lo=scopeRange&&node===scopeRange.startContainer?scopeRange.startOffset:0;
   const hi=scopeRange&&node===scopeRange.endContainer?scopeRange.endOffset:text.length;
   let result="",lastEnd=0;
   for(const match of text.matchAll(regex)){
    const start=match.index??0,end=start+match[0].length;
    if(start<lo||end>hi)continue;
    result+=text.slice(lastEnd,start)+replacement;lastEnd=end;count++;
   }
   result+=text.slice(lastEnd);
   if(result!==text)node.textContent=result;
  }
  if(count)changed();
  setMessage(count?`Replaced ${count} occurrence${count===1?"":"s"}${scopeRange?" in the selection":""}.`:`"${needle}" was not found${scopeRange?" in the selection":""}.`);
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
 const tableActionAtCursor=(action:string)=>{restoreSelection();const anchor=getSelection()?.anchorNode?.parentElement;const table=anchor?.closest("table")as HTMLTableElement|null;if(!table){setMessage("Place the cursor inside a table first.");return}const cell=anchor?.closest("td,th")as HTMLTableCellElement|null;const row=cell?.closest("tr")as HTMLTableRowElement|null;applyTableAction(table,row?row.rowIndex:table.rows.length-1,cell?cell.cellIndex:(table.rows[0]?.cells.length??1)-1,action)};
 const insertTableWithSize=(rows:number,cols:number,layout:string="fixed")=>{const row=`<tr>${Array.from({length:cols},()=>'<td class="border p-2">Cell</td>').join("")}</tr>`;const style=layout==="fixed"?"table-layout:fixed":"table-layout:auto";const width=layout==="fixed"?"":"width:100%;";insertSafe(`<table data-block-type="table" data-table-layout="${layout}" class="my-3 border-collapse" style="${style};${width}"><tbody>${Array.from({length:rows},()=>row).join("")}</tbody></table>`);setDialog(null)};
 const insertSymbol=(value:string)=>{setDialog(null);if(value)insertSafe(`<span data-field="symbol">${escapeHtml(value)}</span>`)};
 const applyPageNumber=(position:string,alignment:string,style:string,format:string,startAt:string)=>{setDialog(null);insertSafe(`<span data-field="page-number|${position}|${alignment}" class="rounded border border-dashed border-cyan-500 bg-cyan-50 px-1 text-xs font-bold text-cyan-800" contenteditable="false">${escapeHtml(pageNumberText(style,format,startAt))}</span>`)};
 const removePageNumbers=()=>{setDialog(null);if(!editor.current)return;const fields=[...editor.current.querySelectorAll('[data-field^="page-number"]')];if(!fields.length){setMessage("This document has no page numbers.");return}for(const field of fields)field.remove();changed();setMessage(`Removed ${fields.length} page number${fields.length===1?"":"s"}.`)};
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
  restoreSelection();const selection=getSelection();if(!selection?.rangeCount||selection.isCollapsed){setDialog(null);return}
  const size=Number(values.fontSize);
  const scale=bounded(values.charScale,1,600),spacing=bounded(values.charSpacing,-100,100),position=bounded(values.charPosition,-100,100),kerningMin=bounded(values.kerningMin,0,72);
  // Real Word: Outline hollows the glyph out entirely (fill becomes
  // transparent, only the stroke -- in the font's own color -- remains
  // visible), regardless of whatever font color was also chosen. Emboss
  // gives a stamped/raised look via a light+dark offset shadow pair and
  // mutes the fill to a mid-gray, since a strong fill color would drown
  // the shadow out. Both are genuine CSS effects, not placeholders.
  const wrapped=wrapEditorRange(selection.getRangeAt(0),{fontWeight:values.bold?"700":"400",fontStyle:values.italic?"italic":"normal",fontFamily:values.fontFamily||undefined,fontSize:Number.isFinite(size)&&size>0?`${size}pt`:undefined,color:values.outline?"transparent":values.emboss?"#808080":values.color||undefined,webkitTextStroke:values.outline?`1px ${values.color||"#000000"}`:undefined,textShadow:values.emboss?"1px 1px 0 rgba(255,255,255,.85),-1px -1px 0 rgba(0,0,0,.55)":undefined,textDecorationLine:[values.underlineStyle!=="none"?"underline":"",values.strike||values.doubleStrike?"line-through":""].filter(Boolean).join(" ")||"none",textDecorationStyle:values.doubleStrike?"double":values.underlineStyle==="none"?"solid":underlineCssStyle(values.underlineStyle),textDecorationColor:values.underlineStyle!=="none"&&values.underlineColor?values.underlineColor:undefined,verticalAlign:values.superscript?"super":values.subscript?"sub":undefined,fontVariant:values.smallCaps?"small-caps":undefined,textTransform:values.allCaps?"uppercase":undefined,opacity:values.hidden?"0.4":undefined,...(scale!==100?{display:"inline-block",transform:`scaleX(${scale/100})`,transformOrigin:"left"}:{}),...(spacing!==0?{letterSpacing:`${spacing}pt`}:{}),...(position!==0?{position:"relative",top:`${-position}pt`}:{}),fontKerning:values.kerningEnabled?"normal":undefined},{...(values.doubleStrike?{doubleStrike:"true"}:{}),...(values.smallCaps?{smallCaps:"true"}:{}),...(values.allCaps?{allCaps:"true"}:{}),...(values.hidden?{hidden:"true"}:{}),...(values.outline?{outline:"true"}:{}),...(values.emboss?{emboss:"true"}:{}),...(values.underlineStyle!=="none"?{underlineStyle:values.underlineStyle}:{}),...(values.underlineStyle!=="none"&&values.underlineColor?{underlineColor:values.underlineColor.replace("#","")}:{}),...(scale!==100?{charScale:String(scale)}:{}),...(spacing!==0?{charSpacing:String(spacing)}:{}),...(position!==0?{charPosition:String(position)}:{}),...(values.kerningEnabled?{kerningEnabled:"true",kerningMin:String(kerningMin)}:{})});
  if(wrapped){savedRange.current=wrapped.range;changed()}
  setDialog(null);
 };
 const applyParagraphDialog=(values:{alignment:string;marginLeft:string;marginRight:string;specialIndentMode:string;specialIndentAmount:string;spaceBefore:string;spaceAfter:string;lineSpacing:string;hyphens:boolean;lineNumbers:boolean})=>{
  const blocks=selectedBlocks();
  if(!blocks.length){setDialog(null);return}
  const left=bounded(values.marginLeft,0,10),right=bounded(values.marginRight,0,10),before=bounded(values.spaceBefore,0,500),after=bounded(values.spaceAfter,0,500),indentAmount=bounded(values.specialIndentAmount,0,10);
  for(const block of blocks){
   block.style.textAlign=values.alignment;
   block.style.marginLeft=`${left}in`;block.style.marginRight=`${right}in`;
   block.style.marginTop=`${before}pt`;block.style.marginBottom=`${after}pt`;
   block.style.lineHeight=values.lineSpacing;
   if(values.specialIndentMode==="none"){delete block.dataset.specialIndentMode;delete block.dataset.specialIndentAmount;block.style.textIndent=""}
   else{block.dataset.specialIndentMode=values.specialIndentMode;block.dataset.specialIndentAmount=`${indentAmount}in`;block.style.textIndent=values.specialIndentMode==="hanging"?`-${indentAmount}in`:`${indentAmount}in`}
   block.style.hyphens=values.hyphens?"auto":"";
   block.classList.toggle("editor-line-numbers",values.lineNumbers);
  }
  setDialog(null);
  changed();
 };
 const applyMargins=(top:string,right:string,bottom:string,left:string)=>{const t=bounded(top,5,50),r=bounded(right,5,50),b=bounded(bottom,5,50),l=bounded(left,5,50);setDialog(null);pageStyle("padding",`${t}mm ${r}mm ${b}mm ${l}mm`)};
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
  if(id==="marginsAction"){if(value==="custom")setDialog({kind:"margins",top:"20",right:"20",bottom:"20",left:"20"});return}
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
 const submit=async()=>{if(!editor.current||(submitConfirmMessage&&!confirm(submitConfirmMessage)))return;setStatus(oneTimeSubmit?"Submitting…":"Saving…");if(oneTimeSubmit)setFinalSubmitting(true);try{const snapshot=toSnapshot(editor.current);const result=await(submitAction??submitWordDocument)(attemptId,snapshot);if(!result.ok){setStatus(result.error);setFinalSubmitting(false);return}onSaved?.(snapshot);if(oneTimeSubmit){setSubmitted(true);setStatus("Test submitted successfully");router.push(`/typing/word-efficiency/results/${attemptId}`)}else{lastAutosave.current=snapshot;setStatus("Saved")}}catch(error){setFinalSubmitting(false);if(isStaleServerActionError(error)){setStaleDeploy(true);setStatus("A newer version of this page was published. Refresh, then try submitting again -- nothing was lost.");return}setStatus(process.env.NODE_ENV==="development"&&error instanceof Error?`Submission failed: ${error.message}`:"Submission failed")}};
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
 return <section ref={viewport} className={`relative min-h-0 overflow-auto bg-slate-100 ${view.mode==="reading"?"fixed inset-0 z-50":""}`}>{finalSubmitting&&<div role="status" aria-live="assertive" className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-4"><div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-2xl"><span className="mx-auto flex h-16 w-16 animate-pulse items-center justify-center rounded-full bg-cyan-100 text-3xl" aria-hidden>⏳</span><h2 className="mt-5 text-2xl font-black text-slate-900">Submitting your test…</h2><p className="mt-3 leading-7 text-slate-600">Please don&apos;t close this page or click Submit again. This can take a few moments -- your document is safe.</p></div></div>}<header className="sticky top-0 z-20 border-b bg-white shadow-sm"><WordEditorRibbon capabilities={capabilities} activeTab={tab} onTabChange={value=>{setHeaderFooterToolsSelected(false);setTab(value)}} activeOption={id=>id==="formatPainter"?paintMode!=="off":active(id,view)} onCommand={run} currentFontFamily={currentFont} onFontChange={font=>exec("fontName",font)} onFontSizeChange={size=>exec("fontSize",String(Math.max(1,Math.min(7,Math.round(size/10)))))} onColorChange={(id,color)=>{if(id==="fontColor")exec("foreColor",color==="automatic"?"#000000":color);else if(id==="highlightColor")exec("backColor",color);else if(id==="shading"){const blocks=selectedBlocks();for(const block of blocks)block.style.backgroundColor=color==="transparent"?"":color;if(blocks.length)changed()}else run(id)}} onUnderlineChange={underline} onValueCommand={onValueCommand} extraTab={hfKind?{id:"hf-design",label:"Design",contextLabel:"Header & Footer Tools",groups:headerFooterToolsGroups}:undefined} extraTabActive={headerFooterToolsSelected} onExtraTabSelect={()=>setHeaderFooterToolsSelected(true)}/>{insideTable&&!submitted&&<div role="toolbar" aria-label="Table Tools" className="flex flex-wrap items-center gap-2 border-t bg-cyan-50 px-4 py-2"><span className="rounded bg-cyan-700 px-2 py-1 text-xs font-black text-white">Table Tools</span>{TABLE_TOOL_ACTIONS.map(([action,label])=><button key={action} type="button" onMouseDown={event=>event.preventDefault()} onClick={()=>tableActionAtCursor(action)} className="rounded-lg border border-cyan-200 bg-white px-3 py-1.5 text-xs font-bold text-cyan-950 hover:bg-cyan-100">{label}</button>)}<span className="ml-auto text-[11px] font-bold text-cyan-800">Merge/split cells is not available in this exam tool.</span></div>}{message&&<p aria-live="polite" className="border-t bg-cyan-50 px-4 py-1 text-xs font-bold text-cyan-950">{message}</p>}</header>
 <div className="flex min-h-[70dvh] gap-3 p-3 sm:p-6">{view.documentMap&&<aside aria-label="Document map" className="w-48 shrink-0 rounded-xl bg-white p-3 text-xs shadow"><strong>Document map</strong>{original.paragraphs.map(p=><a key={p.id} href={`#${p.id}`} className="mt-2 block truncate">{matterText(p)}</a>)}</aside>}{view.thumbnails&&<aside aria-label="Thumbnails" className="w-36 shrink-0 overflow-y-auto rounded-xl bg-white p-2 shadow"><strong className="mb-2 block px-1 text-xs">Thumbnails</strong>{thumbnails.map((group,index)=><button key={group.id} type="button" onClick={()=>document.getElementById(group.targetId)?.scrollIntoView({block:"start",behavior:"smooth"})} aria-label={`Page ${index+1}`} className="word-thumbnail-page mb-2 block w-full" style={{aspectRatio:"210 / 297"}}><ThumbnailPreview nodes={group.nodes}/></button>)}</aside>}{showOriginal&&<aside aria-label="Original matter" className="w-72 shrink-0 overflow-auto rounded-xl bg-cyan-50 p-4 text-sm shadow"><strong>Immutable original matter</strong>{original.paragraphs.map(p=><p key={p.id} className="mt-2">{matterText(p)}</p>)}</aside>}<div className={`relative mx-auto ${view.mode==="web"?"w-full":"max-w-[850px]"} ${view.gridlines?"bg-[linear-gradient(#cbd5e1_1px,transparent_1px),linear-gradient(90deg,#cbd5e1_1px,transparent_1px)] bg-[size:20px_20px]":""}`}>{view.ruler&&<div aria-label="Document ruler" className="mb-1 h-5 rounded bg-[repeating-linear-gradient(90deg,#94a3b8_0_1px,transparent_1px_20px)]"/>}<div ref={editor} role="textbox" aria-multiline="true" aria-label="Working Document Matter editor" contentEditable={!submitted&&view.mode!=="reading"} suppressContentEditableWarning spellCheck onInput={changed} onMouseDown={handleEditorMouseDown} className={`word-document-page min-h-[70dvh] w-[794px] max-w-full bg-white p-8 text-slate-950 shadow-xl outline-none focus:ring-2 focus:ring-cyan-600 sm:p-14 ${view.formattingMarks?"show-formatting-marks":""} ${view.mode==="draft"?"shadow-none":""} ${paintMode!=="off"?"cursor-format-painter":""}`} style={{zoom:`${view.zoom}%`}}>{original.paragraphs.map(paragraph=>paragraph.type==="table"?<table id={paragraph.id} key={paragraph.id} data-block-type="table" className="my-3 w-full border-collapse"><tbody>{paragraph.rows.map((row,rowIndex)=><tr key={rowIndex}>{row.map((cell,cellIndex)=><td key={cellIndex} contentEditable className="border p-2">{cell}</td>)}</tr>)}</tbody></table>:paragraph.type==="list-item"?<li id={paragraph.id} key={paragraph.id} data-list-group={paragraph.listGroup??""}>{paragraph.runs.map((run,index)=><Run key={index} run={run}/>)}</li>:<p id={paragraph.id} key={paragraph.id} data-paragraph-number={paragraph.paragraphNumber??undefined} style={{textAlign:paragraph.alignment,marginLeft:`${paragraph.leftIndent}in`,marginRight:`${paragraph.rightIndent}in`,lineHeight:paragraph.lineSpacing,marginTop:`${paragraph.spaceBefore}pt`,marginBottom:`${paragraph.spaceAfter}pt`}}>{paragraph.runs.map((run,index)=><Run key={index} run={run}/>)}</p>)}</div></div></div>
 <input ref={imageInput} className="sr-only" tabIndex={-1} type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={event=>uploadImage(event.target.files?.[0]??null)}/><footer className="sticky bottom-0 z-20 flex items-center justify-between gap-3 border-t bg-slate-950 px-4 py-3 text-white">{view.statusBar&&<p aria-live="polite" className="text-sm font-bold">Autosave: {status} · {view.zoom}% · Desktop recommended</p>}{staleDeploy&&<button type="button" onClick={()=>window.location.reload()} className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-black text-slate-950 outline-none hover:bg-amber-400 focus-visible:ring-2 focus-visible:ring-white">Refresh page</button>}<button type="button" disabled={submitted} onClick={submit} className="ml-auto rounded-xl bg-red-600 px-5 py-3 font-black text-white outline-none hover:bg-red-500 focus-visible:ring-2 focus-visible:ring-white disabled:bg-slate-500">{submitLabel}</button></footer>{dialog&&<CommandDialog dialog={dialog} onClose={()=>setDialog(null)} onOpenCustomTable={()=>setDialog({kind:"insertTableCustom"})} onInsertTable={insertTableWithSize} onSymbol={insertSymbol} onMargins={applyMargins} onWatermark={applyWatermark} onPageColor={applyPageColor} onColumns={applyColumns} onPageSize={applyPageSize} onTableEdit={runTableEdit} onLineSpacingOptions={applyLineSpacingOptions} onFindNext={runFindNext} onReplaceOne={runReplaceOne} onReplaceAll={runReplaceAll} onGoTo={goToTarget} onZoom={applyZoom} onSort={applySort} onPageNumber={applyPageNumber} onRemovePageNumbers={removePageNumbers} onFont={applyFontDialog} onParagraph={applyParagraphDialog} onHeaderFooterPick={applyHeaderFooterStyle} onHeaderFooterEdit={editHeaderFooter} onHeaderFooterRemove={removeHeaderFooter} onHeaderFooterSave={saveCustomHeaderFooterStyle} onDropCap={applyDropCap}/>}</section>;
}

function active(id:string,view:ViewState){return(id==="ruler"&&view.ruler)||(id==="gridlines"&&view.gridlines)||(id==="documentMap"&&view.documentMap)||(id==="thumbnails"&&view.thumbnails)||(["formattingMarks","viewFormattingMarks"].includes(id)&&view.formattingMarks)||(id==="statusBar"&&view.statusBar)||(id==="printLayout"&&view.mode==="print")||(id==="fullScreenReading"&&view.mode==="reading")||(id==="webLayout"&&view.mode==="web")||(id==="outlineView"&&view.mode==="outline")||(id==="draftView"&&view.mode==="draft")}
function CommandDialog({dialog,onClose,onOpenCustomTable,onInsertTable,onSymbol,onMargins,onWatermark,onPageColor,onColumns,onPageSize,onTableEdit,onLineSpacingOptions,onFindNext,onReplaceOne,onReplaceAll,onGoTo,onZoom,onSort,onPageNumber,onRemovePageNumbers,onFont,onParagraph,onHeaderFooterPick,onHeaderFooterEdit,onHeaderFooterRemove,onHeaderFooterSave,onDropCap}:{dialog:DialogState;onClose:()=>void;onOpenCustomTable:()=>void;onInsertTable:(rows:number,cols:number,layout?:string)=>void;onSymbol:(value:string)=>void;onMargins:(top:string,right:string,bottom:string,left:string)=>void;onWatermark:(value:string)=>void;onPageColor:(value:string)=>void;onColumns:(value:string)=>void;onPageSize:(value:string)=>void;onTableEdit:(action:string)=>void;onLineSpacingOptions:(before:string,after:string,specialIndentMode:string,specialIndentAmount:string)=>void;onFindNext:(needle:string,options:FindOptions,scope:"selection"|"document")=>void;onReplaceOne:(needle:string,replacement:string,options:FindOptions,scope:"selection"|"document")=>void;onReplaceAll:(needle:string,replacement:string,options:FindOptions,scope:"selection"|"document")=>void;onGoTo:(kind:string,value:string)=>void;onZoom:(value:string)=>void;onSort:(value:string)=>void;onPageNumber:(position:string,alignment:string,style:string,format:string,startAt:string)=>void;onRemovePageNumbers:()=>void;onFont:(values:Extract<DialogState,{kind:"font"}>)=>void;onParagraph:(values:Extract<DialogState,{kind:"paragraph"}>)=>void;onHeaderFooterPick:(which:"header"|"footer",innerHtml:string)=>void;onHeaderFooterEdit:(which:"header"|"footer")=>void;onHeaderFooterRemove:(which:"header"|"footer")=>void;onHeaderFooterSave:(which:"header"|"footer")=>void;onDropCap:(mode:string,fontFamily:string,lines:string,distance:string)=>void}){
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
 return createPortal(<div role="presentation" className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/40 p-4" onMouseDown={onClose}><div role="dialog" aria-modal="true" className={`w-full rounded-2xl bg-white p-5 shadow-2xl ${dialog.kind==="findReplace"||dialog.kind==="headerFooterGallery"?"max-w-lg":dialog.kind==="font"||dialog.kind==="paragraph"||dialog.kind==="pageNumber"||dialog.kind==="dropCapOptions"?"max-w-md":"max-w-sm"}`} style={{transform:`translate(${offset.x}px,${offset.y}px)`}} onMouseDown={event=>event.stopPropagation()} onKeyDown={escape}>
  <div className="-mx-5 -mt-5 mb-3 flex cursor-move items-center justify-center rounded-t-2xl bg-slate-100 py-1.5" title="Drag to move" onMouseDown={startDrag}><span aria-hidden className="h-1 w-10 rounded-full bg-slate-300"/></div>
  {dialog.kind==="symbol"&&<SymbolPicker onPick={onSymbol}/>}
  {dialog.kind==="insertTable"&&<TableSizePicker onPick={onInsertTable} onCustom={onOpenCustomTable}/>}
  {dialog.kind==="insertTableCustom"&&<InsertTableCustomForm onSubmit={onInsertTable}/>}
  {dialog.kind==="margins"&&<MarginsForm dialog={dialog} onSubmit={onMargins}/>}
  {dialog.kind==="watermark"&&<TextForm label="Watermark text" initial={dialog.text} onSubmit={onWatermark}/>}
  {dialog.kind==="lineSpacingOptions"&&<LineSpacingOptionsForm dialog={dialog} onSubmit={onLineSpacingOptions}/>}
  {dialog.kind==="findReplace"&&<FindReplaceForm dialog={dialog} onFindNext={onFindNext} onReplaceOne={onReplaceOne} onReplaceAll={onReplaceAll} onGoTo={onGoTo}/>}
  {dialog.kind==="pageColor"&&<ColorForm label="Page color" initial={dialog.value} onSubmit={onPageColor}/>}
  {dialog.kind==="columns"&&<ChoiceForm label="Columns" options={["1","2","3","4","5","6"]} initial={dialog.value} onSubmit={onColumns}/>}
  {dialog.kind==="pageSize"&&<ChoiceForm label="Page size" options={["Letter","Legal","Statement","Executive","A4","A5","B5"]} initial={dialog.value} onSubmit={onPageSize}/>}
  {dialog.kind==="tableEdit"&&<TableEditForm onPick={onTableEdit}/>}
  {dialog.kind==="zoom"&&<ZoomForm dialog={dialog} onSubmit={onZoom}/>}
  {dialog.kind==="sort"&&<ChoiceForm label="Sort" options={["Ascending","Descending"]} initial={dialog.value} onSubmit={onSort}/>}
  {dialog.kind==="pageNumber"&&<PageNumberForm dialog={dialog} onSubmit={onPageNumber} onRemove={onRemovePageNumbers}/>}
  {dialog.kind==="font"&&<FontDialogForm dialog={dialog} onSubmit={onFont}/>}
  {dialog.kind==="paragraph"&&<ParagraphDialogForm dialog={dialog} onSubmit={onParagraph}/>}
  {dialog.kind==="headerFooterGallery"&&<HeaderFooterGalleryForm dialog={dialog} onPick={onHeaderFooterPick} onEdit={onHeaderFooterEdit} onRemove={onHeaderFooterRemove} onSave={onHeaderFooterSave}/>}
  {dialog.kind==="dropCapOptions"&&<DropCapOptionsForm dialog={dialog} onSubmit={onDropCap}/>}
  <button type="button" onMouseDown={event=>event.preventDefault()} onClick={onClose} className="mt-4 w-full rounded-lg bg-slate-100 px-4 py-2 text-sm font-bold">Close</button>
 </div></div>,document.body);
}
function DropCapOptionsForm({dialog,onSubmit}:{dialog:Extract<DialogState,{kind:"dropCapOptions"}>;onSubmit:(mode:string,fontFamily:string,lines:string,distance:string)=>void}){
 const[position,setPosition]=useState(dialog.position),[fontFamily,setFontFamily]=useState(dialog.fontFamily),[lines,setLines]=useState(dialog.lines),[distance,setDistance]=useState(dialog.distance);
 return <div>
  <h3 className="font-black">Drop Cap</h3>
  <label className="mt-3 block text-xs font-bold">Position<div className="mt-1 grid grid-cols-3 gap-2">{[["none","None"],["dropped","Dropped"],["margin","In margin"]].map(([value,label])=><button key={value} type="button" onMouseDown={event=>event.preventDefault()} onClick={()=>setPosition(value)} className={`rounded-lg border p-3 text-center text-xs font-bold ${position===value?"border-blue-700 bg-blue-50 text-blue-800":"border-slate-200"}`}>{label}</button>)}</div></label>
  <div className="mt-4 border-t pt-3"><p className="text-xs font-black uppercase tracking-wide text-slate-500">Options</p>
   <label className="mt-2 block text-xs font-bold">Font<select className="input mt-1" disabled={position==="none"} value={fontFamily} onChange={event=>setFontFamily(event.target.value)}><option value="">(current font)</option>{APPROVED_WORD_FONTS.map(font=><option key={font} value={font}>{font}</option>)}</select></label>
   <div className="mt-2 grid grid-cols-2 gap-3">
    <label className="text-xs font-bold">Lines to drop<input className="input mt-1" type="number" min="1" max="10" disabled={position==="none"} value={lines} onChange={event=>setLines(event.target.value)}/></label>
    <label className="text-xs font-bold">Distance from text (in)<input className="input mt-1" type="number" min="0" max="2" step="0.1" disabled={position==="none"} value={distance} onChange={event=>setDistance(event.target.value)}/></label>
   </div>
  </div>
  <p className="mt-3 text-xs text-slate-500">Applies to the first character of the paragraph the cursor is currently in.</p>
  <button type="button" onMouseDown={event=>event.preventDefault()} onClick={()=>onSubmit(position,fontFamily,lines,distance)} className="mt-4 w-full rounded-lg bg-blue-700 px-4 py-2 text-sm font-black text-white">OK</button>
 </div>;
}
function ParagraphDialogForm({dialog,onSubmit}:{dialog:Extract<DialogState,{kind:"paragraph"}>;onSubmit:(values:Extract<DialogState,{kind:"paragraph"}>)=>void}){
 const[values,setValues]=useState(dialog);
 const[tab,setTab]=useState<"indents"|"breaks">("indents");
 const set=<K extends keyof typeof values>(key:K,value:(typeof values)[K])=>setValues(current=>({...current,[key]:value}));
 const previewAlignment=(["left","center","right","justify"] as const).includes(values.alignment as "left")?values.alignment as "left"|"center"|"right"|"justify":"left";
 return <div>
  <h3 className="font-black">Paragraph</h3>
  <div className="mt-2 flex gap-1 border-b"><button type="button" onMouseDown={event=>event.preventDefault()} onClick={()=>setTab("indents")} className={`px-3 py-2 text-sm font-black ${tab==="indents"?"border-b-2 border-blue-700 text-blue-800":"text-slate-500"}`}>Indents and Spacing</button><button type="button" onMouseDown={event=>event.preventDefault()} onClick={()=>setTab("breaks")} className={`px-3 py-2 text-sm font-black ${tab==="breaks"?"border-b-2 border-blue-700 text-blue-800":"text-slate-500"}`}>Line and Page Breaks</button></div>
  {tab==="indents"&&<div className="mt-4">
   <label className="block text-xs font-bold">Alignment<select className="input mt-1" value={values.alignment} onChange={event=>set("alignment",event.target.value)}><option value="left">Left</option><option value="center">Centered</option><option value="right">Right</option><option value="justify">Justified</option></select></label>
   <div className="mt-3 grid grid-cols-2 gap-3">
    <label className="text-xs font-bold">Left indent (in)<input className="input mt-1" type="number" min="0" max="10" step="0.1" value={values.marginLeft} onChange={event=>set("marginLeft",event.target.value)}/></label>
    <label className="text-xs font-bold">Right indent (in)<input className="input mt-1" type="number" min="0" max="10" step="0.1" value={values.marginRight} onChange={event=>set("marginRight",event.target.value)}/></label>
    <label className="text-xs font-bold">Special<select className="input mt-1" value={values.specialIndentMode} onChange={event=>set("specialIndentMode",event.target.value)}><option value="none">(none)</option><option value="firstLine">First line</option><option value="hanging">Hanging</option></select></label>
    <label className="text-xs font-bold">By (in)<input className="input mt-1" type="number" min="0" max="10" step="0.1" disabled={values.specialIndentMode==="none"} value={values.specialIndentAmount} onChange={event=>set("specialIndentAmount",event.target.value)}/></label>
   </div>
   <div className="mt-3 grid grid-cols-2 gap-3">
    <label className="text-xs font-bold">Space before (pt)<input className="input mt-1" type="number" min="0" max="500" value={values.spaceBefore} onChange={event=>set("spaceBefore",event.target.value)}/></label>
    <label className="text-xs font-bold">Space after (pt)<input className="input mt-1" type="number" min="0" max="500" value={values.spaceAfter} onChange={event=>set("spaceAfter",event.target.value)}/></label>
   </div>
   <label className="mt-3 block text-xs font-bold">Line spacing<select className="input mt-1" value={values.lineSpacing} onChange={event=>set("lineSpacing",event.target.value)}><option value="1">Single</option><option value="1.15">1.15</option><option value="1.5">1.5 lines</option><option value="2">Double</option><option value="2.5">2.5</option><option value="3">3.0 (Multiple)</option></select></label>
  </div>}
  {tab==="breaks"&&<div className="mt-4">
   <p className="text-xs text-slate-500">Page-based pagination controls (widow/orphan control, keep with next, keep lines together, page break before) don't apply to this exam tool's continuous-scroll workspace, so only the two paragraph-level settings below are offered here.</p>
   <label className="mt-4 flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={values.hyphens} onChange={event=>set("hyphens",event.target.checked)}/>Automatic hyphenation for this paragraph</label>
   <label className="mt-2 flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={values.lineNumbers} onChange={event=>set("lineNumbers",event.target.checked)}/>Include this paragraph in line numbering</label>
  </div>}
  <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 p-3" style={{textAlign:previewAlignment,marginLeft:`${Math.max(0,Number(values.marginLeft)||0)}in`,marginRight:`${Math.max(0,Number(values.marginRight)||0)}in`,marginTop:`${Math.max(0,Number(values.spaceBefore)||0)}pt`,marginBottom:`${Math.max(0,Number(values.spaceAfter)||0)}pt`,lineHeight:values.lineSpacing,textIndent:values.specialIndentMode==="none"?"0":values.specialIndentMode==="hanging"?`-${Math.max(0,Number(values.specialIndentAmount)||0)}in`:`${Math.max(0,Number(values.specialIndentAmount)||0)}in`}}><p className="text-xs">Sample Text Sample Text Sample Text Sample Text Sample Text Sample Text Sample Text Sample Text Sample Text.</p></div>
  <button type="button" onMouseDown={event=>event.preventDefault()} onClick={()=>onSubmit(values)} className="mt-4 w-full rounded-lg bg-blue-700 px-4 py-2 text-sm font-black text-white">OK</button>
 </div>;
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
function FontDialogForm({dialog,onSubmit}:{dialog:Extract<DialogState,{kind:"font"}>;onSubmit:(values:Extract<DialogState,{kind:"font"}>)=>void}){
 const[values,setValues]=useState(dialog);
 const[tab,setTab]=useState<"font"|"spacing">("font");
 const set=<K extends keyof typeof values>(key:K,value:(typeof values)[K])=>setValues(current=>({...current,[key]:value}));
 const spacingNumber=Number(values.charSpacing)||0,spacingMode=spacingNumber>0?"expanded":spacingNumber<0?"condensed":"normal";
 const setSpacingMode=(mode:string)=>{const magnitude=Math.abs(spacingNumber)||1;set("charSpacing",mode==="normal"?"0":String(mode==="condensed"?-magnitude:magnitude))};
 const setSpacingBy=(amount:string)=>{const magnitude=Math.max(0,Number(amount)||0);set("charSpacing",spacingMode==="condensed"?String(-magnitude):String(magnitude))};
 const positionNumber=Number(values.charPosition)||0,positionMode=positionNumber>0?"raised":positionNumber<0?"lowered":"normal";
 const setPositionMode=(mode:string)=>{const magnitude=Math.abs(positionNumber)||3;set("charPosition",mode==="normal"?"0":String(mode==="lowered"?-magnitude:magnitude))};
 const setPositionBy=(amount:string)=>{const magnitude=Math.max(0,Number(amount)||0);set("charPosition",positionMode==="lowered"?String(-magnitude):String(magnitude))};
 return <div>
  <div className="flex gap-1 border-b"><button type="button" onMouseDown={event=>event.preventDefault()} onClick={()=>setTab("font")} className={`px-3 py-2 text-sm font-black ${tab==="font"?"border-b-2 border-blue-700 text-blue-800":"text-slate-500"}`}>Font</button><button type="button" onMouseDown={event=>event.preventDefault()} onClick={()=>setTab("spacing")} className={`px-3 py-2 text-sm font-black ${tab==="spacing"?"border-b-2 border-blue-700 text-blue-800":"text-slate-500"}`}>Character Spacing</button></div>
  {tab==="font"&&<>
   <div className="mt-4 grid grid-cols-2 gap-3">
    <label className="text-xs font-bold">Font<select className="input mt-1" value={values.fontFamily} onChange={event=>set("fontFamily",event.target.value)}><option value="">Automatic</option>{APPROVED_WORD_FONTS.map(font=><option key={font} value={font}>{font}</option>)}</select></label>
    <label className="text-xs font-bold">Size<input className="input mt-1" type="number" min="8" max="72" value={values.fontSize} onChange={event=>set("fontSize",event.target.value)}/></label>
    <ColorSwatchField label="Font color" value={values.color} onChange={value=>set("color",value)}/>
    <UnderlineStyleField value={values.underlineStyle} onChange={value=>set("underlineStyle",value)}/>
    <ColorSwatchField label="Underline color" value={values.underlineColor} onChange={value=>set("underlineColor",value)}/>
   </div>
   <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
    <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={values.bold} onChange={event=>set("bold",event.target.checked)}/>Bold</label>
    <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={values.italic} onChange={event=>set("italic",event.target.checked)}/>Italic</label>
    <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={values.strike} onChange={event=>set("strike",event.target.checked)}/>Strikethrough</label>
    <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={values.doubleStrike} onChange={event=>set("doubleStrike",event.target.checked)}/>Double strikethrough</label>
    <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={values.superscript} onChange={event=>set("superscript",event.target.checked)}/>Superscript</label>
    <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={values.subscript} onChange={event=>set("subscript",event.target.checked)}/>Subscript</label>
    <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={values.outline} onChange={event=>set("outline",event.target.checked)}/>Outline</label>
    <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={values.emboss} onChange={event=>set("emboss",event.target.checked)}/>Emboss</label>
    <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={values.smallCaps} onChange={event=>set("smallCaps",event.target.checked)}/>Small caps</label>
    <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={values.allCaps} onChange={event=>set("allCaps",event.target.checked)}/>All caps</label>
    <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={values.hidden} onChange={event=>set("hidden",event.target.checked)}/>Hidden</label>
   </div>
  </>}
  {tab==="spacing"&&<div className="mt-4">
   <label className="block text-xs font-bold">Scale<select className="input mt-1" value={values.charScale} onChange={event=>set("charScale",event.target.value)}>{["200","150","100","90","80","66","50","33","25"].map(preset=><option key={preset} value={preset}>{preset}%</option>)}</select></label>
   <div className="mt-3 grid grid-cols-2 gap-3">
    <label className="text-xs font-bold">Spacing<select className="input mt-1" value={spacingMode} onChange={event=>setSpacingMode(event.target.value)}><option value="normal">Normal</option><option value="expanded">Expanded</option><option value="condensed">Condensed</option></select></label>
    <label className="text-xs font-bold">By (pt)<input className="input mt-1" type="number" min="0" max="100" step="0.1" disabled={spacingMode==="normal"} value={spacingMode==="normal"?"0":String(Math.abs(spacingNumber))} onChange={event=>setSpacingBy(event.target.value)}/></label>
   </div>
   <div className="mt-3 grid grid-cols-2 gap-3">
    <label className="text-xs font-bold">Position<select className="input mt-1" value={positionMode} onChange={event=>setPositionMode(event.target.value)}><option value="normal">Normal</option><option value="raised">Raised</option><option value="lowered">Lowered</option></select></label>
    <label className="text-xs font-bold">By (pt)<input className="input mt-1" type="number" min="0" max="100" step="0.5" disabled={positionMode==="normal"} value={positionMode==="normal"?"0":String(Math.abs(positionNumber))} onChange={event=>setPositionBy(event.target.value)}/></label>
   </div>
   <label className="mt-4 flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={values.kerningEnabled} onChange={event=>set("kerningEnabled",event.target.checked)}/>Kerning for fonts</label>
   <label className="mt-2 block text-xs font-bold">Points and above<input className="input mt-1 w-24" type="number" min="0" max="72" disabled={!values.kerningEnabled} value={values.kerningMin} onChange={event=>set("kerningMin",event.target.value)}/></label>
  </div>}
  <p className="mt-4 overflow-hidden rounded-lg bg-slate-50 p-3" style={{fontWeight:values.bold?700:400,fontStyle:values.italic?"italic":"normal",fontVariant:values.smallCaps?"small-caps":"normal",textTransform:values.allCaps?"uppercase":"none",color:values.outline?"transparent":values.emboss?"#808080":values.color,WebkitTextStroke:values.outline?`1px ${values.color||"#000000"}`:undefined,textShadow:values.emboss?"1px 1px 0 rgba(255,255,255,.85),-1px -1px 0 rgba(0,0,0,.55)":undefined,opacity:values.hidden?.4:1,textDecorationLine:[values.underlineStyle!=="none"?"underline":"",values.strike||values.doubleStrike?"line-through":""].filter(Boolean).join(" ")||"none",textDecorationStyle:values.doubleStrike?"double":values.underlineStyle==="none"?"solid":underlineCssStyle(values.underlineStyle),textDecorationColor:values.underlineColor||undefined,display:"inline-block",transform:`scaleX(${(Number(values.charScale)||100)/100})`,transformOrigin:"left",letterSpacing:`${spacingNumber}pt`,position:"relative",top:`${-positionNumber}pt`}}>Preview text</p>
  <button type="button" onMouseDown={event=>event.preventDefault()} onClick={()=>onSubmit(values)} className="mt-4 w-full rounded-lg bg-blue-700 px-4 py-2 text-sm font-black text-white">Apply</button>
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
function SymbolPicker({onPick}:{onPick:(value:string)=>void}){const symbols=["§","¶","©","®","™","°","±","×","÷","Ω","€","£","¥","…","•","→","✓","½"];return <div><h3 className="font-black">Insert symbol</h3><div className="mt-3 grid grid-cols-6 gap-2">{symbols.map(symbol=><button key={symbol} type="button" onMouseDown={event=>event.preventDefault()} onClick={()=>onPick(symbol)} className="rounded-lg border p-2 text-lg hover:bg-cyan-50">{symbol}</button>)}</div></div>}
function TableSizePicker({onPick,onCustom}:{onPick:(rows:number,cols:number)=>void;onCustom:()=>void}){const[hover,setHover]=useState({rows:2,cols:2});return <div><h3 className="font-black">Insert table</h3><div className="mt-3 grid grid-cols-6 gap-1" onMouseLeave={()=>setHover({rows:2,cols:2})}>{Array.from({length:6},(_,rowIndex)=>Array.from({length:6},(_,colIndex)=><button key={`${rowIndex}-${colIndex}`} type="button" onMouseDown={event=>event.preventDefault()} onMouseEnter={()=>setHover({rows:rowIndex+1,cols:colIndex+1})} onClick={()=>onPick(rowIndex+1,colIndex+1)} className={`h-6 w-6 border ${rowIndex<hover.rows&&colIndex<hover.cols?"bg-cyan-500":"bg-slate-100"}`}/>))}</div><p className="mt-2 text-xs font-bold text-slate-500">{hover.rows} × {hover.cols} table</p><button type="button" onMouseDown={event=>event.preventDefault()} onClick={onCustom} className="mt-3 w-full rounded-lg border px-4 py-2 text-left text-sm font-bold hover:bg-cyan-50">Insert Table…</button></div>}
function InsertTableCustomForm({onSubmit}:{onSubmit:(rows:number,cols:number,layout?:string)=>void}){const[cols,setCols]=useState("5"),[rows,setRows]=useState("2"),[layout,setLayout]=useState("fixed");return <div><h3 className="font-black">Insert Table</h3><div className="mt-3 grid grid-cols-2 gap-3"><label className="text-xs font-bold">Number of columns<input className="input mt-1" type="number" min="1" max="20" value={cols} onChange={event=>setCols(event.target.value)}/></label><label className="text-xs font-bold">Number of rows<input className="input mt-1" type="number" min="1" max="50" value={rows} onChange={event=>setRows(event.target.value)}/></label></div><fieldset className="mt-3"><legend className="text-xs font-bold">AutoFit behavior</legend><div className="mt-1 grid gap-1">{[["fixed","Fixed column width"],["auto","AutoFit to contents"],["window","AutoFit to window"]].map(([value,label])=><label key={value} className="flex items-center gap-2 text-sm"><input type="radio" name="table-autofit" checked={layout===value} onChange={()=>setLayout(value)}/>{label}</label>)}</div></fieldset><button type="button" onMouseDown={event=>event.preventDefault()} onClick={()=>onSubmit(bounded(rows,1,50),bounded(cols,1,20),layout)} className="mt-4 w-full rounded-lg bg-blue-700 px-4 py-2 text-sm font-black text-white">OK</button></div>}
function MarginsForm({dialog,onSubmit}:{dialog:{top:string;right:string;bottom:string;left:string};onSubmit:(top:string,right:string,bottom:string,left:string)=>void}){const[top,setTop]=useState(dialog.top),[right,setRight]=useState(dialog.right),[bottom,setBottom]=useState(dialog.bottom),[left,setLeft]=useState(dialog.left);return <div><h3 className="font-black">Margins (mm)</h3><div className="mt-3 grid grid-cols-2 gap-3"><label className="text-xs font-bold">Top<input className="input mt-1" type="number" min="5" max="50" value={top} onChange={event=>setTop(event.target.value)}/></label><label className="text-xs font-bold">Right<input className="input mt-1" type="number" min="5" max="50" value={right} onChange={event=>setRight(event.target.value)}/></label><label className="text-xs font-bold">Bottom<input className="input mt-1" type="number" min="5" max="50" value={bottom} onChange={event=>setBottom(event.target.value)}/></label><label className="text-xs font-bold">Left<input className="input mt-1" type="number" min="5" max="50" value={left} onChange={event=>setLeft(event.target.value)}/></label></div><button type="button" onMouseDown={event=>event.preventDefault()} onClick={()=>onSubmit(top,right,bottom,left)} className="mt-4 w-full rounded-lg bg-blue-700 px-4 py-2 text-sm font-black text-white">Apply</button></div>}
function TextForm({label,initial,onSubmit}:{label:string;initial:string;onSubmit:(value:string)=>void}){const[value,setValue]=useState(initial);return <div><h3 className="font-black">{label}</h3><input className="input mt-3 w-full" value={value} maxLength={40} onChange={event=>setValue(event.target.value)}/><button type="button" onMouseDown={event=>event.preventDefault()} onClick={()=>onSubmit(value)} className="mt-4 w-full rounded-lg bg-blue-700 px-4 py-2 text-sm font-black text-white">Apply</button></div>}
const SAFE_PAGE_COLORS=["#ffffff","#fef3c7","#dbeafe","#dcfce7","#fee2e2","#f3e8ff"];
function ColorForm({label,initial,onSubmit}:{label:string;initial:string;onSubmit:(value:string)=>void}){const[value,setValue]=useState(initial);return <div><h3 className="font-black">{label}</h3><div className="mt-3 flex flex-wrap gap-2">{SAFE_PAGE_COLORS.map(color=><button key={color} type="button" aria-label={color} onMouseDown={event=>event.preventDefault()} onClick={()=>setValue(color)} className="h-8 w-8 rounded-lg border-2" style={{backgroundColor:color,borderColor:value===color?"#0369a1":"#e2e8f0"}}/>)}</div><button type="button" onMouseDown={event=>event.preventDefault()} onClick={()=>onSubmit(value)} className="mt-4 w-full rounded-lg bg-blue-700 px-4 py-2 text-sm font-black text-white">Apply</button></div>}
function ChoiceForm({label,options,initial,onSubmit}:{label:string;options:string[];initial:string;onSubmit:(value:string)=>void}){const[value,setValue]=useState(initial);return <div><h3 className="font-black">{label}</h3><div className="mt-3 flex gap-2">{options.map(option=><button key={option} type="button" onMouseDown={event=>event.preventDefault()} onClick={()=>setValue(option)} className={`rounded-lg border px-4 py-2 text-sm font-bold ${value===option?"border-blue-700 bg-blue-50 text-blue-800":"border-slate-200"}`}>{option}</button>)}</div><button type="button" onMouseDown={event=>event.preventDefault()} onClick={()=>onSubmit(value)} className="mt-4 w-full rounded-lg bg-blue-700 px-4 py-2 text-sm font-black text-white">Apply</button></div>}
function LineSpacingOptionsForm({dialog,onSubmit}:{dialog:{before:string;after:string;specialIndentMode:string;specialIndentAmount:string};onSubmit:(before:string,after:string,specialIndentMode:string,specialIndentAmount:string)=>void}){const[before,setBefore]=useState(dialog.before),[after,setAfter]=useState(dialog.after),[specialIndentMode,setSpecialIndentMode]=useState(dialog.specialIndentMode),[specialIndentAmount,setSpecialIndentAmount]=useState(dialog.specialIndentAmount);return <div><h3 className="font-black">Indents and Spacing</h3><div className="mt-3 grid grid-cols-2 gap-3"><label className="text-xs font-bold">Space before (pt)<input className="input mt-1" type="number" min="0" max="500" value={before} onChange={event=>setBefore(event.target.value)}/></label><label className="text-xs font-bold">Space after (pt)<input className="input mt-1" type="number" min="0" max="500" value={after} onChange={event=>setAfter(event.target.value)}/></label></div><div className="mt-3 grid grid-cols-2 gap-3"><label className="text-xs font-bold">Special indent<select className="input mt-1" value={specialIndentMode} onChange={event=>setSpecialIndentMode(event.target.value)}><option value="none">(none)</option><option value="firstLine">First line</option><option value="hanging">Hanging</option></select></label><label className="text-xs font-bold">By (inches)<input className="input mt-1" type="number" min="0" max="5" step="0.1" disabled={specialIndentMode==="none"} value={specialIndentAmount} onChange={event=>setSpecialIndentAmount(event.target.value)}/></label></div><button type="button" onMouseDown={event=>event.preventDefault()} onClick={()=>onSubmit(before,after,specialIndentMode,specialIndentAmount)} className="mt-4 w-full rounded-lg bg-blue-700 px-4 py-2 text-sm font-black text-white">Apply</button></div>}
// Every Special/Format item is either genuinely wired (inserts a real
// literal/wildcard token into Find what, or filters matches by an actual
// document property) or explicitly disabled with a stated reason -- never
// a button that looks live but silently does nothing.
const SPECIAL_ITEMS:{label:string;token?:string;wildcards?:boolean;disabledReason?:string}[]=[
 {label:"Paragraph Mark",disabledReason:"Paragraph boundaries aren't part of this editor's searchable text."},
 {label:"Tab Character",token:"\t"},
 {label:"Any Character",token:".",wildcards:true},
 {label:"Any Digit",token:"[0-9]",wildcards:true},
 {label:"Any Letter",token:"[A-Za-z]",wildcards:true},
 {label:"Caret Character",token:"^"},
 {label:"§ Section Character",token:"§"},
 {label:"¶ Paragraph Character",token:"¶"},
 {label:"Column Break",disabledReason:"Column breaks aren't modeled in this exam tool."},
 {label:"Em Dash",token:"—"},
 {label:"En Dash",token:"–"},
 {label:"Endnote Mark",disabledReason:"Endnotes aren't modeled in this exam tool."},
 {label:"Field",disabledReason:"Inserted fields aren't part of this editor's searchable text."},
 {label:"Footnote Mark",disabledReason:"Footnotes aren't modeled in this exam tool."},
 {label:"Graphic",disabledReason:"Images aren't part of this editor's searchable text."},
 {label:"Manual Line Break",disabledReason:"Line breaks aren't part of this editor's searchable text."},
 {label:"Manual Page Break",disabledReason:"Page breaks aren't part of this editor's searchable text."},
 {label:"Nonbreaking Hyphen",token:"‑"},
 {label:"Nonbreaking Space",token:" "},
 {label:"Optional Hyphen",token:"­"},
 {label:"Section Break",disabledReason:"Section breaks aren't part of this editor's searchable text."},
 {label:"White Space",token:"\\s",wildcards:true},
];
const FORMAT_ITEMS:{label:string;action?:"highlight";disabledReason?:string}[]=[
 {label:"Font…",disabledReason:"Searching by font formatting isn't supported in this exam tool."},
 {label:"Paragraph…",disabledReason:"Searching by paragraph formatting isn't supported in this exam tool."},
 {label:"Tabs…",disabledReason:"Tab stops aren't modeled in this exam tool."},
 {label:"Language…",disabledReason:"Per-text language tagging isn't modeled in this exam tool."},
 {label:"Frame…",disabledReason:"Frames aren't modeled in this exam tool."},
 {label:"Style…",disabledReason:"Named paragraph or character styles aren't modeled in this exam tool."},
 {label:"Highlight",action:"highlight"},
];
const GOTO_KINDS:{id:string;label:string;working:boolean}[]=[
 {id:"page",label:"Page",working:true},{id:"section",label:"Section",working:false},{id:"line",label:"Line",working:false},{id:"bookmark",label:"Bookmark",working:true},{id:"comment",label:"Comment",working:false},{id:"footnote",label:"Footnote",working:false},{id:"endnote",label:"Endnote",working:false},{id:"field",label:"Field",working:false},{id:"table",label:"Table",working:true},{id:"graphic",label:"Graphic",working:false},{id:"equation",label:"Equation",working:false},{id:"object",label:"Object",working:false},{id:"heading",label:"Heading",working:false},
];
function FindReplaceForm({dialog,onFindNext,onReplaceOne,onReplaceAll,onGoTo}:{dialog:Extract<DialogState,{kind:"findReplace"}>;onFindNext:(needle:string,options:FindOptions,scope:"selection"|"document")=>void;onReplaceOne:(needle:string,replacement:string,options:FindOptions,scope:"selection"|"document")=>void;onReplaceAll:(needle:string,replacement:string,options:FindOptions,scope:"selection"|"document")=>void;onGoTo:(kind:string,value:string)=>void}){
 const[tab,setTab]=useState(dialog.mode);
 const[query,setQuery]=useState(dialog.query),[replacement,setReplacement]=useState(dialog.replacement);
 const[showMore,setShowMore]=useState(false);
 // Only offered when text was actually selected before Find and Replace
 // was opened (dialog.hadSelection) -- with nothing selected there is no
 // "selection" to scope to, so it's always "Whole document" in that case.
 const[scope,setScope]=useState<"selection"|"document">(dialog.hadSelection?"selection":"document");
 const[options,setOptions]=useState<FindOptions>({matchCase:dialog.matchCase,wholeWord:dialog.wholeWord,wildcards:dialog.wildcards,matchPrefix:dialog.matchPrefix,matchSuffix:dialog.matchSuffix,ignorePunctuation:dialog.ignorePunctuation,ignoreWhitespace:dialog.ignoreWhitespace,formatHighlight:dialog.formatHighlight});
 const[specialOpen,setSpecialOpen]=useState(false),[formatOpen,setFormatOpen]=useState(false);
 const[gotoKind,setGotoKind]=useState("page"),[gotoValue,setGotoValue]=useState("");
 const setOption=<K extends keyof FindOptions>(key:K,value:FindOptions[K])=>setOptions(current=>({...current,[key]:value}));
 const insertSpecial=(item:typeof SPECIAL_ITEMS[number])=>{if(item.disabledReason||!item.token)return;setQuery(current=>current+item.token);if(item.wildcards)setOption("wildcards",true);setSpecialOpen(false)};
 const pickFormat=(item:typeof FORMAT_ITEMS[number])=>{if(item.disabledReason)return;if(item.action==="highlight")setOption("formatHighlight",true);setFormatOpen(false)};
 const gotoDefinition=GOTO_KINDS.find(item=>item.id===gotoKind);
 const runGoTo=(direction:1|-1)=>{if(!gotoDefinition?.working)return;const next=String(Math.max(1,(Number(gotoValue)||1)+direction));setGotoValue(next);onGoTo(gotoKind,next)};
 return <div>
  <h3 className="font-black">Find and Replace</h3>
  <div className="mt-2 flex gap-1 border-b"><button type="button" onMouseDown={event=>event.preventDefault()} onClick={()=>setTab("find")} className={`px-3 py-2 text-sm font-black ${tab==="find"?"border-b-2 border-blue-700 text-blue-800":"text-slate-500"}`}>Find</button><button type="button" onMouseDown={event=>event.preventDefault()} onClick={()=>setTab("replace")} className={`px-3 py-2 text-sm font-black ${tab==="replace"?"border-b-2 border-blue-700 text-blue-800":"text-slate-500"}`}>Replace</button><button type="button" onMouseDown={event=>event.preventDefault()} onClick={()=>setTab("goto")} className={`px-3 py-2 text-sm font-black ${tab==="goto"?"border-b-2 border-blue-700 text-blue-800":"text-slate-500"}`}>Go To</button></div>
  {tab!=="goto"&&<div className="mt-4">
   <label className="block text-xs font-bold">Find what:<input autoFocus className="input mt-1 w-full" value={query} onChange={event=>setQuery(event.target.value)}/></label>
   {tab==="replace"&&<label className="mt-3 block text-xs font-bold">Replace with:<input className="input mt-1 w-full" value={replacement} onChange={event=>setReplacement(event.target.value)}/></label>}
   {dialog.hadSelection&&<div className="mt-3">
    <p className="text-xs font-bold">Find in:</p>
    <div className="mt-1 flex gap-2">
     <button type="button" onMouseDown={event=>event.preventDefault()} onClick={()=>setScope("selection")} aria-pressed={scope==="selection"} className={`rounded-lg border px-3 py-1.5 text-xs font-bold ${scope==="selection"?"border-blue-700 bg-blue-50 text-blue-800":"border-slate-300 text-slate-600"}`}>Selected text</button>
     <button type="button" onMouseDown={event=>event.preventDefault()} onClick={()=>setScope("document")} aria-pressed={scope==="document"} className={`rounded-lg border px-3 py-1.5 text-xs font-bold ${scope==="document"?"border-blue-700 bg-blue-50 text-blue-800":"border-slate-300 text-slate-600"}`}>Whole document</button>
    </div>
   </div>}
   <button type="button" onMouseDown={event=>event.preventDefault()} onClick={()=>setShowMore(value=>!value)} className="mt-3 text-xs font-black text-blue-800">{showMore?"<< Less":"More >>"}</button>
   {showMore&&<div className="mt-3 rounded-lg border border-slate-200 p-3">
    <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">Search Options</p>
    <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
     <label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={options.matchCase} onChange={event=>setOption("matchCase",event.target.checked)}/>Match case</label>
     <label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={options.wholeWord} onChange={event=>setOption("wholeWord",event.target.checked)}/>Find whole words only</label>
     <label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={options.wildcards} onChange={event=>setOption("wildcards",event.target.checked)}/>Use wildcards</label>
     <label className="flex items-center gap-2 text-xs font-bold text-slate-400" title="Phonetic matching isn't supported in this exam tool."><input type="checkbox" disabled/>Sounds like (English)</label>
     <label className="flex items-center gap-2 text-xs font-bold text-slate-400" title="Word-form matching isn't supported in this exam tool."><input type="checkbox" disabled/>Find all word forms (English)</label>
     <label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={options.matchPrefix} onChange={event=>setOption("matchPrefix",event.target.checked)}/>Match prefix</label>
     <label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={options.matchSuffix} onChange={event=>setOption("matchSuffix",event.target.checked)}/>Match suffix</label>
     <label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={options.ignorePunctuation} onChange={event=>setOption("ignorePunctuation",event.target.checked)}/>Ignore punctuation characters</label>
     <label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={options.ignoreWhitespace} onChange={event=>setOption("ignoreWhitespace",event.target.checked)}/>Ignore white-space characters</label>
    </div>
    <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
     <span className="text-[10px] font-black uppercase tracking-wide text-slate-500">Find</span>
     <div className="relative"><button type="button" onMouseDown={event=>event.preventDefault()} onClick={()=>{setFormatOpen(false);setSpecialOpen(value=>!value)}} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold">Special ▾</button>{specialOpen&&<div role="menu" className="absolute left-0 top-full z-10 mt-1 max-h-64 w-52 overflow-y-auto rounded-lg border border-slate-300 bg-white py-1 shadow-xl">{SPECIAL_ITEMS.map(item=><button key={item.label} type="button" role="menuitem" disabled={Boolean(item.disabledReason)} title={item.disabledReason} onMouseDown={event=>event.preventDefault()} onClick={()=>insertSpecial(item)} className="block w-full px-3 py-1 text-left text-xs font-bold text-slate-800 hover:bg-cyan-50 disabled:text-slate-300 disabled:hover:bg-transparent">{item.label}</button>)}</div>}</div>
     <div className="relative"><button type="button" onMouseDown={event=>event.preventDefault()} onClick={()=>{setSpecialOpen(false);setFormatOpen(value=>!value)}} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold">Format ▾</button>{formatOpen&&<div role="menu" className="absolute left-0 top-full z-10 mt-1 w-44 overflow-hidden rounded-lg border border-slate-300 bg-white py-1 shadow-xl">{FORMAT_ITEMS.map(item=><button key={item.label} type="button" role="menuitem" disabled={Boolean(item.disabledReason)} title={item.disabledReason} onMouseDown={event=>event.preventDefault()} onClick={()=>pickFormat(item)} className="block w-full px-3 py-1 text-left text-xs font-bold text-slate-800 hover:bg-cyan-50 disabled:text-slate-300 disabled:hover:bg-transparent">{item.label}</button>)}</div>}</div>
     <button type="button" disabled={!options.formatHighlight} onMouseDown={event=>event.preventDefault()} onClick={()=>setOption("formatHighlight",false)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold disabled:text-slate-300">No Formatting</button>
    </div>
    {options.formatHighlight&&<p className="mt-2 text-[11px] font-bold text-cyan-800">Format: Highlight — only matches with a highlight color applied will be found.</p>}
   </div>}
   <div className="mt-4 flex flex-wrap gap-2">
    <button type="button" onMouseDown={event=>event.preventDefault()} onClick={()=>onFindNext(query,options,scope)} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-black text-white">Find Next</button>
    {tab==="replace"&&<><button type="button" onMouseDown={event=>event.preventDefault()} onClick={()=>onReplaceOne(query,replacement,options,scope)} className="rounded-lg border border-blue-700 px-4 py-2 text-sm font-black text-blue-800">Replace</button><button type="button" onMouseDown={event=>event.preventDefault()} onClick={()=>onReplaceAll(query,replacement,options,scope)} className="rounded-lg border border-blue-700 px-4 py-2 text-sm font-black text-blue-800">Replace All</button></>}
   </div>
  </div>}
  {tab==="goto"&&<div className="mt-4 grid grid-cols-[128px_1fr] gap-3">
   <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200"><p className="border-b bg-slate-50 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-slate-500">Go to what:</p>{GOTO_KINDS.map(item=><button key={item.id} type="button" onMouseDown={event=>event.preventDefault()} onClick={()=>{setGotoKind(item.id);setGotoValue("")}} className={`block w-full px-2 py-1.5 text-left text-xs font-bold ${gotoKind===item.id?"bg-blue-700 text-white":item.working?"text-slate-800 hover:bg-cyan-50":"text-slate-400"}`}>{item.label}</button>)}</div>
   <div>
    {gotoDefinition?.working?<>
     <label className="block text-xs font-bold">{gotoKind==="bookmark"?"Enter bookmark name:":`Enter ${gotoDefinition.label.toLocaleLowerCase()} number:`}
      {gotoKind==="bookmark"?<select className="input mt-1 w-full" value={gotoValue} onChange={event=>setGotoValue(event.target.value)}><option value="">Choose a bookmark…</option>{dialog.bookmarks.map(name=><option key={name} value={name}>{name}</option>)}</select>:<input className="input mt-1 w-full" type="number" min="1" value={gotoValue} onChange={event=>setGotoValue(event.target.value)}/>}
     </label>
     {gotoKind==="bookmark"&&!dialog.bookmarks.length&&<p className="mt-2 text-xs text-slate-500">This document has no bookmarks yet.</p>}
     <div className="mt-3 flex flex-wrap gap-2">
      {gotoKind==="bookmark"?<button type="button" onMouseDown={event=>event.preventDefault()} onClick={()=>onGoTo("bookmark",gotoValue)} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-black text-white">Go To</button>:<><button type="button" onMouseDown={event=>event.preventDefault()} onClick={()=>runGoTo(-1)} className="rounded-lg border border-blue-700 px-4 py-2 text-sm font-black text-blue-800">Previous</button><button type="button" onMouseDown={event=>event.preventDefault()} onClick={()=>runGoTo(1)} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-black text-white">Next</button></>}
     </div>
    </>:<p className="text-xs text-slate-500">{gotoDefinition?.label} isn't modeled in this exam tool's document — choose Page, Table, or Bookmark instead.</p>}
   </div>
  </div>}
 </div>;
}
const ZOOM_PRESETS=["200","150","100","75","50"];
function ZoomForm({dialog,onSubmit}:{dialog:{value:string};onSubmit:(value:string)=>void}){const[value,setValue]=useState(dialog.value);return <div><h3 className="font-black">Zoom</h3><div className="mt-3 flex flex-wrap gap-2">{ZOOM_PRESETS.map(preset=><button key={preset} type="button" onMouseDown={event=>event.preventDefault()} onClick={()=>setValue(preset)} className={`rounded-lg border px-3 py-2 text-sm font-bold ${value===preset?"border-blue-700 bg-blue-50 text-blue-800":"border-slate-200"}`}>{preset}%</button>)}</div><label className="mt-4 block text-xs font-bold">Percent (10–500)<input className="input mt-1 w-full" type="number" min="10" max="500" value={value} onChange={event=>setValue(event.target.value)}/></label><button type="button" onMouseDown={event=>event.preventDefault()} onClick={()=>onSubmit(value)} className="mt-4 w-full rounded-lg bg-blue-700 px-4 py-2 text-sm font-black text-white">OK</button></div>}
function TableEditForm({onPick}:{onPick:(action:string)=>void}){const actions:[string,string][]=[["add-row-above","Insert row above"],["add-row-below","Insert row below"],["remove-row","Delete row"],["add-column-left","Insert column left"],["add-column-right","Insert column right"],["remove-column","Delete column"]];return <div><h3 className="font-black">Table rows and columns</h3><div className="mt-3 grid gap-2">{actions.map(([action,label])=><button key={action} type="button" onMouseDown={event=>event.preventDefault()} onClick={()=>onPick(action)} className="rounded-lg border px-4 py-2 text-left text-sm font-bold hover:bg-cyan-50">{label}</button>)}</div></div>}
function ThumbnailPreview({nodes}:{nodes:HTMLElement[]}){const attach=(container:HTMLDivElement|null)=>{if(container){container.replaceChildren(...nodes.map(node=>node.cloneNode(true)as HTMLElement))}};return <div className="word-thumbnail-page-inner" style={{width:794,transform:"scale(0.145)"}} ref={attach}/>}
function matterText(paragraph:MatterParagraph){return paragraph.type==="table"?paragraph.rows.flat().join(" "):paragraph.runs.map(run=>run.text).join("")}
function Run({run}:{run:Extract<WorkingMatterSnapshot["paragraphs"][number],{type:"paragraph"|"list-item"}>["runs"][number]}){return <span style={{fontWeight:run.bold?700:undefined,fontStyle:run.italic?"italic":undefined,textDecoration:[run.underline?"underline":"",run.strike?"line-through":""].filter(Boolean).join(" ")||undefined,fontFamily:run.fontFamily??undefined,fontSize:run.fontSize?`${run.fontSize}pt`:undefined,color:run.color?`#${run.color}`:undefined,backgroundColor:run.highlight?`#${run.highlight}`:undefined}}>{run.text}</span>}

function toSnapshot(editor:HTMLDivElement){const elements=expandListElements([...editor.children]).slice(0,1000);const blocks=elements.map((element,index)=>canonicalizeBlockMeasurements(enrichBlock(makeStructuredBlock(element,`block-${index}`),element)));return{schemaVersion:"2",blocks:blocks.length?blocks:[canonicalizeBlockMeasurements(enrichBlock(emptyBlock(),editor))],pageLayout:{padding:editor.style.padding||null,maxWidth:editor.style.maxWidth||null,aspectRatio:editor.style.aspectRatio||null,columnCount:editor.style.columnCount||null,backgroundColor:approvedCssColor(editor.style.backgroundColor),border:editor.style.border||null,watermark:(editor.dataset.watermark??"").slice(0,40)||null},operations:(editor.dataset.operations??"").split(",").filter(Boolean).slice(0,256),savedAt:new Date().toISOString()}}
function canonicalizeBlockMeasurements<T extends{attrs:Record<string,unknown>}>(block:T){const attrs={...block.attrs};for(const key of["marginLeft","marginRight","marginTop","marginBottom"]as const)if(key in attrs){const value=canonicalWordMeasurement(attrs[key],"length");if(value)attrs[key]=value;else delete attrs[key]}if("lineHeight"in attrs){const lineHeight=canonicalWordMeasurement(attrs.lineHeight,"lineHeight");if(lineHeight)attrs.lineHeight=lineHeight;else delete attrs.lineHeight}return{...block,attrs}}
function enrichBlock(block:ReturnType<typeof makeBlock>,element:Element){const nodes=textNodes(element);const runs=block.runs.map((run,index)=>{const parent=nodes[index]?.parentElement;const link=parent?.closest("a"),bookmark=parent?.closest("[data-bookmark]"),field=parent?.closest("[data-field]");return{...run,doubleStrike:Boolean(parent&&getComputedStyle(parent).textDecorationStyle==="double"),href:link?.getAttribute("href")??null,bookmark:bookmark?.getAttribute("data-bookmark")??null,field:field?.getAttribute("data-field")??null}});const source=block.attrs as Record<string,unknown>;const common=["marginLeft","marginRight","lineHeight","marginTop","marginBottom","border","backgroundColor","hyphens"];const attrs:Record<string,unknown>={};if(block.type==="table")attrs.rows=source.rows;else if(block.type==="image"){const image=element.querySelector("img");attrs.src=source.src;attrs.alt=source.alt??"";attrs.width=image?.naturalWidth||image?.width||1;attrs.height=image?.naturalHeight||image?.height||1;attrs.localAsset=element.hasAttribute("data-local-asset")}else if(block.type==="page-break"||block.type==="section-break")attrs.kind=block.type==="section-break"?"section-next-page":element.nextElementSibling?.textContent?.trim()?"page":"blank-page";else if(block.type!=="horizontal-rule"){for(const key of common)if(source[key]!=null)attrs[key]=source[key];if(block.type==="paragraph"){attrs.lineNumbers=element.classList.contains("editor-line-numbers");const dropCapNode=element.querySelector("[data-drop-cap]");attrs.dropCap=Boolean(dropCapNode);if(dropCapNode){const html=element as HTMLElement;if(html.dataset.dropCapLines)attrs.dropCapLines=Number(html.dataset.dropCapLines);if(html.dataset.dropCapDistance)attrs.dropCapDistance=Number(html.dataset.dropCapDistance);if(html.dataset.dropCapMargin==="true")attrs.dropCapMargin=true}}if(block.type==="list-item"){
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
function makeBlock(element:Element,id:string){const type=element.getAttribute("data-block-type")||(/^(LI)$/i.test(element.tagName)?"list-item":/^(TABLE)$/i.test(element.tagName)?"table":/^(FIGURE)$/i.test(element.tagName)?"image":/^(HR)$/i.test(element.tagName)?"page-break":"paragraph");const html=element instanceof HTMLElement?element:null;const alignment=html&&["left","center","right","justify"].includes(html.style.textAlign)?html.style.textAlign:"left";const attrs:Record<string,unknown>={};if(type==="table"){attrs.rows=[...element.querySelectorAll("tr")].slice(0,50).map(row=>[...row.querySelectorAll("th,td")].slice(0,20).map(cell=>(cell.textContent??"").slice(0,10000)));const tableLayout=element.getAttribute("data-table-layout");if(tableLayout)attrs.tableLayout=tableLayout}if(type==="image"){const img=element.querySelector("img");attrs.src=img?.getAttribute("src")??null;attrs.alt=(img?.getAttribute("alt")??"").slice(0,200)}const original=originalMeasurements(html);for(const key of["marginLeft","marginRight","lineHeight","marginTop","marginBottom","border","backgroundColor","hyphens"]as const){const current=html?.style[key];if(current)(attrs as Record<string,unknown>)[key]=measurementUnchanged(key,current,original[key])?original[key]:current}if(html?.dataset.borderKind)attrs.border=html.dataset.borderKind;if((type==="paragraph"||type==="list-item")&&html?.dataset.specialIndentMode){attrs.specialIndentMode=html.dataset.specialIndentMode;attrs.specialIndentAmount=html.dataset.specialIndentAmount??null}const runs=[];for(const node of textNodes(element)){const parent=node.parentElement;if(!parent||parent.closest('[contenteditable="false"]'))continue;const style=getComputedStyle(parent),decoration=style.textDecoration,decorationStyle=style.textDecorationStyle,vertical=style.verticalAlign,underlineNode=parent.closest("[data-underline-style]")as HTMLElement|null,doubleStrikeNode=parent.closest('[data-double-strike="true"]'),underline=decoration.includes("underline")||Boolean(underlineNode),doubleStrike=Boolean(doubleStrikeNode)||decoration.includes("line-through")&&decorationStyle==="double",charScaleNode=parent.closest("[data-char-scale]")as HTMLElement|null,charSpacingNode=parent.closest("[data-char-spacing]")as HTMLElement|null,charPositionNode=parent.closest("[data-char-position]")as HTMLElement|null,kerningNode=parent.closest("[data-kerning-enabled]")as HTMLElement|null,outlineNode=parent.closest('[data-outline="true"]')as HTMLElement|null;runs.push({text:(node.textContent??"").slice(0,200000),bold:Number(style.fontWeight)>=600,italic:style.fontStyle==="italic",underline,underlineStyle:underline?underlineNode?.dataset.underlineStyle??"single":null,underlineColor:underlineNode?.dataset.underlineColor?.replace("#","").toUpperCase()??null,underlineThickness:underlineNode?.dataset.underlineThickness?Number(underlineNode.dataset.underlineThickness):underlineNode?.dataset.underlineStyle==="thick"?3:null,underlineWordsOnly:underlineNode?.dataset.underlineWordsOnly==="true"||underlineNode?.dataset.underlineStyle==="words-only",strike:decoration.includes("line-through")&&!doubleStrike,doubleStrike,superscript:vertical==="super",subscript:vertical==="sub",smallCaps:Boolean(parent.closest('[data-small-caps="true"]')),allCaps:Boolean(parent.closest('[data-all-caps="true"]')),hidden:Boolean(parent.closest('[data-hidden="true"]')),outline:Boolean(outlineNode),emboss:Boolean(parent.closest('[data-emboss="true"]')),fontFamily:approvedFont(style.fontFamily),fontSize:approvedSize(style.fontSize),color:outlineNode?approvedColor(getComputedStyle(outlineNode).webkitTextStrokeColor):approvedColor(style.color),highlight:approvedColor(style.backgroundColor),charScale:charScaleNode?Number(charScaleNode.dataset.charScale):null,charSpacing:charSpacingNode?Number(charSpacingNode.dataset.charSpacing):null,charPosition:charPositionNode?Number(charPositionNode.dataset.charPosition):null,kerningEnabled:Boolean(kerningNode),kerningMin:kerningNode?.dataset.kerningMin?Number(kerningNode.dataset.kerningMin):null})}return{id,type,alignment,runs:runs.length?runs:[emptyRun()],attrs}}
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
 const measurements:Record<string,unknown>={};for(const key of["marginLeft","marginRight","lineHeight","marginTop","marginBottom"]as const)if(block.attrs[key]!=null){const value=String(block.attrs[key]);html.style[key]=value;measurements[key]=block.attrs[key]}html.dataset.originalMeasurements=JSON.stringify(measurements);if(typeof block.attrs.border==="string"){applyBorderStyle(html,block.attrs.border);if(BORDER_SIDE_KEYWORDS.has(block.attrs.border))html.dataset.borderKind=block.attrs.border}if((block.type==="paragraph"||block.type==="list-item")&&block.attrs.specialIndentMode&&block.attrs.specialIndentMode!=="none"){html.dataset.specialIndentMode=String(block.attrs.specialIndentMode);if(block.attrs.specialIndentAmount){html.dataset.specialIndentAmount=String(block.attrs.specialIndentAmount);html.style.textIndent=block.attrs.specialIndentMode==="hanging"?`-${block.attrs.specialIndentAmount}`:String(block.attrs.specialIndentAmount)}}if(block.type==="table"&&Array.isArray(block.attrs.rows)){if(typeof block.attrs.tableLayout==="string"){element.setAttribute("data-table-layout",block.attrs.tableLayout);html.style.tableLayout=block.attrs.tableLayout==="window"?"auto":block.attrs.tableLayout;html.style.width=block.attrs.tableLayout==="fixed"?"auto":"100%"}const body=element.appendChild(document.createElement("tbody"));for(const row of block.attrs.rows as string[][]){const tr=body.appendChild(document.createElement("tr"));for(const cell of row)tr.appendChild(document.createElement("td")).textContent=cell}}else if(block.type==="image"&&typeof block.attrs.src==="string"&&safeImageSource(block.attrs.src)){const img=element.appendChild(document.createElement("img"));img.src=block.attrs.src;img.alt=String(block.attrs.alt??"");img.style.maxWidth="320px";img.style.maxHeight="320px";img.style.width="auto";img.style.height="auto"}else for(const run of block.runs){const span=document.createElement("span");span.style.fontWeight=run.bold?"700":"";span.style.fontStyle=run.italic?"italic":"";span.style.verticalAlign=run.superscript?"super":run.subscript?"sub":"";if(run.fontFamily)span.style.fontFamily=run.fontFamily;if(run.fontSize)span.style.fontSize=`${run.fontSize}pt`;if(run.color)span.style.color=`#${run.color}`;if(run.highlight)span.style.backgroundColor=run.highlight.startsWith("#")?run.highlight:`#${run.highlight}`;if(run.smallCaps){span.dataset.smallCaps="true";span.style.fontVariant="small-caps"}if(run.allCaps){span.dataset.allCaps="true";span.style.textTransform="uppercase"}if(run.hidden){span.dataset.hidden="true";span.style.opacity="0.4";span.style.textDecorationLine=[span.style.textDecorationLine,"underline"].filter(Boolean).join(" ");span.style.textDecorationStyle="dotted"}if(run.outline){span.dataset.outline="true";span.style.color="transparent";span.style.webkitTextStroke=`1px ${run.color?`#${run.color}`:"#000000"}`}if(run.emboss){span.dataset.emboss="true";span.style.color="#808080";span.style.textShadow="1px 1px 0 rgba(255,255,255,.85),-1px -1px 0 rgba(0,0,0,.55)"}if(run.charScale&&run.charScale!==100){span.dataset.charScale=String(run.charScale);span.style.display="inline-block";span.style.transform=`scaleX(${run.charScale/100})`;span.style.transformOrigin="left"}if(run.charSpacing){span.dataset.charSpacing=String(run.charSpacing);span.style.letterSpacing=`${run.charSpacing}pt`}if(run.charPosition){span.dataset.charPosition=String(run.charPosition);span.style.position="relative";span.style.top=`${-run.charPosition}pt`}if(run.kerningEnabled){span.dataset.kerningEnabled="true";span.style.fontKerning="normal";if(run.kerningMin)span.dataset.kerningMin=String(run.kerningMin)}const decorations=[];if(run.underline)decorations.push("underline");if(run.strike||run.doubleStrike)decorations.push("line-through");if(decorations.length)span.style.textDecorationLine=[span.style.textDecorationLine,...decorations].filter(Boolean).join(" ");if(run.doubleStrike){span.dataset.doubleStrike="true";span.style.textDecorationStyle="double"}if(run.underline){const style=run.underlineStyle??"single";span.dataset.underlineStyle=style;span.dataset.underlineWordsOnly=String(run.underlineWordsOnly===true);if(run.underlineColor){span.dataset.underlineColor=`#${run.underlineColor}`;span.style.textDecorationColor=`#${run.underlineColor}`}if(run.underlineThickness){span.dataset.underlineThickness=String(run.underlineThickness);span.style.textDecorationThickness=`${run.underlineThickness}px`}if(!run.doubleStrike&&!run.hidden)span.style.textDecorationStyle=underlineCssStyle(style)}span.textContent=run.text;element.appendChild(span)}if(block.type==="paragraph"){if(block.attrs.lineNumbers===true)html.classList.add("editor-line-numbers");if(block.attrs.dropCap===true){const lines=typeof block.attrs.dropCapLines==="number"?block.attrs.dropCapLines:3,distance=typeof block.attrs.dropCapDistance==="number"?block.attrs.dropCapDistance:0,margin=block.attrs.dropCapMargin===true;html.dataset.dropCapLines=String(lines);html.dataset.dropCapDistance=String(distance);if(margin)html.dataset.dropCapMargin="true";applyDropCapMarker(html,lines,distance,margin)}}return element}))}
function applyDropCapMarker(element:HTMLElement,lines=3,distance=0,margin=false){const first=element.querySelector("span");if(!first||!first.textContent)return;const characters=[...first.textContent],capCharacter=characters[0];if(!capCharacter)return;const rest=characters.slice(1).join("");const cap=document.createElement("span");cap.dataset.dropCap="true";cap.style.cssText=first.style.cssText;cap.style.float="left";cap.style.fontSize=`${lines}em`;cap.style.lineHeight=".8";cap.style.marginRight=`${distance}in`;if(margin){cap.dataset.dropCapMargin="true";cap.style.marginLeft=`-${lines*0.5+distance}in`}cap.textContent=capCharacter;if(rest)first.textContent=rest;else first.remove();element.insertBefore(cap,element.firstChild)}
function makeStructuredBlock(element:Element,id:string){const block=makeBlock(element,id),html=element as HTMLElement,type=editorBlockType(element);return{...block,type,attrs:{...block.attrs,...editorBlockAttrs(html,type)}}}
function renderStructuredSnapshot(editor:HTMLDivElement|null,snapshot:ReturnType<typeof toSnapshot>){renderSnapshot(editor,snapshot);if(!editor)return;snapshot.blocks.forEach((block,index)=>{if(!["paragraph","list-item","page-break"].includes(block.type)){const current=editor.children[index]as HTMLElement|undefined;if(current){const replacement=createEditorBlock(document,block);if(!["table","image","page-break","section-break"].includes(block.type))replacement.append(...current.childNodes);const measurements:Record<string,unknown>={};for(const key of["marginLeft","marginRight","lineHeight","marginTop","marginBottom"]as const)if(block.attrs[key]!=null)measurements[key]=block.attrs[key];replacement.dataset.originalMeasurements=JSON.stringify(measurements);current.replaceWith(replacement)}}const element=editor.children[index]as HTMLElement|undefined;if(!element||["table","image","page-break","section-break"].includes(block.type))return;const spans=[...element.querySelectorAll(":scope > span")];block.runs.forEach((run,runIndex)=>{const span=spans[runIndex]as HTMLElement|undefined;if(!span)return;if(run.bookmark)span.dataset.bookmark=run.bookmark;if(run.field)span.dataset.field=run.field;if(run.href){const link=document.createElement("a");link.href=run.href;span.replaceWith(link);link.append(span)}})});editor.replaceChildren(...regroupListElements([...editor.children]as HTMLElement[],snapshot.blocks,document))}
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
function approvedSize(value:string){const size=Math.round(Number.parseFloat(value)*.75);return Number.isFinite(size)&&size>=8&&size<=72?size:null}
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
function approvedColor(value:string){const hex=value.match(/^#([0-9a-f]{6})$/i)?.[1];if(hex)return hex.toUpperCase();const rgba=value.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)$/i);if(!rgba)return null;if(rgba[4]!==undefined&&Number(rgba[4])<=0)return null;return rgba.slice(1,4).map(part=>Number(part).toString(16).padStart(2,"0")).join("").toUpperCase()}function approvedCssColor(value:string){return approvedColor(value)}
function escapeHtml(value:string){return value.replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]!))}function safeId(value:string){return value.replace(/[^a-z0-9_-]/gi,"").slice(0,50)}function bounded(value:string,min:number,max:number){const number=Number(value);return Number.isFinite(number)?Math.max(min,Math.min(max,number)):min}function changeCase(value:string){if(!value)return value;if(value===value.toUpperCase())return value.toLowerCase();if(value===value.toLowerCase())return value.replace(/\b\p{L}/gu,char=>char.toUpperCase());return value.toUpperCase()}function safeImageSource(value:string){return /^data:image\/(?:png|jpeg|webp|gif);base64,[a-z0-9+/=]+$/i.test(value)&&value.length<750000}
