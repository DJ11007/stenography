import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { TypingStudentProvider } from "@/app/typing/_components/typing-student-provider";
import { KeyHunterGame } from "@/app/typing/games/key-hunter/key-hunter-game";

export const metadata: Metadata = { title: "Preview: Key Hunter | Admin" };

// The real /typing/games/key-hunter page is gated by requireStudent()
// (app/typing/layout.tsx), which redirects an admin session straight to
// /admin -- an admin can never just open the student-facing page directly
// to see what a student sees. This is a permanent, admin-only read route
// that renders the exact same game component under the same provider the
// real layout uses. Key Hunter never calls a student-gated server action
// (its per-key stats are kept in localStorage only), so no previewMode
// flag is needed here.
export default async function PreviewKeyHunterPage() {
  const { user, profile } = await requireAdmin();
  return (
    <TypingStudentProvider student={{ name: profile.full_name?.trim() || "Admin", email: user.email || "", phone: user.phone || null }}>
      <KeyHunterGame />
    </TypingStudentProvider>
  );
}
