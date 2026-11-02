import type { Metadata } from "next";
import Link from "next/link";
import { BackButton } from "@/app/_components/back-button";
import { getLiveExamResults, getLiveExamsWithResults } from "@/lib/live-test-results-server";

export const metadata: Metadata = {
  title: "Live Exam Results — All Students",
  description: "Every student's result in Samradhi Classes' full-pattern live exams (RSMSSB LDC pattern), all batches together: Hindi typing, English typing, Word and Excel marks with the total.",
  alternates: { canonical: "/live-exam-results" },
};

const CROWN = ["🥇", "🥈", "🥉"];
const istDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" });
const mark = (value: number | null | undefined) => (value === null || value === undefined ? "—" : String(Number(value)));
// The batch a student sat, from its exam's name: "RSMSSB LDC Exam-1 (5 pm batch)" → "5 pm batch"; the plain name → "Main".
const batchLabel = (batch: string, test: string) => batch.trim() === test.trim() ? "Main" : batch.match(/\(([^()]*)\)\s*$/)?.[1] ?? batch;

// Every student's result of a live exam TEST, all batches together and best first, with each part's marks — linked by
// "View all results" under the home page's top rankers. Only tests whose results are open are listed (the database
// decides that and combines the batches: "Exam-1" and "Exam-1 (5 pm batch)" are one test).
export default async function LiveExamResultsPage({ searchParams }: { searchParams: Promise<{ test?: string }> }) {
  const { test } = await searchParams;
  const tests = await getLiveExamsWithResults();
  const chosen = test && tests.some((item) => item.test_title === test) ? test : tests[0]?.test_title ?? null;
  const rows = chosen ? await getLiveExamResults(chosen) : [];
  const head = rows[0];
  const batches = new Set(rows.map((row) => row.batch)).size;
  return (
    <main className="min-h-screen bg-slate-100">
      <section className="bg-gradient-to-br from-red-800 to-slate-950 px-4 py-10 text-white">
        <div className="mx-auto max-w-6xl">
          <BackButton href="/" label="Home" dark />
          <p className="mt-6 text-sm font-black uppercase tracking-[.2em] text-red-200">Live Exam</p>
          <h1 className="mt-2 text-3xl font-black sm:text-4xl">All students&apos; results</h1>
          <p className="mt-2 max-w-3xl text-red-100">Choose a test: every student who sat it, from all batches, ranked together with each part&apos;s marks.</p>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-4 py-8">
        {tests.length > 0 && (
          <nav aria-label="Choose a test" className="flex flex-wrap gap-2">
            {tests.map((item) => (
              <Link key={item.test_title} href={`/live-exam-results?test=${encodeURIComponent(item.test_title)}`} aria-current={item.test_title === chosen ? "page" : undefined}
                className={`rounded-xl border px-3 py-2 text-sm font-black ${item.test_title === chosen ? "border-red-700 bg-red-700 text-white" : "border-slate-300 bg-white text-slate-700 hover:border-red-400"}`}>
                {item.test_title} <span className={`font-bold ${item.test_title === chosen ? "text-red-100" : "text-slate-500"}`}>· {istDate(item.exam_date)}</span>
              </Link>
            ))}
          </nav>
        )}
        {head ? (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="text-xl font-black text-slate-900">{head.test_title}</h2>
                <p className="text-sm text-slate-600">{istDate(head.exam_date)} · {rows.length} students{batches > 1 ? ` · ${batches} batches together` : ""}</p>
              </div>
              <Link href="/live-exam" className="rounded-xl border-2 border-red-700 px-3 py-1.5 text-sm font-black text-red-700 hover:bg-red-50">Live exams →</Link>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[44rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-black uppercase tracking-wider text-slate-500">
                    <th className="py-2 pr-2">Rank</th>
                    <th className="py-2 pr-2">Name</th>
                    {batches > 1 && <th className="py-2 pr-2">Batch</th>}
                    {head.sections.map((section) => <th key={section.position} className="py-2 pr-2 text-right">{section.label} ({Number(section.maxMarks)})</th>)}
                    <th className="py-2 text-right">Total ({Number(head.max_total)})</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => {
                    const byPart = new Map(row.section_marks.map((item) => [item.position, item.marks]));
                    return (
                      <tr key={`${row.rank}-${row.student_name}-${index}`} className={`border-b border-slate-100 ${row.rank <= 3 ? "bg-amber-50" : ""}`}>
                        <td className="py-2.5 pr-2 font-black text-slate-700">{row.rank <= 3 ? <span aria-label={`Rank ${row.rank}`}>{CROWN[row.rank - 1]}</span> : row.rank}</td>
                        <td className="py-2.5 pr-2 font-bold text-slate-900">{row.student_name}</td>
                        {batches > 1 && <td className="py-2.5 pr-2 text-xs font-bold text-slate-500">{batchLabel(row.batch, row.test_title)}</td>}
                        {head.sections.map((section) => <td key={section.position} className="py-2.5 pr-2 text-right tabular-nums text-slate-700">{mark(byPart.get(section.position))}</td>)}
                        <td className="py-2.5 text-right font-black tabular-nums text-slate-900">{Number(row.total).toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-slate-500">“—” means that part&apos;s answer was not received.</p>
          </div>
        ) : <p className="mt-6 rounded-2xl bg-white p-7 text-slate-600 shadow">No live exam results are open yet. Please check again after the next live exam.</p>}
      </section>
    </main>
  );
}
