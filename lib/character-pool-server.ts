import { createClient } from "@/lib/supabase/server";
import { DEFAULT_CHARACTER_POOL, type CharacterPoolLanguage } from "./character-pool-content";

// Mirrors getWordtrisWords()'s "DB row if configured, else the bundled
// constant" fallback -- get_character_pool_config returns null (not an
// empty array) when a language has no row, or its row's array was
// emptied back out, so either state falls back to the full keyboard.
export async function getCharacterPool(): Promise<Record<CharacterPoolLanguage, string[]>> {
  const supabase = await createClient();
  const result = { ...DEFAULT_CHARACTER_POOL };
  const languages: CharacterPoolLanguage[] = ["hindi", "english"];

  await Promise.all(
    languages.map(async (language) => {
      try {
        const { data, error } = await supabase.rpc("get_character_pool_config", { p_language: language });
        if (!error && Array.isArray(data) && data.length) result[language] = data as string[];
      } catch {
        /* keep the bundled fallback for this language */
      }
    }),
  );

  return result;
}
