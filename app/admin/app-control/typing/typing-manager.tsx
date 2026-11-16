"use client";

import { useMemo, useState, useTransition } from "react";
import { addWebsiteTestsToApp, saveAppTest, updateAppTests, type AppTestActionState } from "./actions";

export type WebsiteTestRow = { id: string; title: string; language: string; mode: string; minutes: number; board: string | null };
export type AppTestRow = { id: string; source_test_id: string | null; title: string; language: string; mode: string; board: string | null; duration_seconds: number; required_wpm: number | null; required_accuracy: number | null; backspace_mode: string; encoding: string; published: boolean; words: number };

type Tab = "add" | "create" | "inapp";
const field = "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900";
const emptyForm = { id: null as string | null, title: "", language: "English", mode: "exam", minutes: "10", wpm: "", accuracy: "", backspace: "full", passage: "" };

export function TypingAppManager({ available, inApp }: { available: WebsiteTestRow[]; inApp: AppTestRow[] }) {
  const [tab, setTab] = useState<Tab>("add");
  const [state, setState] = useState<AppTestActionState>({});
  const [pending, start] = useTransition();
  const run = (job: () => Promise<AppTestActionState>, after?: () => void) => start(async () => { const result = await job(); setState(result); if (!result.error) after?.(); });

  // Add from website
  const [query, setQuery] = useState("");
  const [lang, setLang] = useState("all");
  const [kind, setKind] = useState("all");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const shown = useMemo(() => available.filter((t) => (lang === "all" || t.language === lang) && (kind === "all" || t.mode === kind) && t.title.toLowerCase().includes(query.trim().toLowerCase())), [available, lang, kind, query]);
  const toggle = (id: string) => setPicked((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  // Create / edit
  const [form, setForm] = useState(emptyForm);
  const edit = (t: AppTestRow) => setForm({ id: t.id, title: t.title, language: t.language, mode: t.mode, minutes: String(Math.round(t.duration_seconds / 60)), wpm: t.required_wpm == null ? "" : String(t.required_wpm), accuracy: t.required_accuracy == null ? "" : String(t.required_accuracy), backspace: t.backspace_mode, passage: "" });
  const num = (value: string) => (value.trim() === "" || !Number.isFinite(Number(value)) ? null : Number(value));

  const tabButton = (id: Tab, label: string) => (
    <button type="button" onClick={() => { setTab(id); setState({}); }} className={`rounded-full px-5 py-2 text-sm font-bold ${tab === id ? "bg-blue-700 text-white" : "bg-white text-slate-700 shadow"}`}>{label}</button>
  );

  return (
    <div className="mt-6">
      <div className="flex flex-wrap gap-2">
        {tabButton("add", `1. Add from website tests (${available.length})`)}
        {tabButton("create", form.id ? "2. Edit test" : "2. Create a new test")}
        {tabButton("inapp", `3. Tests in the app (${inApp.length})`)}
      </div>
      {(state.error || state.success) && <p role="status" className={`mt-4 rounded-xl px-4 py-3 text-sm font-semibold ${state.error ? "bg-rose-50 text-rose-800" : "bg-emerald-50 text-emerald-800"}`}>{state.error ?? state.success}</p>}

      {tab === "add" && (
        <section className="mt-4 rounded-2xl bg-white p-6 shadow">
          <h2 className="text-lg font-black text-slate-900">Add tests you made on the website</h2>
          <p className="mt-1 text-sm text-slate-600">Tick the tests to send to the app, then press <b>Add to app</b>. The passage, time, speed and accuracy are copied. Tests already in the app are not shown here.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name…" className={field} />
            <select value={lang} onChange={(e) => setLang(e.target.value)} className={field}><option value="all">English + Hindi</option><option>English</option><option>Hindi</option></select>
            <select value={kind} onChange={(e) => setKind(e.target.value)} className={field}><option value="all">Exam + Practice</option><option value="exam">Exam tests</option><option value="practice">Practice tests</option></select>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-bold">
            <button type="button" onClick={() => setPicked(new Set([...picked, ...shown.map((t) => t.id)]))} className="rounded-full bg-slate-100 px-3 py-1">Tick all {shown.length} shown</button>
            <button type="button" onClick={() => setPicked(new Set())} className="rounded-full bg-slate-100 px-3 py-1">Clear</button>
            <span className="text-slate-500">{picked.size} ticked</span>
          </div>
          <ul className="mt-3 max-h-[28rem] divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200">
            {shown.length === 0 && <li className="p-4 text-sm text-slate-500">No tests match.</li>}
            {shown.slice(0, 300).map((t) => (
              <li key={t.id}><label className="flex cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-slate-50">
                <input type="checkbox" checked={picked.has(t.id)} onChange={() => toggle(t.id)} />
                <span className="min-w-0 flex-1 truncate font-semibold text-slate-900">{t.title}</span>
                <span className="text-xs text-slate-500">{t.language} · {t.mode} · {t.minutes} min</span>
              </label></li>
            ))}
            {shown.length > 300 && <li className="p-3 text-center text-xs text-slate-500">Showing the first 300. Narrow the search to see more.</li>}
          </ul>
          <button type="button" disabled={pending || picked.size === 0} onClick={() => run(() => addWebsiteTestsToApp([...picked]), () => { setPicked(new Set()); setTab("inapp"); })} className="mt-4 rounded-xl bg-blue-700 px-6 py-2.5 font-bold text-white disabled:opacity-50">{pending ? "Adding…" : `Add ${picked.size || ""} to app`}</button>
        </section>
      )}

      {tab === "create" && (
        <section className="mt-4 rounded-2xl bg-white p-6 shadow">
          <h2 className="text-lg font-black text-slate-900">{form.id ? "Edit test" : "Create a new test for the app"}</h2>
          <p className="mt-1 text-sm text-slate-600">This test is only for the app. For Hindi, paste normal Hindi (Unicode); the app converts it to Kruti Dev automatically.</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Test name<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={field} placeholder="e.g. Exercise 41" /></label>
            <label className="text-sm font-semibold text-slate-700">Language<select value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })} className={field}><option>English</option><option>Hindi</option></select></label>
            <label className="text-sm font-semibold text-slate-700">Where it appears<select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })} className={field}><option value="exam">Exam Simulator (inside every exam board)</option><option value="practice">Quick Practice</option></select></label>
            <label className="text-sm font-semibold text-slate-700">Duration (minutes)<input inputMode="numeric" value={form.minutes} onChange={(e) => setForm({ ...form, minutes: e.target.value })} className={field} /></label>
            <label className="text-sm font-semibold text-slate-700">Backspace<select value={form.backspace} onChange={(e) => setForm({ ...form, backspace: e.target.value })} className={field}><option value="full">Allowed</option><option value="word">Only within the current word</option><option value="disabled">Not allowed</option></select></label>
            <label className="text-sm font-semibold text-slate-700">Required speed, WPM (optional)<input inputMode="numeric" value={form.wpm} onChange={(e) => setForm({ ...form, wpm: e.target.value })} className={field} /></label>
            <label className="text-sm font-semibold text-slate-700">Required accuracy % (optional)<input inputMode="numeric" value={form.accuracy} onChange={(e) => setForm({ ...form, accuracy: e.target.value })} className={field} /></label>
            <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Passage to type
              <textarea value={form.passage} onChange={(e) => setForm({ ...form, passage: e.target.value })} rows={9} className={field} placeholder={form.id ? "Paste the passage again to change it (it is not shown here)." : "Paste the passage here…"} />
            </label>
          </div>
          <div className="mt-4 flex gap-3">
            <button type="button" disabled={pending} onClick={() => run(() => saveAppTest({ id: form.id, title: form.title, language: form.language, mode: form.mode, minutes: Number(form.minutes), wpm: num(form.wpm), accuracy: num(form.accuracy), backspace: form.backspace, passage: form.passage }), () => { setForm(emptyForm); setTab("inapp"); })} className="rounded-xl bg-blue-700 px-6 py-2.5 font-bold text-white disabled:opacity-50">{pending ? "Saving…" : form.id ? "Save changes" : "Create and send to app"}</button>
            {form.id && <button type="button" onClick={() => setForm(emptyForm)} className="rounded-xl bg-slate-100 px-5 py-2.5 font-bold text-slate-700">Cancel edit</button>}
          </div>
        </section>
      )}

      {tab === "inapp" && (
        <section className="mt-4 rounded-2xl bg-white p-6 shadow">
          <h2 className="text-lg font-black text-slate-900">Tests students get in the app</h2>
          {inApp.length === 0 ? <p className="mt-3 text-sm text-slate-500">Nothing added yet. Use step 1 or 2. The app keeps its built-in tests either way.</p> : (
            <ul className="mt-3 divide-y divide-slate-100">
              {inApp.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className={`font-semibold ${t.published ? "text-slate-900" : "text-slate-400 line-through"}`}>{t.title}</p>
                    <p className="text-xs text-slate-500">{t.language} · {t.mode === "exam" ? "Exam Simulator" : "Quick Practice"} · {Math.round(t.duration_seconds / 60)} min · {t.words} words · {t.source_test_id ? "from website" : "created for app"}{t.published ? "" : " · hidden"}</p>
                  </div>
                  {!t.source_test_id && <button type="button" onClick={() => { edit(t); setTab("create"); setState({}); }} className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-800">Edit</button>}
                  <button type="button" disabled={pending} onClick={() => run(() => updateAppTests([t.id], t.published ? "hide" : "show"))} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{t.published ? "Hide" : "Show"}</button>
                  <button type="button" disabled={pending} onClick={() => { if (confirm(`Remove "${t.title}" from the app? (The website test is not affected.)`)) run(() => updateAppTests([t.id], "delete")); }} className="rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-800">Remove</button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
