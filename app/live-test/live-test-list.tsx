"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { liveTestState, type LiveTestState } from "@/lib/live-tests";
import { formatIST, formatISTDate, formatISTTime } from "@/lib/format-datetime";

type LiveTest = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  language: string;
  duration_seconds: number;
  live_starts_at: string | null;
  live_ends_at: string | null;
  results_publish_at: string | null;
  results_delay_minutes: number | null;
  is_live: boolean;
};

// Real reported problem: once 100+ live tests pile up, the old one-card-
// per-test layout (always showing Starts/Ends/Duration/Results expanded)
// takes forever to scan and mixes months-old closed tests in with what's
// actually coming up. Students only need a quick glance -- language,
// start time, duration, current status -- to decide whether to open a
// test; the exact end/results timestamps and description are useful but
// secondary, so they're tucked behind a "Details" toggle instead of
// always on screen. Grouping by calendar day plus a status/language
// filter keeps a long list navigable the same way the lesson catalogue
// and stenography task library already do it elsewhere in this app.
const STATUS_LABEL: Record<LiveTestState, string> = {
  ordinary: "—",
  upcoming: "Upcoming",
  open: "Open now",
  closed: "Closed",
  "results-published": "Results out",
  anytime: "Anytime",
};
const STATUS_BADGE: Record<LiveTestState, string> = {
  ordinary: "bg-slate-100 text-slate-600",
  upcoming: "bg-blue-100 text-blue-700",
  open: "bg-green-100 text-green-700",
  closed: "bg-slate-200 text-slate-500",
  "results-published": "bg-violet-100 text-violet-700",
  anytime: "bg-amber-100 text-amber-700",
};
const STATUS_ACCENT: Record<LiveTestState, string> = {
  ordinary: "bg-slate-300",
  upcoming: "bg-blue-500",
  open: "bg-green-500",
  closed: "bg-slate-300",
  "results-published": "bg-violet-500",
  anytime: "bg-amber-500",
};
const STATUS_TABS = ["anytime", "upcoming", "open", "results-published", "closed"] as const;

function dayKey(iso: string | null) {
  return iso ? formatISTDate(iso, { year: "numeric", month: "2-digit", day: "2-digit" }) || "unscheduled" : "unscheduled";
}
function dayHeading(iso: string | null) {
  return iso ? formatISTDate(iso, { weekday: "short", day: "numeric", month: "short", year: "numeric" }) || "Unscheduled" : "Unscheduled";
}

