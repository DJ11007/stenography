import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { BackButton } from "../../../_components/back-button";

export const metadata: Metadata = { title: "Student Results | Admin" };

// Track is the results/analytics hub: every test a student has appeared
// for, with full detail (score, errors, a Review link into the exact
// passage-vs-typed breakdown) -- everything a teacher needs to actually
// teach from a student's mistakes. Account/subscription/access management
// lives at /admin/students/[id] instead; the two pages cross-link but
// deliberately don't duplicate each other's content, per the split the
// admin asked for: Track for results, Students for account records.
export default async function AdminTrackStudentPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const supabase = await createClient();

  const { data: student } = await supabase.from("profiles").select("id,full_name,email").eq("id", id).maybeSingle();
  if (!student) notFound();

  const { data: typingAttempts } = await supabase.from("test_attempts").select("id,test_id,result,started_at,submitted_at,is_live_attempt").eq("student_id", id).order("started_at", { ascending: false }).limit(100);
  const typingTestIds = [...new Set((typingAttempts ?? []).map((a) => a.test_id))];
  const { data: typingTests } = typingTestIds.length ? await supabase.from("tests").select("id,title,mode").in("id", typingTestIds) : { data: [] };
  const typingTitleById = new Map((typingTests ?? []).map((t) => [t.id, t]));

  const { data: wordAttempts } = await supabase.from("word_efficiency_attempts").select("id,version_id,status,result,started_at,submitted_at,evaluation_status,result_published_at").eq("student_id", id).order("started_at", { ascending: false }).limit(100);
  const wordVersionIds = [...new Set((wordAttempts ?? []).map((a) => a.version_id))];
  const { data: wordVersions } = wordVersionIds.length ? await supabase.from("word_efficiency_versions").select("id,title,maximum_marks").in("id", wordVersionIds) : { data: [] };
  const wordTitleById = new Map((wordVersions ?? []).map((v) => [v.id, v]));

  const { data: excelAttempts } = await supabase.from("excel_efficiency_attempts").select("id,version_id,status,result,started_at,submitted_at,evaluation_status,result_published_at").eq("student_id", id).order("started_at", { ascending: false }).limit(100);
  const excelVersionIds = [...new Set((excelAttempts ?? []).map((a) => a.version_id))];
  const { data: excelVersions } = excelVersionIds.length ? await supabase.from("excel_efficiency_versions").select("id,title,maximum_marks").in("id", excelVersionIds) : { data: [] };
  const excelTitleById = new Map((excelVersions ?? []).map((v) => [v.id, v]));

  const totalAttempts = (typingAttempts?.length ?? 0) + (wordAttempts?.length ?? 0) + (excelAttempts?.length ?? 0);

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-5xl">
        <BackButton href="/admin/track" label="Track" />

        <header className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-900 p-6 text-white shadow">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-blue-300">All test results</p>
            <h1 className="mt-1 text-2xl font-black">{student.full_name || "(no name)"}</h1>
            <p className="mt-1 text-sm text-slate-300">{student.email} · {totalAttempts} attempt{totalAttempts === 1 ? "" : "s"} across every module</p>
          </div>
          <Link href={`/admin/students/${student.id}`} className="rounded-lg border border-white/30 px-4 py-2 text-sm font-bold hover:bg-white/10">Account & subscription →</Link>
        </header>

        <section className="mt-6 rounded-2xl bg-white p-6 shadow">
          <h2 className="text-xl font-black">Typing / Practice / Exam / Stenography results</h2>
          <div className="mt-4 overflow-x-auto"><table className="w-full border-collapse text-left text-sm"><thead><tr className="bg-slate-100"><th className="p-3">Test</th><th className="p-3">Mode</th><th className="p-3">Net WPM</th><th className="p-3">Accuracy</th><th className="p-3">Submitted</th><th className="p-3">View</th></tr></thead><tbody>
            {(typingAttempts ?? []).map((attempt) => { const test = typingTitleById.get(attempt.test_id); const result = attempt.result as Record<string, unknown> | null; const netWpm = result?.marksNetWpm ?? result?.netWpm; return <tr key={attempt.id} className="border-b"><td className="p-3">{test?.title ?? "Unknown test"}</td><td className="p-3">{test?.mode ?? "—"}</td><td className="p-3">{netWpm != null ? String(netWpm) : "—"}</td><td className="p-3">{result?.accuracy != null ? `${result.accuracy}%` : "—"}</td><td className="p-3">{attempt.submitted_at ? date(attempt.submitted_at) : "In progress"}</td><td className="p-3">{attempt.submitted_at && <EyeLink href={`/admin/students/attempts/${attempt.id}`} label="View this attempt's full result"/>}</td></tr>; })}
            {!typingAttempts?.length && <tr><td colSpan={6} className="p-6 text-center text-slate-500">No typing attempts yet.</td></tr>}
          </tbody></table></div>
        </section>

        <section className="mt-6 rounded-2xl bg-white p-6 shadow">
          <h2 className="text-xl font-black">Word Efficiency results</h2>
          <div className="mt-4 overflow-x-auto"><table className="w-full border-collapse text-left text-sm"><thead><tr className="bg-slate-100"><th className="p-3">Test</th><th className="p-3">Status</th><th className="p-3">Marks</th><th className="p-3">Submitted</th><th className="p-3">View</th></tr></thead><tbody>
            {(wordAttempts ?? []).map((attempt) => { const version = wordTitleById.get(attempt.version_id); const result = attempt.result as Record<string, unknown> | null; const published = attempt.evaluation_status === "published"; return <tr key={attempt.id} className="border-b"><td className="p-3">{version?.title ?? "Unknown test"}</td><td className="p-3">{attempt.status}</td><td className="p-3">{published && result?.marksObtained != null ? `${result.marksObtained} / ${version?.maximum_marks ?? "?"}` : published ? "Not graded" : "Pending"}</td><td className="p-3">{attempt.submitted_at ? date(attempt.submitted_at) : "In progress"}</td><td className="p-3">{attempt.submitted_at && <EyeLink href={`/admin/word-efficiency-tests/attempts/${attempt.id}`} label="View/grade this attempt"/>}</td></tr>; })}
            {!wordAttempts?.length && <tr><td colSpan={5} className="p-6 text-center text-slate-500">No Word Efficiency attempts yet.</td></tr>}
          </tbody></table></div>
        </section>

        <section className="mt-6 rounded-2xl bg-white p-6 shadow">
          <h2 className="text-xl font-black">Excel Efficiency results</h2>
          <div className="mt-4 overflow-x-auto"><table className="w-full border-collapse text-left text-sm"><thead><tr className="bg-slate-100"><th className="p-3">Test</th><th className="p-3">Status</th><th className="p-3">Marks</th><th className="p-3">Submitted</th><th className="p-3">View</th></tr></thead><tbody>
            {(excelAttempts ?? []).map((attempt) => { const version = excelTitleById.get(attempt.version_id); const result = attempt.result as Record<string, unknown> | null; const published = attempt.evaluation_status === "published"; return <tr key={attempt.id} className="border-b"><td className="p-3">{version?.title ?? "Unknown test"}</td><td className="p-3">{attempt.status}</td><td className="p-3">{published && result?.marksObtained != null ? `${result.marksObtained} / ${version?.maximum_marks ?? "?"}` : published ? "Not graded" : "Pending"}</td><td className="p-3">{attempt.submitted_at ? date(attempt.submitted_at) : "In progress"}</td><td className="p-3">{attempt.submitted_at && <EyeLink href={`/admin/excel-efficiency-tests/attempts/${attempt.id}`} label="View/grade this attempt"/>}</td></tr>; })}
            {!excelAttempts?.length && <tr><td colSpan={5} className="p-6 text-center text-slate-500">No Excel Efficiency attempts yet.</td></tr>}
          </tbody></table></div>
        </section>
      </div>
    </main>
  );
}

function EyeLink({ href, label }: { href: string; label: string }) {
  return <Link href={href} title={label} aria-label={label} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 hover:text-blue-700"><svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z"/><circle cx="12" cy="12" r="3"/></svg></Link>;
}
function date(value: string | null) {
  return value ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(value)) : "Unavailable";
}
