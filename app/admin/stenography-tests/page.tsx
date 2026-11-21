import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { BackButton } from "@/app/_components/back-button";
import { STENOGRAPHY_CATEGORIES, getStenographyCategory } from "@/lib/stenography-categories";
import { ExamCategoryIcon } from "@/app/typing/exams/_components/exam-category-icon";
import { SectionTestPage } from "../tests/section-test-page";

// Admin Stenography Tests, organised by EXAM (21 Nov 2026, owner's request): the first page is a grid of exam
// cards -- like the student Exam Simulator -- with each exam's English / Hindi test counts. Opening an exam lists
// only the tests set for it, and "Create test" there starts with that exam already chosen. One test can be set
// for several exams (the "Also use this dictation for" ticks); it then counts and appears under each of them.
export default async function AdminStenographyTestsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const params = await searchParams;
  const language = params.language === "Hindi" ? "Hindi" as const : params.language === "English" ? "English" as const : null;
  const exam = params.exam ? getStenographyCategory(params.exam) : undefined;

  if (language) {
    // An exam's own tests (or, with no exam, every stenography test of this language -- the earlier full list).
    return <SectionTestPage mode="stenography" language={language} stenoExam={exam?.slug} backHref="/admin/stenography-tests" />;
  }

  // How many tests each exam has, per language (a test set for several exams counts under each).
  const supabase = await createClient();
  const { data: tests } = await supabase.from("tests").select("language,settings").eq("mode", "stenography").eq("is_live", false);
  const counts = new Map<string, { English: number; Hindi: number }>();
  let untagged = { English: 0, Hindi: 0 };
  for (const test of tests ?? []) {
    const settings = (test.settings ?? {}) as { steno_category?: string | null; steno_categories?: unknown };
    const list = Array.isArray(settings.steno_categories) ? settings.steno_categories.filter((slug): slug is string => typeof slug === "string") : [];
    const slugs = [...new Set([...(settings.steno_category ? [settings.steno_category] : []), ...list])];
    const lang = test.language === "Hindi" ? "Hindi" : "English";
    if (!slugs.length) { untagged = { ...untagged, [lang]: untagged[lang] + 1 }; continue; }
    for (const slug of slugs) { const entry = counts.get(slug) ?? { English: 0, Hindi: 0 }; entry[lang] += 1; counts.set(slug, entry); }
  }
  const total = (tests ?? []).length;

  return (
    <main className="min-h-screen bg-slate-100 p-4 sm:p-6">
      <div className="mx-auto max-w-7xl">
        <BackButton href="/admin" label="Admin dashboard" />
        <h1 className="mt-2 text-3xl font-black">Stenography Tests</h1>
        <p className="mt-1 max-w-3xl text-slate-600">Choose the exam to manage its dictation tests. A test made inside an exam starts with that exam chosen; tick <b>“Also use this dictation for”</b> to give the same dictation to other exams too — each exam then marks it by its own speed, time and full / half mistake rules.</p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {STENOGRAPHY_CATEGORIES.map((category) => {
            const count = counts.get(category.slug) ?? { English: 0, Hindi: 0 };
            return (
              <div key={category.slug} className="flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm">
                <ExamCategoryIcon category={category} />
                <span className="text-sm font-black leading-tight text-slate-800">{category.name}</span>
                <span className="text-[11px] font-bold text-slate-500">{category.dictationSpeedEnglish === category.dictationSpeedHindi ? `${category.dictationSpeedEnglish} WPM` : `${category.dictationSpeedEnglish} / ${category.dictationSpeedHindi} WPM`}{category.writingMinutesEnglish ? ` · ${category.writingMinutesEnglish}${category.writingMinutesHindi && category.writingMinutesHindi !== category.writingMinutesEnglish ? ` / ${category.writingMinutesHindi}` : ""} min` : ""} · {category.accuracy}%</span>
                <div className="mt-auto grid w-full grid-cols-2 gap-2">
                  {(["English", "Hindi"] as const).map((lang) => (
                    <Link key={lang} href={`/admin/stenography-tests?exam=${category.slug}&language=${lang}`} className={`rounded-lg border px-2 py-2 text-xs font-black transition hover:-translate-y-0.5 ${count[lang] ? "border-blue-300 bg-blue-50 text-blue-800 hover:border-blue-500" : "border-slate-200 bg-slate-50 text-slate-500 hover:border-blue-300"}`}>
                      {lang} <span className={`ml-1 rounded-full px-1.5 py-0.5 ${count[lang] ? "bg-blue-700 text-white" : "bg-slate-200 text-slate-500"}`}>{count[lang]}</span>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
          <b className="text-slate-800">All stenography tests ({total})</b> — the full list without an exam filter{untagged.English + untagged.Hindi ? `, including ${untagged.English + untagged.Hindi} not yet set for any exam` : ""}:
          <span className="ml-2 inline-flex gap-2"><Link href="/admin/stenography-tests?language=English" className="font-black text-blue-700 underline">English</Link><Link href="/admin/stenography-tests?language=Hindi" className="font-black text-blue-700 underline">Hindi</Link></span>
        </div>
      </div>
    </main>
  );
}
