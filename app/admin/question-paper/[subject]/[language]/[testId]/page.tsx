import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { QuestionPaperSheet } from "@/components/efficiency/question-paper-sheet";
import { loadQuestionPaper } from "@/lib/question-paper";

type Props = { params: Promise<{ subject: string; language: string; testId: string }> };

// Depends on live admin state (question_paper_ready) and the test's current questions: never prerender/cache it.
export const dynamic = "force-dynamic";

// The admin's preview of a test's printable question paper (students' pages are under /typing, which admins cannot
// open): the same sheet, shown before "Question paper" is turned on.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const route = await params;
  const subject = route.subject === "excel" ? "excel" : "word";
  const paper = await loadQuestionPaper(subject, route.language, route.testId);
  return { title: paper ? `${paper.language} ${subject === "word" ? "Word" : "Excel"} ${paper.title} - Question Paper` : "Question Paper" };
}

export default async function AdminQuestionPaperPage({ params }: Props) {
  await requireAdmin();
  const route = await params;
  if (route.subject !== "word" && route.subject !== "excel") notFound();
  const paper = await loadQuestionPaper(route.subject, route.language, route.testId);
  if (!paper) notFound();
  return <QuestionPaperSheet paper={paper} backHref={`/admin/${route.subject}-efficiency-tests`} />;
}
