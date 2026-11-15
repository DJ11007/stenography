"use client";

import { useMemo, useState, useTransition } from "react";
import { saveAppControl, type AppControlState } from "./actions";
import type { AppAccess, AppControlGroup, AppRule, AppSettings } from "@/lib/app-control";

const ACCESS_LABEL: Record<AppAccess, string> = { default: "Normal (trial limits apply)", free: "Free for everyone (no trial limits)", activated: "Locked until activated" };

export function AppControlManager({ groups, initialRules, initialSettings }: { groups: AppControlGroup[]; initialRules: AppRule[]; initialSettings: AppSettings }) {
  const [rules, setRules] = useState<Record<string, AppRule>>(() => Object.fromEntries(initialRules.map((r) => [r.key, r])));
  const [settings, setSettings] = useState<AppSettings>(initialSettings);
  const [state, setState] = useState<AppControlState>({});
  const [pending, start] = useTransition();
  const changed = useMemo(() => Object.values(rules).filter((r) => !r.visible || r.access !== "default").length, [rules]);

  const get = (key: string): AppRule => rules[key] ?? { key, visible: true, access: "default" };
  const patch = (key: string, next: Partial<AppRule>) => setRules((current) => ({ ...current, [key]: { ...get(key), ...next } }));
  const setGroup = (group: AppControlGroup, next: Partial<AppRule>) => setRules((current) => {
    const copy = { ...current };
    for (const item of group.items) copy[item.key] = { ...(copy[item.key] ?? { key: item.key, visible: true, access: "default" as AppAccess }), ...next };
    return copy;
  });

  const save = () => start(async () => setState(await saveAppControl(Object.values(rules), settings)));

  return (
    <div className="mt-6 space-y-6 pb-24">
      <section className="rounded-2xl bg-white p-6 shadow">
        <h2 className="text-lg font-black text-slate-900">Notice &amp; trial limits</h2>
        <label className="mt-4 block text-sm font-semibold text-slate-700">Notice banner shown at the top of the app (leave empty for none)
          <input value={settings.notice} maxLength={300} onChange={(e) => setSettings({ ...settings, notice: e.target.value })} placeholder="e.g. New SSC CGL tests added — update the app!" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900" />
        </label>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-semibold text-slate-700">Trial: seconds per attempt (blank = 60)
            <input inputMode="numeric" value={settings.trialSeconds} onChange={(e) => setSettings({ ...settings, trialSeconds: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900" />
          </label>
          <label className="block text-sm font-semibold text-slate-700">Trial: words of the passage (blank = 50)
            <input inputMode="numeric" value={settings.trialWords} onChange={(e) => setSettings({ ...settings, trialWords: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900" />
          </label>
        </div>
      </section>

      {groups.map((group) => (
        <section key={group.heading} className="rounded-2xl bg-white p-6 shadow">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-black text-slate-900">{group.heading} <span className="text-sm font-semibold text-slate-400">({group.items.length})</span></h2>
            {group.items.length > 1 && (
              <div className="flex gap-2 text-xs font-bold">
                <button type="button" onClick={() => setGroup(group, { visible: true })} className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-800">Show all</button>
                <button type="button" onClick={() => setGroup(group, { visible: false })} className="rounded-full bg-rose-100 px-3 py-1 text-rose-800">Hide all</button>
                <button type="button" onClick={() => setGroup(group, { visible: true, access: "default" })} className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">Reset</button>
              </div>
            )}
          </div>
          {group.items.length === 0 ? <p className="mt-3 text-sm text-slate-500">No published tests yet.</p> : (
            <ul className="mt-3 divide-y divide-slate-100">
              {group.items.map((item) => {
                const rule = get(item.key);
                return (
                  <li key={item.key} className="flex flex-wrap items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className={`font-semibold ${rule.visible ? "text-slate-900" : "text-slate-400 line-through"}`}>{item.label}</p>
                      {item.hint && <p className="truncate text-xs text-slate-500">{item.hint}</p>}
                    </div>
                    <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                      <input type="checkbox" checked={rule.visible} onChange={(e) => patch(item.key, { visible: e.target.checked })} /> Visible
                    </label>
                    <select value={rule.access} disabled={!rule.visible} onChange={(e) => patch(item.key, { access: e.target.value as AppAccess })} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-900 disabled:opacity-40">
                      {(Object.keys(ACCESS_LABEL) as AppAccess[]).map((access) => <option key={access} value={access}>{ACCESS_LABEL[access]}</option>)}
                    </select>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ))}

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-200 bg-white/95 p-4 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <p className={`text-sm font-semibold ${state.error ? "text-rose-700" : state.success ? "text-emerald-700" : "text-slate-600"}`} role="status">
            {state.error ?? state.success ?? `${changed} item${changed === 1 ? "" : "s"} customised. Nothing is live until you save.`}
          </p>
          <button type="button" onClick={save} disabled={pending} className="rounded-xl bg-blue-700 px-6 py-2.5 font-bold text-white disabled:opacity-60">{pending ? "Saving…" : "Save changes"}</button>
        </div>
      </div>
    </div>
  );
}
