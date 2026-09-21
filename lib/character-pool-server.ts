import { createClient } from "@/lib/supabase/server";
import { DEFAULT_CHARACTER_POOL, type CharacterPoolLanguage } from "./character-pool-content";

export type CharacterPoolForLanguage = {
  keys: string[];
  // Real requested feature: an admin who has explicitly ordered a custom
  // key list wants WordTris's Character mode to introduce those keys in
  // THAT exact sequence, not shuffled -- unlike Key Hunter, which always
  // adapts to the student's own weakest keys regardless of any list
  // order, so this flag only ever matters to WordTris. True whenever the
  // admin has actually configured this language (get_character_pool_config
  // returned a real row); false for the untouched default full keyboard,
  // which keeps behaving exactly as it did before this feature existed
  // (a random shuffle every round).
  sequential: boolean;
};

// Mirrors getWordtrisWords()'s "DB row if configured, else the bundled
// constant" fallback -- get_character_pool_config returns null (not an
// empty array) when a language has no row, or its row's array was
// emptied back out, so either state falls back to the full keyboard.
export async function getCharacterPool(): Promise<Record<CharacterPoolLanguage, CharacterPoolForLanguage>> {
  const supabase = await createClient();
  const result: Record<CharacterPoolLanguage, CharacterPoolForLanguage> = {
    hindi: { keys: DEFAULT_CHARACTER_POOL.hindi, sequential: false },
    english: { keys: DEFAULT_CHARACTER_POOL.english, sequential: false },
  };
  const languages: CharacterPoolLanguage[] = ["hindi", "english"];

  await Promise.all(
    languages.map(async (language) => {
      try {
        const { data, error } = await supabase.rpc("get_character_pool_config", { p_language: language });
        if (!error && Array.isArray(data) && data.length) result[language] = { keys: data as string[], sequential: true };
      } catch {
        /* keep the bundled fallback for this language */
      }
    }),
  );

  return result;
}
