import type { Metadata } from "next";
import Link from "next/link";
import { STENOGRAPHY_CATEGORIES } from "@/lib/stenography-categories";
import { TypingBrandHeader } from "../../../_components/typing-brand";
import { ExamCategoryIcon } from "../../../exams/_components/exam-category-icon";

export const metadata: Metadata = { title: "Stenography Exam Simulators | Samradhi Classes", description: "Independent court and government stenographer exam-pattern simulations, in English and Hindi." };

export default function StenographyExamCataloguePage() {
  return (
    <main className="min-h-screen bg-slate-100">
      <TypingBrandHeader backHref="/typing/practice/stenography" backLabel="Stenography" />
      <section className="mx-auto max-w-7xl px-4 py-10">
        <h1 className="mt-5 text-4xl font-black">Stenography Exam Simulators</h1>
        <p className="mt-2 text-slate-600">Independent practice simulations built for court and government stenographer recruitment patterns, in English and Hindi. Not affiliated with any examination authority.</p>

        <h2 className="mt-10 text-2xl font-black">Select Exam Category</h2>
        <p className="mt-1 text-sm text-slate-500">{STENOGRAPHY_CATEGORIES.length} categories &middot; English &amp; Hindi</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {STENOGRAPHY_CATEGORIES.map((category) => (
            <Link key={category.slug} href={`/typing/practice/stenography/exams/${category.slug}`} className="group flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm transition hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-md">
              <ExamCategoryIcon category={category} />
              <span className="text-sm font-bold leading-tight text-slate-800 group-hover:text-violet-700">{category.name}</span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-500">EN / HI</span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
