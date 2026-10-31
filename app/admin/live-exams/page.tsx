import type { Metadata } from "next";
import Link from "next/link";
import { BackButton } from "@/app/_components/back-button";
import { requireAdmin } from "@/lib/auth";
import { formatIST } from "@/lib/format-datetime";
import { examLengthSeconds, isoToIstInput, LIVE_EXAM_PATTERNS, liveExamStarted, patternById, type LiveExamSection } from "@/lib/live-exam";
import { createClient } from "@/lib/supabase/server";
import { deleteLiveExam } from "./actions";
import { LiveExamEditor, type TestOption } from "./live-exam-editor";

export const metadata: Metadata = { title: "Live Exam Center | Admin" };

type ExamRow = { id: string; title: string; pattern: string; starts_at: string; results_at: string | null; status: string; instructions: string | null; live_exam_sections: { duration_seconds: number; gap_after_seconds: number }[] };

// Live Exam Center (docs/live-exam-center-plan.md): timed exams made of sections that reuse tests already on the site.
export default async function AdminLiveExamsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const query = await searchParams;
  const supabase = await createClient();
  const { data: exams, error } = await supabase.from("live_exams").select("id,title,pattern,starts_at,results_at,status,instructions,live_exam_sections(duration_seconds,gap_after_seconds)").order("starts_at", { ascending: false });

  const editing = query.edit ? (exams as ExamRow[] | null)?.find((exam) => exam.id === query.edit) ?? null : null;
  const newPattern = query.new ? patternById(query.new) : null;
  const showEditor = Boolean(editing || query.new);

  let editor: React.ReactNode = null;
  if (showEditor) {
    // Every published test a section can use, by kind and language.
    const [typing, word, excel] = await Promise.all([
      supabase.from("tests").select("id,title,language,mode").eq("status", "published").eq("test_type", "typing").is("archived_at", null).in("mode", ["exam", "practice"]).order("title"),
      supabase.from("word_efficiency_tests").select("id,title,language").eq("status", "published").order("title"),
      supabase.from("excel_efficiency_tests").select("id,title,language").eq("status", "published").order("title"),
    ]);
    const tests: TestOption[] = [
      ...(typing.data ?? []).map((test) => ({ id: test.id, title: test.title, kind: "typing" as const, language: test.language as TestOption["language"], mode: test.mode })),
      ...(word.data ?? []).map((test) => ({ id: test.id, title: test.title, kind: "word" as const, language: test.language as TestOption["language"] })),
      ...(excel.data ?? []).map((test) => ({ id: test.id, title: test.title, kind: "excel" as const, language: test.language as TestOption["language"] })),
    ].sort((a, b) => a.title.localeCompare(b.title, "en", { numeric: true, sensitivity: "base" }));
    let sections: LiveExamSection[] = (newPattern?.sections ?? [{ kind: "typing", language: "English", label: "Section 1", durationSeconds: 600, gapAfterSeconds: 0, maxMarks: 25 }]).map((section) => ({ ...section, testId: "" }));
    let locked = false;
    if (editing) {
      const { data: rows } = await supabase.from("live_exam_sections").select("kind,language,label,test_id,duration_seconds,gap_after_seconds,max_marks").eq("exam_id", editing.id).order("seq");
      sections = (rows ?? []).map((row) => ({ kind: row.kind, language: row.language, label: row.label, testId: row.test_id, durationSeconds: row.duration_seconds, gapAfterSeconds: row.gap_after_seconds, maxMarks: Number(row.max_marks) }));
      locked = liveExamStarted(editing);
    }
    const pattern = editing ? patternById(editing.pattern) : newPattern;
    editor = <LiveExamEditor key={editing?.id ?? query.new} locked={locked} pattern={pattern} tests={tests} initial={{
      examId: editing?.id ?? null, title: editing?.title ?? (pattern ? `${pattern.name} Live Exam` : ""), pattern: editing?.pattern ?? newPattern?.id ?? "custom",
      startsAt: isoToIstInput(editing?.starts_at), resultsAt: isoToIstInput(editing?.results_at), status: editing?.status ?? "draft", instructions: editing?.instructions ?? "", sections,
    }} />;
  }

  return (
    <main className="min-h-screen bg-slate-100 p-4 sm:p-6">
      <div className="mx-auto max-w-5xl">
        <BackButton href="/admin" label="Admin dashboard" />
        <h1 className="mt-2 text-3xl font-black">Live Exam Center</h1>
        <p className="mt-1 text-slate-600">Timed exams made of sections — typing, Word, Excel — that use tests you have already uploaded. Every student follows the same clock from the start time, with breaks between sections.</p>
        {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm font-bold text-red-800">The Live Exam Center needs its database update first (migration 202611011000). {error.message}</p>}
        {query.error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm font-bold text-red-800">{query.error}</p>}
        {query.saved && <p role="status" className="mt-4 rounded-xl bg-green-50 p-4 text-sm font-bold text-green-800">Exam saved.</p>}
        {query.deleted && <p role="status" className="mt-4 rounded-xl bg-green-50 p-4 text-sm font-bold text-green-800">Draft exam deleted.</p>}
        {query.cancelled && <p role="status" className="mt-4 rounded-xl bg-amber-50 p-4 text-sm font-bold text-amber-900">Exam cancelled. Its attempts are kept.</p>}

        <div className="mt-6 flex flex-wrap gap-3">
          {LIVE_EXAM_PATTERNS.map((pattern) => <Link key={pattern.id} href={`?new=${pattern.id}`} className="rounded-xl bg-red-700 px-5 py-3 font-black text-white hover:bg-red-800">+ New {pattern.name} exam</Link>)}
          <Link href="?new=custom" className="rounded-xl border border-slate-300 bg-white px-5 py-3 font-black text-slate-800 hover:bg-slate-50">+ New custom exam</Link>
        </div>

        {editor}
        {editing && (
          <form action={deleteLiveExam} className="mt-4">
            <input type="hidden" name="examId" value={editing.id} />
            <button className="rounded-xl border border-red-200 px-4 py-2 text-sm font-black text-red-700 hover:bg-red-50">{editing.status === "draft" ? "Delete this draft" : "Cancel this exam"}</button>
          </form>
        )}

        <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-xl font-black">All live exams</h2>
          {!(exams ?? []).length && <p className="mt-2 text-sm text-slate-500">No live exams yet.</p>}
          <ul className="mt-3 divide-y">
            {((exams ?? []) as ExamRow[]).map((exam) => {
              const length = examLengthSeconds(exam.live_exam_sections.map((s) => ({ durationSeconds: s.duration_seconds, gapAfterSeconds: s.gap_after_seconds })));
              return (
                <li key={exam.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-black text-slate-900">{exam.title}</p>
                    <p className="text-xs text-slate-500">{patternById(exam.pattern)?.name ?? "Custom"} · starts {formatIST(exam.starts_at)} · {exam.live_exam_sections.length} sections · {Math.round(length / 60)} min</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-black ${exam.status === "published" ? "bg-green-100 text-green-800" : exam.status === "cancelled" ? "bg-slate-200 text-slate-600" : "bg-amber-100 text-amber-800"}`}>{exam.status}</span>
                  <Link href={`?edit=${exam.id}`} className="rounded-lg border px-3 py-1.5 text-sm font-bold hover:bg-slate-50">Edit</Link>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </main>
  );
}
