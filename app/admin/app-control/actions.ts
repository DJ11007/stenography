"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { AppRule, AppSettings } from "@/lib/app-control";

export type AppControlState = { error?: string; success?: string };

export async function saveAppControl(rules: AppRule[], settings: AppSettings): Promise<AppControlState> {
  await requireAdmin();
  const clean = rules
    .filter((rule) => /^(section|learn|exam|steno|word|excel):[a-z0-9-]+$/i.test(rule.key))
    .map((rule) => ({ key: rule.key, visible: rule.visible !== false, access: rule.access === "free" || rule.access === "activated" ? rule.access : "default" }));
  const num = (value: string, min: number, max: number) => {
    const n = Math.round(Number(value));
    return value.trim() !== "" && Number.isFinite(n) && n >= min && n <= max ? String(n) : "";
  };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_save_app_control", {
    p_rules: clean,
    p_settings: { notice: settings.notice.trim().slice(0, 300), trialSeconds: num(settings.trialSeconds, 10, 3600), trialWords: num(settings.trialWords, 10, 2000) },
  });
  if (error) return { error: error.message };
  revalidatePath("/admin/app-control");
  revalidatePath("/offline-app/control");
  return { success: "Saved. Installed apps pick this up the next time they open or sync (within a few minutes)." };
}
