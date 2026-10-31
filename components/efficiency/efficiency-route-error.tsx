"use client";

import { useEffect } from "react";
import { isStaleServerActionError } from "@/lib/pending-attempts";

// Error screen for the Excel Efficiency pages (student and admin). After a deploy, a page that was already open
// calls actions the server no longer knows ("Server Action ... was not found", a 404). That is not a real failure:
// the page reloads itself once and works again. Any other error shows a Try again button.
export function EfficiencyRouteError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const stale = isStaleServerActionError(error);
  useEffect(() => {
    if (!stale) return;
    let recent = false;
    try { recent = Date.now() - Number(sessionStorage.getItem("efficiency-deploy-reload") ?? 0) < 60_000; sessionStorage.setItem("efficiency-deploy-reload", String(Date.now())); } catch { recent = true; }
    if (!recent) window.location.reload();
  }, [stale]);
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-16">
      <section role="alert" className="mx-auto max-w-2xl rounded-3xl border border-amber-200 bg-white p-8 text-center shadow-lg">
        <h1 className="text-2xl font-black text-slate-950">{stale ? "This page was updated" : "Something went wrong"}</h1>
        <p className="mt-3 text-slate-600">{stale ? "A newer version of the website was published while this page was open. Reloading the page fixes it; your saved work is safe." : "The page could not finish that step. Please try again."}</p>
        <button type="button" onClick={() => (stale ? window.location.reload() : retry())} className="mt-6 rounded-xl bg-emerald-700 px-6 py-3 font-black text-white hover:bg-emerald-800">{stale ? "Reload page" : "Try again"}</button>
      </section>
    </main>
  );
}
