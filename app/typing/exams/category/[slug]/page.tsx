import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getExamCategory, defaultExamCategoryRules } from "@/lib/exam-categories";
import { TypingBrandHeader } from "../../../_components/typing-brand";
import { ExamCategoryIcon } from "../../_components/exam-category-icon";

export async function generateMetadata({ params }: PageProps<"/typing/exams/category/[slug]">): Promise<Metadata> {
  const category = getExamCategory((await params).slug);
  return { title: category ? `${category.name} | Exam Simulator | Samradhi Classes` : "Exam Simulator" };
}

export default async function ExamCategoryRulesPage({ params }: PageProps<"/typing/exams/category/[slug]">) {
  const category = getExamCategory((await params).slug);
  if (!category) notFound();
  const englishRules = defaultExamCategoryRules(category, "English");
  const hindiRules = defaultExamCategoryRules(category, "Hindi");

  return (
    <main className="min-h-screen bg-slate-100">
      <TypingBrandHeader backHref="/typing/exams" backLabel="Exam Categories" />
      <section className="mx-auto max-w-4xl px-4 py-10">
        <div className="mt-6 flex items-center gap-4">
          <ExamCategoryIcon category={category} size={96} />
          <div>
            <h1 className="text-3xl font-black">{category.name}</h1>
            <p className="mt-1 text-slate-600">{category.fullName}</p>
          </div>
        </div>

        {/* Per-category sourced/estimated framing already lives inside
            defaultExamCategoryRules() itself (its second and third bullets),
            so this box only needs to add emphasis, not duplicate it -- and
            it must reflect this specific category's real research state,
            not a blanket "nothing is finalized yet" claim that would be
            false for every category with patternSourced: true. */}
        <div className={`mt-8 rounded-2xl border p-5 text-sm ${category.patternSourced ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
          {category.patternSourced
            ? <>The rules below (marking scheme, backspace policy, and screen behaviour) are researched from {category.name}&apos;s published exam-pattern guidance. Government exam patterns can change between recruitment cycles — always cross-check against the current official notification before your real exam.</>
            : <>No confirmed official notification was found for {category.name}&apos;s exact typing-test pattern. The rules below are a reasoned baseline from the closest comparable exam family, not a verified official pattern — please tell us the real pattern if you have the official notification, and we will update it.</>}
        </div>

        {/* flex+h-full+flex-1: English and Hindi translations are never the
            same length, so one card's rule list is reliably taller than the
            other's -- without this, the two "Start" buttons would land at
            different heights instead of lining up along the bottom edge.
            The rule list (not the button's own margin) grows to fill the
            leftover space, so the mt-6 gap above each button stays the same
            fixed size on both cards regardless of which one is shorter. */}
        <div className="mt-8 grid items-stretch gap-6 md:grid-cols-2">
          <div className="flex h-full flex-col rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-xl font-black">English rules &amp; regulations</h2>
            <ul className="mt-4 flex-1 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-700">
              {englishRules.map((rule) => <li key={rule}>{rule}</li>)}
            </ul>
            <Link href={`/typing/exams/category/${category.slug}/english`} className="mt-6 block rounded-xl bg-blue-700 px-4 py-3 text-center font-black text-white hover:bg-blue-800">
              Start in English
            </Link>
          </div>
          <div className="flex h-full flex-col rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-xl font-black">हिंदी नियम एवं शर्तें</h2>
            <ul className="mt-4 flex-1 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-700">
              {hindiRules.map((rule) => <li key={rule}>{rule}</li>)}
            </ul>
            <Link href={`/typing/exams/category/${category.slug}/hindi`} className="mt-6 block rounded-xl bg-blue-700 px-4 py-3 text-center font-black text-white hover:bg-blue-800">
              हिंदी में शुरू करें (Start in Hindi)
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
