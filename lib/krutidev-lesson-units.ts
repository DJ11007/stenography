export type KrutiDevExerciseKind = "key-lesson" | "word-set" | "paragraph";

// Real reported bug: the student-facing tutor page (app/typing/learn/
// krutidev/page.tsx, via lib/krutidev-tutor-server.ts) resolves a Key
// drill's Kruti-Dev-vs-Unicode format per LINE, and a Word set's per
// WHITESPACE-separated WORD -- not once for the whole Content field. The
// admin editor's own live preview and the admin list's per-row preview
// both used to run the whole field through krutiDevTypingTarget as one
// blob instead. Harmless when a field is entirely one format, but a real
// scenario mixes formats WITHIN one field (an admin adds a new
// Kruti-Dev-typed drill line to the top of an existing lesson whose other
// lines are real Hindi words) -- the real-Hindi majority made the whole
// blob detect as "unicode", corrupting the new line when converting it,
// while the actual student page (resolving that line independently)
// showed it correctly. This is the single shared definition of "one
// format-resolution unit" for each exercise kind, used identically by the
// student-facing target derivation, the admin editor's live preview, and
// the admin list's per-row preview, so all three are guaranteed to agree.
export function krutiDevExerciseUnits(kind: KrutiDevExerciseKind, content: string): string[] {
  if (kind === "key-lesson") return content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (kind === "word-set") return content.split(/\s+/).filter(Boolean);
  const trimmed = content.trim();
  return trimmed ? [trimmed] : [];
}

// How resolved units are rejoined for display -- one per line for Key
// drills (matches how they're authored/reviewed), space-separated for
// Word sets, and irrelevant for Paragraphs (always exactly one unit).
export function krutiDevExerciseJoiner(kind: KrutiDevExerciseKind): string {
  return kind === "word-set" ? " " : "\n";
}
