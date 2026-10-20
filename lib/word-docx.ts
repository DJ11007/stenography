import{unzipSync}from"fflate";
import{XMLParser}from"fast-xml-parser";
import{looksLikeKrutiDevText}from"./word-pdf-extraction.ts";

export type MatterRun={text:string;bold:boolean;italic:boolean;underline:boolean;strike:boolean;fontFamily:string|null;fontSize:number|null;color:string|null;highlight:string|null};
export type MatterTextParagraph={id:string;type:"paragraph"|"list-item";paragraphNumber:number|null;listGroup:string|null;runs:MatterRun[];alignment:"left"|"center"|"right"|"justify";leftIndent:number;rightIndent:number;lineSpacing:number;spaceBefore:number;spaceAfter:number;numbered?:boolean};
// cellFonts / cellSizes: each cell's font and size (pt) from its first run -- a Hindi table typed in
// Kruti Dev 010 shows as Latin gibberish in any other font.
export type MatterTable={id:string;type:"table";rows:string[][];cellFonts?:(string|null)[][];cellSizes?:(number|null)[][]};
export type MatterParagraph=MatterTextParagraph|MatterTable;
export type WorkingMatterSnapshot={schemaVersion:1|"1";language:"English"|"Hindi";source?:{fileName:string;sizeBytes:number;bucket?:string;storagePath?:string};paragraphs:MatterParagraph[];formattingSummary:{paragraphs:number;runs:number;italicParagraphs:number;justifiedParagraphs:number;listItems:number;tables:number;fonts:string[]};warnings:string[]};
const MAX_DOCX_BYTES=10*1024*1024,MAX_UNCOMPRESSED_BYTES=40*1024*1024;
// trimValues defaults to true in fast-xml-parser, which strips the leading/
// trailing space off every <w:t> text node -- exactly the whitespace Word
// uses to mark a word boundary at a run split (e.g. one word given its own
// formatting run splits "your Guru document" into "your "/"Guru"/" document").
// Joining trimmed runs with "" then glues adjacent words together
// ("yourGurudocument") with no separator ever having existed to restore.
// Word's actual significant-whitespace marker (xml:space="preserve") is
// irrelevant here: fast-xml-parser's trimming ignores it and strips the
// value regardless, so the fix is simply to stop trimming at the parser level.
const parser=new XMLParser({ignoreAttributes:false,attributeNamePrefix:"@",textNodeName:"#text",trimValues:false,isArray:(name)=>["w:p","w:r","w:t","w:tbl","w:tr","w:tc"].includes(name)});
const own=(value:unknown,key:string)=>Boolean(value&&typeof value==="object"&&Object.prototype.hasOwnProperty.call(value,key));
const attr=(value:unknown,key:string)=>value&&typeof value==="object"?String((value as Record<string,unknown>)[`@w:${key}`]??""):"";
const points=(value:string,divisor:number)=>Number.isFinite(Number(value))?Number(value)/divisor:0;
// w:highlight's w:val is always one of OOXML's ST_HighlightColor enum names
// (never a hex code, unlike w:color) -- passing it straight through as a
// raw CSS value used to render literally as e.g. black/red wherever a
// document happened to use Word's black/red highlighter swatch. Mapped to
// real hex here so it round-trips through this app's hex-only color
// convention like every other color field; anything outside the 16 known
// names (including "none") becomes no highlight instead of an unpredictable
// raw string.
const HIGHLIGHT_HEX:Record<string,string>={yellow:"FFFF00",green:"00FF00",cyan:"00FFFF",magenta:"FF00FF",blue:"0000FF",red:"FF0000",darkblue:"00008B",darkcyan:"008B8B",darkgreen:"006400",darkmagenta:"8B008B",darkred:"8B0000",darkyellow:"808000",darkgray:"A9A9A9",lightgray:"D3D3D3",black:"000000",white:"FFFFFF"};
const highlightHex=(value:string):string|null=>HIGHLIGHT_HEX[value.trim().toLowerCase()]??null;
const cleanText=(value:string)=>value.normalize("NFC").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/gu,"").slice(0,200000);

export function validateWorkingMatterFile(file:{name:string;type:string;size:number}){const errors:string[]=[];const lower=file.name.toLowerCase();if(!lower.endsWith(".docx")||lower.endsWith(".doc")||lower.endsWith(".docm"))errors.push("Upload a Microsoft Word .docx file only.");if(file.type&&file.type!=="application/vnd.openxmlformats-officedocument.wordprocessingml.document")errors.push("The file MIME type is not a valid DOCX document.");if(file.size<=0||file.size>MAX_DOCX_BYTES)errors.push("Working Matter DOCX must be between 1 byte and 10 MB.");return errors}

