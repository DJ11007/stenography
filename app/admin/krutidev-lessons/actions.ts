"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type KrutiDevLessonActionState = { error?: string; success?: string };

function refresh() {
  revalidatePath("/admin/krutidev-lessons");
  revalidatePath("/typing/learn/krutidev");
}

export async function saveKrutiDevExercise(_: KrutiDevLessonActionState, formData: FormData): Promise<KrutiDevLessonActionState> {
  await requireAdmin();
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "").trim() || null;
  const { error } = await supabase.rpc("admin_save_krutidev_exercise", {
    p_id: id,
    p_kind: String(formData.get("kind") ?? ""),
    p_title: String(formData.get("title") ?? "").trim(),
    p_content: String(formData.get("content") ?? ""),
    p_focus_keys: String(formData.get("focusKeys") ?? "").trim(),
    p_is_published: formData.get("isPublished") === "on",
    p_display_order: Number(formData.get("displayOrder") ?? 0) || 0,
  });
  if (error) return { error: error.message };
  refresh();
  return { success: "Exercise saved." };
}

export async function deleteKrutiDevExercise(_: KrutiDevLessonActionState, formData: FormData): Promise<KrutiDevLessonActionState> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_delete_krutidev_exercise", { p_id: String(formData.get("id") ?? "") });
  if (error) return { error: error.message };
  refresh();
  return { success: "Exercise removed." };
}
