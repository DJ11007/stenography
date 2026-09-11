import { createClient } from "@/lib/supabase/server";
import { KEY_LESSONS, PARAGRAPHS, WORD_SETS } from "./english-tutor-content";

export type RawEnglishTutorExercises = {
  lessons: { id: string; title: string; focusKeys: string[]; drills: string[] }[];
  wordSets: { id: string; title: string; words: string[] }[];
  paragraphs: { id: string; title: string; text: string }[];
};

type Row = { id: string; kind: string; title: string; content: string; focus_keys: string | null };

// The English tutor's three practice tabs. Admin-editable rows come from
// list_published_english_tutor_exercises (see the 202609111530 migration);
// lib/english-tutor-content.ts is the built-in fallback used until that
// table has published rows of a given kind -- so a fresh database, or one
// where the migration has not run yet, still shows the full curriculum.
// Same shape as getKrutiDevExercises() (lib/krutidev-tutor-server.ts) --
// no font conversion step here, English is typed exactly as authored.
export async function getEnglishTutorExercises(): Promise<RawEnglishTutorExercises> {
  let rows: Row[] = [];
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("list_published_english_tutor_exercises");
    if (!error && Array.isArray(data)) rows = data as Row[];
  } catch {
    rows = [];
  }

  const lessons = rows
    .filter((row) => row.kind === "key-lesson")
    .map((row) => ({
      id: row.id,
      title: row.title,
      focusKeys: (row.focus_keys ?? "").split(/\s+/).filter(Boolean),
      drills: row.content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean),
    }));
  const wordSets = rows
    .filter((row) => row.kind === "word-set")
    .map((row) => ({ id: row.id, title: row.title, words: row.content.split(/\s+/).filter(Boolean) }));
  const paragraphs = rows
    .filter((row) => row.kind === "paragraph")
    .map((row) => ({ id: row.id, title: row.title, text: row.content.trim() }));

  return {
    lessons: lessons.length ? lessons : KEY_LESSONS.map((l) => ({ id: l.id, title: l.title, focusKeys: l.focusKeys, drills: l.drills })),
    wordSets: wordSets.length ? wordSets : WORD_SETS.map((s) => ({ id: s.id, title: s.title, words: s.words })),
    paragraphs: paragraphs.length ? paragraphs : PARAGRAPHS.map((p) => ({ id: p.id, title: p.title, text: p.text })),
  };
}
