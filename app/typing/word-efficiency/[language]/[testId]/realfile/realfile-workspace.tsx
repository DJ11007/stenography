"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { submitWordEfficiencyRealFile } from "../../../actions";
import { QuestionContent } from "@/components/efficiency/question-content";

type Question = { id: string; number: number; display_order: number; instruction: string | null; marks: number; section: string | null; is_visible: boolean };
type Snapshot = { title: string; language: string; instructions_markdown: string; duration_seconds: number; question_count: number; maximum_marks: number; questions: Question[] };

export function RealFileWorkspace({ attemptId, language, testId, snapshot, startedAt }: { attemptId: string; language: string; testId: string; snapshot: Snapshot; startedAt: string | null }) {
  const router = useRouter();
  const startTime = startedAt ? new Date(startedAt).getTime() : Date.now();
  const [remaining, setRemaining] = useState(snapshot.duration_seconds);
  const [downloaded, setDownloaded] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => { const tick = () => setRemaining(Math.max(0, snapshot.duration_seconds - Math.floor((Date.now() - startTime) / 1000) + 300)); tick(); const timer = setInterval(tick, 1000); return () => clearInterval(timer); }, [snapshot.duration_seconds, startTime]);
  const expired = remaining <= 0;
  const catalogueHref = `/typing/word-efficiency/${language}`;

  const submit = async () => {
    if (!file) { setMessage("Choose your finished .docx file before submitting."); return; }
    if (!confirm("Submit your final document? You cannot upload again afterward.")) return;
    setSubmitting(true);
    setMessage("");
    const form = new FormData();
    form.set("file", file);
    try {
      const result = await submitWordEfficiencyRealFile(attemptId, form);
      if (!result.ok) { setMessage(result.error); setSubmitting(false); return; }
      router.push(`/typing/word-efficiency/results/${attemptId}`);
    } catch {
      setMessage("Submission failed. Please try again.");
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-100">
      <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 bg-slate-950 px-4 py-3 text-white">
        <div className="flex items-center gap-3">
          <Link href={catalogueHref} onClick={(event) => { if (!confirm("Leave the test? Your progress is not saved until you upload your finished document.")) event.preventDefault(); }} className="rounded-lg bg-white/10 px-3 py-2 text-sm font-black hover:bg-white/20">← Exit</Link>
          <div><p className="text-xs font-black uppercase tracking-wider text-cyan-300">Word Efficiency · Real File</p><h1 className="font-black">{snapshot.title}</h1></div>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-xl bg-white/10 px-3 py-2 text-sm font-black">{snapshot.maximum_marks} total marks</span>
          <span aria-live="polite" className={`rounded-xl px-4 py-2 font-mono text-xl font-black ${expired ? "bg-red-600" : "bg-white/10"}`}>{formatClock(remaining)}</span>
        </div>
      </header>
      <div className="mx-auto max-w-4xl px-4 py-8">
        <section className="rounded-2xl border border-cyan-200 bg-cyan-50 p-5">
          <h2 className="font-black text-cyan-950">How this test works</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-cyan-900">
            <li>Download the Working Matter document below.</li>
            <li>Open it in your own installed Microsoft Word and complete every question exactly as instructed.</li>
            <li>Save your work, then upload the finished .docx file back here before time runs out.</li>
          </ol>
          <p className="mt-3 text-xs font-bold text-cyan-800">A 5-minute grace period after the timer ends is included above for uploading — but the document you upload must already be finished by the time the main timer reaches zero.</p>
        </section>

        <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-black">Step 1 — Download</h2>
          <a href={`/typing/word-efficiency/${language}/${testId}/working-matter?attempt=${attemptId}`} target="_blank" rel="noreferrer" onClick={() => setDownloaded(true)} className="mt-3 inline-flex rounded-xl bg-blue-700 px-5 py-3 font-black text-white hover:bg-blue-800">⇩ Download Working Matter (.docx)</a>
          {downloaded && <p className="mt-2 text-sm font-bold text-green-700">Downloaded. Open it in Microsoft Word to begin.</p>}
        </section>

        <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-black">Question paper</h2>
          <div className="mt-3 space-y-3">
            {snapshot.questions.map((question) => (
              <article key={question.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <span className="block text-sm font-black text-blue-800">Question {question.number}</span>
                {question.section && <span className="mt-1 block text-xs font-bold text-slate-500">{question.section}</span>}
                <QuestionContent className="mt-2 text-slate-900" text={question.instruction} />
                <span className="mt-2 block text-xs font-bold text-slate-500">{question.marks} marks</span>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-black">Step 2 — Upload your finished document</h2>
          <input ref={fileInput} type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="mt-3 block w-full text-sm" />
          {file && <p className="mt-2 text-sm font-bold text-slate-700">Selected: {file.name} ({Math.round(file.size / 1024)} KB)</p>}
          {message && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm font-bold text-red-800">{message}</p>}
          <button type="button" disabled={submitting || !file} onClick={submit} className="mt-4 w-full rounded-xl bg-red-600 px-5 py-3 font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300 sm:w-auto">{submitting ? "Submitting…" : "Submit Final Document"}</button>
        </section>
      </div>
    </main>
  );
}
function formatClock(seconds: number) { return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`; }
