import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Test Results | Admin" };

type ResultData = { netWpm?: number; accuracy?: number; fullErrors?: number; halfErrors?: number };

// Per-TEST view of every student who has attempted it, ranked by score --
// the counterpart to /admin/students/[id] (which is per-STUDENT, across
// every test). Neither existed before: the test manager's own "View"
// button only ever opened the student-facing test page, with no way to
// see who took a given test or how they did without opening each student
// individually. Every row's Review eye-icon reuses the same attempt-detail
// page already built for the student-detail view (a full passage-vs-typed
// comparison with error highlighting), so this is purely a different way
// in to the same underlying capability.
export default async function AdminTestResultsPage({ params }: { params: Promise<{ testId: string }> }) {
  await requireAdmin();
  const { testId } = await params;
  const supabase = await createClient();

  const { data: test } = await supabase.from("tests").select("id,title,slug,mode,current_version_id").eq("id", testId).maybeSingle();
  if (!test) notFound();
  const { data: version } = test.current_version_id ? await supabase.from("test_versions").select("required_wpm,required_accuracy").eq("id", test.current_version_id).maybeSingle() : { data: null };

  const { data: attempts } = await supabase.from("test_attempts").select("id,student_id,result,started_at,submitted_at").eq("test_id", testId).order("submitted_at", { ascending: false }).limit(500);
  const rows = attempts ?? [];
  const studentIds = [...new Set(rows.map((row) => row.student_id))];
  const { data: students } = studentIds.length ? await supabase.from("profiles").select("id,full_name,email").in("id", studentIds) : { data: [] };
  const studentById = new Map((students ?? []).map((student) => [student.id, student]));

  const requiredWpm = version?.required_wpm != null ? Number(version.required_wpm) : null;
  const requiredAccuracy = version?.required_accuracy != null ? Number(version.required_accuracy) : null;
  const ranked = rows
    .map((row) => {
      const result = (row.result ?? {}) as ResultData;
      const netWpm = Number(result.netWpm ?? 0);
      const accuracy = Number(result.accuracy ?? 0);
      const passed = requiredWpm != null && requiredAccuracy != null ? netWpm >= requiredWpm && accuracy >= requiredAccuracy : null;
      return { ...row, student: studentById.get(row.student_id), netWpm, accuracy, fullErrors: Number(result.fullErrors ?? 0), halfErrors: Number(result.halfErrors ?? 0), passed };
    })
    .sort((a, b) => b.netWpm - a.netWpm || b.accuracy - a.accuracy);

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-6xl">
        <Link href="/admin/tests" className="text-sm font-black text-blue-700">← Assessment Studio</Link>
        <header className="mt-4 rounded-2xl bg-slate-900 p-6 text-white shadow">
          <p className="text-xs font-black uppercase tracking-widest text-blue-300">Test results</p>
          <h1 className="mt-1 text-2xl font-black">{test.title}</h1>
          <p className="mt-2 text-sm text-slate-300">{ranked.length} attempt{ranked.length === 1 ? "" : "s"}{requiredWpm != null && requiredAccuracy != null ? ` · Pass requires ${requiredWpm} WPM and ${requiredAccuracy}% accuracy` : ""}</p>
        </header>

        <div className="mt-6 overflow-x-auto rounded-2xl bg-white shadow">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="bg-slate-100">
                <th className="p-3">Rank</th>
                <th className="p-3">Student</th>
                <th className="p-3">Net WPM</th>
                <th className="p-3">Accuracy</th>
                <th className="p-3">Errors</th>
                <th className="p-3">Result</th>
                <th className="p-3">Submitted</th>
                <th className="p-3">Review</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((row, index) => (
                <tr key={row.id} className="border-b align-top">
                  <td className="p-3 font-black text-slate-500">#{index + 1}</td>
                  <td className="p-3"><Link href={`/admin/students/${row.student_id}`} className="font-bold text-blue-700 hover:underline">{row.student?.full_name || "(no name)"}</Link><br /><span className="text-xs text-slate-500">{row.student?.email}</span></td>
                  <td className="p-3">{row.netWpm}</td>
                  <td className="p-3">{row.accuracy}%</td>
                  <td className="p-3">{row.fullErrors + row.halfErrors}</td>
                  <td className="p-3">{row.passed === null ? "—" : row.passed ? <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-black text-green-800">Pass</span> : <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-black text-red-800">Fail</span>}</td>
                  <td className="p-3">{row.submitted_at ? new Date(row.submitted_at).toLocaleString() : "In progress"}</td>
                  <td className="p-3">{row.submitted_at && <EyeLink href={`/admin/students/attempts/${row.id}`} label="View this attempt's full result"/>}</td>
                </tr>
              ))}
              {!ranked.length && <tr><td colSpan={8} className="p-6 text-center text-slate-500">No attempts yet for this test.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}

function EyeLink({ href, label }: { href: string; label: string }) {
  return <Link href={href} title={label} aria-label={label} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 hover:text-blue-700"><svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z"/><circle cx="12" cy="12" r="3"/></svg></Link>;
}
