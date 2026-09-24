import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getStenographyCategory, defaultStenographyCategoryRules } from "@/lib/stenography-categories";
import { TypingBrandHeader } from "../../../../_components/typing-brand";
import { ExamCategoryIcon } from "../../../../exams/_components/exam-category-icon";

export async function generateMetadata({ params }: PageProps<"/typing/practice/stenography/exams/[slug]">): Promise<Metadata> {
  const category = getStenographyCategory((await params).slug);
  return { title: category ? `${category.name} | Stenography Exam Simulator | Samradhi Classes` : "Stenography Exam Simulator" };
}

// Rules + Start only. The category's tests are listed on the next page
// (./[language]) once the student picks a language, mirroring the typing
// exam simulator's category -> language -> exercises flow.
export default async function StenographyCategoryRulesPage({ params }: PageProps<"/typing/practice/stenography/exams/[slug]">) {
  const category = getStenographyCategory((await params).slug);
  if (!category) notFound();
  const englishRules = defaultStenographyCategoryRules(category, "English");
  const hindiRules = defaultStenographyCategoryRules(category, "Hindi");

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

        <div className="mt-8 grid items-stretch gap-6 md:grid-cols-2">
          <div className="flex h-full flex-col rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-xl font-black">English rules &amp; regulations</h2>
            <ul className="mt-4 flex-1 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-700">
              {englishRules.map((rule) => <li key={rule}>{rule}</li>)}
            </ul>
            <Link href={`/typing/practice/stenography/exams/${category.slug}/english`} className="mt-6 block rounded-xl bg-violet-700 px-4 py-3 text-center font-black text-white hover:bg-violet-800">
              Start in English
            </Link>
          </div>
          <div className="flex h-full flex-col rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-xl font-black">हिंदी नियम एवं शर्तें</h2>
            <ul className="mt-4 flex-1 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-700">
              {hindiRules.map((rule) => <li key={rule}>{rule}</li>)}
            </ul>
            <Link href={`/typing/practice/stenography/exams/${category.slug}/hindi`} className="mt-6 block rounded-xl bg-violet-700 px-4 py-3 text-center font-black text-white hover:bg-violet-800">
              हिंदी में शुरू करें (Start in Hindi)
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
