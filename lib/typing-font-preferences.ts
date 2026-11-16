import type { InputEncoding, TypingScript } from "./typing-language.ts";

export const MIN_TYPING_FONT_SIZE = 14;
export const MAX_TYPING_FONT_SIZE = 40;
export const TYPING_FONT_STEP = 2;

export type TypingFontPreferences = {
  originalSize: number;
  typingSize: number;
  linked: boolean;
  // English only: some exams show the passage in Courier New, so a student can practise in it.
  englishFont?: EnglishTypingFont;
};

export type EnglishTypingFont = "default" | "courier";
export const COURIER_FONT_STACK = '"Courier New", Courier, monospace';

// The passage and typing-area font: Courier New when an English student chose it, else the input system's own.
export function typingFontFamily(preferences: TypingFontPreferences, script: TypingScript, fontStack: string) {
  return script === "Latin" && preferences.englishFont === "courier" ? COURIER_FONT_STACK : fontStack;
}

// Defaults set by Samradhi Classes (16 Nov 2026): both panels 20px with "Link sizes" on, and English in
// Courier New. A student's own saved choice still wins; these apply to new students and "Reset".
export function defaultTypingFontPreferences(script: TypingScript = "Latin"): TypingFontPreferences {
  return script === "Devanagari"
    ? { originalSize: 20, typingSize: 20, linked: true }
    : { originalSize: 20, typingSize: 20, linked: true, englishFont: "courier" };
}

export function isValidTypingFontSize(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= MIN_TYPING_FONT_SIZE && value <= MAX_TYPING_FONT_SIZE && value % TYPING_FONT_STEP === 0;
}

export function parseTypingFontPreferences(value: unknown, script: TypingScript = "Latin"): TypingFontPreferences {
  const defaults = defaultTypingFontPreferences(script);
  if (!value || typeof value !== "object") return defaults;
  const candidate = value as Record<string, unknown>;
  return {
    originalSize: isValidTypingFontSize(candidate.originalSize) ? candidate.originalSize : defaults.originalSize,
    typingSize: isValidTypingFontSize(candidate.typingSize) ? candidate.typingSize : defaults.typingSize,
    linked: typeof candidate.linked === "boolean" ? candidate.linked : defaults.linked,
    // "default" is stored explicitly when a student picks it, so a missing value means "never chosen" -> the default.
    ...(candidate.englishFont === "courier" || candidate.englishFont === "default"
      ? { englishFont: candidate.englishFont }
      : defaults.englishFont ? { englishFont: defaults.englishFont } : {}),
  };
}

export function changeTypingFontSize(preferences: TypingFontPreferences, panel: "original" | "typing", direction: -1 | 1): TypingFontPreferences {
  const key = panel === "original" ? "originalSize" : "typingSize";
  const nextSize = Math.min(MAX_TYPING_FONT_SIZE, Math.max(MIN_TYPING_FONT_SIZE, preferences[key] + direction * TYPING_FONT_STEP));
  if (preferences.linked) return { ...preferences, originalSize: nextSize, typingSize: nextSize };
  return { ...preferences, [key]: nextSize };
}

export function resetTypingFontSize(preferences: TypingFontPreferences, panel: "original" | "typing", script: TypingScript = "Latin"): TypingFontPreferences {
  const defaults = defaultTypingFontPreferences(script);
  if (preferences.linked) return { ...preferences, originalSize: defaults.originalSize, typingSize: defaults.originalSize };
  return panel === "original" ? { ...preferences, originalSize: defaults.originalSize } : { ...preferences, typingSize: defaults.typingSize };
}

export function typingFontStorageKey(script: TypingScript, encoding: InputEncoding = "unicode") {
  return `samradhi-typing-font-sizes-v1-${script.toLowerCase()}-${encoding}`;
}
