import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getExamCategory, defaultExamCategoryRules } from "@/lib/exam-categories";
import { getExamCategoryNavigator, type ExamCategoryNavigatorItem } from "@/lib/exam-category-navigator-server";
import { TypingBrandHeader } from "../../../_components/typing-brand";
import { BackButton } from "../../../../_components/back-button";
import { ExamCategoryIcon } from "../../_components/exam-category-icon";

// How many of this category's real (admin-published) exercises to preview
// inline, right on the rules page -- matches the Stenography Exam
// Simulator's own equivalent box (RealTestList in
// app/typing/practice/stenography/exams/[slug]/page.tsx), so a student can
// jump straight to a real exercise instead of only ever landing on the
// generic Official Pattern simulation. Kept small and linked out to the
// full, paginated Exercises catalogue (already existing at
// /typing/exams/category/[slug]/[language]) rather than listing everything
// here, since -- unlike Stenography's per-category-scoped list -- every
// exam exercise is shared onto every category's list (see
// getExamCategoryNavigator's own comment), so the true total can be large.
const REAL_TEST_PREVIEW_COUNT = 5;

export async function generateMetadata({ params }: PageProps<"/typing/exams/category/[slug]">): Promise<Metadata> {
  const category = getExamCategory((await params).slug);
  return { title: category ? `${category.name} | Exam Simulator | Samradhi Classes` : "Exam Simulator" };
}

export default async function ExamCategoryRulesPage({ params }: PageProps<"/typing/exams/category/[slug]">) {
  const category = getExamCategory((await params).slug);
  if (!category) notFound();
  const englishRules = defaultExamCategoryRules(category, "English");
  const hindiRules = defaultExamCategoryRules(category, "Hindi");
  const [englishTests, hindiTests] = await Promise.all([
    getExamCategoryNavigator({ categorySlug: category.slug, language: "English", page: undefined, sort: "oldest" }),
    getExamCategoryNavigator({ categorySlug: category.slug, language: "Hindi", page: undefined, sort: "oldest" }),
  ]);

  return (
    <main className="min-h-screen bg-slate-100">
      <TypingBrandHeader />
      <section className="mx-auto max-w-4xl px-4 py-10">
        <BackButton href="/typing/exams" label="Exam Categories" />
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
            <RealTestList categorySlug={category.slug} tests={englishTests.items} total={englishTests.total} language="English"/>
            <Link href={`/typing/exams/category/${category.slug}/english`} className="mt-6 block rounded-xl bg-blue-700 px-4 py-3 text-center font-black text-white hover:bg-blue-800">
              Start in English
            </Link>
          </div>
          <div className="flex h-full flex-col rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-xl font-black">हिंदी नियम एवं शर्तें</h2>
            <ul className="mt-4 flex-1 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-700">
              {hindiRules.map((rule) => <li key={rule}>{rule}</li>)}
            </ul>
            <RealTestList categorySlug={category.slug} tests={hindiTests.items} total={hindiTests.total} language="Hindi"/>
            <Link href={`/typing/exams/category/${category.slug}/hindi`} className="mt-6 block rounded-xl bg-blue-700 px-4 py-3 text-center font-black text-white hover:bg-blue-800">
              हिंदी में शुरू करें (Start in Hindi)
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

// Mirrors Stenography Exam Simulator's own RealTestList (app/typing/practice/
// stenography/exams/[slug]/page.tsx) -- same box styling and copy, adapted
// for exam exercises being shared across every category (see
// getExamCategoryNavigator's own comment) rather than scoped to just one:
// previews a handful, links out to the full paginated catalogue for the
// rest instead of listing everything inline.
function RealTestList({ categorySlug, tests, total, language }: { categorySlug: string; tests: ExamCategoryNavigatorItem[]; total: number; language: "English" | "Hindi" }) {
  const preview = tests.slice(0, REAL_TEST_PREVIEW_COUNT);
  return (
    <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
      <h3 className="text-sm font-black text-emerald-900">{language === "English" ? "Real tests" : "वास्तविक टेस्ट"}</h3>
      {preview.length ? (
        <ul className="mt-2 space-y-1.5">
          {preview.map((item) => (
            <li key={item.id}>
              <Link href={`/tests/${item.slug}?viewAs=${categorySlug}`} className="block rounded-lg bg-white px-3 py-2 text-sm font-bold text-emerald-900 shadow-sm hover:bg-emerald-100">
                {item.title}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs font-bold text-emerald-800">{language === "English" ? "No exercises published yet -- the Official Pattern below is always available." : "अभी कोई अभ्यास प्रकाशित नहीं है -- आधिकारिक पैटर्न नीचे हमेशा उपलब्ध है।"}</p>
      )}
      {total > preview.length && (
        <Link href={`/typing/exams/category/${categorySlug}/${language.toLowerCase()}`} className="mt-2 inline-block text-xs font-black text-emerald-800 underline">
          {language === "English" ? `See all ${total} exercises →` : `सभी ${total} अभ्यास देखें →`}
        </Link>
      )}
    </div>
  );
}
