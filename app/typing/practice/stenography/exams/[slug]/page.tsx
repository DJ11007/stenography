import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getStenographyCategory, stenographyCategoryPresetId, defaultStenographyCategoryRules } from "@/lib/stenography-categories";
import { getStenographyCategoryNavigator } from "@/lib/stenography-category-navigator-server";
import { TypingBrandHeader } from "../../../../_components/typing-brand";
import { ExamCategoryIcon } from "../../../../exams/_components/exam-category-icon";
import { RealTestNavigator } from "./real-test-navigator";

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
  // The generic preset below (ENGLISH_STENO_PASSAGE/HINDI_STENO_PASSAGE) has
  // no audio -- it predates the real dictation-gate feature and is only a
  // text-passage stand-in for categories/languages nobody has recorded real
  // dictation for yet. Once a real admin-uploaded test exists, that's the
  // actual product experience (real audio dictation, not copy-typing), so
  // the main Start button should go straight there instead of silently
  // landing students on the no-audio sample.
  const englishHref = englishTests.length ? `/tests/${englishTests[0].slug}` : `/typing/exams/${englishPresetId}`;
  const hindiHref = hindiTests.length ? `/tests/${hindiTests[0].slug}` : `/typing/exams/${hindiPresetId}`;

  return (
    <main className="min-h-screen bg-slate-100">
      <TypingBrandHeader backHref="/typing/practice/stenography/exams" backLabel="Exam Categories" />
      <section className="mx-auto max-w-4xl px-4 py-10">
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
            <RealTestNavigator tests={englishTests} language="English"/>
            <Link href={englishHref} className="mt-4 block rounded-xl bg-violet-700 px-4 py-3 text-center font-black text-white hover:bg-violet-800">
              Start in English
            </Link>
          </div>
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-xl font-black">हिंदी नियम एवं शर्तें</h2>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-700">
              {hindiRules.map((rule) => <li key={rule}>{rule}</li>)}
            </ul>
            <RealTestNavigator tests={hindiTests} language="Hindi"/>
            <Link href={hindiHref} className="mt-4 block rounded-xl bg-violet-700 px-4 py-3 text-center font-black text-white hover:bg-violet-800">
              हिंदी में शुरू करें (Start in Hindi)
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
