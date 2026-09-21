import { GLYPH_KEYS as HINDI_GLYPH_KEYS } from "./krutidev-tutor-content";
import { GLYPH_KEYS as ENGLISH_GLYPH_KEYS } from "./english-tutor-content";

export type CharacterPoolLanguage = "hindi" | "english";

// The full, default set of drillable keys per language -- every plain,
// unshifted key that already carries real content on the Kruti Dev /
// English tutor keyboards (deduped). Both WordTris's Character mode and
// Key Hunter drill from this same set; an admin can now narrow it via
// /admin/character-pool (see character-pool-server.ts), but a language
// nobody has configured yet keeps this exact full keyboard, unchanged
// from before this was ever editable.
export const DEFAULT_CHARACTER_POOL: Record<CharacterPoolLanguage, string[]> = {
  english: [...new Set(ENGLISH_GLYPH_KEYS.map((k) => k.normal).filter(Boolean))],
  hindi: [...new Set(HINDI_GLYPH_KEYS.map((k) => k.normal).filter(Boolean))],
};
