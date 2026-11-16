import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { BackButton } from "../../../_components/back-button";

export default async function AppControlEfficiencyPage() {
  await requireAdmin();
  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-4xl">
        <BackButton href="/admin/app-control" label="App control" />
        <div className="mt-5 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 p-7 text-white shadow-xl">
          <p className="text-xs font-black uppercase tracking-[.2em] text-blue-300">SCTyping desktop app</p>
          <h1 className="mt-2 text-3xl font-black">Efficiency Test</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-300">Choose Word or Excel. Adding new efficiency tests to the app from here is coming in a later update; for now you can show, hide or lock the tests the app already has.</p>
        </div>
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <Link href="/admin/app-control/word" className="rounded-2xl bg-white p-6 shadow transition hover:-translate-y-1 hover:shadow-lg"><h2 className="text-lg font-bold">Word Efficiency tests</h2><p className="mt-2 text-sm text-slate-600">Show, hide or lock each Word test.</p><span className="mt-5 inline-block rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-800">Manage →</span></Link>
          <Link href="/admin/app-control/excel" className="rounded-2xl bg-white p-6 shadow transition hover:-translate-y-1 hover:shadow-lg"><h2 className="text-lg font-bold">Excel Efficiency tests</h2><p className="mt-2 text-sm text-slate-600">Show, hide or lock each Excel test.</p><span className="mt-5 inline-block rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-800">Manage →</span></Link>
        </div>
        <p className="mt-5 text-sm text-slate-600">To create or upload the tests themselves on the website: <Link className="font-bold text-blue-700 underline" href="/admin/word-efficiency-tests">Word tests</Link> · <Link className="font-bold text-blue-700 underline" href="/admin/excel-efficiency-tests">Excel tests</Link></p>
      </div>
    </main>
  );
}
