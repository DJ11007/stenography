import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { StudentActionButtons } from "./student-action-buttons";
import { StudentAccessLockButton } from "./student-access-controls";
import { AccessStatusBadge, validityLabel, type AccessRow } from "./access-status-badge";
import { BackButton } from "../../_components/back-button";

export const metadata: Metadata = { title: "Students | Admin" };

type Profile = { id: string; email: string; full_name: string | null; phone: string | null; role: string; is_active: boolean; approved: boolean; created_at: string; class_info: string | null };

export default async function AdminStudentsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const params = await searchParams;
  const search = (params.search ?? "").trim();
  const statusFilter = params.statusFilter ?? "all";
  const accessFilter = params.accessFilter ?? "all";

  const supabase = await createClient();
  const base = () => supabase.from("profiles").select("id,email,full_name,phone,role,is_active,approved,created_at,class_info").eq("role", "student").order("created_at", { ascending: false });
  let students: Profile[] | null;
  let error: { message: string } | null = null;
  if (search) {
    // Two separate ilike queries merged in JS, instead of building a raw PostgREST
    // .or() filter string, so a name or email containing "," "(" ")" (special to
    // that filter syntax) can never be misparsed as extra filter clauses.
    const escaped = `%${search.replace(/[%_]/g, "\\$&")}%`;
    const [byName, byEmail] = await Promise.all([base().ilike("full_name", escaped), base().ilike("email", escaped)]);
    error = byName.error ?? byEmail.error;
    const merged = new Map((byName.data ?? []).map((row) => [row.id, row] as const));
    for (const row of byEmail.data ?? []) merged.set(row.id, row);
    students = [...merged.values()].sort((a, b) => b.created_at.localeCompare(a.created_at));
  } else {
    const result = await base();
    students = result.data;
    error = result.error;
  }
  if (error) throw new Error(`Could not load students: ${error.message}`);

  const admin = createAdminClient();
  const authStatus = new Map<string, { emailConfirmed: boolean; lastSignInAt: string | null }>();
  if (admin) {
    const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
    for (const authUser of data?.users ?? []) {
      authStatus.set(authUser.id, { emailConfirmed: Boolean(authUser.email_confirmed_at), lastSignInAt: authUser.last_sign_in_at ?? null });
    }
  }

  const { data: accessRows } = await supabase.rpc("admin_list_student_access");
  const accessByStudent = new Map<string, AccessRow>(((accessRows ?? []) as AccessRow[]).map((row) => [row.student_id, row]));

  const rows = (students ?? []).map((student) => ({ student, status: authStatus.get(student.id) ?? { emailConfirmed: true, lastSignInAt: null }, access: accessByStudent.get(student.id) ?? null }));
  const pendingApprovalCount = rows.filter((row) => !row.student.approved).length;
  const unconfirmedCount = rows.filter((row) => !row.status.emailConfirmed).length;
  const neverSignedInCount = rows.filter((row) => !row.status.lastSignInAt).length;
  const activeCount = rows.filter((row) => row.access?.status === "active").length;
  const graceCount = rows.filter((row) => row.access?.status === "grace").length;
  const lockedCount = rows.filter((row) => row.access?.status === "locked").length;

  // Two independent dropdown filters, matching a reference admin's
  // "All-Status" + "Membership" pair -- account status (approval/active/
  // confirmation) is a different axis from test-access status (active/
  // grace/locked), so both stay separate rather than one combined filter.
  // Stat cards above stay computed from the full, unfiltered `rows`.
  const visibleRows = rows.filter((row) => {
    const statusOk = statusFilter === "all"
      || (statusFilter === "pending" && !row.student.approved)
      || (statusFilter === "active" && row.student.approved && row.student.is_active)
      || (statusFilter === "deactivated" && !row.student.is_active)
      || (statusFilter === "unconfirmed" && !row.status.emailConfirmed);
    const accessOk = accessFilter === "all" || row.access?.status === accessFilter;
    return statusOk && accessOk;
  });

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-900 p-6 text-white shadow">
          <div>
            <p className="text-sm font-semibold text-blue-300">SAMRADHI CLASSES</p>
            <h1 className="text-2xl font-bold">Students</h1>
            <p className="mt-1 text-slate-300">{rows.length} student{rows.length === 1 ? "" : "s"} · {pendingApprovalCount} pending approval · {unconfirmedCount} unconfirmed · {neverSignedInCount} never signed in</p>
          </div>
          <BackButton href="/admin" label="Admin panel" dark />
        </header>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Total users" value={rows.length} />
          <StatCard label="Pending approval" value={pendingApprovalCount} tone="amber" />
          <StatCard label="Active" value={activeCount} tone="green" />
          <StatCard label="Grace" value={graceCount} tone="amber" />
          <StatCard label="Locked" value={lockedCount} tone="red" />
        </div>

        {!admin && (
          <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm font-bold text-amber-900">
            Email confirmation status and the manual-confirm-email tool need the SUPABASE_SERVICE_ROLE_KEY environment variable on the server — it is not set, so that column and that tool are hidden below. (Setting a student&apos;s password directly still works without it.)
          </p>
        )}

        <form className="mt-6 flex flex-wrap items-end gap-2" role="search">
          <label className="text-xs font-bold text-slate-600">Search
            <input name="search" defaultValue={search} placeholder="Name or email" className="mt-1 block w-full max-w-sm rounded-lg border border-slate-300 px-4 py-2" />
          </label>
          <label className="text-xs font-bold text-slate-600">Status
            <select name="statusFilter" defaultValue={statusFilter} className="mt-1 block rounded-lg border border-slate-300 px-3 py-2">
              <option value="all">All statuses</option>
              <option value="pending">Pending approval</option>
              <option value="active">Active</option>
              <option value="deactivated">Deactivated</option>
              <option value="unconfirmed">Unconfirmed email</option>
            </select>
          </label>
          <label className="text-xs font-bold text-slate-600">Test access
            <select name="accessFilter" defaultValue={accessFilter} className="mt-1 block rounded-lg border border-slate-300 px-3 py-2">
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="grace">Grace</option>
              <option value="locked">Locked</option>
            </select>
          </label>
          <button className="rounded-lg bg-blue-700 px-5 py-2 font-bold text-white">Apply</button>
          {(search || statusFilter !== "all" || accessFilter !== "all") && <Link href="/admin/students" className="rounded-lg bg-slate-200 px-4 py-2 font-bold text-slate-700">Clear</Link>}
        </form>

        <div className="mt-6 overflow-x-auto rounded-2xl bg-white shadow">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="bg-slate-100">
                <th className="p-2">User</th>
                <th className="p-2">Status</th>
                <th className="p-2">Test limit</th>
                <th className="p-2">Validity</th>
                <th className="p-2">Manage</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map(({ student, status, access }) => (
                <tr key={student.id} className="border-b align-top">
                  <td className="p-2">
                    <Link href={`/admin/students/${student.id}`} className="font-bold text-blue-700 hover:underline">{student.full_name || "(no name)"}</Link>
                    <p className="text-slate-500">{student.email}</p>
                    <p className="text-slate-400">{student.phone || "No phone"} · Joined {date(student.created_at)} · Last in {status.lastSignInAt ? date(status.lastSignInAt) : "Never"}</p>
                  </td>
                  <td className="p-2">
                    <div className="flex flex-col gap-1">
                      {!student.approved && <span className="inline-flex w-fit rounded-full bg-amber-100 px-2 py-0.5 font-bold text-amber-900">Pending approval</span>}
                      <span className={`inline-flex w-fit rounded-full px-2 py-0.5 font-bold ${student.is_active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>{student.is_active ? "Active" : "Deactivated"}</span>
                      {admin && <span className={`inline-flex w-fit rounded-full px-2 py-0.5 font-bold ${status.emailConfirmed ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-900"}`}>{status.emailConfirmed ? "Email confirmed" : "Email not confirmed"}</span>}
                      <AccessStatusBadge access={access} />
                    </div>
                  </td>
                  <td className="p-2">{access?.test_limit != null ? `${access.tests_remaining}/${access.test_limit} left` : "Unlimited"}<p className="text-slate-400">{access ? `${access.tests_today}/${access.tests_total} tests` : "—"}</p></td>
                  <td className="p-2">{validityLabel(access)}</td>
                  <td className="p-2">
                    <div className="flex flex-wrap items-start gap-1">
                      <Link href={`/admin/students/${student.id}`} title="View / edit profile" aria-label="View / edit profile" className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-sm font-black text-slate-800 hover:bg-slate-200">👁</Link>
                      <StudentAccessLockButton studentId={student.id} accessLocked={access?.access_locked ?? false} />
                      <StudentActionButtons studentId={student.id} emailConfirmed={status.emailConfirmed} isActive={student.is_active} approved={student.approved} compact />
                    </div>
                  </td>
                </tr>
              ))}
              {!visibleRows.length && <tr><td colSpan={5} className="p-6 text-center text-slate-500">No students match these filters.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}

function date(value: string | null) {
  return value ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(value)) : "Unavailable";
}

function StatCard({ label, value, tone }: { label: string; value: number; tone?: "green" | "amber" | "red" }) {
  const toneClass = tone === "green" ? "text-green-700" : tone === "amber" ? "text-amber-700" : tone === "red" ? "text-red-700" : "text-slate-900";
  return <div className="rounded-2xl bg-white p-4 shadow"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p><p className={`mt-1 text-3xl font-black ${toneClass}`}>{value}</p></div>;
}
