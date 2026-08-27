import { EFFICIENCY_EXAM_PATTERNS } from "@/lib/efficiency-exam-patterns";

export function ExamPatternReference({ subject }: { subject: "Word" | "Excel" }) {
  const patterns = EFFICIENCY_EXAM_PATTERNS.filter((pattern) => pattern.subject === subject || pattern.subject === "Both");
  if (!patterns.length) return null;
  return (
    <details className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <summary className="cursor-pointer font-black text-slate-800">Real {subject} Efficiency exam patterns (reference — for your information while authoring)</summary>
      <p className="mt-2 text-xs text-slate-500">These are researched patterns from actual government recruitment boards, shown so your duration, marks, and task choices can be realistic. They do not restrict what you author.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {patterns.map((pattern) => (
          <article key={pattern.id} className="rounded-xl border bg-white p-4 text-sm">
            <div className="flex items-start justify-between gap-2">
              <h4 className="font-black text-slate-900">{pattern.board}</h4>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${pattern.sourced ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{pattern.sourced ? "Sourced" : "Estimated"}</span>
            </div>
            <p className="text-xs font-bold text-slate-500">{pattern.examName}</p>
            <dl className="mt-2 space-y-1 text-xs text-slate-700">
              <div><dt className="inline font-bold">Duration: </dt><dd className="inline">{pattern.durationMinutes}</dd></div>
              <div><dt className="inline font-bold">Marks: </dt><dd className="inline">{pattern.maximumMarks}</dd></div>
              {pattern.font && <div><dt className="inline font-bold">Font: </dt><dd className="inline">{pattern.font}</dd></div>}
              <div><dt className="inline font-bold">Task focus: </dt><dd className="inline">{pattern.taskFocus.join(", ")}</dd></div>
            </dl>
            {pattern.notes.map((note) => <p key={note} className="mt-2 text-[11px] text-slate-500">{note}</p>)}
          </article>
        ))}
      </div>
    </details>
  );
}
