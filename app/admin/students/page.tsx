import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { StudentActionButtons } from "./student-action-buttons";

export const metadata: Metadata = { title: "Students | Admin" };

type Profile = { id: string; email: string; full_name: string | null; phone: string | null; role: string; is_active: boolean; created_at: string };

export default async function AdminStudentsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const params = await searchParams;
  const search = (params.search ?? "").trim();

  const supabase = await createClient();
  const base = () => supabase.from("profiles").select("id,email,full_name,phone,role,is_active,created_at").eq("role", "student").order("created_at", { ascending: false });
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

  const rows = (students ?? []).map((student) => ({ student, status: authStatus.get(student.id) ?? { emailConfirmed: true, lastSignInAt: null } }));
  const unconfirmedCount = rows.filter((row) => !row.status.emailConfirmed).length;
  const neverSignedInCount = rows.filter((row) => !row.status.lastSignInAt).length;

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-900 p-6 text-white shadow">
          <div>
            <p className="text-sm font-semibold text-blue-300">SAMRADHI CLASSES</p>
            <h1 className="text-2xl font-bold">Students</h1>
            <p className="mt-1 text-slate-300">{rows.length} student{rows.length === 1 ? "" : "s"} · {unconfirmedCount} unconfirmed · {neverSignedInCount} never signed in</p>
          </div>
          <Link href="/admin" className="rounded-lg bg-white/10 px-4 py-2 font-semibold hover:bg-white/20">← Back to admin panel</Link>
        </header>

        {!admin && (
          <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm font-bold text-amber-900">
            Email confirmation status and manual-confirm/resend tools need the SUPABASE_SERVICE_ROLE_KEY environment variable on the server — it is not set, so those columns and actions are hidden below.
          </p>
        )}

        <form className="mt-6 flex gap-2" role="search">
          <input name="search" defaultValue={search} placeholder="Search by name or email" className="w-full max-w-sm rounded-lg border border-slate-300 px-4 py-2" />
          <button className="rounded-lg bg-blue-700 px-5 font-bold text-white">Search</button>
          {search && <Link href="/admin/students" className="rounded-lg bg-slate-200 px-4 py-2 font-bold text-slate-700">Clear</Link>}
        </form>

        <div className="mt-6 overflow-x-auto rounded-2xl bg-white shadow">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="bg-slate-100">
                <th className="p-3">Name</th>
                <th className="p-3">Email</th>
                <th className="p-3">Phone</th>
                <th className="p-3">Status</th>
                <th className="p-3">Joined</th>
                <th className="p-3">Last sign-in</th>
                {admin && <th className="p-3">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ student, status }) => (
                <tr key={student.id} className="border-b align-top">
                  <td className="p-3 font-bold"><Link href={`/admin/students/${student.id}`} className="text-blue-700 hover:underline">{student.full_name || "(no name)"}</Link></td>
                  <td className="p-3">{student.email}</td>
                  <td className="p-3">{student.phone || <span className="text-slate-400">Not provided</span>}</td>
                  <td className="p-3">
                    <div className="flex flex-col gap-1">
                      <span className={`inline-flex w-fit rounded-full px-2 py-0.5 text-xs font-bold ${student.is_active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>{student.is_active ? "Active" : "Deactivated"}</span>
                      {admin && <span className={`inline-flex w-fit rounded-full px-2 py-0.5 text-xs font-bold ${status.emailConfirmed ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-900"}`}>{status.emailConfirmed ? "Email confirmed" : "Email not confirmed"}</span>}
                    </div>
                  </td>
                  <td className="p-3">{date(student.created_at)}</td>
                  <td className="p-3">{status.lastSignInAt ? date(status.lastSignInAt) : <span className="text-slate-400">Never</span>}</td>
                  {admin && <td className="p-3"><StudentActionButtons studentId={student.id} emailConfirmed={status.emailConfirmed} isActive={student.is_active} /></td>}
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={7} className="p-6 text-center text-slate-500">No students match this search.</td></tr>}
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
