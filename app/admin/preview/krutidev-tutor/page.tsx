import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { TypingStudentProvider } from "@/app/typing/_components/typing-student-provider";
import { toTypeableKrutiDev } from "@/lib/hindi-font-converter";
import { FINGERS, GLYPH_KEYS, KEYBOARD_ROWS } from "@/lib/krutidev-tutor-content";
import { getKrutiDevExercises } from "@/lib/krutidev-tutor-server";
import { KrutiDevTutor } from "@/app/typing/learn/krutidev/krutidev-tutor";

export const metadata: Metadata = { title: "Preview: Kruti Dev Typing Tutor | Admin" };

function toTarget(text: string): string {
  try {
    return toTypeableKrutiDev(text);
  } catch {
    return text;
  }
}

// Same permanent admin-preview pattern as /admin/preview/english-tutor --
// the real student-facing page is gated by requireStudent()
// (app/typing/layout.tsx), which redirects an admin session straight to
// /admin.
export default async function PreviewKrutiDevTutorPage() {
  const { user, profile } = await requireAdmin();
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
    <TypingStudentProvider student={{ name: profile.full_name?.trim() || "Admin", email: user.email || "", phone: user.phone || null }}>
      <KrutiDevTutor
        keyboardRows={KEYBOARD_ROWS}
        glyphKeys={GLYPH_KEYS}
        fingers={FINGERS}
        lessons={lessons}
        wordSets={wordSets}
        paragraphs={paragraphs}
      />
    </TypingStudentProvider>
  );
}
