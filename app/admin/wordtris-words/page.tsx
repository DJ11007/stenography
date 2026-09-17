import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { toTypeableKrutiDev } from "@/lib/hindi-font-converter";
import { BUNDLED_WORDS, CATEGORIES, type WordtrisCategory, type WordtrisLanguage } from "@/lib/wordtris-content";
import { BackButton } from "../../_components/back-button";
import { WordtrisWordsManager } from "./wordtris-words-manager";

export const metadata: Metadata = { title: "WordTris Word Banks | Admin" };

// The built-in word lists, shown read-only until the 202609171700
// migration has run (which seeds these same words into the DB and makes
// them editable).
const BUNDLED = (["hindi", "english"] as const).flatMap((language) =>
  CATEGORIES.flatMap((category) =>
    BUNDLED_WORDS[language][category.id].map((word, i) => ({
      id: `bundled-${language}-${category.id}-${i}`,
      language,
      category: category.id,
      word,
      is_published: true,
    })),
  ),
);

export default async function AdminWordtrisWordsPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_wordtris_words");
  const dbReady = !error && Array.isArray(data) && data.length > 0;

  const rows = (dbReady ? data : BUNDLED).map((row: { id: string; language: string; category: string; word: string; is_published: boolean }) => {
    let krutidev = "";
    if (row.language === "hindi") {
      try {
        krutidev = toTypeableKrutiDev(row.word);
      } catch {
        krutidev = "";
      }
    }
    return { ...row, language: row.language as WordtrisLanguage, category: row.category as WordtrisCategory, krutidev };
  });

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-4xl">
        <BackButton href="/admin" label="Admin panel" />
        <h1 className="mt-5 text-2xl font-black text-slate-950">WordTris Word Banks</h1>
        <p className="mt-2 text-sm text-slate-600">
          Add or edit the words students catch in the WordTris falling-word game
          (<code>/typing/games/wordtris</code>), per category and language. Hindi words are written in
          normal Unicode — they are converted to Kruti Dev automatically for the game.
        </p>
        {!dbReady && (
          <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm font-bold text-amber-900">
            Showing the built-in word lists below (read-only). Deploy database migration
            <code className="mx-1">202609171700_wordtris</code> — it copies these into the database and
            turns on editing here. Until then students play with this exact word bank.
          </p>
        )}
        <div className="mt-6">
          <WordtrisWordsManager rows={rows} dbReady={dbReady} />
        </div>
      </div>
    </main>
  );
}
