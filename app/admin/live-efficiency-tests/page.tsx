import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Live Efficiency Test | Admin" };

// Word and Excel Efficiency are two completely separate systems (own
// tables, own admin editors) rather than one shared component like Typing/
// Stenography's TestManager -- this is a small chooser that deep-links into
// the existing, already-live-scheduling-enabled admin pages, mirroring how
// /admin/stenography-tests asks for a language before showing the list.
export default async function AdminLiveEfficiencyTestsPage() {
  await requireAdmin();
  return (
    <main className="min-h-screen bg-slate-100 p-4 sm:p-6">
      <div className="mx-auto max-w-3xl">
        <Link href="/admin" className="text-sm font-semibold text-blue-700">← Admin dashboard</Link>
        <h1 className="mt-2 text-3xl font-black">Live Efficiency Test</h1>
        <p className="mt-1 text-slate-600">Scheduled, free live Word or Excel Efficiency tests -- check "Free scheduled live test" on either editor below to give it a start/end/results window and put it on the public Live Test hub.</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Link href="/admin/word-efficiency-tests" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-400 hover:shadow-md">
            <h2 className="text-xl font-black text-slate-900">Word Efficiency</h2>
            <p className="mt-1 text-sm text-slate-600">Document-editing efficiency tests.</p>
          </Link>
          <Link href="/admin/excel-efficiency-tests" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-400 hover:shadow-md">
            <h2 className="text-xl font-black text-slate-900">Excel Efficiency</h2>
            <p className="mt-1 text-sm text-slate-600">Spreadsheet-editing efficiency tests.</p>
          </Link>
        </div>
      </div>
    </main>
  );
}
