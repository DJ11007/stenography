import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireStudent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AnswerReview, type AnswerReviewSnapshot } from "./answer-review";

export const metadata: Metadata = { title: "Your Answer | Word Efficiency" };

// The student's own submitted document, opened read-only in the same Word editor they worked in,
// with the questions above it -- so they can see exactly what they did against each question.
export default async function WordEfficiencyAnswerPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const { user } = await requireStudent();
  const { attemptId } = await params;
  const supabase = await createClient();
  const { data: attempt } = await supabase
    .from("word_efficiency_attempts")
    .select("id,status,snapshot,final_document_snapshot")
    .eq("id", attemptId)
    .eq("student_id", user.id)
    .maybeSingle();
  if (!attempt) notFound();
  if (attempt.status !== "submitted" && attempt.status !== "completed") redirect(`/typing/word-efficiency/results/${attemptId}`);
  return <AnswerReview attemptId={attempt.id} snapshot={attempt.snapshot as AnswerReviewSnapshot} document={attempt.final_document_snapshot} />;
}
