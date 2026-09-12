import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getStenographyCategory, stenographyCategoryPresetId, defaultStenographyCategoryRules } from "@/lib/stenography-categories";
import { getStenographyCategoryNavigator, type StenographyCategoryNavigatorItem } from "@/lib/stenography-category-navigator-server";
import { TypingBrandHeader } from "../../../../_components/typing-brand";
import { BackButton } from "../../../../../_components/back-button";
import { ExamCategoryIcon } from "../../../../exams/_components/exam-category-icon";

export async function generateMetadata({ params }: PageProps<"/typing/practice/stenography/exams/[slug]">): Promise<Metadata> {
  const category = getStenographyCategory((await params).slug);
  return { title: category ? `${category.name} | Stenography Exam Simulator | Samradhi Classes` : "Stenography Exam Simulator" };
}

export default async function StenographyCategoryRulesPage({ params }: PageProps<"/typing/practice/stenography/exams/[slug]">) {
  const category = getStenographyCategory((await params).slug);
  if (!category) notFound();
  const englishPresetId = stenographyCategoryPresetId(category.slug, "English");
  const hindiPresetId = stenographyCategoryPresetId(category.slug, "Hindi");
  const englishRules = defaultStenographyCategoryRules(category, "English");
  const hindiRules = defaultStenographyCategoryRules(category, "Hindi");
  const [englishTests, hindiTests] = await Promise.all([
    getStenographyCategoryNavigator(category.slug, "English"),
    getStenographyCategoryNavigator(category.slug, "Hindi"),
  ]);

  return (
    <main className="min-h-screen bg-slate-100">
      <TypingBrandHeader />
      <section className="mx-auto max-w-4xl px-4 py-10">
        <BackButton href="/typing/practice/stenography/exams" label="Exam Categories" />
        <div className="mt-6 flex items-center gap-4">
          <ExamCategoryIcon category={category} size={96} />
          <div>
            <h1 className="text-3xl font-black">{category.name}</h1>
            <p className="mt-1 text-slate-600">{category.fullName}</p>
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          Terms &amp; conditions and exact exam rules for this category have not been finalized yet. The rules below are
          generic placeholders and will be replaced once the administrator configures the official pattern for{" "}
          {category.name}.
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-xl font-black">English rules &amp; regulations</h2>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-700">
              {englishRules.map((rule) => <li key={rule}>{rule}</li>)}
            </ul>
            <RealTestList tests={englishTests} language="English"/>
            <Link href={`/typing/exams/${englishPresetId}`} className="mt-4 block rounded-xl bg-violet-700 px-4 py-3 text-center font-black text-white hover:bg-violet-800">
              Start in English
            </Link>
          </div>
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-xl font-black">हिंदी नियम एवं शर्तें</h2>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-700">
              {hindiRules.map((rule) => <li key={rule}>{rule}</li>)}
            </ul>
            <RealTestList tests={hindiTests} language="Hindi"/>
            <Link href={`/typing/exams/${hindiPresetId}`} className="mt-4 block rounded-xl bg-violet-700 px-4 py-3 text-center font-black text-white hover:bg-violet-800">
              हिंदी में शुरू करें (Start in Hindi)
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

// Court/legal categories share admin-uploaded tests amongst themselves (see
// getStenographyCategoryNavigator), so this can legitimately list a test
// created under a *different* court category -- students preparing for one
// court's exam benefit from real court-matter dictation regardless of
// exactly which court it was originally uploaded for.
function RealTestList({ tests, language }: { tests: StenographyCategoryNavigatorItem[]; language: "English" | "Hindi" }) {
  return (
    <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
      <h3 className="text-sm font-black text-emerald-900">{language === "English" ? "Real tests (with dictation audio, where attached)" : "वास्तविक टेस्ट (जहाँ उपलब्ध हो, श्रुतलेख ऑडियो सहित)"}</h3>
      {tests.length ? (
        <ul className="mt-2 space-y-1.5">
          {tests.map((test) => (
            <li key={test.id}>
              <Link href={`/tests/${test.slug}`} className="block rounded-lg bg-white px-3 py-2 text-sm font-bold text-emerald-900 shadow-sm hover:bg-emerald-100">
                {test.title}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs font-bold text-emerald-800">{language === "English" ? "No real test published for this category yet -- the generic sample below is all that's available for now." : "इस श्रेणी के लिए अभी कोई वास्तविक टेस्ट प्रकाशित नहीं है -- फिलहाल केवल नीचे दिया गया सामान्य नमूना ही उपलब्ध है।"}</p>
      )}
    </div>
  );
}
