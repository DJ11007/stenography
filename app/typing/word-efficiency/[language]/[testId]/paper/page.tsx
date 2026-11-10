import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { QuestionPaperSheet } from "@/components/efficiency/question-paper-sheet";
import { loadQuestionPaper } from "@/lib/question-paper";

type Props = { params: Promise<{ language: string; testId: string }> };

// Depends on live admin state (question_paper_ready) and the signed-in user's own role: never prerender/cache it.
export const dynamic = "force-dynamic";

// The Word Efficiency test's printable question paper (see lib/question-paper.ts). The page title is the PDF's name.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const route = await params;
  const paper = await loadQuestionPaper("word", route.language, route.testId);
  return { title: paper ? `${paper.language} Word ${paper.title} - Question Paper` : "Question Paper", robots: { index: false } };
}

export default async function WordQuestionPaperPage({ params }: Props) {
  const route = await params;
  const paper = await loadQuestionPaper("word", route.language, route.testId);
  if (!paper) notFound();
  return <QuestionPaperSheet paper={paper} backHref={`/typing/word-efficiency/${route.language}/${route.testId}/instructions`} />;
}
