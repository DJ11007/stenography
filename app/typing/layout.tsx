import { requireStudent } from "@/lib/auth";
import { TypingStudentProvider } from "./_components/typing-student-provider";

export default async function TypingLayout({ children }: { children: React.ReactNode }) {
  const { user, profile } = await requireStudent();
  return <TypingStudentProvider student={{ name: profile.full_name?.trim() || "Student", email: user.email || "", phone: user.phone || null }}>{children}</TypingStudentProvider>;
}
