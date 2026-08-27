import type { Metadata } from "next";
import Link from "next/link";
import { TypingBrandHeader } from "../../_components/typing-brand";

export const metadata: Metadata = {
  title: "Choose Stenography Language | Samradhi Classes",
  description: "Choose English or Hindi stenography practice for dictation and transcription speed.",
};

const LANGUAGES = [
  {
    language: "English",
    title: "English Stenography",
    description: "Practise published English stenography passages with dedicated speed targets.",
    action: "Choose English",
    href: "/typing/practice/english-stenography",
    tone: "from-violet-700 via-fuchsia-600 to-fuchsia-500",
    surface: "border-violet-200 bg-violet-50/60",
  },
  {
    language: "Hindi",
    title: "Hindi Stenography",
    description: "Choose your Hindi input system and practise compatible stenography tests.",
    action: "Choose Hindi",
    href: "/typing/practice/hindi-stenography",
    tone: "from-rose-700 via-pink-600 to-pink-500",
    surface: "border-rose-200 bg-rose-50/60",
  },
] as const;

export default function StenographyLanguagePage() {
  return (
    <main className="min-h-screen bg-[#f3f6fb]">
      <TypingBrandHeader />
      <section className="relative overflow-hidden bg-slate-950 text-white">
        <div className="absolute -left-24 top-0 h-72 w-72 rounded-full bg-violet-600/25 blur-3xl" />
        <div className="absolute -right-20 bottom-0 h-72 w-72 rounded-full bg-rose-500/15 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
          <Link
            href="/typing"
            aria-label="Back to Typing Hub"
            className="inline-flex min-h-12 items-center gap-3 rounded-xl border border-fuchsia-300/30 bg-white/10 px-5 py-3 text-sm font-black text-fuchsia-200 shadow-lg backdrop-blur transition hover:bg-fuchsia-300 hover:text-slate-950"
          >
            ← Back to Typing Hub
          </Link>
          <p className="mt-10 text-xs font-black uppercase tracking-[.22em] text-fuchsia-300">Stenography</p>
          <h1 className="mt-3 max-w-4xl text-4xl font-black tracking-tight sm:text-5xl">
            Choose your stenography language
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300 sm:text-lg">
            Practise shorthand dictation and transcription speed in your preferred language.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="grid items-stretch gap-6 md:grid-cols-2">
          {LANGUAGES.map((item) => (
            <article
              key={item.language}
              className={`flex min-h-[26rem] flex-col overflow-hidden rounded-3xl border shadow-sm ${item.surface}`}
            >
              <div className={`bg-gradient-to-br ${item.tone} p-7 text-white`}>
                <StenographyLanguageIcon />
              </div>
              <div className="flex flex-1 flex-col p-6 sm:p-8">
                <p className="text-xs font-black uppercase tracking-[.18em] text-slate-500">{item.language} stenography</p>
                <h2 className="mt-2 text-2xl font-black text-slate-950 sm:text-3xl">{item.title}</h2>
                <p className="mt-4 text-base leading-7 text-slate-600">{item.description}</p>
                <Link
                  href={item.href}
                  aria-label={`${item.action} stenography`}
                  className={`mt-auto flex min-h-12 items-center justify-between rounded-xl bg-gradient-to-r ${item.tone} px-5 py-3.5 font-black text-white shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl`}
                >
                  {item.action}
                  <span aria-hidden>→</span>
                </Link>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-10 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-xs font-black uppercase tracking-[.18em] text-violet-600">New</p>
          <h2 className="mt-2 text-2xl font-black text-slate-950">Court &amp; Government Stenography Exam Simulator</h2>
          <p className="mt-3 max-w-2xl leading-7 text-slate-600">Choose from court and government stenographer recruitment patterns — Supreme Court, High Courts, SSC, CBI, Parliament, and more — in English or Hindi.</p>
          <Link href="/typing/practice/stenography/exams" className="mt-5 inline-flex rounded-xl bg-violet-700 px-5 py-3 font-black text-white hover:bg-violet-800">
            Select Exam Category →
          </Link>
        </div>

        <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-xs font-black uppercase tracking-[.18em] text-violet-600">New</p>
          <h2 className="mt-2 text-2xl font-black text-slate-950">Task / Topic Wise Tests Library</h2>
          <p className="mt-3 max-w-2xl leading-7 text-slate-600">Browse stenography tests by category — Task, Basic, Paper, Court, Books, Editor, Speech, Article — in English or Hindi.</p>
          <Link href="/typing/practice/stenography/library" className="mt-5 inline-flex rounded-xl bg-violet-700 px-5 py-3 font-black text-white hover:bg-violet-800">
            Browse Task Library →
          </Link>
        </div>
      </section>
    </main>
  );
}

function StenographyLanguageIcon() {
  return (
    <span className="grid h-20 w-20 place-items-center rounded-2xl bg-white/15 shadow-inner" aria-hidden>
      <svg viewBox="0 0 64 64" className="h-11 w-11 fill-none stroke-current stroke-[3]">
        <rect x="22" y="6" width="14" height="26" rx="7" />
        <path d="M14 26a15 15 0 0 0 30 0M29 41v9M22 50h14" />
      </svg>
    </span>
  );
}
