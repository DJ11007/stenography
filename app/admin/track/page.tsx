import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AccessStatusBadge, validityLabel, type AccessRow } from "../students/access-status-badge";
import { BackButton } from "../../_components/back-button";

export const metadata: Metadata = { title: "Track | Admin" };

export default async function AdminTrackPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const params = await searchParams;
  const search = (params.search ?? "").trim().toLowerCase();

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_student_access");
  if (error) throw new Error(`Could not load tracker: ${error.message}`);
  const all = (data ?? []) as AccessRow[];
  const rows = search ? all.filter((row) => (row.full_name ?? "").toLowerCase().includes(search) || row.email.toLowerCase().includes(search)) : all;

  const totalStudents = all.length;
  const testsGivenToday = all.filter((row) => row.tests_today > 0).length;
  const noTestToday = totalStudents - testsGivenToday;
  const trackingDate = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" }).format(new Date());

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-900 p-6 text-white shadow">
          <div>
            <p className="text-sm font-semibold text-blue-300">SAMRADHI CLASSES</p>
            <h1 className="text-2xl font-bold">Track</h1>
            <p className="mt-1 text-slate-300">Live tracker and daily activity summary.</p>
          </div>
          <BackButton href="/admin" label="Admin panel" dark />
        </header>

        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <Stat label="Total students" value={String(totalStudents)} />
          <Stat label="Test given today" value={String(testsGivenToday)} />
          <Stat label="No test today" value={String(noTestToday)} />
          <Stat label="Tracking date" value={trackingDate} />
        </div>

        <form className="mt-6 flex gap-2" role="search">
          <input name="search" defaultValue={search} placeholder="Search user by name or email" className="w-full max-w-sm rounded-lg border border-slate-300 px-4 py-2" />
          <button className="rounded-lg bg-blue-700 px-5 font-bold text-white">Search</button>
          {search && <Link href="/admin/track" className="rounded-lg bg-slate-200 px-4 py-2 font-bold text-slate-700">Clear</Link>}
        </form>

        <div className="mt-6 overflow-x-auto rounded-2xl bg-white shadow">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="bg-slate-100">
                <th className="p-3">S.No.</th>
                <th className="p-3">User</th>
                <th className="p-3">Today</th>
                <th className="p-3">All tests</th>
                <th className="p-3">Score</th>
                <th className="p-3">Validity</th>
                <th className="p-3">Status</th>
                <th className="p-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.student_id} className="border-b align-top">
                  <td className="p-3">{index + 1}</td>
                  <td className="p-3"><Link href={`/admin/track/${row.student_id}`} className="font-bold text-blue-700 hover:underline">{row.full_name || "(no name)"}</Link><br /><span className="text-xs text-slate-500">{row.email}</span></td>
                  <td className="p-3">{row.tests_today}</td>
                  <td className="p-3">{row.tests_total}</td>
                  <td className="p-3">{row.avg_score != null ? `${row.avg_score}%` : "—"}</td>
                  <td className="p-3">{validityLabel(row)}</td>
                  <td className="p-3"><AccessStatusBadge access={row} /></td>
                  <td className="p-3"><Link href={`/admin/students/${row.student_id}`} className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200">Manage</Link></td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={8} className="p-6 text-center text-slate-500">No students match this search.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-white p-4 shadow"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-2xl font-black text-slate-950">{value}</p></div>;
}
