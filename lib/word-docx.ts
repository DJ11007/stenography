import{unzipSync}from"fflate";
import{XMLParser}from"fast-xml-parser";
import{looksLikeKrutiDevText}from"./word-pdf-extraction.ts";

export type MatterRun={text:string;bold:boolean;italic:boolean;underline:boolean;strike:boolean;fontFamily:string|null;fontSize:number|null;color:string|null;highlight:string|null};
export type MatterTextParagraph={id:string;type:"paragraph"|"list-item";paragraphNumber:number|null;listGroup:string|null;runs:MatterRun[];alignment:"left"|"center"|"right"|"justify";leftIndent:number;rightIndent:number;lineSpacing:number;spaceBefore:number;spaceAfter:number};
export type MatterTable={id:string;type:"table";rows:string[][]};
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
 if(bytes.byteLength>MAX_DOCX_BYTES)throw new Error("Working Matter DOCX exceeds 10 MB.");let expanded=0;const files=unzipSync(bytes,{filter:file=>{if(file.name.includes("..")||file.name.startsWith("/")||file.name.includes("\\"))throw new Error("DOCX contains an unsafe package path.");expanded+=file.originalSize;if(expanded>MAX_UNCOMPRESSED_BYTES)throw new Error("DOCX expands beyond the safe 40 MB limit.");return true}});const names=Object.keys(files);if(!files["[Content_Types].xml"]||!files["word/document.xml"])throw new Error("Malformed DOCX: required Word document parts are missing.");if(names.some(name=>/(?:vbaProject\.bin|activeX|embeddings|oleObject|\.exe$|\.dll$|\.js$)/iu.test(name)))throw new Error("DOCX contains executable or embedded content that is not allowed.");const decoder=new TextDecoder();for(const name of names.filter(name=>name.endsWith(".rels"))){const rels=decoder.decode(files[name]);if(/TargetMode\s*=\s*["']External["']/iu.test(rels))throw new Error("DOCX contains unsafe external relationships.")}
 const xml=decoder.decode(files["word/document.xml"]);const doc=parser.parse(xml);const body=doc?.["w:document"]?.["w:body"];if(!body)throw new Error("Malformed DOCX document body.");const rawParagraphs=(Array.isArray(body["w:p"])?body["w:p"]:[]).map(parseParagraph).filter((paragraph:MatterTextParagraph)=>paragraph.runs.some(run=>run.text.trim()));const rawTables=(Array.isArray(body["w:tbl"])?body["w:tbl"] as Record<string,unknown>[]:[]).map((tbl,index)=>parseTable(tbl,`matter-table-${index+1}`)).filter((table):table is MatterTable=>table!==null);if(!rawParagraphs.length&&!rawTables.length)throw new Error("DOCX contains no supported editable paragraphs.");const warnings:string[]=[];if(/<w:(?:drawing|pict|object|altChunk)\b/iu.test(xml))warnings.push("Unsupported drawings or embedded elements were omitted; supported paragraph and table text was preserved.");
 const textParagraphs=groupShortList(rawParagraphs);let number=0;for(const paragraph of textParagraphs)paragraph.paragraphNumber=paragraph.type==="paragraph"?++number:null;
 // Word tables are pulled out separately by the XML parser, so exact interleaving with
 // surrounding paragraphs isn't preserved -- they're appended after the running text.
 // Position them within the working matter body rather than reordering paragraph text.
 const paragraphs:MatterParagraph[]=[...textParagraphs,...rawTables];
 const text=paragraphs.flatMap(p=>p.type==="table"?p.rows.flat():p.runs.map(r=>r.text)).join(" ");if(looksLikeKrutiDevText(text))throw new Error("Legacy Kruti Dev text detected. Select an explicit Kruti Dev-to-Unicode conversion workflow before importing.");const language:"English"|"Hindi"=/[\u0900-\u097f]/u.test(text)?"Hindi":"English";const fonts=[...new Set(textParagraphs.flatMap(p=>p.runs.map(r=>r.fontFamily).filter((font):font is string=>Boolean(font))))];
 return{schemaVersion:1,language,paragraphs,formattingSummary:{paragraphs:number,runs:textParagraphs.reduce((sum,p)=>sum+p.runs.length,0),italicParagraphs:textParagraphs.filter(p=>p.runs.some(r=>r.italic)).length,justifiedParagraphs:textParagraphs.filter(p=>p.alignment==="justify").length,listItems:textParagraphs.filter(p=>p.type==="list-item").length,tables:rawTables.length,fonts},warnings}
}

function parseTable(tbl:Record<string,unknown>,id:string):MatterTable|null{const trs=Array.isArray(tbl["w:tr"])?tbl["w:tr"] as Record<string,unknown>[]:[];const rows=trs.map(tr=>{const tcs=Array.isArray(tr["w:tc"])?tr["w:tc"] as Record<string,unknown>[]:[];return tcs.map(cellText).slice(0,20)}).filter(row=>row.length).slice(0,50);if(!rows.length||!rows[0].length)return null;return{id,type:"table",rows}}
function cellText(cell:Record<string,unknown>):string{const paragraphs=Array.isArray(cell["w:p"])?cell["w:p"] as Record<string,unknown>[]:[];return cleanText(paragraphs.map(p=>{const rawRuns=Array.isArray(p["w:r"])?p["w:r"] as Record<string,unknown>[]:[];return rawRuns.map(run=>parseRun(run,{}).text).join("")}).filter(Boolean).join(" ")).slice(0,10000)}
function parseParagraph(value:Record<string,unknown>,index:number):MatterTextParagraph{const pPr=(value["w:pPr"]??{})as Record<string,unknown>;const paragraphRun=(pPr["w:rPr"]??{})as Record<string,unknown>;const rawRuns=Array.isArray(value["w:r"])?value["w:r"] as Record<string,unknown>[]:[];const runs=rawRuns.map(run=>parseRun(run,paragraphRun)).filter(run=>run.text);const alignmentValue=attr(pPr["w:jc"],"val");const alignment:MatterTextParagraph["alignment"]=alignmentValue==="both"?"justify":alignmentValue==="center"?"center":alignmentValue==="right"?"right":"left";const ind=pPr["w:ind"],spacing=pPr["w:spacing"];return{id:`matter-p-${index+1}`,type:"paragraph",paragraphNumber:null,listGroup:null,runs,alignment,leftIndent:points(attr(ind,"left")||attr(ind,"start"),1440),rightIndent:points(attr(ind,"right")||attr(ind,"end"),1440),lineSpacing:points(attr(spacing,"line"),240)||1,spaceBefore:points(attr(spacing,"before"),20),spaceAfter:points(attr(spacing,"after"),20)}}
function parseRun(value:Record<string,unknown>,paragraphRun:Record<string,unknown>):MatterRun{const rPr=(value["w:rPr"]??{})as Record<string,unknown>;const texts=Array.isArray(value["w:t"])?value["w:t"]:[];const text=cleanText(texts.map(item=>typeof item==="object"&&item!==null?String((item as Record<string,unknown>)["#text"]??""):item==null?"":String(item)).join(""));const prop=(key:string)=>own(rPr,key)||own(paragraphRun,key);const fonts=rPr["w:rFonts"]??paragraphRun["w:rFonts"],size=attr(rPr["w:sz"]??paragraphRun["w:sz"],"val");return{text,bold:prop("w:b"),italic:prop("w:i"),underline:prop("w:u"),strike:prop("w:strike")||prop("w:dstrike"),fontFamily:attr(fonts,"ascii")||attr(fonts,"hAnsi")||null,fontSize:size?points(size,2):null,color:attr(rPr["w:color"]??paragraphRun["w:color"],"val")||null,highlight:highlightHex(attr(rPr["w:highlight"]??paragraphRun["w:highlight"],"val"))}}
function groupShortList(items:MatterTextParagraph[]){const result=items.map(item=>({...item,runs:item.runs.map(run=>({...run}))}));for(let start=0;start<result.length;){if(textOf(result[start]).length>40){start++;continue}let end=start;while(end<result.length&&textOf(result[end]).length>0&&textOf(result[end]).length<=40)end++;if(end-start>=2)for(let index=start;index<end;index++){result[index].type="list-item";result[index].listGroup=`matter-list-${start+1}`}start=Math.max(end,start+1)}return result}
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