export function LiveTestList({ tests }: { tests: LiveTest[] }) {
  const [language, setLanguage] = useState<"All" | string>("All");
  const [status, setStatus] = useState<"All" | LiveTestState>("All");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const languages = useMemo(() => [...new Set(tests.map((test) => test.language))], [tests]);

  const withState = useMemo(
    () => tests.map((test) => ({ test, state: liveTestState({ isLive: test.is_live, startsAt: test.live_starts_at, endsAt: test.live_ends_at, resultsPublishAt: test.results_publish_at, resultsDelayMinutes: test.results_delay_minutes }) })),
    [tests],
  );

  const filtered = useMemo(
    () => withState
      .filter(({ test, state }) => (language === "All" || test.language === language) && (status === "All" || state === status))
      .sort((a, b) => {
        const at = a.test.live_starts_at ? new Date(a.test.live_starts_at).getTime() : 0;
        const bt = b.test.live_starts_at ? new Date(b.test.live_starts_at).getTime() : 0;
        return sort === "newest" ? bt - at : at - bt;
      }),
    [withState, language, status, sort],
  );

  // Anytime tests have no live_starts_at to group/sort by, and "always
  // attemptable" is more useful pinned at the very top than scattered to
  // whichever end of the list a null timestamp happens to sort to --
  // students shouldn't have to hunt for them depending on the Newest/
  // Oldest toggle.
  const groups = useMemo(() => {
    const anytimeItems = filtered.filter(({ state }) => state === "anytime");
    const scheduledItems = filtered.filter(({ state }) => state !== "anytime");
    const map = new Map<string, { heading: string; items: typeof filtered }>();
    for (const item of scheduledItems) {
      const key = dayKey(item.test.live_starts_at);
      if (!map.has(key)) map.set(key, { heading: dayHeading(item.test.live_starts_at), items: [] });
      map.get(key)!.items.push(item);
    }
    const dayGroups = [...map.values()];
    return anytimeItems.length ? [{ heading: "Available anytime", items: anytimeItems }, ...dayGroups] : dayGroups;
  }, [filtered]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <div role="tablist" aria-label="Filter by status" className="flex flex-wrap gap-2">
          <StatusTab label="All" active={status === "All"} onClick={() => setStatus("All")} />
          {STATUS_TABS.map((value) => <StatusTab key={value} label={STATUS_LABEL[value]} active={status === value} onClick={() => setStatus(value)} />)}
        </div>
        <select aria-label="Sort tests" value={sort} onChange={(event) => setSort(event.target.value as "newest" | "oldest")} className="input ml-auto w-auto">
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select>
      </div>
      {languages.length > 1 && (
        <div role="tablist" aria-label="Filter by language" className="mt-2 flex flex-wrap gap-2">
          <button type="button" role="tab" aria-selected={language === "All"} onClick={() => setLanguage("All")} className={`rounded-full px-3 py-1 text-xs font-black ${language === "All" ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>All languages</button>
          {languages.map((lang) => <button key={lang} type="button" role="tab" aria-selected={language === lang} onClick={() => setLanguage(lang)} className={`rounded-full px-3 py-1 text-xs font-black ${language === lang ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>{lang}</button>)}
        </div>
      )}
      {groups.length === 0 && <p className="mt-6 rounded-2xl bg-white p-7 text-center text-slate-600 shadow">No live test matches this view.</p>}
      <div className="mt-6 space-y-7">
        {groups.map((group) => (
          <div key={group.heading}>
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">{group.heading}</h3>
            <div className="mt-3 grid items-start justify-items-start gap-3 grid-cols-[repeat(auto-fill,minmax(250px,max-content))]">
              {group.items.map(({ test, state }) => <LiveTestCard key={test.id} test={test} state={state} />)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return <button type="button" role="tab" aria-selected={active} onClick={onClick} className={`rounded-full px-3 py-1.5 text-xs font-black ${active ? "bg-red-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>{label}</button>;
}

function LiveTestCard({ test, state }: { test: LiveTest; state: LiveTestState }) {
  const [open, setOpen] = useState(false);
  const action = state === "open" || state === "anytime" ? "Start test" : state === "upcoming" ? "Schedule" : state === "results-published" ? "Results" : "Closed";
  return (
    <article className="relative w-full max-w-xs overflow-hidden rounded-xl border border-slate-200 bg-white pl-3.5 shadow-sm">
      <span className={`absolute inset-y-0 left-0 w-1.5 ${STATUS_ACCENT[state]}`} aria-hidden="true"/>
      <div className="p-3 pl-0">
        <div className="flex items-center justify-between gap-2">
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-black text-red-700">LIVE</span>
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${STATUS_BADGE[state]}`}>{STATUS_LABEL[state]}</span>
        </div>
        <h3 className="mt-2 line-clamp-2 text-[15px] font-black leading-5 text-slate-950">{test.title}</h3>
        <p className="mt-1.5 text-xs font-semibold text-slate-500">
          <span>{test.language}</span>
          <span className="mx-1.5 text-slate-300">•</span>
          <span>{Math.round(test.duration_seconds / 60)} min</span>
          {state === "anytime"
            ? <><span className="mx-1.5 text-slate-300">•</span><span>Results in {test.results_delay_minutes} min</span></>
            : test.live_starts_at && <><span className="mx-1.5 text-slate-300">•</span><span>{formatISTTime(test.live_starts_at, { hour: "numeric", minute: "2-digit", hour12: true })}</span></>}
        </p>
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-2.5">
          <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="flex items-center gap-1 text-xs font-black text-blue-700">
            <span className={`inline-block text-[9px] transition-transform ${open ? "rotate-90" : ""}`} aria-hidden="true">▶</span>Details
          </button>
          <Link href={state === "results-published" ? "/live-test" : `/tests/${test.slug}`} aria-disabled={state === "closed"} className={`rounded-lg px-4 py-1.5 text-center text-xs font-black ${state === "open" || state === "anytime" ? "bg-green-600 text-white" : state === "closed" ? "pointer-events-none bg-slate-100 text-slate-400" : "bg-blue-600 text-white"}`}>{action}</Link>
        </div>
        {open && (
          <dl className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1.5 rounded-lg bg-slate-50 p-2.5 text-[11px]">
            {state === "anytime" ? (
              <div className="col-span-2"><dt className="text-slate-400">Availability</dt><dd className="font-bold text-slate-700">Any day, any time · your result unlocks {test.results_delay_minutes} minutes after you submit</dd></div>
            ) : (<>
              <div><dt className="text-slate-400">Starts</dt><dd className="font-bold text-slate-700">{formatIST(test.live_starts_at) || "—"}</dd></div>
              <div><dt className="text-slate-400">Ends</dt><dd className="font-bold text-slate-700">{formatIST(test.live_ends_at) || "—"}</dd></div>
              <div className="col-span-2"><dt className="text-slate-400">Results</dt><dd className="font-bold text-slate-700">{formatIST(test.results_publish_at) || "—"}</dd></div>
            </>)}
            {test.description && <div className="col-span-2"><dt className="text-slate-400">Note</dt><dd className="text-slate-600">{test.description}</dd></div>}
          </dl>
        )}
      </div>
    </article>
  );
}
