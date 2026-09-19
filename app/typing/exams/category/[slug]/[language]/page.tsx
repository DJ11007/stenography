import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getExamCategory, examCategoryPresetId } from "@/lib/exam-categories";
import { getExamCategoryNavigator } from "@/lib/exam-category-navigator-server";
import { TypingBrandHeader } from "../../../../_components/typing-brand";
import { ExamCategoryIcon } from "../../../_components/exam-category-icon";

function languageFromSegment(segment: string) {
  return segment === "hindi" ? ("Hindi" as const) : segment === "english" ? ("English" as const) : null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string; language: string }> }): Promise<Metadata> {
  const { slug, language } = await params;
  const category = getExamCategory(slug);
  const lang = languageFromSegment(language);
  return { title: category && lang ? `${category.name} — ${lang} Exercises | Exam Simulator | Samradhi Classes` : "Exam Simulator" };
}

export default async function ExamCategoryExercisesPage({ params, searchParams }: { params: Promise<{ slug: string; language: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { slug, language: languageSegment } = await params;
  const category = getExamCategory(slug);
  const language = languageFromSegment(languageSegment);
  if (!category || !language) notFound();
  const query = await searchParams;
  // Oldest-first by default, matching every other typing section's test
  // catalogue -- exercises run in the order they were actually published.
  const sort = query.sort === "newest" ? "newest" : "oldest";
  const { items, page, pages, total } = await getExamCategoryNavigator({ categorySlug: slug, language, page: query.page, sort });

  const officialPresetId = examCategoryPresetId(slug, language);
  const pageHref = (targetPage: number, targetSort: "newest" | "oldest" = sort) => {
    const params = new URLSearchParams();
    if (targetSort === "newest") params.set("sort", "newest");
    if (targetPage > 1) params.set("page", String(targetPage));
    const search = params.toString();
    return `/typing/exams/category/${slug}/${languageSegment}${search ? `?${search}` : ""}`;
  };
  const pageWindow = (() => {
    const span = 2, start = Math.max(1, page - span), end = Math.min(pages, page + span);
    const numbers: number[] = [];
    for (let n = start; n <= end; n++) numbers.push(n);
    return numbers;
  })();

  return (
    <main className="min-h-screen bg-slate-100">
      <TypingBrandHeader backHref={`/typing/exams/category/${slug}`} backLabel={category.name} />
      <section className="mx-auto max-w-5xl px-4 py-10">
        <div className="mt-6 flex items-center gap-4">
          <ExamCategoryIcon category={category} size={72} />
          <div>
            <h1 className="text-3xl font-black">{category.name} — {language} Exercises</h1>
            <p className="mt-1 text-slate-600">{category.fullName}</p>
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-blue-200 bg-blue-50 p-5">
          <p className="text-sm font-black text-blue-900">Official Pattern</p>
          <p className="mt-1 text-sm text-blue-800">A synthetic practice passage built to this category&apos;s own target: {language === "English" ? category.speedEnglish : category.speedHindi} WPM, {category.durationMinutes} minutes, {category.accuracy}% accuracy, backspace {category.backspaceMode === "disabled" ? "not allowed" : category.backspaceMode === "word" ? "current word only" : "full"}. Always available, not one of the exercises below.</p>
          <Link href={`/typing/exams/${officialPresetId}`} className="mt-4 inline-block rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-black text-white hover:bg-blue-800">Start Official Pattern</Link>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-black">Exercises {total > 0 && <span className="font-normal text-slate-500">({total})</span>}</h2>
          <div className="flex overflow-hidden rounded-full border border-slate-300 bg-white text-sm font-bold" role="group" aria-label="Sort exercises">
            <Link href={pageHref(1, "newest")} aria-pressed={sort === "newest"} className={`px-4 py-1.5 ${sort === "newest" ? "bg-blue-700 text-white" : "text-slate-600"}`}>Newest</Link>
            <Link href={pageHref(1, "oldest")} aria-pressed={sort === "oldest"} className={`px-4 py-1.5 ${sort === "oldest" ? "bg-blue-700 text-white" : "text-slate-600"}`}>Oldest</Link>
          </div>
        </div>

        {items.length === 0
          ? <p className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">No additional exercises have been published yet for {category.name} in {language}. Practice with the Official Pattern above, or check back soon.</p>
          : <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {items.map((item, index) => (
                // Every category's list now includes every exam exercise
                // (see getExamCategoryNavigator), whichever category it was
                // native-uploaded under -- viewAs always names the page
                // you're actually browsing, telling managedVersionToPreset()
                // to render/score it with THIS category's own rules. When
                // an item's native category already matches (its own home
                // page), this resolves to the exact same rules either way.
                <Link key={item.id} href={`/tests/${item.slug}?viewAs=${slug}`} className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-700 text-sm font-black text-white">{(page - 1) * 50 + index + 1}</span>
                  <span className="min-w-0 truncate font-black text-slate-800">{item.title}</span>
                </Link>
              ))}
            </div>}

        {pages > 1 && <nav aria-label="Exercise pages" className="mt-8 flex flex-wrap items-center justify-center gap-2">
          <Link href={pageHref(Math.max(1, page - 1))} aria-disabled={page === 1} className={`rounded-lg border px-3 py-1.5 text-sm font-bold ${page === 1 ? "pointer-events-none border-slate-100 text-slate-300" : "border-slate-300 text-slate-700"}`}>‹ Prev</Link>
          {pageWindow[0] > 1 && <><Link href={pageHref(1)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-bold text-slate-700">1</Link>{pageWindow[0] > 2 && <span className="px-1 text-slate-400">…</span>}</>}
          {pageWindow.map((n) => <Link key={n} href={pageHref(n)} aria-current={n === page ? "page" : undefined} className={`rounded-lg border px-3 py-1.5 text-sm font-bold ${n === page ? "border-blue-700 bg-blue-700 text-white" : "border-slate-300 text-slate-700"}`}>{n}</Link>)}
          {pageWindow[pageWindow.length - 1] < pages && <>{pageWindow[pageWindow.length - 1] < pages - 1 && <span className="px-1 text-slate-400">…</span>}<Link href={pageHref(pages)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-bold text-slate-700">{pages}</Link></>}
          <Link href={pageHref(Math.min(pages, page + 1))} aria-disabled={page === pages} className={`rounded-lg border px-3 py-1.5 text-sm font-bold ${page === pages ? "pointer-events-none border-slate-100 text-slate-300" : "border-slate-300 text-slate-700"}`}>Next ›</Link>
        </nav>}
      </section>
    </main>
  );
}
