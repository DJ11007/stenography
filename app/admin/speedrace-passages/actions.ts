"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type SpeedRacePassageActionState = { error?: string; success?: string };

function refresh() {
  revalidatePath("/admin/speedrace-passages");
  revalidatePath("/typing/games/speed-race");
}

export async function saveSpeedRacePassage(_: SpeedRacePassageActionState, formData: FormData): Promise<SpeedRacePassageActionState> {
  await requireAdmin();
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "").trim() || null;
  const { error } = await supabase.rpc("admin_save_speedrace_passage", {
    p_id: id,
    p_language: String(formData.get("language") ?? ""),
    p_title: String(formData.get("title") ?? "").trim(),
    p_passage: String(formData.get("passage") ?? ""),
    p_is_published: formData.get("isPublished") === "on",
  });
  if (error) return { error: error.message };
  refresh();
  return { success: "Passage saved." };
}

export async function deleteSpeedRacePassage(_: SpeedRacePassageActionState, formData: FormData): Promise<SpeedRacePassageActionState> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_delete_speedrace_passage", { p_id: String(formData.get("id") ?? "") });
  if (error) return { error: error.message };
  refresh();
  return { success: "Passage removed." };
}
