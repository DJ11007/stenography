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

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3"><BackButton href="/admin/students" label="Students" /><Link href={`/admin/track/${student.id}`} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-black text-white hover:bg-blue-800">View all test results →</Link></div>

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
