"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type WordtrisWordActionState = { error?: string; success?: string };

function refresh() {
  revalidatePath("/admin/wordtris-words");
  revalidatePath("/typing/games/wordtris");
}

export async function saveWordtrisWord(_: WordtrisWordActionState, formData: FormData): Promise<WordtrisWordActionState> {
  await requireAdmin();
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "").trim() || null;
  const { error } = await supabase.rpc("admin_save_wordtris_word", {
    p_id: id,
    p_language: String(formData.get("language") ?? ""),
    p_category: String(formData.get("category") ?? ""),
    p_word: String(formData.get("word") ?? "").trim(),
    p_is_published: formData.get("isPublished") === "on",
  });
  if (error) return { error: error.message };
  refresh();
  return { success: "Word saved." };
}

export async function deleteWordtrisWord(_: WordtrisWordActionState, formData: FormData): Promise<WordtrisWordActionState> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_delete_wordtris_word", { p_id: String(formData.get("id") ?? "") });
  if (error) return { error: error.message };
  refresh();
  return { success: "Word removed." };
}
