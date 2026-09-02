"use client";

import { useMemo, useState } from "react";
import { convertHindiTextWithMarker, countHindiText, detectHindiTextFormat, type ConvertedHindiText, type HindiTextFormat } from "@/lib/hindi-font-converter";

const unicodeFont = 'Mangal, "Nirmala UI", "Noto Sans Devanagari", sans-serif';
const krutiFont = '"Kruti Dev 010", sans-serif';
// Kruti Dev renders noticeably smaller and tighter-kerned than Unicode
// Devanagari at the same font size -- easy to misjudge whether a
// conjunct/matra is really there at a glance (confirmed live: a real
// admin-reported "missing character" turned out to be present all along,
// just hard to see at 20px). Every Kruti Dev surface in this component
// uses a visibly larger size than its Unicode counterpart for exactly
// that reason.
const krutiTextClass = "text-[28px] leading-[1.5]";
const unicodeTextClass = "text-xl leading-9";

export function FontConverter({ initialText = "", initialSource = "unicode", expectedOutput, onUse }: { initialText?:string; initialSource?:HindiTextFormat; expectedOutput?:HindiTextFormat; onUse?:(result:ConvertedHindiText)=>void }) {
  const [source,setSource]=useState(initialSource); const [output,setOutput]=useState<HindiTextFormat>(expectedOutput??(initialSource==="unicode"?"krutidev":"unicode")); const [text,setText]=useState(initialText); const [converted,setConverted]=useState(""); const [error,setError]=useState("");
  const sourceCount=useMemo(()=>countHindiText(text),[text]); const outputCount=useMemo(()=>countHindiText(converted),[converted]);
  const convert=()=>{try{const detected=detectHindiTextFormat(text);if(detected!=="empty"&&detected!=="unknown"&&detected!==source)throw new Error(`Source text appears to be ${detected === "krutidev" ? "Kruti Dev 010" : "Unicode Hindi"}. Select the matching source format.`);setConverted(convertHindiTextWithMarker(text,source,output).text);setError("");}catch(reason){setError(reason instanceof Error?reason.message:"Conversion failed.");}};
  const swap=()=>{setSource(output);setOutput(source);setText(converted||text);setConverted("");setError("");};
  const reset=()=>{setText(initialText);setConverted("");setSource(initialSource);setOutput(expectedOutput??(initialSource==="unicode"?"krutidev":"unicode"));setError("");};
  const download=()=>{const blob=new Blob([converted],{type:"text/plain;charset=utf-8"});const url=URL.createObjectURL(blob);const anchor=document.createElement("a");anchor.href=url;anchor.download=output==="krutidev"?"krutidev-010.txt":"unicode-hindi.txt";anchor.click();URL.revokeObjectURL(url);};
  const rawIsLegacy=output==="krutidev";
  return <div className="overflow-hidden rounded-3xl border border-violet-100 bg-white shadow">
    <div className="flex flex-wrap items-center gap-3 border-b border-violet-100 bg-violet-50/60 p-4">
      <button type="button" onClick={convert} className="rounded-xl bg-violet-700 px-6 py-3 font-black text-white hover:bg-violet-800">Convert</button>
      <button type="button" onClick={swap} className="rounded-xl border border-violet-300 bg-white px-4 py-3 font-bold text-violet-800 hover:bg-violet-50">⇄ Swap direction</button>
      <button type="button" onClick={reset} className="rounded-xl bg-white px-4 py-3 font-bold text-slate-600 hover:bg-slate-100">Reset</button>
      <span role="status" className="ml-auto rounded-full border border-violet-200 bg-white px-3 py-1.5 text-xs font-black text-violet-800">{error ? "Error" : converted ? "Converted" : "Ready"}</span>
    </div>
    {error&&<p role="alert" className="border-b border-red-100 bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}
    <div className="grid xl:grid-cols-2">
      <ConverterPanel heading="Source Text" format={source} onFormat={setSource} text={text} onText={setText} counts={sourceCount} borderClass="xl:border-r xl:border-violet-100"/>
      <section>
        <div className="flex items-center justify-between gap-3 border-b border-violet-100 bg-violet-50/40 p-4"><h2 className="font-black">Converted Text</h2><select aria-label="Output format" className="input max-w-56" value={output} onChange={e=>setOutput(e.target.value as HindiTextFormat)}><option value="unicode">Unicode Hindi — Mangal</option><option value="krutidev">Kruti Dev 010</option></select></div>
        <div className="p-4">
          <div className="flex items-center justify-between gap-3"><FontBadge format={output}/><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">{outputCount.characters} characters · {outputCount.words} words</span></div>
          <label className="mt-3 block text-sm font-black text-slate-700">{rawIsLegacy?"Raw encoded text":"Unicode output"}<textarea aria-label={rawIsLegacy?"Raw encoded text":"Converted text"} readOnly value={converted} data-encoding={output} style={{fontFamily:rawIsLegacy?'ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace':unicodeFont}} className={`input mt-2 min-h-48 resize-y ${rawIsLegacy?"text-lg leading-8":unicodeTextClass}`}/></label>
          {rawIsLegacy&&<section aria-label="Rendered Kruti Dev preview" className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4"><h3 className="text-sm font-black text-amber-950">Rendered Kruti Dev preview</h3><p className={`mt-3 min-h-24 whitespace-pre-wrap text-slate-950 ${krutiTextClass}`} style={{fontFamily:krutiFont}}>{converted||"The Hindi preview will appear here."}</p><p className="mt-3 text-xs text-amber-900">Display only. Copy and Use in Test always use the raw encoded text above.</p></section>}
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" disabled={!converted} onClick={()=>navigator.clipboard.writeText(converted)} className="rounded-lg bg-slate-900 px-4 py-2 font-bold text-white disabled:opacity-40">Copy raw value</button>
            <button type="button" disabled={!converted} onClick={download} className="rounded-lg border px-4 py-2 font-bold disabled:opacity-40">Download .txt</button>
            {onUse&&<button type="button" disabled={!converted} onClick={()=>onUse({text:converted,encoding:output})} className="rounded-lg bg-green-700 px-4 py-2 font-black text-white disabled:opacity-40">Use converted text in test</button>}
          </div>
        </div>
      </section>
    </div>
  </div>;
}

function ConverterPanel({heading,format,onFormat,text,onText,counts,borderClass}:{heading:string;format:HindiTextFormat;onFormat:(value:HindiTextFormat)=>void;text:string;onText:(value:string)=>void;counts:ReturnType<typeof countHindiText>;borderClass:string}){
  const isKruti = format==="krutidev";
  return <section className={borderClass}>
    <div className="flex items-center justify-between gap-3 border-b border-violet-100 bg-violet-50/40 p-4"><h2 className="font-black">{heading}</h2><select aria-label="Source format" className="input max-w-48" value={format} onChange={e=>onFormat(e.target.value as HindiTextFormat)}><option value="unicode">Unicode Hindi</option><option value="krutidev">Kruti Dev 010</option></select></div>
    <div className="p-4">
      <div className="flex items-center justify-between gap-3"><FontBadge format={format}/><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">{counts.characters} characters · {counts.words} words</span></div>
      <textarea aria-label={heading} value={text} onChange={e=>onText(e.target.value)} style={{fontFamily:isKruti?krutiFont:unicodeFont}} className={`input mt-3 min-h-80 resize-y ${isKruti?krutiTextClass:unicodeTextClass}`}/>
      <div className="mt-4 flex gap-2"><button type="button" onClick={async()=>{const value=await navigator.clipboard.readText();onText(value)}} className="rounded-lg bg-blue-700 px-4 py-2 font-bold text-white">Paste</button><button type="button" onClick={()=>onText("")} className="rounded-lg border px-4 py-2 font-bold">Clear</button></div>
    </div>
  </section>;
}
function FontBadge({format}:{format:HindiTextFormat}){return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${format==="krutidev"?"bg-amber-100 text-amber-900":"bg-emerald-100 text-emerald-900"}`}>{format==="krutidev"?"Kruti Dev 010 · Legacy encoded text":"Unicode Hindi · Mangal display"}</span>}
