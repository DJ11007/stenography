import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ManagedTestMode } from "@/lib/admin-tests";
import TestManager, { type ManagedTestRow } from "./test-manager";

const TITLES: Record<ManagedTestMode, string> = { learn: "Learn Typing tests", practice: "Practice Tests", exam: "Exam Tests", stenography: "Stenography Tests" };

export async function SectionTestPage({ mode, language, inputSystemId, backHref }: { mode: ManagedTestMode; language?: "English" | "Hindi"; inputSystemId?: string; backHref?: string }) {
  await requireAdmin();
  const supabase = await createClient();
  let query = supabase.from("tests").select("id,title,slug,description,language,status,mode,input_system_id,visibility,duration_seconds,current_version_id,current_version_number,updated_at,is_live,live_starts_at,live_ends_at,results_publish_at").eq("mode", mode).eq("is_live", false).order("updated_at", { ascending: false });
  if (language) query = query.eq("language", language);
  if (inputSystemId) query = query.eq("input_system_id", inputSystemId);
  const { data: tests, error } = await query;
  const ids = (tests ?? []).map((test) => test.id);
  const versionIds = (tests ?? []).flatMap((test) => test.current_version_id ? [test.current_version_id] : []);
  const [{ data: versions }, { data: attempts }] = await Promise.all([
    versionIds.length ? supabase.from("test_versions").select("*").in("id", versionIds) : Promise.resolve({ data: [] }),
    ids.length ? supabase.from("test_attempts").select("test_id").in("test_id", ids) : Promise.resolve({ data: [] }),
  ]);
  const versionMap = new Map((versions ?? []).map((version) => [version.id, version]));
  const attemptCounts = new Map<string, number>();
  for (const attempt of attempts ?? []) attemptCounts.set(attempt.test_id, (attemptCounts.get(attempt.test_id) ?? 0) + 1);
  const rows = (tests ?? []).map((test) => ({ ...test, currentVersion: test.current_version_id ? versionMap.get(test.current_version_id) ?? null : null, attempts: attemptCounts.get(test.id) ?? 0 })) as ManagedTestRow[];
  const scopeLabel = language ? `${TITLES[mode]} · ${language}${inputSystemId ? ` · ${inputSystemId}` : ""}` : TITLES[mode];
  return <main className="section-test-manager min-h-screen bg-slate-100 p-4 sm:p-6"><div className="mx-auto max-w-[1500px]"><header className="mb-6"><Link href={backHref ?? "/admin"} className="text-sm font-semibold text-blue-700">← {backHref ? "Choose language" : "Admin dashboard"}</Link><h1 className="mt-2 text-3xl font-black">{scopeLabel}</h1><p className="mt-1 text-slate-600">Tests created here are permanently assigned to this section.</p><span className="mt-3 inline-flex rounded-full bg-blue-100 px-3 py-2 text-sm font-black text-blue-800">Locked section: {TITLES[mode].replace(/s$/, "")}</span></header>{error&&<p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 font-bold text-red-800">This test section could not be loaded ({error.code || "database error"}).</p>}<TestManager tests={rows} lockedMode={mode} lockedLanguage={language} lockedInputSystemId={inputSystemId}/><style>{`.section-test-manager label:has([name="mode"]),.section-test-manager fieldset:has([name="isLive"]){display:none}`}</style></div></main>;
}
