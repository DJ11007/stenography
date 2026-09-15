"use client";

import type { ExamPreset } from "@/lib/typing-curriculum";
import type { InputSystem } from "@/lib/typing-language";
import type { TypingScore } from "@/lib/typing-test";
import { AdvancedTypingResults } from "@/app/typing/_components/advanced-typing-results";

// Thin client wrapper: AdvancedTypingResults is the exact same component a
// student sees on their own results screen right after submitting -- it
// needs an onRestart callback (meaningless for an admin reviewing someone
// else's finished attempt, so it's a no-op here) and is itself a client
// component, which the server page above can't render directly.
export function AttemptReviewClient(props: { preset: ExamPreset; inputSystem: InputSystem; passage: string; typedText: string; score: TypingScore; backspaces: number; returnHref: string; returnLabel: string; mode: "practice" | "exam" }) {
  return <AdvancedTypingResults {...props} onRestart={() => {}} />;
}
