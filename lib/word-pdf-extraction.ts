export type ExtractedWordQuestion={fingerprint:string;number:number;text:string;confidence:"Detected"|"Review required";include:boolean;section:string|null};
const QUESTION=/^(?:(?:Q\s*\.?\s*|Question\s+)(\d{1,3})(?:\s*[.) :-])?\s+(.+)|(\d{1,3})\s*(?:[.)]|[:-])\s+(.+)|प्रश्न\s*[-–:]?\s*(\d{1,3})(?:\s*[.) :-])?\s+(.+))$/iu;
const PAGE_NUMBER=/^(?:page\s*)?\d+(?:\s*(?:of|\/|का)\s*\d+)?$/iu;
export function stableQuestionFingerprint(number:number,text:string){let hash=2166136261;for(const char of`${number}|${text.normalize("NFKC").replace(/\s+/gu," ").trim()}`){hash^=char.codePointAt(0)??0;hash=Math.imul(hash,16777619)}return `pdf-${(hash>>>0).toString(16)}`}
export function looksLikeKrutiDevText(text:string){
 if(/[\u0900-\u097f]/u.test(text))return false;
 const latinTokens=text.match(/[A-Za-zÒ—”’]+(?:[/{;}][A-Za-zÒ—”’{};/]*)?/gu)??[];if(latinTokens.join("").length<20)return false;
 const legacyGlyphs=(text.match(/[Ò—”’]/gu)??[]).length;
 const punctuated=latinTokens.filter(token=>/[/{;}]/u.test(token)).length;
 const mixedCase=latinTokens.filter(token=>/[a-z][A-Z]|[A-Z][a-z].*[A-Z]/u.test(token)).length;
 const suspicious=latinTokens.filter(token=>/[Ò—”’/{;}]/u.test(token)||/[a-z][A-Z]|[A-Z][a-z].*[A-Z]/u.test(token)).length;
 return legacyGlyphs>0&&suspicious>=2||punctuated>0&&mixedCase>=2||mixedCase>=5&&suspicious/latinTokens.length>=.25
}
export function detectPdfQuestions(pages:string[]):ExtractedWordQuestion[]{
 const pageLines=pages.map(page=>page.replace(/\r/g,"").split("\n").map(line=>line.replace(/\s+/gu," ").trim()).filter(Boolean));const frequencies=new Map<string,number>();for(const lines of pageLines)for(const line of new Set(lines))frequencies.set(line,(frequencies.get(line)??0)+1);
 const lines=pageLines.flatMap(items=>items.filter(line=>!PAGE_NUMBER.test(line)&&!((frequencies.get(line)??0)>1&&line.length<120)));const found:ExtractedWordQuestion[]=[];let current:{number:number;text:string;uncertain:boolean}|null=null;
 for(const line of lines){const match=line.match(QUESTION);if(match){if(current)found.push(toQuestion(current));current={number:Number(match[1]??match[3]??match[5]),text:(match[2]??match[4]??match[6]).trim(),uncertain:false};continue}if(current){current.text+=` ${line}`;current.uncertain=current.uncertain||line.length<2}}
 if(current)found.push(toQuestion(current));return found.map((question,index)=>({...question,confidence:question.number===index+1&&question.text.length>=8?question.confidence:"Review required"}))
}
function toQuestion(value:{number:number;text:string;uncertain:boolean}):ExtractedWordQuestion{return{fingerprint:stableQuestionFingerprint(value.number,value.text),number:value.number,text:value.text,confidence:value.uncertain||value.text.length<8?"Review required":"Detected",include:true,section:null}}
