import type { Metadata } from "next";
import Link from "next/link";
import { TypingBrandHeader } from "../_components/typing-brand";
import { EfficiencySubjectTabs } from "../_components/efficiency-subject-tabs";

export const metadata: Metadata = {
  title: "Choose Excel Efficiency Language | Samradhi Classes",
  description: "Choose English or Hindi Excel Efficiency training for spreadsheet data entry, formulas, formatting, and sorting.",
};

const LANGUAGES = [
  {
    language: "English",
    title: "English Excel Efficiency",
    description: "Practise spreadsheet data entry, formulas, formatting and sorting in English.",
    action: "Choose English",
    href: "/typing/excel-efficiency/english",
    tone: "from-emerald-800 via-emerald-700 to-teal-500",
    surface: "border-emerald-200 bg-emerald-50/60",
    icon: "A",
  },
  {
    language: "Hindi",
    title: "Hindi Excel Efficiency",
    description: "Practise Hindi spreadsheet data entry, formulas and formatting with compatible Hindi fonts.",
    action: "Choose Hindi",
    href: "/typing/excel-efficiency/hindi",
    tone: "from-orange-700 via-amber-600 to-yellow-400",
    surface: "border-amber-200 bg-amber-50/60",
    icon: "अ",
  },
] as const;

export default function ExcelEfficiencyLanguagePage(){return <main className="min-h-screen bg-[#f3f6fb]"><TypingBrandHeader backHref="/typing/practice" backLabel="Practice Categories"/><section className="relative overflow-hidden bg-slate-950 text-white"><div className="absolute -left-24 top-0 h-48 w-48 rounded-full bg-emerald-600/25 blur-3xl"/><div className="absolute -right-20 bottom-0 h-48 w-48 rounded-full bg-amber-500/15 blur-3xl"/><div className="relative mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10"><div className="mt-6"><EfficiencySubjectTabs active="excel"/></div><p className="mt-2 text-xs font-black uppercase tracking-[.22em] text-emerald-300">Excel Efficiency</p><h1 className="mt-2 max-w-4xl text-3xl font-black tracking-tight sm:text-4xl">Choose your Excel Efficiency language</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">Practise spreadsheet data entry, formulas, formatting and sorting skills in your preferred language.</p></div></section><section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14"><div className="grid items-stretch gap-6 md:grid-cols-2">{LANGUAGES.map((item)=><article key={item.language} className={`flex min-h-[26rem] flex-col overflow-hidden rounded-3xl border shadow-sm ${item.surface}`}><div className={`bg-gradient-to-br ${item.tone} p-7 text-white`}><SheetLanguageIcon label={item.icon}/></div><div className="flex flex-1 flex-col p-6 sm:p-8"><p className="text-xs font-black uppercase tracking-[.18em] text-slate-500">{item.language} spreadsheets</p><h2 className="mt-2 text-2xl font-black text-slate-950 sm:text-3xl">{item.title}</h2><p className="mt-4 text-base leading-7 text-slate-600">{item.description}</p><Link href={item.href} aria-label={`${item.action} Excel Efficiency`} className={`mt-auto flex min-h-12 items-center justify-between rounded-xl bg-gradient-to-r ${item.tone} px-5 py-3.5 font-black text-white shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl`}>{item.action}<span aria-hidden>→</span></Link></div></article>)}</div></section></main>}

function SheetLanguageIcon({label}:{label:string}){return <span className="relative grid h-20 w-20 place-items-center rounded-2xl bg-white/15 shadow-inner" aria-hidden><svg viewBox="0 0 64 64" className="absolute h-14 w-14 fill-none stroke-current stroke-[3]"><rect x="8" y="10" width="48" height="44" rx="2"/><path d="M8 24h48M8 38h48M24 10v44M40 10v44"/></svg><strong className="relative -translate-y-1 text-2xl font-black">{label}</strong></span>}
