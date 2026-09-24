import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getStenographyCategory, stenographyCategoryPresetId } from "@/lib/stenography-categories";
import { getStenographyCategoryNavigator } from "@/lib/stenography-category-navigator-server";
import { normalizeExamCategoryPage, examCategoryPageBounds, sortExamCategoryNavigatorItems } from "@/lib/exam-category-navigator";
import { TypingBrandHeader } from "../../../../../_components/typing-brand";
import { ExamCategoryIcon } from "../../../../../exams/_components/exam-category-icon";
import { RealTestGrid } from "../real-test-grid";

function languageFromSegment(segment: string) {
  return segment === "hindi" ? ("Hindi" as const) : segment === "english" ? ("English" as const) : null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string; language: string }> }): Promise<Metadata> {
  const { slug, language } = await params;
  const category = getStenographyCategory(slug);
  const lang = languageFromSegment(language);
  return { title: category && lang ? `${category.name} — ${lang} Tests | Stenography Exam Simulator | Samradhi Classes` : "Stenography Exam Simulator" };
}

export default async function StenographyCategoryTestsPage({ params, searchParams }: { params: Promise<{ slug: string; language: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { slug, language: languageSegment } = await params;
  const category = getStenographyCategory(slug);
  const language = languageFromSegment(languageSegment);
  if (!category || !language) notFound();
  const query = await searchParams;
  // Oldest-first by default, matching the exam simulator's own catalogue.
  const sort = query.sort === "newest" ? "newest" : "oldest";
  // The navigator returns every matching test in publish order; numbered
  // titles (Legal-2 before Legal-10) are re-sorted across the whole set
  // before slicing into pages, so page boundaries follow the serial order.
  const all = sortExamCategoryNavigatorItems(await getStenographyCategoryNavigator(category.slug, language), sort === "oldest" ? "ascending" : "descending");
  const total = all.length;
  const { page, from, to, pages } = examCategoryPageBounds(normalizeExamCategoryPage(query.page), total);
  const tests = all.slice(from, to + 1);
  const samplePresetId = stenographyCategoryPresetId(category.slug, language);

  const basePath = `/typing/practice/stenography/exams/${category.slug}/${languageSegment}`;
  const pageHref = (targetPage: number, targetSort: "newest" | "oldest" = sort) => {
    const search = new URLSearchParams();
    if (targetSort === "newest") search.set("sort", "newest");
    if (targetPage > 1) search.set("page", String(targetPage));
    const qs = search.toString();
    return `${basePath}${qs ? `?${qs}` : ""}`;
  };
  const pageWindow = (() => {
    const span = 2, start = Math.max(1, page - span), end = Math.min(pages, page + span);
    const numbers: number[] = [];
    for (let n = start; n <= end; n++) numbers.push(n);
    return numbers;
  })();

  return (
    <main className="min-h-screen bg-slate-100">
      <TypingBrandHeader backHref={`/typing/practice/stenography/exams/${category.slug}`} backLabel={category.name} />
      <section className="mx-auto max-w-5xl px-4 py-10">
        <div className="mt-6 flex items-center gap-4">
          <ExamCategoryIcon category={category} size={72} />
          <div>
            <h1 className="text-3xl font-black">{category.name} — {language} Tests</h1>
            <p className="mt-1 text-slate-600">{category.fullName}</p>
          </div>
        </div>

        <div className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
          {total > 0 && (
            <div className="flex justify-end">
              <div className="flex overflow-hidden rounded-full border border-slate-300 bg-white text-sm font-bold" role="group" aria-label="Sort tests">
                <Link href={pageHref(1, "newest")} aria-pressed={sort === "newest"} className={`px-4 py-1.5 ${sort === "newest" ? "bg-violet-700 text-white" : "text-slate-600"}`}>Newest</Link>
                <Link href={pageHref(1, "oldest")} aria-pressed={sort === "oldest"} className={`px-4 py-1.5 ${sort === "oldest" ? "bg-violet-700 text-white" : "text-slate-600"}`}>Oldest</Link>
              </div>
            </div>
          )}
          <RealTestGrid tests={tests} language={language} total={total} startNumber={from + 1} />

          {pages > 1 && <nav aria-label="Test pages" className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <Link href={pageHref(Math.max(1, page - 1))} aria-disabled={page === 1} className={`rounded-lg border px-3 py-1.5 text-sm font-bold ${page === 1 ? "pointer-events-none border-slate-100 text-slate-300" : "border-slate-300 text-slate-700"}`}>‹ Prev</Link>
            {pageWindow[0] > 1 && <><Link href={pageHref(1)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-bold text-slate-700">1</Link>{pageWindow[0] > 2 && <span className="px-1 text-slate-400">…</span>}</>}
            {pageWindow.map((n) => <Link key={n} href={pageHref(n)} aria-current={n === page ? "page" : undefined} className={`rounded-lg border px-3 py-1.5 text-sm font-bold ${n === page ? "border-violet-700 bg-violet-700 text-white" : "border-slate-300 text-slate-700"}`}>{n}</Link>)}
            {pageWindow[pageWindow.length - 1] < pages && <>{pageWindow[pageWindow.length - 1] < pages - 1 && <span className="px-1 text-slate-400">…</span>}<Link href={pageHref(pages)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-bold text-slate-700">{pages}</Link></>}
            <Link href={pageHref(Math.min(pages, page + 1))} aria-disabled={page === pages} className={`rounded-lg border px-3 py-1.5 text-sm font-bold ${page === pages ? "pointer-events-none border-slate-100 text-slate-300" : "border-slate-300 text-slate-700"}`}>Next ›</Link>
          </nav>}

          {/* The generic sample has no audio -- it is only a text-passage
              stand-in, so it stays a secondary option under the real tests. */}
          <Link href={`/typing/exams/${samplePresetId}`} className="mt-4 block rounded-xl border border-violet-300 px-4 py-3 text-center text-sm font-black text-violet-800 hover:bg-violet-50">
            {language === "English" ? "Try the generic sample (no dictation audio)" : "सामान्य नमूना आज़माएँ (श्रुतलेख ऑडियो के बिना)"}
          </Link>
        </div>
      </section>
    </main>
  );
}
