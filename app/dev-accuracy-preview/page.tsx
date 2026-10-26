"use client";
// TEMPORARY local-only preview (not committed): one typed attempt shown through the real
// AdvancedTypingResults for a chosen exam, so results can be checked without a student login.
// ?exam=<category slug>&lang=English|Hindi&words=<words typed>&mistakes=<wrong words>
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { AdvancedTypingResults } from "../typing/_components/advanced-typing-results";
import { TypingStudentProvider } from "../typing/_components/typing-student-provider";
import { getExamPreset } from "@/lib/typing-curriculum";
import { examCategoryPresetId } from "@/lib/exam-categories";
import { calculateTypingScore } from "@/lib/typing-test";

function Preview() {
  const params = useSearchParams();
  const slug = params.get("exam") ?? "rajasthan-ldc";
  const language = params.get("lang") === "Hindi" ? "Hindi" : "English";
  const preset = getExamPreset(examCategoryPresetId(slug, language));
  if (!preset) return <p>Unknown exam {slug}</p>;
  const all = preset.passage.split(/\s+/).filter(Boolean);
  const count = Math.min(all.length, Number(params.get("words") ?? 400));
  const mistakes = Number(params.get("mistakes") ?? 10);
  // Spread the wrong words evenly; a wrong word = the passage word with an extra letter.
  const step = mistakes > 0 ? Math.floor(count / mistakes) : Infinity;
  let made = 0;
  const typed = all.slice(0, count).map((word, index) => {
    if (made < mistakes && (index + 1) % step === 0) { made += 1; return `${word}x`; }
    return word;
  }).join(" ");
  const score = calculateTypingScore({ typedText: typed, passage: preset.passage, elapsedSeconds: 600, wordMethod: preset.wordMethod, scoringProfile: preset.scoringProfile, includeUntypedWords: true });
  return <AdvancedTypingResults preset={preset} inputSystem={preset.inputSystems[0]} passage={preset.passage} typedText={typed} score={score} backspaces={0} onRestart={() => {}} mode="exam" />;
}

export default function Page() {
  return <TypingStudentProvider student={{ name: "Preview Student", email: "preview@example.com", phone: null }}><Suspense><Preview /></Suspense></TypingStudentProvider>;
}
