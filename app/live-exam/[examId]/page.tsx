import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { patternById, sectionInstructions } from "@/lib/live-exam";
import { createClient } from "@/lib/supabase/server";
import { LiveExamRoom, type LiveExamState } from "./live-exam-room";

export const metadata: Metadata = { title: "Live Exam", robots: { index: false, follow: false } };

// One live exam: the exam login (with the peripheral check and the instructions), then the exam room on the server's
// clock. An admin may open it as a preview (nothing is submitted).
export default async function LiveExamPage({ params }: { params: Promise<{ examId: string }> }) {
  const { examId } = await params;
  const user = await requireUser();
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("role, full_name, is_active, approved").eq("id", user.id).maybeSingle();
  const preview = profile?.role === "admin";
  if (!preview && (profile?.role !== "student" || profile.is_active === false || profile.approved === false)) redirect("/login");
  const { data: state, error } = await supabase.rpc("live_exam_state", { p_exam_id: examId });
  if (error || !state) notFound();
  const exam = state as LiveExamState;
  const pattern = patternById(exam.pattern);
  const instructions = [...sectionInstructions(exam.sections), ...(pattern?.instructions ?? []), ...(exam.instructions ?? "").split("\n").map((line) => line.trim()).filter(Boolean)];
  return (
    <LiveExamRoom
      initial={exam}
      instructions={instructions}
      preview={preview}
      candidate={{ name: profile?.full_name?.trim() || "Candidate", loginId: user.email ?? "", rollNumber: user.id.slice(0, 8).toUpperCase() }}
    />
  );
}
