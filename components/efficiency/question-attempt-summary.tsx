// Word / Excel result page: one round, numbered circle per question, coloured by what the student did, with the
// totals above. "Attempted" counts every question the student worked on (correct or not); "Not attempted" the ones
// where nothing the question checks was changed. The states come from <subject>_efficiency_attempt_question_states
// (migration 202611071300); without it (not applied yet) the section is simply not shown.
export type QuestionAttemptState = { number: number; state: "correct" | "attempted" | "unattempted" | "pending" };

const STYLES: Record<QuestionAttemptState["state"], { circle: string; label: string }> = {
  correct: { circle: "bg-emerald-600 text-white border-emerald-700", label: "Correct" },
  attempted: { circle: "bg-amber-400 text-amber-950 border-amber-500", label: "Attempted, not correct" },
  unattempted: { circle: "bg-white text-slate-500 border-slate-300", label: "Not attempted" },
  pending: { circle: "bg-sky-100 text-sky-800 border-sky-300", label: "Not marked yet" },
};

export function QuestionAttemptSummary({ states }: { states: QuestionAttemptState[] | null | undefined }) {
  if (!states?.length) return null;
  const count = (state: QuestionAttemptState["state"]) => states.filter(item => item.state === state).length;
  const attempted = count("correct") + count("attempted");
  const notAttempted = count("unattempted");
  const shown = (["correct", "attempted", "unattempted", "pending"] as const).filter(state => count(state) > 0);
  return (
    <section aria-labelledby="question-attempts-heading" className="mt-6 rounded-2xl border border-slate-200 p-5">
      <h2 id="question-attempts-heading" className="text-center text-xl font-black uppercase tracking-wide text-slate-500">Questions Attempted</h2>
      <div className="mt-4 flex flex-wrap justify-center gap-3 text-sm font-black">
        <span className="rounded-full bg-blue-50 px-4 py-2 text-blue-900">Total {states.length}</span>
        <span className="rounded-full bg-emerald-50 px-4 py-2 text-emerald-800">Attempted {attempted}</span>
        <span className="rounded-full bg-slate-100 px-4 py-2 text-slate-700">Not attempted {notAttempted}</span>
        <span className="rounded-full bg-emerald-50 px-4 py-2 text-emerald-800">Correct {count("correct")}</span>
      </div>
      <ol aria-label="Question status" className="mt-5 flex flex-wrap justify-center gap-2.5">
        {states.map(item => (
          <li key={item.number} title={`Question ${item.number}: ${STYLES[item.state].label}`} aria-label={`Question ${item.number}: ${STYLES[item.state].label}`}
            className={`grid h-10 w-10 place-items-center rounded-full border-2 text-sm font-black ${STYLES[item.state].circle}`}>
            {item.number}
          </li>
        ))}
      </ol>
      <ul className="mt-4 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs font-bold text-slate-600">
        {shown.map(state => (
          <li key={state} className="flex items-center gap-2"><span aria-hidden className={`inline-block h-3.5 w-3.5 rounded-full border-2 ${STYLES[state].circle}`} />{STYLES[state].label} ({count(state)})</li>
        ))}
      </ul>
    </section>
  );
}
