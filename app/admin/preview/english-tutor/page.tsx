import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { TypingStudentProvider } from "@/app/typing/_components/typing-student-provider";
import { FINGERS, GLYPH_KEYS, KEYBOARD_ROWS } from "@/lib/english-tutor-content";
import { getEnglishTutorExercises } from "@/lib/english-tutor-server";
import { EnglishTutor } from "@/app/typing/learn/english-tutor/english-tutor";

export const metadata: Metadata = { title: "Preview: English Typing Tutor | Admin" };

// The real /typing/learn/english-tutor page is gated by requireStudent()
// (app/typing/layout.tsx), which redirects an admin session straight to
// /admin -- an admin can never just open the student-facing page directly
// to see what a student sees. This is a permanent, admin-only read
// route that renders the exact same page component under the same
// provider the real layout uses, wrapped with the admin's own identity
// (nothing student-specific is faked) -- unlike the earlier throwaway
// tmp-preview-* pages this replaces, it's meant to stay.
export default async function PreviewEnglishTutorPage() {
  const { user, profile } = await requireAdmin();
  const { lessons, wordSets, paragraphs } = await getEnglishTutorExercises();
  return (
    <TypingStudentProvider student={{ name: profile.full_name?.trim() || "Admin", email: user.email || "", phone: user.phone || null }}>
      <EnglishTutor
        keyboardRows={KEYBOARD_ROWS}
        glyphKeys={GLYPH_KEYS}
        fingers={FINGERS}
        lessons={lessons.map((lesson) => ({ id: lesson.id, title: lesson.title, focusKeys: lesson.focusKeys, target: lesson.drills.join("   ") }))}
        wordSets={wordSets.map((set) => ({ id: set.id, title: set.title, target: set.words.join(" ") }))}
        paragraphs={paragraphs.map((paragraph) => ({ id: paragraph.id, title: paragraph.title, target: paragraph.text }))}
      />
    </TypingStudentProvider>
  );
}
