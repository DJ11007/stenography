import Link from "next/link";
import { formatIST } from "@/lib/format-datetime";
import { BackButton } from "@/app/_components/back-button";
import { QuestionContent } from "./question-content";

// The paper solution of a Word or Excel Efficiency test, opened from the student's result page, and the box at
// the end of the result page that leads to it. What may be shown is decided by the database
// (excel_/word_efficiency_solution_status: result published, live window closed).
export type SolutionStatus = { available?: boolean; reason?: string; opensAt?: string };
export type SolutionQuestion = { number: number; instruction: string | null; marks: number; solution: string | null; image: string | null; awarded: number | null };
export type PaperSolutionData = SolutionStatus & { title?: string; questions?: SolutionQuestion[] };

const TIPS: Record<"Excel" | "Word", string> = {
  Excel: "Tip: select a range quickly by typing it in the **Name Box** (left of the formula bar) and pressing Enter. Questions with parts (a), (b), (c) give marks for each part, so finish every part.",
  Word: "Tip: select the text first, then use the ribbon command; check each change in the document before moving on. Questions with parts (a), (b), (c) give marks for each part, so finish every part.",
};

export function SolutionLinkBox({ status, href }: { status: SolutionStatus; href: string }) {
  if (status.reason === "none" || status.reason === "not found" || (!status.available && !status.reason)) return null;
  return (
    <section aria-labelledby="paper-solution" className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 print:hidden">
      <h2 id="paper-solution" className="text-lg font-black text-emerald-950">Paper solution</h2>
      {status.available ? <>
        <p className="mt-1 text-sm text-emerald-900">See how each question is solved, step by step with screenshots, and compare it with your answers.</p>
        <Link href={href} className="mt-4 inline-block rounded-xl bg-emerald-700 px-5 py-3 font-black text-white">View paper solution</Link>
      </> : status.reason === "live" ? <p className="mt-1 text-sm text-emerald-900">The solution opens when the live test ends{status.opensAt ? ` (${formatIST(status.opensAt)})` : ""}, so that it cannot help students who are still taking it.</p>
        : <p className="mt-1 text-sm text-emerald-900">The solution opens with your result.</p>}
    </section>
  );
}

export function PaperSolution({ subject, solution, resultHref }: { subject: "Excel" | "Word"; solution: PaperSolutionData; resultHref: string }) {
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10">
      <section className="mx-auto max-w-4xl overflow-hidden rounded-3xl bg-white shadow-xl">
        <header className={`bg-gradient-to-r p-7 text-white ${subject === "Excel" ? "from-slate-950 to-emerald-900" : "from-slate-950 to-blue-900"}`}>
          <BackButton href={resultHref} label="My result" dark />
          <p className="mt-3 text-xs font-black uppercase tracking-[.2em] text-emerald-300">{subject} Efficiency · paper solution</p>
          <h1 className="mt-2 text-3xl font-black">{solution.title ?? "Paper solution"}</h1>
          <p className="mt-2 text-slate-300">How each question is solved in {subject} 2013, step by step.</p>
        </header>
        <div className="grid gap-5 p-5 sm:p-7">
          {!solution.available ? (
            <p className="rounded-xl bg-amber-50 p-4 font-bold text-amber-900">
              {solution.reason === "live" ? `The solution opens when the live test ends${solution.opensAt ? ` (${formatIST(solution.opensAt)})` : ""}.` : solution.reason === "result pending" ? "The solution opens with your result." : "This test has no paper solution yet."}
            </p>
          ) : (
            <>
              <QuestionContent className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950" text={TIPS[subject]} />
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
