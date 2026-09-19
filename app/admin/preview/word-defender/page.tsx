import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { TypingStudentProvider } from "@/app/typing/_components/typing-student-provider";
import { getWordtrisWords } from "@/lib/wordtris-server";
import { WordDefenderGame } from "@/app/typing/games/word-defender/word-defender-game";

export const metadata: Metadata = { title: "Preview: Word Defender | Admin" };

// The real /typing/games/word-defender page is gated by requireStudent()
// (app/typing/layout.tsx), which redirects an admin session straight to
// /admin -- an admin can never just open the student-facing page directly
// to see what a student sees. This is a permanent, admin-only read route
// that renders the exact same game component under the same provider the
// real layout uses. Like Speed Race, Word Defender never calls a
// student-gated server action (its personal-best score is kept in
// localStorage only), so no previewMode flag is needed here.
export default async function PreviewWordDefenderPage() {
  const { user, profile } = await requireAdmin();
  const words = await getWordtrisWords();
  return (
    <TypingStudentProvider student={{ name: profile.full_name?.trim() || "Admin", email: user.email || "", phone: user.phone || null }}>
      <WordDefenderGame words={words} />
    </TypingStudentProvider>
  );
}
