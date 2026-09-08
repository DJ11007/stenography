import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { StudentActionButtons } from "../student-action-buttons";
import { StudentAccessControls } from "../student-access-controls";
import { AccessStatusBadge, validityLabel, type StudentAccessStatus } from "../access-status-badge";
import { BackButton } from "../../../_components/back-button";

export const metadata: Metadata = { title: "Student Profile | Admin" };

export default async function AdminStudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const supabase = await createClient();

  const { data: student } = await supabase.from("profiles").select("id,email,full_name,phone,role,is_active,approved,created_at,class_info,free_practice_test_limit").eq("id", id).maybeSingle();
  if (!student) notFound();

  const admin = createAdminClient();
  let emailConfirmed = true, lastSignInAt: string | null = null, bannedUntil: string | null = null;
  if (admin) {
    const { data } = await admin.auth.admin.getUserById(id);
    emailConfirmed = Boolean(data.user?.email_confirmed_at);
    lastSignInAt = data.user?.last_sign_in_at ?? null;
    bannedUntil = data.user?.banned_until ?? null;
  }

  const { data: accessRows } = await supabase.rpc("student_access_status", { p_student_id: id });
  const access = ((accessRows ?? [])[0] ?? null) as StudentAccessStatus | null;

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

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-5xl">
        <BackButton href="/admin/students" label="Students" />

        <section className="mt-4 rounded-2xl bg-white p-6 shadow">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-black">{student.full_name || "(no name)"}</h1>
              <dl className="mt-3 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
                <Field label="Email" value={student.email} />
                <Field label="Phone" value={student.phone || "Not provided"} />
                <Field label="Joined" value={date(student.created_at)} />
                <Field label="Last sign-in" value={lastSignInAt ? date(lastSignInAt) : "Never"} />
                <Field label="Account status" value={student.is_active ? "Active" : "Deactivated"} />
                <Field label="Admin approval" value={student.approved ? "Approved" : "Pending approval"} />
                <Field label="Email confirmation" value={emailConfirmed ? "Confirmed" : "Not confirmed"} />
                <Field label="Class info" value={student.class_info || "Not set"} />
                {bannedUntil && <Field label="Banned until" value={date(bannedUntil)} />}
                <div><dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Test access</dt><dd className="mt-1 flex items-center gap-2"><AccessStatusBadge access={access} />{access?.test_limit != null && <span className="text-slate-600">{access.tests_remaining}/{access.test_limit} left</span>}</dd></div>
                <Field label="Validity" value={validityLabel(access)} />
              </dl>
              <p className="mt-4 max-w-md text-xs text-slate-500">Passwords are never stored or shown in plain text by this or any secure system — use &quot;Send password reset link&quot; below if this student is locked out.</p>
            </div>
            <StudentActionButtons studentId={student.id} emailConfirmed={emailConfirmed} isActive={student.is_active} approved={student.approved} />
          </div>
          <div className="mt-5">
            <StudentAccessControls studentId={student.id} testLimit={access?.test_limit ?? null} validityDays={access?.validity_expires_at ? Math.max(0, Math.ceil((new Date(access.validity_expires_at).getTime() - Date.now()) / 86400000)) : null} graceDays={access?.grace_days ?? 0} accessLocked={access?.access_locked ?? false} classInfo={student.class_info} freePracticeLimit={student.free_practice_test_limit} />
          </div>
        </section>

        <section className="mt-6 rounded-2xl bg-white p-6 shadow">
          <h2 className="text-xl font-black">Typing / Practice / Exam / Stenography results</h2>
          <div className="mt-4 overflow-x-auto"><table className="w-full border-collapse text-left text-sm"><thead><tr className="bg-slate-100"><th className="p-3">Test</th><th className="p-3">Mode</th><th className="p-3">Net WPM</th><th className="p-3">Accuracy</th><th className="p-3">Submitted</th></tr></thead><tbody>
            {(typingAttempts ?? []).map((attempt) => { const test = typingTitleById.get(attempt.test_id); const result = attempt.result as Record<string, unknown> | null; return <tr key={attempt.id} className="border-b"><td className="p-3">{test?.title ?? "Unknown test"}</td><td className="p-3">{test?.mode ?? "—"}</td><td className="p-3">{result?.netWpm != null ? String(result.netWpm) : "—"}</td><td className="p-3">{result?.accuracy != null ? `${result.accuracy}%` : "—"}</td><td className="p-3">{attempt.submitted_at ? date(attempt.submitted_at) : "In progress"}</td></tr>; })}
            {!typingAttempts?.length && <tr><td colSpan={5} className="p-6 text-center text-slate-500">No typing attempts yet.</td></tr>}
          </tbody></table></div>
        </section>

        <section className="mt-6 rounded-2xl bg-white p-6 shadow">
          <h2 className="text-xl font-black">Word Efficiency results</h2>
          <div className="mt-4 overflow-x-auto"><table className="w-full border-collapse text-left text-sm"><thead><tr className="bg-slate-100"><th className="p-3">Test</th><th className="p-3">Status</th><th className="p-3">Marks</th><th className="p-3">Submitted</th></tr></thead><tbody>
            {(wordAttempts ?? []).map((attempt) => { const version = wordTitleById.get(attempt.version_id); const result = attempt.result as Record<string, unknown> | null; const published = attempt.evaluation_status === "published"; return <tr key={attempt.id} className="border-b"><td className="p-3">{version?.title ?? "Unknown test"}</td><td className="p-3">{attempt.status}</td><td className="p-3">{published && result?.marksObtained != null ? `${result.marksObtained} / ${version?.maximum_marks ?? "?"}` : published ? "Not graded" : "Pending"}</td><td className="p-3">{attempt.submitted_at ? date(attempt.submitted_at) : "In progress"}</td></tr>; })}
            {!wordAttempts?.length && <tr><td colSpan={4} className="p-6 text-center text-slate-500">No Word Efficiency attempts yet.</td></tr>}
          </tbody></table></div>
        </section>

        <section className="mt-6 rounded-2xl bg-white p-6 shadow">
          <h2 className="text-xl font-black">Excel Efficiency results</h2>
          <div className="mt-4 overflow-x-auto"><table className="w-full border-collapse text-left text-sm"><thead><tr className="bg-slate-100"><th className="p-3">Test</th><th className="p-3">Status</th><th className="p-3">Marks</th><th className="p-3">Submitted</th></tr></thead><tbody>
            {(excelAttempts ?? []).map((attempt) => { const version = excelTitleById.get(attempt.version_id); const result = attempt.result as Record<string, unknown> | null; const published = attempt.evaluation_status === "published"; return <tr key={attempt.id} className="border-b"><td className="p-3">{version?.title ?? "Unknown test"}</td><td className="p-3">{attempt.status}</td><td className="p-3">{published && result?.marksObtained != null ? `${result.marksObtained} / ${version?.maximum_marks ?? "?"}` : published ? "Not graded" : "Pending"}</td><td className="p-3">{attempt.submitted_at ? date(attempt.submitted_at) : "In progress"}</td></tr>; })}
            {!excelAttempts?.length && <tr><td colSpan={4} className="p-6 text-center text-slate-500">No Excel Efficiency attempts yet.</td></tr>}
          </tbody></table></div>
        </section>
      </div>
    </main>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</dt><dd className="font-bold text-slate-900">{value}</dd></div>;
}
function date(value: string | null) {
  return value ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(value)) : "Unavailable";
}
