import Link from "next/link";

export function EfficiencySubjectTabs({ active, language }: { active: "word" | "excel"; language?: "english" | "hindi" }) {
  const suffix = language ? `/${language}` : "";
  return (
    <div role="tablist" aria-label="Efficiency subject" className="mb-6 inline-flex gap-1 rounded-xl bg-slate-200 p-1">
      <Link href={`/typing/word-efficiency${suffix}`} role="tab" aria-selected={active === "word"} className={`rounded-lg px-5 py-2.5 text-sm font-black transition ${active === "word" ? "bg-white text-blue-800 shadow" : "text-slate-600 hover:text-slate-900"}`}>Word Efficiency</Link>
      <Link href={`/typing/excel-efficiency${suffix}`} role="tab" aria-selected={active === "excel"} className={`rounded-lg px-5 py-2.5 text-sm font-black transition ${active === "excel" ? "bg-white text-emerald-800 shadow" : "text-slate-600 hover:text-slate-900"}`}>Excel Efficiency</Link>
    </div>
  );
}
