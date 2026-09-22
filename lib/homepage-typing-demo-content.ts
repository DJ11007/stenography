// Passage content for the public, no-login "Try a free typing test" demo
// on the homepage (app/_components/homepage-typing-demo.tsx). Reuses
// already-verified passages from the real exam curriculum instead of
// authoring new Hindi/English content -- EXAM_PRESETS' own English
// preset and HINDI_KRUTI_DEV's own Kruti Dev legacy-encoded passage,
// each just stretched further (repeatPassageToExactWordCount is already
// idempotent-safe for this -- it treats whatever string it's given as
// its own word pool to cycle through) so a fast typist never runs out
// of text within 10 minutes, the longest demo duration on offer.
import { EXAM_PRESETS, HINDI_KRUTI_DEV, repeatPassageToExactWordCount } from "@/lib/typing-curriculum";

const englishPreset = EXAM_PRESETS.find((preset) => preset.id === "rssb-ldc-english")!;

const DEMO_WORD_COUNT = 1800;

export const DEMO_ENGLISH_PASSAGE = repeatPassageToExactWordCount(englishPreset.passage, DEMO_WORD_COUNT);
export const DEMO_HINDI_KRUTIDEV_PASSAGE = repeatPassageToExactWordCount(HINDI_KRUTI_DEV.passageOverride!, DEMO_WORD_COUNT);
