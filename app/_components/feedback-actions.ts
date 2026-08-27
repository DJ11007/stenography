"use server";
import { createClient } from "@/lib/supabase/server";

export type FeedbackFormState = { status?: "idle" | "success" | "error"; message?: string };

export async function submitFeedback(_prevState: FeedbackFormState, formData: FormData): Promise<FeedbackFormState> {
  const message = String(formData.get("message") ?? "").trim();
  const ratingRaw = String(formData.get("rating") ?? "").trim();
  const rating = ratingRaw ? Number(ratingRaw) : null;
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_student_feedback", { p_message: message, p_rating: rating });
  if (error) return { status: "error", message: error.message.includes("between 10 and 1000") ? "Please write between 10 and 1000 characters." : error.message.includes("not authorized") ? "Please log in as a student to leave feedback." : "Could not submit feedback. Please try again." };
  return { status: "success", message: "Thank you! Your feedback has been submitted for review." };
}
