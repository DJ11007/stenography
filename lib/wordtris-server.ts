import { createClient } from "@/lib/supabase/server";
import { BUNDLED_WORDS, CATEGORIES, type WordtrisCategory, type WordtrisLanguage } from "./wordtris-content";

// All 7 categories x 2 languages of admin-editable words, up front, so the
// game's language/category picker never needs a round-trip -- mirrors
// getKrutiDevExercises()'s "DB row if published, else bundled constant"
// fallback pattern per kind, just crossed over two axes here instead of one.
export async function getWordtrisWords(): Promise<Record<WordtrisLanguage, Record<WordtrisCategory, string[]>>> {
  const supabase = await createClient();
  const result: Record<WordtrisLanguage, Record<WordtrisCategory, string[]>> = { hindi: { ...BUNDLED_WORDS.hindi }, english: { ...BUNDLED_WORDS.english } };
  const languages: WordtrisLanguage[] = ["hindi", "english"];

  await Promise.all(
    languages.flatMap((language) =>
      CATEGORIES.map(async (category) => {
        try {
          const { data, error } = await supabase.rpc("list_published_wordtris_words", { p_language: language, p_category: category.id });
          const words = !error && Array.isArray(data) ? (data as { word: string }[]).map((row) => row.word) : [];
          if (words.length) result[language][category.id] = words;
        } catch {
          /* keep the bundled fallback for this language/category */
        }
      }),
    ),
  );

  return result;
}
