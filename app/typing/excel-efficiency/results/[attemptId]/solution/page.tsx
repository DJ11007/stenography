import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStudent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatIST } from "@/lib/format-datetime";
import { BackButton } from "../../../../../_components/back-button";
import { QuestionContent } from "@/components/efficiency/question-content";

export const metadata: Metadata = { title: "Paper Solution | Excel Efficiency" };
type SolutionQuestion = { number: number; instruction: string | null; marks: number; solution: string | null; image: string | null; awarded: number | null };
type Solution = { available: boolean; reason?: string; opensAt?: string; title?: string; questions?: SolutionQuestion[] };

// The paper solution of an Excel Efficiency test, opened from the student's result page: each question with the
// admin's solution steps and screenshot, beside the marks this student got for it. The database decides whether
// it may be shown (result published, live window closed; migration 202610261000).
export default async function ExcelPaperSolutionPage({ params }: { params: Promise<{ attemptId: string }> }) {
  await requireStudent();
  const { attemptId } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_excel_efficiency_solution", { p_attempt_id: attemptId });
  if (error || !data) notFound();
  const solution = data as Solution;
  if (solution.reason === "not found") notFound();
  const resultHref = `/typing/excel-efficiency/results/${attemptId}`;
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10">
      <section className="mx-auto max-w-4xl overflow-hidden rounded-3xl bg-white shadow-xl">
        <header className="bg-gradient-to-r from-slate-950 to-emerald-900 p-7 text-white">
          <BackButton href={resultHref} label="My result" dark />
          <p className="mt-3 text-xs font-black uppercase tracking-[.2em] text-emerald-300">Excel Efficiency · paper solution</p>
          <h1 className="mt-2 text-3xl font-black">{solution.title ?? "Paper solution"}</h1>
          <p className="mt-2 text-slate-300">How each question is solved in Excel 2013, step by step.</p>
        </header>
        <div className="grid gap-5 p-5 sm:p-7">
          {!solution.available ? (
            <p className="rounded-xl bg-amber-50 p-4 font-bold text-amber-900">
              {solution.reason === "live" ? `The solution opens when the live test ends${solution.opensAt ? ` (${formatIST(solution.opensAt)})` : ""}.` : solution.reason === "result pending" ? "The solution opens with your result." : "This test has no paper solution yet."}
            </p>
          ) : (
            <>
              <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">Tip: select a range quickly by typing it in the <b>Name Box</b> (left of the formula bar) and pressing Enter. Questions with parts (a), (b), (c) give marks for each part, so finish every part.</p>
              {(solution.questions ?? []).map((question) => {
                const full = question.awarded !== null && Number(question.awarded) >= Number(question.marks);
                return (
                  <article key={question.number} aria-labelledby={`solution-q${question.number}`} className="overflow-hidden rounded-2xl border border-slate-200">
                    <div className="flex flex-wrap items-start gap-3 border-b border-slate-100 bg-slate-50 p-4">
                      <span className="rounded-lg bg-emerald-100 px-2.5 py-1 text-sm font-black text-emerald-900">Q{question.number}</span>
                      <div className="min-w-0 flex-1">
                        <h2 id={`solution-q${question.number}`} className="sr-only">Question {question.number}</h2>
                        <QuestionContent className="text-sm text-slate-800" text={question.instruction} />
                      </div>
                      <span className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-black ${question.awarded === null ? "bg-slate-200 text-slate-700" : full ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-900"}`}>
                        You: {question.awarded === null ? "—" : Number(question.awarded)} / {Number(question.marks)}
                      </span>
                    </div>
                    <div className="grid gap-3 p-4">
                      {question.solution ? <QuestionContent className="text-[15px] leading-7 text-slate-900" text={question.solution} /> : <p className="text-sm text-slate-500">No written steps for this question.</p>}
                      {/* eslint-disable-next-line @next/next/no-img-element -- a stored image data URI, not a static file */}
                      {question.image && <img src={question.image} alt={`Screenshot of question ${question.number} after solving it`} className="w-full rounded-xl border border-slate-200" loading="lazy" />}
                    </div>
                  </article>
                );
              })}
            </>
          )}
          <div className="flex flex-wrap gap-3"><Link href={resultHref} className="rounded-xl bg-emerald-700 px-5 py-3 font-black text-white">Back to my result</Link></div>
        </div>
      </section>
    </main>
  );
}
