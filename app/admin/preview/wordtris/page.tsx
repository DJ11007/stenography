import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { TypingStudentProvider } from "@/app/typing/_components/typing-student-provider";
import { getWordtrisWords } from "@/lib/wordtris-server";
import { WordtrisGame } from "@/app/typing/games/wordtris/wordtris-game";

export const metadata: Metadata = { title: "Preview: WordTris | Admin" };

// The real /typing/games/wordtris page is gated by requireStudent()
// (app/typing/layout.tsx), which redirects an admin session straight to
// /admin -- an admin can never just open the student-facing page directly
// to see what a student sees. This is a permanent, admin-only read route
// that renders the exact same game component under the same provider the
// real layout uses, wrapped with the admin's own identity.
export default async function PreviewWordtrisPage() {
  const { user, profile } = await requireAdmin();
  const words = await getWordtrisWords();
  return (
    <TypingStudentProvider student={{ name: profile.full_name?.trim() || "Admin", email: user.email || "", phone: user.phone || null }}>
      <WordtrisGame words={words} previewMode />
    </TypingStudentProvider>
  );
}
