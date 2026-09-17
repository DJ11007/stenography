"use server";

import { requireStudent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { WordtrisCategory, WordtrisLanguage } from "@/lib/wordtris-content";

export type LeaderboardRow = { id: string; student_name: string; score: number; words_caught: number; created_at: string };

// Server-authoritative: the client only reports what happened (score,
// words caught), never anything trusted as-is -- same "never trust the
// client's own number" precedent as recordManagedAttempt
// (app/tests/actions.ts). The RPC itself re-derives student_id/name from
// the caller's own session and re-validates language/category/score.
export async function submitWordtrisScore(language: WordtrisLanguage, category: WordtrisCategory, score: number, wordsCaught: number) {
  await requireStudent();
  const supabase = await createClient();
  const safeScore = Number.isFinite(score) ? Math.max(0, Math.round(score)) : 0;
  const safeWordsCaught = Number.isFinite(wordsCaught) ? Math.max(0, Math.round(wordsCaught)) : 0;
  const { error } = await supabase.rpc("submit_wordtris_score", {
    p_language: language,
    p_category: category,
    p_score: safeScore,
    p_words_caught: safeWordsCaught,
  });
  return { error: error?.message ?? null };
}

export async function getWordtrisLeaderboard(language: WordtrisLanguage, category: WordtrisCategory, limit: 10 | 20 | 50): Promise<LeaderboardRow[]> {
  await requireStudent();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("wordtris_leaderboard", { p_language: language, p_category: category, p_limit: limit });
  if (error || !Array.isArray(data)) return [];
  return data as LeaderboardRow[];
}
