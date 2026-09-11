"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type EnglishLessonActionState = { error?: string; success?: string };

function refresh() {
  revalidatePath("/admin/english-lessons");
  revalidatePath("/typing/learn/english-tutor");
}

export async function saveEnglishTutorExercise(_: EnglishLessonActionState, formData: FormData): Promise<EnglishLessonActionState> {
  await requireAdmin();
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "").trim() || null;
  const { error } = await supabase.rpc("admin_save_english_tutor_exercise", {
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

export async function deleteEnglishTutorExercise(_: EnglishLessonActionState, formData: FormData): Promise<EnglishLessonActionState> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_delete_english_tutor_exercise", { p_id: String(formData.get("id") ?? "") });
  if (error) return { error: error.message };
  refresh();
  return { success: "Exercise removed." };
}
