import { GLYPH_KEYS as HINDI_GLYPH_KEYS } from "./krutidev-tutor-content.ts";
import { GLYPH_KEYS as ENGLISH_GLYPH_KEYS } from "./english-tutor-content.ts";

export type CharacterPoolLanguage = "hindi" | "english";

// The full, default set of drillable keys per language -- every byte
// (unshifted AND shifted) that carries real content on the Kruti Dev /
// English tutor keyboards (deduped). Both WordTris's Character mode and
// Key Hunter drill from this same set; an admin can now narrow it via
// /admin/character-pool (see character-pool-server.ts), but a language
// nobody has configured yet gets this exact full keyboard.
//
// Real reported gap: this used to keep only k.normal (the plain,
// unshifted byte), which silently dropped every Shift-key glyph --
// Hindi's half-letters (Shift+D/R/T/U/L => क्/त्/ज्/न्/स्) and conjuncts
// (Shift+Z/[/J/K => र्/क्ष्/श्र/ज्ञ, KEY_LESSONS l14/l15) could never be
// practiced in either game. normalize()/dropText() in WordtrisGame and
// the plain string equality in KeyHunterGame are already case-sensitive
// for Hindi, so a shifted byte (e.g. "D") types and matches correctly
// with no other code changes needed.
export const DEFAULT_CHARACTER_POOL: Record<CharacterPoolLanguage, string[]> = {
  english: [...new Set(ENGLISH_GLYPH_KEYS.flatMap((k) => [k.normal, k.shift]).filter(Boolean))],
  hindi: [...new Set(HINDI_GLYPH_KEYS.flatMap((k) => [k.normal, k.shift]).filter(Boolean))],
};
