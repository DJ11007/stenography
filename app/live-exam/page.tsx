import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { formatIST } from "@/lib/format-datetime";
import { examLengthSeconds, patternById } from "@/lib/live-exam";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Live Exam", robots: { index: false, follow: false } };

type Row = { id: string; title: string; pattern: string; starts_at: string; live_exam_sections: { duration_seconds: number; gap_after_seconds: number }[] };

// The published live exams (Live Exam Center): today's and upcoming ones first, then the last few that ended.
export default async function LiveExamListPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!profile) redirect("/login");
  const { data } = await supabase.from("live_exams").select("id,title,pattern,starts_at,live_exam_sections(duration_seconds,gap_after_seconds)").eq("status", "published").order("starts_at");
  const exams = ((data ?? []) as Row[]).map((exam) => {
    const lengthMs = examLengthSeconds(exam.live_exam_sections.map((s) => ({ durationSeconds: s.duration_seconds, gapAfterSeconds: s.gap_after_seconds }))) * 1000;
    return { ...exam, endsAt: new Date(new Date(exam.starts_at).getTime() + lengthMs).toISOString(), minutes: Math.round(lengthMs / 60000) };
  });
  const nowIso = new Date().toISOString();
  const open = exams.filter((exam) => exam.endsAt >= nowIso), ended = exams.filter((exam) => exam.endsAt < nowIso).reverse().slice(0, 10);
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm font-bold text-slate-600 hover:text-slate-900">← Home</Link>
        <h1 className="mt-3 text-3xl font-black text-slate-950">Live Exam</h1>
        <p className="mt-1 text-slate-600">Full exams in the real exam pattern, on one clock for every candidate. Open your exam a few minutes before it starts and log in again with your login ID and password.</p>
        <ul className="mt-6 grid gap-3">
          {!open.length && <li className="rounded-2xl bg-white p-6 text-slate-600 shadow-sm">No live exam is scheduled right now.</li>}
          {open.map((exam) => (
            <li key={exam.id} className="flex flex-wrap items-center gap-4 rounded-2xl bg-white p-5 shadow-sm">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-black uppercase tracking-widest text-red-700">{patternById(exam.pattern)?.name ?? "Live exam"}</p>
                <p className="text-lg font-black text-slate-900">{exam.title}</p>
                <p className="text-sm text-slate-600">Starts {formatIST(exam.starts_at)} · {exam.live_exam_sections.length} parts · {exam.minutes} minutes</p>
              </div>
              <Link href={`/live-exam/${exam.id}`} className="rounded-xl bg-red-700 px-5 py-3 font-black text-white hover:bg-red-800">Open exam →</Link>
            </li>
          ))}
        </ul>
        {ended.length > 0 && <>
          <h2 className="mt-10 text-lg font-black text-slate-800">Ended</h2>
          <ul className="mt-3 grid gap-2">{ended.map((exam) => <li key={exam.id} className="rounded-xl bg-white px-4 py-3 text-sm text-slate-700 shadow-sm"><Link href={`/live-exam/${exam.id}`} className="font-bold hover:underline">{exam.title}</Link> · {formatIST(exam.starts_at)}</li>)}</ul>
        </>}
      </div>
    </main>
  );
}
