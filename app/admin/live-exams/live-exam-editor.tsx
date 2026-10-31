"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { examLengthSeconds, SECTION_KIND_LABEL, sectionInstructions, type LiveExamLanguage, type LiveExamPattern, type LiveExamSection, type LiveExamSectionKind } from "@/lib/live-exam";
import { saveLiveExam } from "./actions";

export type TestOption = { id: string; title: string; kind: LiveExamSectionKind; language: LiveExamLanguage; mode?: string | null };
type Initial = { examId: string | null; title: string; pattern: string; startsAt: string; resultsAt: string; status: string; instructions: string; sections: LiveExamSection[] };

const UPLOAD_LINK: Record<LiveExamSectionKind, (language: LiveExamLanguage) => string> = {
  typing: () => "/admin/exam-tests",
  word: (language) => `/admin/word-efficiency-tests?new=1&language=${language}`,
  excel: (language) => `/admin/excel-efficiency-tests?new=1&language=${language}`,
};
const minutes = (seconds: number) => Math.round((seconds / 60) * 100) / 100;

// The exam form: title, schedule, extra instructions and the sections in order. Each section picks one of the tests
// already uploaded (filtered by kind and language) or links to upload a new one.
export function LiveExamEditor({ initial, pattern, tests, locked }: { initial: Initial; pattern: LiveExamPattern | null; tests: TestOption[]; locked: boolean }) {
  const [sections, setSections] = useState<LiveExamSection[]>(initial.sections);
  const update = (index: number, change: Partial<LiveExamSection>) => setSections((current) => current.map((section, i) => (i === index ? { ...section, ...change } : section)));
  const move = (index: number, by: -1 | 1) => setSections((current) => { const next = [...current]; const [item] = next.splice(index, 1); next.splice(index + by, 0, item); return next; });
  const total = useMemo(() => examLengthSeconds(sections), [sections]);
  const marks = sections.reduce((sum, section) => sum + (Number(section.maxMarks) || 0), 0);

  return (
    <form action={saveLiveExam} className="mt-6 grid gap-6">
      <input type="hidden" name="examId" value={initial.examId ?? ""} />
      <input type="hidden" name="pattern" value={initial.pattern} />
      <input type="hidden" name="sections" value={JSON.stringify(sections)} />
      {locked && <p className="rounded-xl bg-amber-50 p-4 text-sm font-bold text-amber-900">This exam has started, so its sections and times can no longer change.</p>}

      <section className="grid gap-4 rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-xl font-black">Exam details</h2>
        <label className="grid gap-2 text-sm font-bold text-slate-700">Title<input className="input" name="title" required defaultValue={initial.title} placeholder="RSMSSB LDC Live Exam — 2 Nov" /></label>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="grid gap-2 text-sm font-bold text-slate-700">Date &amp; start time (India time)<input className="input" name="startsAt" type="datetime-local" required defaultValue={initial.startsAt} /></label>
          <label className="grid gap-2 text-sm font-bold text-slate-700">Results shown from (India time)<input className="input" name="resultsAt" type="datetime-local" defaultValue={initial.resultsAt} /><span className="text-xs font-normal text-slate-500">Empty = shown when the exam ends.</span></label>
          <label className="grid gap-2 text-sm font-bold text-slate-700">Status
            <select className="input" name="status" defaultValue={initial.status}>
              <option value="draft">Draft (only admins see it)</option>
              <option value="published">Published (students can join)</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
        </div>
      </section>

      <section className="grid gap-4 rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xl font-black">Sections, in order</h2>
          <p className="text-sm font-bold text-slate-600">Exam length {minutes(total)} min · {marks} marks</p>
        </div>
        {pattern && <p className="text-sm text-slate-600">{pattern.name} pattern: {pattern.description}</p>}
        {sections.map((section, index) => {
          const options = tests.filter((test) => test.kind === section.kind && test.language === section.language);
          return (
            <div key={index} className="grid gap-3 rounded-xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-slate-900 text-sm font-black text-white">{index + 1}</span>
                <input className="input max-w-xs font-bold" aria-label={`Section ${index + 1} name`} value={section.label} disabled={locked} onChange={(event) => update(index, { label: event.target.value })} />
                <span className="ml-auto flex gap-1">
                  <button type="button" disabled={locked || index === 0} onClick={() => move(index, -1)} className="rounded-lg border px-2 py-1 text-sm disabled:opacity-30" aria-label="Move up">↑</button>
                  <button type="button" disabled={locked || index === sections.length - 1} onClick={() => move(index, 1)} className="rounded-lg border px-2 py-1 text-sm disabled:opacity-30" aria-label="Move down">↓</button>
                  <button type="button" disabled={locked || sections.length === 1} onClick={() => setSections((current) => current.filter((_, i) => i !== index))} className="rounded-lg border border-red-200 px-2 py-1 text-sm text-red-700 disabled:opacity-30">Remove</button>
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-[150px_120px_1fr]">
                <label className="grid gap-1 text-xs font-bold text-slate-600">Type
                  <select className="input" value={section.kind} disabled={locked} onChange={(event) => update(index, { kind: event.target.value as LiveExamSectionKind, testId: "" })}>
                    {(Object.keys(SECTION_KIND_LABEL) as LiveExamSectionKind[]).map((kind) => <option key={kind} value={kind}>{SECTION_KIND_LABEL[kind]}</option>)}
                  </select>
                </label>
                <label className="grid gap-1 text-xs font-bold text-slate-600">Language
                  <select className="input" value={section.language} disabled={locked} onChange={(event) => update(index, { language: event.target.value as LiveExamLanguage, testId: "" })}>
                    <option>Hindi</option><option>English</option>
                  </select>
                </label>
                <label className="grid gap-1 text-xs font-bold text-slate-600">Test ({options.length} available)
                  <span className="flex gap-2">
                    <select className="input min-w-0 flex-1" value={section.testId} disabled={locked} onChange={(event) => update(index, { testId: event.target.value })}>
                      <option value="">— choose a test —</option>
                      {options.map((test) => <option key={test.id} value={test.id}>{test.title}{test.mode ? ` (${test.mode})` : ""}</option>)}
                    </select>
                    <Link href={UPLOAD_LINK[section.kind](section.language)} target="_blank" className="whitespace-nowrap rounded-lg border border-blue-200 px-3 py-2 text-xs font-black text-blue-700 hover:bg-blue-50">Upload new ↗</Link>
                  </span>
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="grid gap-1 text-xs font-bold text-slate-600">Duration (minutes)<input className="input" type="number" min={1} max={240} step={0.5} disabled={locked} value={minutes(section.durationSeconds)} onChange={(event) => update(index, { durationSeconds: Math.max(60, Number(event.target.value) * 60) })} /></label>
                <label className="grid gap-1 text-xs font-bold text-slate-600">Break after it (minutes)<input className="input" type="number" min={0} max={60} step={0.5} disabled={locked} value={minutes(section.gapAfterSeconds)} onChange={(event) => update(index, { gapAfterSeconds: Math.max(0, Number(event.target.value) * 60) })} /></label>
                <label className="grid gap-1 text-xs font-bold text-slate-600">Maximum marks<input className="input" type="number" min={1} max={1000} step={0.5} disabled={locked} value={section.maxMarks} onChange={(event) => update(index, { maxMarks: Number(event.target.value) })} /></label>
              </div>
            </div>
          );
        })}
        {!locked && <button type="button" onClick={() => setSections((current) => [...current, { kind: "typing", language: "English", label: `Section ${current.length + 1}`, testId: "", durationSeconds: 600, gapAfterSeconds: 120, maxMarks: 25 }])} className="justify-self-start rounded-xl border border-dashed border-slate-400 px-4 py-2 text-sm font-black text-slate-700 hover:bg-slate-50">+ Add section</button>}
      </section>

      <section className="grid gap-3 rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-xl font-black">Instructions for students</h2>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-700">{[...sectionInstructions(sections), ...(pattern?.instructions ?? [])].map((line) => <li key={line}>{line}</li>)}</ol>
        <label className="grid gap-2 text-sm font-bold text-slate-700">Extra instructions for this exam (one per line, shown after the standard ones)
          <textarea className="input min-h-28" name="instructions" defaultValue={initial.instructions} placeholder={"Reporting time: 9:45 AM\nKeep your login ID and password ready."} />
        </label>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button className="rounded-xl bg-slate-900 px-6 py-3 font-black text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40" disabled={locked}>Save exam</button>
        <span className="text-sm text-slate-500">Students see a published exam on the Live Exam page from its start time.</span>
      </div>
    </form>
  );
}
