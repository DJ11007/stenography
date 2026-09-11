import type { Metadata } from "next";
import { FINGERS, GLYPH_KEYS, KEYBOARD_ROWS } from "@/lib/english-tutor-content";
import { getEnglishTutorExercises } from "@/lib/english-tutor-server";
import { EnglishTutor } from "./english-tutor";

export const metadata: Metadata = { title: "Learn English Typing" };

// Drills are stored / authored in plain English (readable, reviewable, and
// admin-editable via /admin/english-lessons) -- unlike the Kruti Dev tutor,
// there's no font-encoding conversion step: the target text is exactly what
// a student types.
export default async function EnglishTutorLearnPage() {
  const { lessons, wordSets, paragraphs } = await getEnglishTutorExercises();

  return (
    <EnglishTutor
      keyboardRows={KEYBOARD_ROWS}
      glyphKeys={GLYPH_KEYS}
      fingers={FINGERS}
      lessons={lessons.map((lesson) => ({ id: lesson.id, title: lesson.title, focusKeys: lesson.focusKeys, target: lesson.drills.join("   ") }))}
      wordSets={wordSets.map((set) => ({ id: set.id, title: set.title, target: set.words.join(" ") }))}
      paragraphs={paragraphs.map((paragraph) => ({ id: paragraph.id, title: paragraph.title, target: paragraph.text }))}
    />
  );
}
