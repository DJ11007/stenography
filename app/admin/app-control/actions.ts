"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { normaliseRules, type AppRule, type AppSettings } from "@/lib/app-control";

export type AppControlState = { error?: string; success?: string };

// Saves ONE area's page. Rules outside this page's scope are kept as they are, so saving the Exam page
// can never wipe what was set on the Stenography page. settings === null leaves notice/trial untouched.
export async function saveAppControl(scope: string[], rules: AppRule[], settings: AppSettings | null): Promise<AppControlState> {
  await requireAdmin();
  const supabase = await createClient();
  const { data: current } = await supabase.rpc("public_app_control");
  const existing = normaliseRules(current?.rules);
  const inScope = new Set(scope);
  const keep = existing.filter((rule) => !inScope.has(rule.key));
  const incoming = rules.filter((rule) => inScope.has(rule.key));
  const merged = [...keep, ...incoming]
    .filter((rule) => /^(section|learn|exam|steno|word|excel):[a-z0-9-]+$/i.test(rule.key))
    .map((rule) => ({ key: rule.key, visible: rule.visible !== false, access: rule.access === "free" || rule.access === "activated" ? rule.access : "default" }));
  const num = (value: string, min: number, max: number) => {
    const n = Math.round(Number(value));
    return value.trim() !== "" && Number.isFinite(n) && n >= min && n <= max ? String(n) : "";
  };
  const old = (current?.settings ?? {}) as Record<string, string>;
  const nextSettings = settings
    ? { notice: settings.notice.trim().slice(0, 300), trialSeconds: num(settings.trialSeconds, 10, 3600), trialWords: num(settings.trialWords, 10, 2000) }
    : { notice: old.notice ?? "", trialSeconds: old.trialSeconds ?? "", trialWords: old.trialWords ?? "" };
  const { error } = await supabase.rpc("admin_save_app_control", { p_rules: merged, p_settings: nextSettings });
  if (error) return { error: error.message };
  revalidatePath("/admin/app-control", "layout");
  revalidatePath("/offline-app/control");
  return { success: "Saved. Installed apps pick this up within a few minutes." };
}
