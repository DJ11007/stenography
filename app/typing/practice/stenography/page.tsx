import type { Metadata } from "next";
import Link from "next/link";
import { TypingBrandHeader } from "../../_components/typing-brand";
import { STENOGRAPHY_TASK_CATEGORIES } from "@/lib/stenography-task-library";

export const metadata: Metadata = {
  title: "Stenography Practice | Samradhi Classes",
  description: "Independent court and government stenography exam simulations, and a full task/topic-wise test library, in English and Hindi.",
};

export default function StenographyLanguagePage() {
  return (
    <main className="min-h-screen bg-[#f3f6fb]">
      <TypingBrandHeader backHref="/typing" backLabel="Typing Hub" />
      <section className="relative overflow-hidden bg-slate-950 text-white">
        <div className="absolute -left-24 top-0 h-72 w-72 rounded-full bg-violet-600/25 blur-3xl" />
        <div className="absolute -right-20 bottom-0 h-72 w-72 rounded-full bg-rose-500/15 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
          <p className="mt-10 text-xs font-black uppercase tracking-[.22em] text-fuchsia-300">Stenography</p>
          <h1 className="mt-3 max-w-4xl text-4xl font-black tracking-tight sm:text-5xl">
            Stenography practice
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300 sm:text-lg">
            Practise shorthand dictation and transcription speed in English or Hindi — pick an exam pattern or browse the full test library below.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="grid items-stretch gap-6 md:grid-cols-2">
          <article className="flex min-h-[26rem] flex-col overflow-hidden rounded-3xl border border-amber-200 bg-amber-50/60 shadow-sm">
            <div className="bg-gradient-to-br from-amber-700 via-orange-600 to-amber-500 p-7 text-white">
              <GovernmentExamIcon />
            </div>
            <div className="flex flex-1 flex-col p-6 sm:p-8">
              <p className="text-xs font-black uppercase tracking-[.18em] text-violet-600">New</p>
              <h2 className="mt-2 text-2xl font-black text-slate-950 sm:text-3xl">Government Stenography Exam Simulator</h2>
              <p className="mt-4 text-base leading-7 text-slate-600">Choose from government stenographer recruitment patterns — Supreme Court, High Courts, SSC, CBI, Parliament, and more — in English or Hindi.</p>
              <Link
                href="/typing/practice/stenography/exams"
                aria-label="Select exam category"
                className="mt-auto flex min-h-12 items-center justify-between rounded-xl bg-gradient-to-r from-amber-700 via-orange-600 to-amber-500 px-5 py-3.5 font-black text-white shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl"
              >
                Select Exam Category
                <span aria-hidden>→</span>
              </Link>
            </div>
          </article>

          <article className="flex min-h-[26rem] flex-col overflow-hidden rounded-3xl border border-teal-200 bg-teal-50/60 shadow-sm">
            <div className="bg-gradient-to-br from-teal-700 via-emerald-600 to-teal-500 p-7 text-white">
              <div className="flex flex-wrap gap-2">
                {STENOGRAPHY_TASK_CATEGORIES.map((item) => (
                  <span key={item} className="rounded-full bg-white/15 px-3 py-1 text-xs font-black uppercase tracking-wide text-white shadow-inner backdrop-blur">{item}</span>
                ))}
              </div>
            </div>
            <div className="flex flex-1 flex-col p-6 sm:p-8">
              <p className="text-xs font-black uppercase tracking-[.18em] text-violet-600">New</p>
              <h2 className="mt-2 text-2xl font-black text-slate-950 sm:text-3xl">Task / Topic Wise Tests Library</h2>
              <p className="mt-4 text-base leading-7 text-slate-600">Browse every stenography test by category — Task, Basic, Paper, Court, Books, Editor, Speech, Article — in English or Hindi.</p>
              <Link
                href="/typing/practice/stenography/library"
                aria-label="Browse task library"
                className="mt-auto flex min-h-12 items-center justify-between rounded-xl bg-gradient-to-r from-teal-700 via-emerald-600 to-teal-500 px-5 py-3.5 font-black text-white shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl"
              >
                Browse Task Library
                <span aria-hidden>→</span>
              </Link>
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}

function GovernmentExamIcon() {
  return (
    <span className="grid h-20 w-20 place-items-center rounded-2xl bg-white/15 shadow-inner" aria-hidden>
      <svg viewBox="0 0 64 64" className="h-11 w-11 fill-none stroke-current stroke-[3]">
        <path d="M32 6 10 18h44L32 6Z" strokeLinejoin="round" />
        <path d="M14 24v22M24 24v22M40 24v22M50 24v22" strokeLinecap="round" />
        <path d="M8 52h48" strokeLinecap="round" />
      </svg>
    </span>
  );
}
