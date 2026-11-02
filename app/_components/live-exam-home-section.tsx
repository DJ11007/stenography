import Link from "next/link";
import { liveExamRunningNow } from "@/lib/live-exam";
import type { LiveExamTopRanker, UpcomingLiveExam } from "@/lib/live-test-results-server";

const CROWN = ["🥇", "🥈", "🥉"];
// The same gold / silver / bronze rows as the typing Top Rankers (live-test-top-rankers.tsx).
const TONE = ["from-amber-400 to-yellow-500 text-amber-950", "from-slate-300 to-slate-400 text-slate-900", "from-orange-400 to-amber-600 text-orange-950"];

const istDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" });
const istTime = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit" });

// The home page's Live Exam section: the upcoming and running full-pattern live exams with a Join button, and the
// latest live exam's top rankers (only once its results are open). Nothing shows when there is neither.
export function LiveExamHomeSection({ upcoming, rankers }: { upcoming: UpcomingLiveExam[]; rankers: LiveExamTopRanker[] }) {
  if (!upcoming.length && !rankers.length) return null;
  const exam = rankers[0];
  return (
    <section aria-labelledby="live-exam-heading" className="border-b border-red-100 bg-gradient-to-b from-red-50 to-white px-4 py-12">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-red-700">Live Exam</p>
            <h2 id="live-exam-heading" className="mt-1 text-2xl font-black text-slate-900 sm:text-3xl">Full-pattern live exams, like the real exam</h2>
            <p className="mt-1 text-sm text-slate-600">Hindi typing, English typing, Word and Excel in one timed exam with breaks — the RSMSSB LDC pattern.</p>
          </div>
          <Link href="/live-exam" className="rounded-xl border-2 border-red-700 px-4 py-2 text-sm font-black text-red-700 hover:bg-red-50">All live exams →</Link>
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">Upcoming live exams</h3>
            {upcoming.length ? (
              <ul className="mt-3 space-y-3">
                {upcoming.map((item) => {
                  const live = liveExamRunningNow(item.starts_at, item.ends_at);
                  return (
                    <li key={item.id} className={`flex flex-wrap items-center gap-3 rounded-xl border p-3.5 ${live ? "border-red-300 bg-red-50" : "border-slate-200 bg-slate-50"}`}>
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-2 font-black text-slate-900">
                          {live && <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-white"><span aria-hidden className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />Live now</span>}
                          <span className="min-w-0 break-words">{item.title}</span>
                        </p>
                        <p className="mt-0.5 text-sm text-slate-600">{istDate(item.starts_at)} · {istTime(item.starts_at)} – {istTime(item.ends_at)}</p>
                        <p className="mt-0.5 truncate text-xs text-slate-500" title={item.part_names}>{item.part_names}</p>
                      </div>
                      <Link href={`/live-exam/${item.id}`} className={`shrink-0 rounded-xl px-4 py-2 text-sm font-black text-white ${live ? "bg-red-700 hover:bg-red-800" : "bg-[#0b2e59] hover:bg-[#123d73]"}`}>{live ? "Join now" : "Open"}</Link>
                    </li>
                  );
                })}
              </ul>
            ) : <p className="mt-3 text-sm text-slate-500">No live exam is scheduled right now. Check back soon.</p>}
          </div>
          <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">Top rankers — latest live exam</h3>
            {exam ? (
              <>
                <p className="mt-1 text-sm font-bold text-slate-700">{exam.exam_title} · {istDate(exam.exam_date)}</p>
                <div className="mt-3 space-y-2">
                  {rankers.map((ranker, index) => (
                    <div key={`${ranker.rank}-${ranker.student_name}-${index}`} className={`flex items-center justify-between gap-2 rounded-xl px-3.5 py-2.5 text-sm ${ranker.rank <= 3 ? `bg-gradient-to-r ${TONE[ranker.rank - 1]}` : "bg-slate-50 text-slate-700"}`}>
                      <span className="flex min-w-0 flex-1 items-center gap-2 font-black">
                        {ranker.rank <= 3 ? <span aria-hidden="true">{CROWN[ranker.rank - 1]}</span>
                          : <span aria-hidden="true" className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[11px] text-slate-600">{ranker.rank}</span>}
                        <span className="truncate">{ranker.student_name}</span>
                      </span>
                      <strong className="shrink-0">{Number(ranker.total).toFixed(2)} / {Number(ranker.max_total)}</strong>
                    </div>
                  ))}
                </div>
                <Link href={`/live-exam-results?exam=${exam.exam_id}`} className="mt-3 block rounded-xl bg-red-700 px-4 py-2.5 text-center text-sm font-black text-white hover:bg-red-800">View all results →</Link>
              </>
            ) : <p className="mt-3 text-sm text-slate-500">Results appear here after the live exam&apos;s results are open.</p>}
          </div>
        </div>
      </div>
    </section>
  );
}
