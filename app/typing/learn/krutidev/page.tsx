import type { Metadata } from "next";
import { toTypeableKrutiDev } from "@/lib/hindi-font-converter";
import { FINGERS, GLYPH_KEYS, KEYBOARD_ROWS } from "@/lib/krutidev-tutor-content";
import { getKrutiDevExercises } from "@/lib/krutidev-tutor-server";
import { KrutiDevTutor } from "./krutidev-tutor";

export const metadata: Metadata = { title: "कृतिदेव हिन्दी टाइपिंग सीखें" };

// Drills are stored / authored in Unicode Hindi (readable, reviewable, and
// admin-editable via /admin/krutidev-lessons) and converted to
// keyboard-typeable Kruti Dev bytes here -- toTypeableKrutiDev rewrites
// the Latin-1 ligature bytes the plain converter emits (Ò, è, ç ...) into
// the ASCII sequences a student can actually press. A conversion that
// throws on one bad exercise falls back to the raw text for that one
// rather than 500-ing the page.
function toTarget(text: string): string {
  try {
    return toTypeableKrutiDev(text);
  } catch {
    return text;
  }
}

export default async function KrutiDevLearnPage() {
  const { lessons: rawLessons, wordSets: rawWordSets, paragraphs: rawParagraphs } = await getKrutiDevExercises();

  const lessons = rawLessons.map((lesson) => ({
    id: lesson.id,
    title: lesson.title,
    focusKeys: lesson.focusKeys,
    target: lesson.drills.map(toTarget).join("   "),
  }));
  const wordSets = rawWordSets.map((set) => ({
    id: set.id,
    title: set.title,
    target: set.words.map(toTarget).join(" "),
  }));
  const paragraphs = rawParagraphs.map((paragraph) => ({
    id: paragraph.id,
    title: paragraph.title,
    target: toTarget(paragraph.text),
  }));

  return (
    <KrutiDevTutor
      keyboardRows={KEYBOARD_ROWS}
      glyphKeys={GLYPH_KEYS}
      fingers={FINGERS}
      lessons={lessons}
      wordSets={wordSets}
      paragraphs={paragraphs}
    />
  );
}
