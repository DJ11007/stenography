"use client";
import { useState } from "react";
import Link from "next/link";
import { STENOGRAPHY_TASK_CATEGORIES, type StenographyTaskSummary } from "@/lib/stenography-task-library";

function practiceHref(task: StenographyTaskSummary) {
  return task.language === "English"
    ? `/typing/practice/english-stenography?test=${encodeURIComponent(task.slug)}`
    : `/typing/practice/hindi-stenography?input=${encodeURIComponent(task.inputSystemId)}&test=${encodeURIComponent(task.slug)}`;
}

export function StenographyTaskLibraryView({ tasks }: { tasks: StenographyTaskSummary[] }) {
  const [category, setCategory] = useState<"All" | (typeof STENOGRAPHY_TASK_CATEGORIES)[number]>("Task");
  const [query, setQuery] = useState("");
  const filtered = tasks.filter((task) => (category === "All" || task.category === category) && task.title.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title…" className="input flex-1 min-w-48" aria-label="Search tests"/>
      </div>
      <h2 className="mt-6 text-xl font-black text-slate-950">Task / Topic Wise Tests</h2>
      <div role="tablist" className="mt-3 flex flex-wrap gap-2">
        <button type="button" role="tab" aria-selected={category === "All"} onClick={() => setCategory("All")} className={`rounded-full px-4 py-1.5 text-sm font-black ${category === "All" ? "bg-violet-700 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>All</button>
        {STENOGRAPHY_TASK_CATEGORIES.map((item) => (
          <button key={item} type="button" role="tab" aria-selected={category === item} onClick={() => setCategory(item)} className={`rounded-full px-4 py-1.5 text-sm font-black uppercase ${category === item ? "bg-violet-700 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>{item}</button>
        ))}
      </div>
      <div className="mt-5 grid gap-3">
        {filtered.length === 0 && <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-500">No tests in this category yet.</p>}
        {filtered.map((task) => (
          <article key={task.testId} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-violet-100 bg-white p-4 shadow-sm">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-black text-violet-900">{task.title}</h3>
                <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-black uppercase text-violet-800">{task.category}</span>
                {task.hasAudio && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-black text-blue-800">🎧 Audio</span>}
              </div>
              <p className="mt-1 text-xs text-slate-500">{Math.round(task.durationSeconds / 60)} min · {task.requiredWpm} WPM required · {task.requiredAccuracy}% accuracy</p>
            </div>
            <Link href={practiceHref(task)} className="shrink-0 rounded-xl bg-green-600 px-5 py-2.5 text-sm font-black text-white hover:bg-green-700">Practice</Link>
          </article>
        ))}
      </div>
    </div>
  );
}
