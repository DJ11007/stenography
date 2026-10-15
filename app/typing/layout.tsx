import type { Metadata } from "next";
import { requireStudent } from "@/lib/auth";
import { TypingStudentProvider } from "./_components/typing-student-provider";

// Login-only pages: keep them out of search results.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function TypingLayout({ children }: { children: React.ReactNode }) {
  const { user, profile } = await requireStudent();
  return <TypingStudentProvider student={{ name: profile.full_name?.trim() || "Student", email: user.email || "", phone: user.phone || null }}>{children}</TypingStudentProvider>;
}
