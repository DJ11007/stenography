import type { Metadata } from "next";
import { krutiDevTypingTarget } from "@/lib/hindi-font-converter";
import { FINGERS, GLYPH_KEYS, KEYBOARD_ROWS } from "@/lib/krutidev-tutor-content";
import { getKrutiDevExercises } from "@/lib/krutidev-tutor-server";
import { KrutiDevTutor } from "./krutidev-tutor";

export const metadata: Metadata = { title: "कृतिदेव हिन्दी टाइपिंग सीखें" };

// Drills may be authored either in Unicode Hindi (readable, reviewable,
// and admin-editable via /admin/krutidev-lessons) or as raw Kruti Dev
// keystrokes directly -- krutiDevTypingTarget (lib/hindi-font-converter.ts)
// is the single shared resolver used identically here and in the admin
// editor, so what a student sees always matches what the admin saved,
// byte-for-byte. See that function's own comment for why converting
// already-Kruti-Dev content again would corrupt it, and why a lossy
// Unicode round trip isn't used for it either.
const toTarget = krutiDevTypingTarget;

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
