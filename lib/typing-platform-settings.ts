import type { BackspaceMode, HighlightMode, TypingSettings, WordMethod } from "./typing-test.ts";
import { defaultTypingFontPreferences, parseTypingFontPreferences, type TypingFontPreferences } from "./typing-font-preferences.ts";

export const TYPING_PLATFORM_SETTINGS_KEY = "samradhi-typing-platform-settings-v2";
export const TYPING_PLATFORM_SETTINGS_VERSION = 2 as const;

export type FontPreferenceContext = "latin" | "devanagari" | "krutidev";
export type UniversalTypingPreferences = {
  highlightMode: HighlightMode;
  backspaceMode: BackspaceMode;
  wordMethod: WordMethod;
  autoScroll: boolean;
  showScrollbar: boolean;
  inputSystemId: string;
  durationMinutes: number;
  fonts: Record<FontPreferenceContext, TypingFontPreferences>;
};
export type TypingPlatformSettingsStore = { version: typeof TYPING_PLATFORM_SETTINGS_VERSION; preferences: UniversalTypingPreferences };
export type AttemptVariant = "official" | "custom";
export type ManagedSettingsLock = "duration" | "highlightMode" | "backspaceMode" | "wordMethod";
export type ManagedSettingsLockMap = Partial<Record<ManagedSettingsLock, true>>;

export const DEFAULT_PLATFORM_PREFERENCES: UniversalTypingPreferences = {
  highlightMode: "none",
  backspaceMode: "word",
  wordMethod: "spaces",
  autoScroll: false,
  showScrollbar: true,
  inputSystemId: "",
  durationMinutes: 10,
  fonts: { latin: defaultTypingFontPreferences("Latin"), devanagari: defaultTypingFontPreferences("Devanagari"), krutidev: defaultTypingFontPreferences("Devanagari") },
};

const validHighlight = (value: unknown): value is HighlightMode => value === "character" || value === "word" || value === "none";
const validBackspace = (value: unknown): value is BackspaceMode => value === "full" || value === "word" || value === "disabled";
const validWordMethod = (value: unknown): value is WordMethod => value === "characters" || value === "spaces";

export function parsePlatformPreferences(value: unknown): UniversalTypingPreferences {
  const data = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const fonts = data.fonts && typeof data.fonts === "object" ? data.fonts as Record<string, unknown> : {};
  return {
    highlightMode: validHighlight(data.highlightMode) ? data.highlightMode : data.highlightMode === "highlight" ? "character" : DEFAULT_PLATFORM_PREFERENCES.highlightMode,
    backspaceMode: validBackspace(data.backspaceMode) ? data.backspaceMode : DEFAULT_PLATFORM_PREFERENCES.backspaceMode,
    wordMethod: validWordMethod(data.wordMethod) ? data.wordMethod : DEFAULT_PLATFORM_PREFERENCES.wordMethod,
    autoScroll: typeof data.autoScroll === "boolean" ? data.autoScroll : DEFAULT_PLATFORM_PREFERENCES.autoScroll,
    showScrollbar: typeof data.showScrollbar === "boolean" ? data.showScrollbar : DEFAULT_PLATFORM_PREFERENCES.showScrollbar,
    inputSystemId: typeof data.inputSystemId === "string" ? data.inputSystemId : "",
    durationMinutes: typeof data.durationMinutes === "number" && Number.isInteger(data.durationMinutes) && data.durationMinutes >= 1 && data.durationMinutes <= 60 ? data.durationMinutes : 10,
    fonts: {
      latin: parseTypingFontPreferences(fonts.latin, "Latin"),
      devanagari: parseTypingFontPreferences(fonts.devanagari, "Devanagari"),
      krutidev: parseTypingFontPreferences(fonts.krutidev, "Devanagari"),
    },
  };
}

export function migrateTypingPlatformSettings(current: unknown, legacy: Record<string, unknown> = {}): TypingPlatformSettingsStore {
  if (current && typeof current === "object") {
    const store = current as Record<string, unknown>;
    if (store.version === TYPING_PLATFORM_SETTINGS_VERSION) return { version: TYPING_PLATFORM_SETTINGS_VERSION, preferences: parsePlatformPreferences(store.preferences) };
    if (store.preferences) return { version: TYPING_PLATFORM_SETTINGS_VERSION, preferences: parsePlatformPreferences(store.preferences) };
  }
  const oldSettings = legacy["rssb-ldc-typing-settings"];
  const old = oldSettings && typeof oldSettings === "object" ? oldSettings as Record<string, unknown> : {};
  const preferences = parsePlatformPreferences(old);
  const latinFont = legacy["samradhi-typing-font-sizes-v1-latin-unicode"];
  const devanagariFont = legacy["samradhi-typing-font-sizes-v1-devanagari-unicode"];
  const krutiFont = legacy["samradhi-typing-font-sizes-v1-devanagari-krutidev-legacy"];
  return { version: TYPING_PLATFORM_SETTINGS_VERSION, preferences: { ...preferences, fonts: { latin: parseTypingFontPreferences(latinFont, "Latin"), devanagari: parseTypingFontPreferences(devanagariFont, "Devanagari"), krutidev: parseTypingFontPreferences(krutiFont, "Devanagari") } } };
}

export function resolveAttemptSettings(preferences: UniversalTypingPreferences, official: Pick<TypingSettings, "backspaceMode" | "wordMethod">, variant: AttemptVariant): TypingSettings & { autoScroll: boolean } {
  return {
    backspaceMode: variant === "official" ? official.backspaceMode : preferences.backspaceMode,
    wordMethod: variant === "official" ? official.wordMethod : preferences.wordMethod,
    highlightMode: preferences.highlightMode,
    minWords: 150,
    maxWords: 1500,
    autoScroll: preferences.autoScroll,
  };
}

export function managedTestSettingsLocks(mode: "learn" | "practice" | "exam" | "stenography" | undefined, isLive = false): ManagedSettingsLockMap {
  if (mode === "practice" && !isLive) return {};
  if (!mode && !isLive) return {};
  return { duration: true, highlightMode: true, backspaceMode: true, wordMethod: true };
}

export function fontContextFor(inputEncoding: string, script: string): FontPreferenceContext {
  return inputEncoding === "krutidev-legacy" ? "krutidev" : script === "Devanagari" ? "devanagari" : "latin";
}
