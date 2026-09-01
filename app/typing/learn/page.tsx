import Link from "next/link";
import { TypingBrandHeader } from "../_components/typing-brand";
import { BackButton } from "../../_components/back-button";

type Choice = { label: string; detail: string; href: string; icon: string; accent: string };
const english: Choice[] = [
  { label: "Learn Typing", detail: "Build accuracy from the basics", href: "/typing/learn/english", icon: "AB", accent: "from-blue-600 to-cyan-500" },
  { label: "Take Tests", detail: "Measure speed and precision", href: "/typing/practice", icon: "✓", accent: "from-indigo-600 to-violet-500" },
  { label: "Number Typing", detail: "Master the complete number row", href: "/typing/learn/english", icon: "12", accent: "from-cyan-600 to-teal-500" },
];
const kruti: Choice[] = [
  { label: "Learn Typing", detail: "Guided Kruti Dev lessons", href: "/typing/learn/hindi", icon: "अ", accent: "from-orange-500 to-amber-400" },
  { label: "Take Tests", detail: "Kruti Dev speed practice", href: "/typing/practice", icon: "क", accent: "from-rose-500 to-orange-400" },
];
const unicode: Choice[] = [
  { label: "Remington GAIL", detail: "Learn and practise the GAIL layout", href: "/typing/learn/hindi", icon: "ग", accent: "from-emerald-600 to-teal-400" },
  { label: "InScript", detail: "Official Unicode keyboard layout", href: "/typing/learn/hindi", icon: "इ", accent: "from-violet-600 to-fuchsia-500" },
  { label: "Remington CBI", detail: "CBI-oriented Remington practice", href: "/typing/learn/hindi", icon: "र", accent: "from-pink-600 to-rose-500" },
];

export default function LearnTypingPage() {
  return <main className="min-h-screen bg-[#f4f7fb]"><TypingBrandHeader/><section className="relative overflow-hidden bg-slate-950 text-white"><div className="absolute -left-20 top-10 h-64 w-64 rounded-full bg-blue-600/25 blur-3xl"/><div className="absolute -right-20 bottom-0 h-72 w-72 rounded-full bg-cyan-500/20 blur-3xl"/><div className="relative mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16"><BackButton href="/typing" label="Typing Hub" dark/><span className="mt-6 inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-cyan-200">Samradhi Learning Studio</span><div className="mt-5 grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end"><div><h1 className="max-w-3xl text-4xl font-black tracking-tight sm:text-5xl">Choose your typing journey.</h1><p className="mt-4 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">Structured English and Hindi learning paths designed for accuracy, confidence, and competitive-exam speed.</p></div><div className="flex gap-3 text-center"><HeroMetric value="3" label="Languages & formats"/><HeroMetric value="∞" label="Admin lessons"/></div></div></div></section><section className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 sm:py-10"><PathSection eyebrow="English skills" title="English Typing" description="Start with letters, improve through guided practice, then master numbers." tone="blue" choices={english}/><div className="grid gap-6 xl:grid-cols-2"><PathSection eyebrow="Legacy Hindi" title="Kruti Dev & DevLys" description="Build confidence with popular legacy Hindi typing systems." tone="orange" choices={kruti}/><PathSection eyebrow="Unicode Hindi" title="Mangal Unicode" description="Choose the keyboard layout required for your target examination." tone="emerald" choices={unicode}/></div></section></main>;
}

function HeroMetric({ value, label }: { value: string; label: string }) { return <div className="min-w-28 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur"><strong className="block text-2xl font-black text-cyan-300">{value}</strong><span className="text-[11px] font-bold text-slate-300">{label}</span></div>; }

function PathSection({ eyebrow, title, description, tone, choices }: { eyebrow: string; title: string; description: string; tone: "blue" | "orange" | "emerald"; choices: Choice[] }) {
  const tones = { blue: "from-blue-50 to-cyan-50 border-blue-100 text-blue-700", orange: "from-orange-50 to-amber-50 border-orange-100 text-orange-700", emerald: "from-emerald-50 to-teal-50 border-emerald-100 text-emerald-700" };
  return <section className={`rounded-[2rem] border bg-gradient-to-br p-5 shadow-sm sm:p-7 ${tones[tone]}`}><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[11px] font-black uppercase tracking-[0.2em] opacity-80">{eyebrow}</p><h2 className="mt-1 text-2xl font-black text-slate-950">{title}</h2><p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">{description}</p></div><span className="w-fit rounded-full bg-white/80 px-3 py-1 text-xs font-black shadow-sm">{choices.length} paths</span></div><div className={`mt-6 grid gap-3 ${choices.length === 3 ? "md:grid-cols-3" : "sm:grid-cols-2"}`}>{choices.map((choice) => <ChoiceCard key={choice.label} choice={choice}/>)}</div></section>;
}

function ChoiceCard({ choice }: { choice: Choice }) {
  return <Link href={choice.href} className="group relative overflow-hidden rounded-2xl border border-white/80 bg-white p-4 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-blue-600"><div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${choice.accent}`}/><div className="flex items-center gap-4"><span aria-hidden="true" className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-xl font-black text-white shadow-lg ${choice.accent}`}>{choice.icon}</span><span className="min-w-0"><strong className="block text-base font-black text-slate-950 group-hover:text-blue-700">{choice.label}</strong><span className="mt-1 block text-xs leading-5 text-slate-500">{choice.detail}</span></span><span aria-hidden="true" className="ml-auto text-xl font-black text-slate-300 transition group-hover:translate-x-1 group-hover:text-blue-600">→</span></div></Link>;
}
