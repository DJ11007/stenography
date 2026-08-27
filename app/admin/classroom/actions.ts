"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type ClassroomActionState = { error?: string; success?: string };

function refresh() {
  revalidatePath("/admin/classroom");
  revalidatePath("/classroom");
}

export async function saveClassroomUpdate(_: ClassroomActionState, formData: FormData): Promise<ClassroomActionState> {
  await requireAdmin();
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "").trim() || null;
  const { error } = await supabase.rpc("admin_save_classroom_update", {
    p_id: id,
    p_title: String(formData.get("title") ?? "").trim(),
    p_body: String(formData.get("body") ?? "").trim(),
    p_is_published: formData.get("isPublished") === "on",
    p_display_order: Number(formData.get("displayOrder") ?? 0) || 0,
  });
  if (error) return { error: error.message };
  refresh();
  return { success: "Update saved." };
}

export async function deleteClassroomUpdate(_: ClassroomActionState, formData: FormData): Promise<ClassroomActionState> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_delete_classroom_update", { p_id: String(formData.get("id") ?? "") });
  if (error) return { error: error.message };
  refresh();
  return { success: "Update removed." };
}

export async function setLiveClassLink(_: ClassroomActionState, formData: FormData): Promise<ClassroomActionState> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_live_class_link", {
    p_url: String(formData.get("url") ?? "").trim() || null,
    p_is_active: formData.get("isActive") === "on",
  });
  if (error) return { error: error.message };
  refresh();
  return { success: "Live class updated." };
}
