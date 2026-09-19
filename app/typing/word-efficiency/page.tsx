import type { Metadata } from "next";
import Link from "next/link";
import { TypingBrandHeader } from "../_components/typing-brand";
import { EfficiencySubjectTabs } from "../_components/efficiency-subject-tabs";

export const metadata: Metadata = {
  title: "Choose Word Efficiency Language | Samradhi Classes",
  description: "Choose English or Hindi Word Efficiency training for document creation, formatting, editing, shortcuts, and productivity.",
};

const LANGUAGES = [
  {
    language: "English",
    title: "English Word Efficiency",
    description: "Practise formatting, editing, shortcuts and document productivity in English.",
    action: "Choose English",
    href: "/typing/word-efficiency/english",
    tone: "from-blue-800 via-blue-700 to-cyan-500",
    surface: "border-blue-200 bg-blue-50/60",
    icon: "A",
  },
  {
    language: "Hindi",
    title: "Hindi Word Efficiency",
    description: "Practise Hindi document formatting, editing and productivity with compatible Hindi fonts.",
    action: "Choose Hindi",
    href: "/typing/word-efficiency/hindi",
    tone: "from-orange-700 via-amber-600 to-yellow-400",
    surface: "border-amber-200 bg-amber-50/60",
    icon: "अ",
  },
] as const;

export default function WordEfficiencyLanguagePage(){return <main className="min-h-screen bg-[#f3f6fb]"><TypingBrandHeader backHref="/typing/practice" backLabel="Practice Categories"/><section className="relative overflow-hidden bg-slate-950 text-white"><div className="absolute -left-24 top-0 h-48 w-48 rounded-full bg-blue-600/25 blur-3xl"/><div className="absolute -right-20 bottom-0 h-48 w-48 rounded-full bg-amber-500/15 blur-3xl"/><div className="relative mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10"><div className="mt-6"><EfficiencySubjectTabs active="word"/></div><p className="mt-2 text-xs font-black uppercase tracking-[.22em] text-cyan-300">Word Efficiency</p><h1 className="mt-2 max-w-4xl text-3xl font-black tracking-tight sm:text-4xl">Choose your Word Efficiency language</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">Practise document creation, formatting, editing, keyboard shortcuts and everyday productivity skills in your preferred language.</p></div></section><section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14"><div className="grid items-stretch gap-6 md:grid-cols-2">{LANGUAGES.map((item)=><article key={item.language} className={`flex min-h-[26rem] flex-col overflow-hidden rounded-3xl border shadow-sm ${item.surface}`}><div className={`bg-gradient-to-br ${item.tone} p-7 text-white`}><DocumentLanguageIcon label={item.icon}/></div><div className="flex flex-1 flex-col p-6 sm:p-8"><p className="text-xs font-black uppercase tracking-[.18em] text-slate-500">{item.language} documents</p><h2 className="mt-2 text-2xl font-black text-slate-950 sm:text-3xl">{item.title}</h2><p className="mt-4 text-base leading-7 text-slate-600">{item.description}</p><Link href={item.href} aria-label={`${item.action} Word Efficiency`} className={`mt-auto flex min-h-12 items-center justify-between rounded-xl bg-gradient-to-r ${item.tone} px-5 py-3.5 font-black text-white shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl`}>{item.action}<span aria-hidden>→</span></Link></div></article>)}</div></section></main>}

function DocumentLanguageIcon({label}:{label:string}){return <span className="relative grid h-20 w-20 place-items-center rounded-2xl bg-white/15 shadow-inner" aria-hidden><svg viewBox="0 0 64 64" className="absolute h-14 w-14 fill-none stroke-current stroke-[3]"><path d="M14 6h25l11 11v41H14z"/><path d="M39 6v13h11M22 43h20M22 50h15"/></svg><strong className="relative -translate-y-1 text-2xl font-black">{label}</strong></span>}
