"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { CharacterPoolLanguage } from "@/lib/character-pool-content";

export type CharacterPoolActionState = { error?: string; success?: string };

export async function saveCharacterPoolConfig(_: CharacterPoolActionState, formData: FormData): Promise<CharacterPoolActionState> {
  await requireAdmin();
  const supabase = await createClient();
  const language = String(formData.get("language") ?? "") as CharacterPoolLanguage;
  const enabledKeys = formData.getAll("key").map(String);
  const { error } = await supabase.rpc("admin_save_character_pool_config", { p_language: language, p_enabled_keys: enabledKeys });
  if (error) return { error: error.message };
  revalidatePath("/admin/character-pool");
  revalidatePath("/typing/games/wordtris");
  revalidatePath("/typing/games/key-hunter");
  return { success: "Saved." };
}
