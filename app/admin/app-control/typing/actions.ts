"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type AppTestActionState = { error?: string; success?: string };

const done = (success: string): AppTestActionState => {
  revalidatePath("/admin/app-control/typing");
  revalidatePath("/offline-app/control");
  return { success };
};

export async function addWebsiteTestsToApp(ids: string[]): Promise<AppTestActionState> {
  await requireAdmin();
  const clean = ids.filter((id) => /^[0-9a-f-]{36}$/i.test(id)).slice(0, 500);
  if (!clean.length) return { error: "Choose at least one test." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_add_website_tests_to_app", { p_ids: clean });
  if (error) return { error: error.message };
  return done(`${data ?? 0} test${data === 1 ? "" : "s"} added to the app. Students get them the next time the app opens online.`);
}

export async function saveAppTest(input: { id: string | null; title: string; language: string; mode: string; minutes: number; wpm: number | null; accuracy: number | null; backspace: string; passage: string }): Promise<AppTestActionState> {
  await requireAdmin();
  if (!["English", "Hindi"].includes(input.language) || !["exam", "practice"].includes(input.mode) || !["full", "word", "disabled"].includes(input.backspace)) return { error: "Invalid choice." };
  const minutes = Math.round(input.minutes);
  if (!Number.isFinite(minutes) || minutes < 1 || minutes > 120) return { error: "Duration must be 1 to 120 minutes." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_save_app_test", {
    p_id: input.id, p_title: input.title, p_language: input.language, p_mode: input.mode, p_duration: minutes * 60,
    p_wpm: input.wpm, p_accuracy: input.accuracy, p_backspace: input.backspace, p_passage: input.passage.trim(),
  });
  if (error) return { error: error.message };
  return done(input.id ? "Test updated." : "Test created and sent to the app.");
}

export async function updateAppTests(ids: string[], action: "delete" | "hide" | "show"): Promise<AppTestActionState> {
  await requireAdmin();
  const clean = ids.filter((id) => /^[0-9a-f-]{36}$/i.test(id));
  if (!clean.length) return { error: "Choose at least one test." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_update_app_tests", { p_ids: clean, p_action: action });
  if (error) return { error: error.message };
  return done(action === "delete" ? "Removed from the app." : action === "hide" ? "Hidden in the app." : "Shown in the app.");
}
