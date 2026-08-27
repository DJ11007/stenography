import type { Metadata } from "next";
import Link from "next/link";
import { EXAM_CATEGORIES } from "@/lib/exam-categories";
import { TypingBrandHeader } from "../_components/typing-brand";
import { BackButton } from "../../_components/back-button";
import { ExamCategoryIcon } from "./_components/exam-category-icon";

export const metadata:Metadata={title:"Exam Simulators | Samradhi Classes",description:"Independent exam-pattern typing simulations with transparent configuration and no examination-authority affiliation claim."};

export default function ExamCataloguePage() {
  return <main className="min-h-screen bg-slate-100"><TypingBrandHeader/><section className="mx-auto max-w-7xl px-4 py-10">
    <BackButton href="/typing" label="Typing Hub"/>
    <h1 className="mt-5 text-4xl font-black">Exam Simulators</h1>
    <p className="mt-2 text-slate-600">Independent practice simulations built for government and institutional recruitment exam patterns, in English and Hindi. Not affiliated with any examination authority.</p>

    <h2 className="mt-10 text-2xl font-black">Select Exam Category</h2>
    <p className="mt-1 text-sm text-slate-500">{EXAM_CATEGORIES.length} categories &middot; English &amp; Hindi</p>
    <div className="mt-5 grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {EXAM_CATEGORIES.map((category) => (
        <Link key={category.slug} href={`/typing/exams/category/${category.slug}`} className="group flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md">
          <ExamCategoryIcon category={category} />
          <span className="text-sm font-bold leading-tight text-slate-800 group-hover:text-blue-700">{category.name}</span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-500">EN / HI</span>
        </Link>
      ))}
      <Link href="/typing/practice" className="group flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-600 text-sm font-black text-white" aria-hidden="true">A—Z</span>
        <span className="text-sm font-bold leading-tight text-slate-800 group-hover:text-blue-700">A to Z Exams</span>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-500">Custom practice</span>
      </Link>
      <Link href="/typing/learn" className="group flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-700 text-sm font-black text-white" aria-hidden="true">⌨</span>
        <span className="text-sm font-bold leading-tight text-slate-800 group-hover:text-blue-700">Keyboard Practice</span>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-500">Lessons</span>
      </Link>
    </div>
  </section></main>;
}
