"use client";
import { useActionState, useState } from "react";
import { submitFeedback, type FeedbackFormState } from "./feedback-actions";
import type { StudentFeedback } from "@/lib/homepage-content";

const initialState: FeedbackFormState = {};

function Stars({ value }: { value: number | null }) {
  if (!value) return null;
  return <span aria-label={`${value} out of 5 stars`} className="text-amber-500">{"★".repeat(value)}{"☆".repeat(5 - value)}</span>;
}

export function FeedbackSection({ feedback, canSubmit }: { feedback: StudentFeedback[]; canSubmit: boolean }) {
  const [state, action, pending] = useActionState(submitFeedback, initialState);
  const [rating, setRating] = useState(0);

  return (
    <section aria-labelledby="feedback-title" className="py-10">
      <div className="mb-6"><p className="text-xs font-black uppercase tracking-widest text-blue-700">Student voices</p><h2 id="feedback-title" className="mt-1 text-3xl font-black text-slate-950">What our students say</h2><p className="mt-2 max-w-2xl text-sm text-slate-600">Real feedback from Samradhi Classes students. Reviews are checked before they appear here.</p></div>
      <div className="grid gap-6 lg:grid-cols-[1.2fr_.8fr]">
        <div className="grid gap-4 sm:grid-cols-2">
          {feedback.length === 0 && <p className="col-span-full rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">No published feedback yet — be the first to share yours.</p>}
          {feedback.map((item) => (
            <article key={item.id} className="flex flex-col rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
              <Stars value={item.rating} />
              <p className="mt-2 flex-1 text-sm leading-6 text-slate-700">&ldquo;{item.message}&rdquo;</p>
              <p className="mt-3 text-xs font-black text-blue-800">— {item.displayName}</p>
            </article>
          ))}
        </div>
        <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-5">
          <h3 className="font-black text-slate-950">Share your experience</h3>
          {canSubmit ? (
            <form action={action} className="mt-3 space-y-3">
              <div>
                <span className="text-xs font-bold text-slate-600">Your rating</span>
                <div className="mt-1 flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button key={star} type="button" onClick={() => setRating(star)} aria-label={`Rate ${star} out of 5`} aria-pressed={rating === star} className={`text-2xl ${star <= rating ? "text-amber-500" : "text-slate-300"}`}>★</button>
                  ))}
                </div>
                <input type="hidden" name="rating" value={rating || ""} />
              </div>
              <textarea name="message" required minLength={10} maxLength={1000} rows={4} placeholder="Tell us about your experience with Samradhi Classes…" className="w-full rounded-xl border border-slate-200 p-3 text-sm" />
              <button type="submit" disabled={pending} className="w-full rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-black text-white hover:bg-blue-800 disabled:opacity-60">{pending ? "Submitting…" : "Submit feedback"}</button>
              {state.message && <p role="status" className={`text-sm font-bold ${state.status === "error" ? "text-red-700" : "text-green-700"}`}>{state.message}</p>}
            </form>
          ) : (
            <p className="mt-3 text-sm text-slate-600"><a href="/login" className="font-black text-blue-700 underline">Log in</a> as a student to leave feedback.</p>
          )}
        </div>
      </div>
    </section>
  );
}
