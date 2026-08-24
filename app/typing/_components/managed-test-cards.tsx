import Link from "next/link";
import type { ManagedCatalogueTest } from "@/lib/managed-test-catalogue-server";

export function ManagedTestCards({ tests, empty = false }: { tests: ManagedCatalogueTest[]; empty?: boolean }) {
  if (!tests.length) return empty ? <p className="rounded-2xl bg-white p-7 text-slate-600 shadow">No managed tests are published in this section yet.</p> : null;
  return <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{tests.map((test)=><article key={test.id} className="rounded-2xl border border-blue-100 bg-white p-6 shadow-sm"><span className="text-xs font-black uppercase tracking-wider text-blue-700">{test.language} · {test.mode === "stenography" ? "Stenography" : "Typing"}</span><h2 className="mt-2 text-xl font-black">{test.title}</h2><p className="mt-2 min-h-10 text-sm text-slate-600">{test.description || "Samradhi Classes managed test."}</p><dl className="mt-4 grid grid-cols-3 gap-2 text-center"><Metric label="Duration" value={`${Math.round(test.duration_seconds/60)}m`}/><Metric label="WPM target" value={String(test.required_wpm)}/><Metric label="Accuracy" value={`${test.required_accuracy}%`}/></dl><p className="mt-3 text-xs font-bold text-slate-500">Input system: {test.input_system_id}</p><Link href={`/tests/${test.slug}`} className="mt-5 block rounded-xl bg-blue-700 px-4 py-3 text-center font-black text-white">Start Test</Link></article>)}</div>;
}

function Metric({label,value}:{label:string;value:string}) { return <div className="rounded-xl bg-slate-50 p-2"><dt className="text-[10px] font-bold uppercase text-slate-400">{label}</dt><dd className="mt-1 text-sm font-black">{value}</dd></div>; }
