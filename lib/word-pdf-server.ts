import"server-only";

type WorkerModule={WorkerMessageHandler:unknown};
type PdfJsWorkerGlobal=typeof globalThis&{pdfjsWorker?:WorkerModule};
export class PdfReaderStartError extends Error{constructor(){super("The PDF reader could not start. Please retry after the application restarts.");this.name="PdfReaderStartError"}}

async function loadServerPdfJs(){
 try{const[pdfjs,worker]=await Promise.all([import("pdfjs-dist/legacy/build/pdf.mjs"),import("pdfjs-dist/legacy/build/pdf.worker.mjs")]);(globalThis as PdfJsWorkerGlobal).pdfjsWorker={WorkerMessageHandler:worker.WorkerMessageHandler};return pdfjs}catch(error){console.error("[Word Efficiency PDF reader startup failed]",error);throw new PdfReaderStartError()}
}

export async function extractPdfTextPages(arrayBuffer:ArrayBuffer|Uint8Array){
 const pdfjs=await loadServerPdfJs();const data=arrayBuffer instanceof Uint8Array?new Uint8Array(arrayBuffer):new Uint8Array(arrayBuffer);const options={data,useSystemFonts:true,isEvalSupported:false}as Parameters<typeof pdfjs.getDocument>[0]&{isEvalSupported:boolean};const loadingTask=pdfjs.getDocument(options);let document:Awaited<typeof loadingTask.promise>|null=null;
 try{document=await loadingTask.promise;const pages:string[]=[];for(let pageNumber=1;pageNumber<=document.numPages;pageNumber++){const page=await document.getPage(pageNumber);const content=await page.getTextContent();const lines=new Map<number,string[]>();for(const item of content.items){if(!("str"in item))continue;const y=Math.round(item.transform[5]);lines.set(y,[...(lines.get(y)??[]),item.str])}pages.push([...lines.entries()].sort((a,b)=>b[0]-a[0]).map(([,parts])=>parts.join(" ").trim()).filter(Boolean).join("\n"))}return{pages,pageCount:document.numPages,workerSource:pdfjs.GlobalWorkerOptions.workerSrc}}
 finally{try{await document?.cleanup()}catch(error){console.error("[Word Efficiency PDF document cleanup failed]",error)}try{await loadingTask.destroy()}catch(error){console.error("[Word Efficiency PDF loading task cleanup failed]",error)}}
}
