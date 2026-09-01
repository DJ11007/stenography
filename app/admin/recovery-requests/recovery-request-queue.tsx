"use client";

import { useMemo, useState } from "react";
import { useActionState } from "react";
import { reviewRecoveryRequest, type RecoveryReviewState } from "./actions";

export type RecoveryRequestRow = {
  id: string;
  request_type: "student" | "admin";
  student_id_hint: string;
  institution_code: string;
  status: "pending" | "approved" | "rejected" | "expired" | "used";
  created_at: string;
  expires_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
};

const TABS = ["pending", "approved", "rejected", "all"] as const;
type Tab = (typeof TABS)[number];

const initial: RecoveryReviewState = {};

function date(value: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(value));
}

export function RecoveryRequestQueue({ requests }: { requests: RecoveryRequestRow[] }) {
  const [tab, setTab] = useState<Tab>("pending");
  const pendingCount = requests.filter((row) => row.status === "pending" && new Date(row.expires_at) > new Date()).length;
  const filtered = useMemo(() => (tab === "all" ? requests : requests.filter((row) => row.status === tab)), [requests, tab]);

  return (
    <section className="mt-6 rounded-2xl bg-white p-6 shadow">
      <div role="tablist" className="flex flex-wrap gap-2">
        {TABS.map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={tab === item}
            onClick={() => setTab(item)}
            className={`rounded-full px-4 py-1.5 text-sm font-black capitalize ${tab === item ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
          >
            {item}{item === "pending" && pendingCount > 0 ? ` (${pendingCount})` : ""}
          </button>
        ))}
      </div>

      <div className="mt-5 space-y-3">
        {filtered.length === 0 && <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-500">No {tab === "all" ? "" : tab} requests.</p>}
        {filtered.map((row) => <RequestCard key={row.id} row={row} />)}
      </div>
    </section>
  );
}

function RequestCard({ row }: { row: RecoveryRequestRow }) {
  const [state, action, pending] = useActionState(reviewRecoveryRequest, initial);
  const expired = row.status === "pending" && new Date(row.expires_at) <= new Date();
  const statusLabel = expired ? "expired" : row.status;
  const statusTone =
    statusLabel === "pending" ? "bg-amber-100 text-amber-800" :
    statusLabel === "approved" ? "bg-green-100 text-green-800" :
    statusLabel === "rejected" ? "bg-red-100 text-red-800" :
    "bg-slate-200 text-slate-600";

  return (
    <article className="rounded-xl border border-slate-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-black uppercase text-slate-600">{row.request_type}</span>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-black capitalize ${statusTone}`}>{statusLabel}</span>
          </div>
          <p className="mt-2 text-sm text-slate-700">
            Self-declared ID ends in <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono font-bold">{row.student_id_hint}</code>
          </p>
          <p className="mt-1 text-xs text-slate-500">Submitted {date(row.created_at)} &middot; expires {date(row.expires_at)}</p>
          {row.reviewed_at && <p className="mt-1 text-xs text-slate-500">Reviewed {date(row.reviewed_at)}</p>}
        </div>
        {row.status === "pending" && !expired && (
          <form action={action} className="flex shrink-0 gap-2">
            <input type="hidden" name="requestId" value={row.id} />
            <button name="decision" value="approved" disabled={pending} className="rounded-lg bg-green-600 px-4 py-2 text-sm font-black text-white hover:bg-green-700 disabled:opacity-60">{pending ? "Saving…" : "Approve"}</button>
            <button name="decision" value="rejected" disabled={pending} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-black text-white hover:bg-red-700 disabled:opacity-60">{pending ? "Saving…" : "Reject"}</button>
          </form>
        )}
      </div>
      {state.error && <p role="alert" className="mt-2 text-xs font-bold text-red-700">{state.error}</p>}
      {state.success && <p className="mt-2 text-xs font-bold text-green-700">{state.success}</p>}
    </article>
  );
}