export function parseWorkingMatterDocx(bytes:Uint8Array):WorkingMatterSnapshot{
 if(bytes.byteLength>MAX_DOCX_BYTES)throw new Error("Working Matter DOCX exceeds 10 MB.");let expanded=0;const files=unzipSync(bytes,{filter:file=>{if(file.name.includes("..")||file.name.startsWith("/")||file.name.includes("\\"))throw new Error("DOCX contains an unsafe package path.");expanded+=file.originalSize;if(expanded>MAX_UNCOMPRESSED_BYTES)throw new Error("DOCX expands beyond the safe 40 MB limit.");return true}});const names=Object.keys(files);if(!files["[Content_Types].xml"]||!files["word/document.xml"])throw new Error("Malformed DOCX: required Word document parts are missing.");if(names.some(name=>/(?:vbaProject\.bin|activeX|embeddings|oleObject|\.exe$|\.dll$|\.js$)/iu.test(name)))throw new Error("DOCX contains executable or embedded content that is not allowed.");const decoder=new TextDecoder();for(const name of names.filter(name=>name.endsWith(".rels"))){const rels=decoder.decode(files[name]);
  // Word records the template a document was made from (attachedTemplate, often a path on the author's
  // PC) and hyperlink addresses as external targets; this importer never loads either, so they are
  // harmless. Any other external relationship (linked pictures, objects) is still refused.
  for(const relationship of rels.match(/<Relationship\b[^>]*>/giu)??[])if(/TargetMode\s*=\s*["']External["']/iu.test(relationship)&&!/Type\s*=\s*["'][^"']*\/relationships\/(?:attachedTemplate|hyperlink)["']/iu.test(relationship))throw new Error("DOCX contains unsafe external relationships.")}
 const xml=decoder.decode(files["word/document.xml"]);const doc=parser.parse(xml);const body=doc?.["w:document"]?.["w:body"];if(!body)throw new Error("Malformed DOCX document body.");const allParagraphs=(Array.isArray(body["w:p"])?body["w:p"]:[]).map(parseParagraph);const allTables=(Array.isArray(body["w:tbl"])?body["w:tbl"] as Record<string,unknown>[]:[]).map((tbl,index)=>parseTable(tbl,`matter-table-${index+1}`));const hasText=(paragraph:MatterTextParagraph)=>paragraph.runs.some(run=>run.text.trim());const rawParagraphs=allParagraphs.filter(hasText);const rawTables=allTables.filter((table):table is MatterTable=>table!==null);if(!rawParagraphs.length&&!rawTables.length)throw new Error("DOCX contains no supported editable paragraphs.");const warnings:string[]=[];if(/<w:(?:drawing|pict|object|altChunk)\b/iu.test(xml))warnings.push("Unsupported drawings or embedded elements were omitted; supported paragraph and table text was preserved.");
 const textParagraphs=groupNumberedList(rawParagraphs);let number=0;for(const paragraph of textParagraphs)paragraph.paragraphNumber=paragraph.type==="paragraph"?++number:null;
 // The XML parser collects <w:p> and <w:tbl> separately; their order in the document body is read
 // from the XML itself, so a table stays where it is in Word (before the list that follows it, etc.).
 // If that ever disagrees with what the parser found, tables go after the text as before.
 const order=bodyOrder(xml);const ordered:MatterParagraph[]=[];let nextParagraph=0,nextTable=0;
 if(order.filter(kind=>kind==="p").length===allParagraphs.length&&order.filter(kind=>kind==="tbl").length===allTables.length){const kept=new Set(textParagraphs.map(paragraph=>paragraph.id));const byId=new Map(textParagraphs.map(paragraph=>[paragraph.id,paragraph]));for(const kind of order){if(kind==="p"){const paragraph=allParagraphs[nextParagraph++];if(kept.has(paragraph.id))ordered.push(byId.get(paragraph.id)!)}else{const table=allTables[nextTable++];if(table)ordered.push(table)}}}
 const paragraphs:MatterParagraph[]=ordered.length===textParagraphs.length+rawTables.length?ordered:[...textParagraphs,...rawTables];
 for(const paragraph of paragraphs)if(paragraph.type!=="table")delete paragraph.numbered;
 // Kruti Dev 010 text in a Kruti Dev font is real Hindi as Word shows it, and the editor has the font,
 // so it is kept exactly as typed. Only Kruti-looking text in some other font (which would show as
 // gibberish) still needs a conversion first.
 const krutiFont=(font:string|null|undefined)=>/kruti/i.test(font??"");
 const text=paragraphs.flatMap(p=>p.type==="table"?p.rows.flatMap((row,r)=>row.filter((_,c)=>!krutiFont(p.cellFonts?.[r]?.[c]))):p.runs.filter(r=>!krutiFont(r.fontFamily)).map(r=>r.text)).join(" ");if(looksLikeKrutiDevText(text))throw new Error("Legacy Kruti Dev text detected. Set those paragraphs to the Kruti Dev 010 font in Word, or convert them to Unicode, before importing.");const language:"English"|"Hindi"=/[\u0900-\u097f]/u.test(text)?"Hindi":"English";const fonts=[...new Set(textParagraphs.flatMap(p=>p.runs.map(r=>r.fontFamily).filter((font):font is string=>Boolean(font))))];
 return{schemaVersion:1,language,paragraphs,formattingSummary:{paragraphs:number,runs:textParagraphs.reduce((sum,p)=>sum+p.runs.length,0),italicParagraphs:textParagraphs.filter(p=>p.runs.some(r=>r.italic)).length,justifiedParagraphs:textParagraphs.filter(p=>p.alignment==="justify").length,listItems:textParagraphs.filter(p=>p.type==="list-item").length,tables:rawTables.length,fonts},warnings}
}

function parseTable(tbl:Record<string,unknown>,id:string):MatterTable|null{const trs=Array.isArray(tbl["w:tr"])?tbl["w:tr"] as Record<string,unknown>[]:[];const cellRows=trs.map(tr=>(Array.isArray(tr["w:tc"])?tr["w:tc"] as Record<string,unknown>[]:[]).slice(0,20)).filter(row=>row.length).slice(0,50);const rows=cellRows.map(row=>row.map(cellText));if(!rows.length||!rows[0].length)return null;const firstRun=(cell:Record<string,unknown>)=>{for(const p of Array.isArray(cell["w:p"])?cell["w:p"] as Record<string,unknown>[]:[]){const pPr=(p["w:pPr"]??{})as Record<string,unknown>;for(const run of Array.isArray(p["w:r"])?p["w:r"] as Record<string,unknown>[]:[]){const parsed=parseRun(run,(pPr["w:rPr"]??{})as Record<string,unknown>);if(parsed.text.trim())return parsed}}return null};const runs=cellRows.map(row=>row.map(firstRun));const cellFonts=runs.map(row=>row.map(run=>run?.fontFamily??null)),cellSizes=runs.map(row=>row.map(run=>run?.fontSize??null));return{id,type:"table",rows,...(cellFonts.flat().some(Boolean)?{cellFonts}:{}),...(cellSizes.flat().some(Boolean)?{cellSizes}:{})}}
function cellText(cell:Record<string,unknown>):string{const paragraphs=Array.isArray(cell["w:p"])?cell["w:p"] as Record<string,unknown>[]:[];return cleanText(paragraphs.map(p=>{const rawRuns=Array.isArray(p["w:r"])?p["w:r"] as Record<string,unknown>[]:[];return rawRuns.map(run=>parseRun(run,{}).text).join("")}).filter(Boolean).join(" ")).slice(0,10000)}
function parseParagraph(value:Record<string,unknown>,index:number):MatterTextParagraph{const pPr=(value["w:pPr"]??{})as Record<string,unknown>;const paragraphRun=(pPr["w:rPr"]??{})as Record<string,unknown>;const rawRuns=Array.isArray(value["w:r"])?value["w:r"] as Record<string,unknown>[]:[];const runs=rawRuns.map(run=>parseRun(run,paragraphRun)).filter(run=>run.text);const alignmentValue=attr(pPr["w:jc"],"val");const alignment:MatterTextParagraph["alignment"]=alignmentValue==="both"?"justify":alignmentValue==="center"?"center":alignmentValue==="right"?"right":"left";const ind=pPr["w:ind"],spacing=pPr["w:spacing"];return{id:`matter-p-${index+1}`,type:"paragraph",numbered:own(pPr,"w:numPr"),paragraphNumber:null,listGroup:null,runs,alignment,leftIndent:points(attr(ind,"left")||attr(ind,"start"),1440),rightIndent:points(attr(ind,"right")||attr(ind,"end"),1440),lineSpacing:points(attr(spacing,"line"),240)||1,spaceBefore:points(attr(spacing,"before"),20),spaceAfter:points(attr(spacing,"after"),20)}}
function parseRun(value:Record<string,unknown>,paragraphRun:Record<string,unknown>):MatterRun{const rPr=(value["w:rPr"]??{})as Record<string,unknown>;const texts=Array.isArray(value["w:t"])?value["w:t"]:[];const text=cleanText(texts.map(item=>typeof item==="object"&&item!==null?String((item as Record<string,unknown>)["#text"]??""):item==null?"":String(item)).join(""));const prop=(key:string)=>own(rPr,key)||own(paragraphRun,key);const fonts=rPr["w:rFonts"]??paragraphRun["w:rFonts"],size=attr(rPr["w:sz"]??paragraphRun["w:sz"],"val");return{text,bold:prop("w:b"),italic:prop("w:i"),underline:prop("w:u"),strike:prop("w:strike")||prop("w:dstrike"),fontFamily:attr(fonts,"ascii")||attr(fonts,"hAnsi")||null,fontSize:size?points(size,2):null,color:attr(rPr["w:color"]??paragraphRun["w:color"],"val")||null,highlight:highlightHex(attr(rPr["w:highlight"]??paragraphRun["w:highlight"],"val"))}}
// A paragraph is a list item when Word made it one (it has list numbering, <w:numPr>). Short lines
// that are plain paragraphs in Word stay plain paragraphs: guessing a list from line length turned
// a "make this a multilevel list" exercise into a list before the student touched it.
function groupNumberedList(items:MatterTextParagraph[]){const result=items.map(item=>({...item,runs:item.runs.map(run=>({...run}))}));for(let start=0;start<result.length;){if(!result[start].numbered){start++;continue}let end=start;while(end<result.length&&result[end].numbered)end++;for(let index=start;index<end;index++){result[index].type="list-item";result[index].listGroup=`matter-list-${start+1}`}start=end}return result}
// The order of the document body's top-level paragraphs ("p") and tables ("tbl").
function bodyOrder(xml:string):("p"|"tbl")[]{const open=/<w:body\b[^>]*>/.exec(xml);const end=xml.lastIndexOf("</w:body>");if(!open||end<0)return[];const order:("p"|"tbl")[]=[];const tag=/<(\/?)(w:[A-Za-z]+)\b[^>]*?(\/?)>/g;tag.lastIndex=open.index+open[0].length;for(let found=tag.exec(xml);found&&found.index<end;found=tag.exec(xml)){const[,closing,name,selfClosing]=found;if(closing)continue;if(name==="w:p"||name==="w:tbl")order.push(name==="w:p"?"p":"tbl");if(selfClosing)continue;let depth=1;const inner=new RegExp(`<(/?)${name}\\b[^>]*?(/?)>`,"g");inner.lastIndex=tag.lastIndex;for(let match=inner.exec(xml);match;match=inner.exec(xml)){if(match[1])depth--;else if(!match[2])depth++;if(depth===0){tag.lastIndex=inner.lastIndex;break}}}return order}
function textOf(paragraph:MatterTextParagraph){return paragraph.runs.map(run=>run.text).join("").trim()}
export function cloneMatterSnapshot(snapshot:WorkingMatterSnapshot):WorkingMatterSnapshot{return structuredClone(snapshot)}

/** Ports public.word_efficiency_initial_editor_document's conversion to
 * TypeScript (schema-v1 "paragraphs" -> schema-v1 "blocks") so a real .docx
 * uploaded by a student for the realfile delivery mode can be turned into
 * exactly the same document shape the on-screen editor's original/final
 * snapshots already use, without a network round trip. Unlike the Postgres
 * function, a table paragraph is converted into a plain-text block instead
 * of a block with no runs at all -- the Postgres version's naive
 * `runs` lookup produces `null` for a table paragraph (tables carry `rows`,
 * not `runs`), which the document schema validator would then reject as an
 * invalid block; this avoids that trap for real uploaded files, which are
 * far more likely to actually contain a table than an admin-controlled
 * working matter used only to seed the on-screen editor. */
export function convertWorkingMatterToEditorDocument(matter:WorkingMatterSnapshot):Record<string,unknown>{
 const blocks=matter.paragraphs.map((paragraph,index)=>{
  if(paragraph.type==="table"){
   return{id:`block-${index}`,type:"paragraph",alignment:"left",runs:[{text:paragraph.rows.flat().join(" ").slice(0,200000),bold:false,italic:false,underline:false,strike:false,superscript:false,subscript:false,fontFamily:null,fontSize:null,color:null,highlight:null}]};
  }
  return{
   id:`block-${index}`,
   type:paragraph.type==="list-item"?"list-item":"paragraph",
   alignment:paragraph.alignment,
   runs:paragraph.runs.length?paragraph.runs.map(run=>({text:run.text,bold:run.bold,italic:run.italic,underline:run.underline,strike:run.strike,superscript:false,subscript:false,fontFamily:run.fontFamily,fontSize:run.fontSize,color:run.color,highlight:run.highlight})):[{text:"",bold:false,italic:false,underline:false,strike:false,superscript:false,subscript:false,fontFamily:null,fontSize:null,color:null,highlight:null}],
  };
 });
 return{schemaVersion:"1",blocks,savedAt:"1970-01-01T00:00:00.000Z"};
}
