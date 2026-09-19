import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { TypingStudentProvider } from "@/app/typing/_components/typing-student-provider";
import { getWordtrisWords } from "@/lib/wordtris-server";
import { SpeedRaceGame } from "@/app/typing/games/speed-race/speed-race-game";

export const metadata: Metadata = { title: "Preview: Speed Race | Admin" };

// The real /typing/games/speed-race page is gated by requireStudent()
// (app/typing/layout.tsx), which redirects an admin session straight to
// /admin -- an admin can never just open the student-facing page directly
// to see what a student sees. This is a permanent, admin-only read route
// that renders the exact same game component under the same provider the
// real layout uses, wrapped with the admin's own identity. Solo play's own
// personal-best score is localStorage-only, but the Live Classroom Race
// join flow (see speed-race-game.tsx) calls getMyJoinedRoom(), which is
// gated by requireStudent() -- previewMode skips that entirely so the
// admin preview isn't redirected out of the page, the same bug already
// fixed once for WordTris's own admin preview.
export default async function PreviewSpeedRacePage() {
  const { user, profile } = await requireAdmin();
  const words = await getWordtrisWords();
  return (
    <TypingStudentProvider student={{ name: profile.full_name?.trim() || "Admin", email: user.email || "", phone: user.phone || null }}>
      <SpeedRaceGame words={words} previewMode />
    </TypingStudentProvider>
  );
}
