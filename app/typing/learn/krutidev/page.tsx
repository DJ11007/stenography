import type { Metadata } from "next";
import { toTypeableKrutiDev } from "@/lib/hindi-font-converter";
import {
  FINGERS,
  GLYPH_KEYS,
  KEYBOARD_ROWS,
  KEY_LESSONS,
  PARAGRAPHS,
  WORD_SETS,
} from "@/lib/krutidev-tutor-content";
import { KrutiDevTutor } from "./krutidev-tutor";

export const metadata: Metadata = { title: "कृतिदेव हिन्दी टाइपिंग सीखें" };

// The tutor drills are authored in Unicode Hindi (readable, reviewable)
// and converted to keyboard-typeable Kruti Dev bytes here on the server --
// toTypeableKrutiDev rewrites the few Latin-1 ligature bytes the plain
// converter emits (Ò, è, ç ...) into the ASCII sequences a student can
// actually press. The client then compares raw bytes and paints them
// through the Kruti Dev 010 font.
export default function KrutiDevLearnPage() {
  const lessons = KEY_LESSONS.map((lesson) => ({
    id: lesson.id,
    title: lesson.title,
    focusKeys: lesson.focusKeys,
    target: lesson.drills.map(toTypeableKrutiDev).join("   "),
  }));
  const wordSets = WORD_SETS.map((set) => ({
    id: set.id,
    title: set.title,
    target: set.words.map(toTypeableKrutiDev).join(" "),
  }));
  const paragraphs = PARAGRAPHS.map((paragraph) => ({
    id: paragraph.id,
    title: paragraph.title,
    target: toTypeableKrutiDev(paragraph.text),
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
