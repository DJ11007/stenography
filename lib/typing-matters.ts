import type { BackspaceMode, HighlightMode, WordMethod } from "./typing-test.ts";
import type { TypingLanguage } from "./typing-language.ts";
import { krutiDevToUnicode, unicodeToKrutiDev } from "./hindi-font-converter.ts";

export const MY_MATTERS_KEY = "samradhi-my-test-matters-v1";
export const MAX_MATTER_FILE_BYTES = 1_000_000;
export const MAX_MATTER_CHARACTERS = 100_000;
export function validateDurationMinutes(value: unknown) { return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 60 ? value : 10; }
export type MatterMode = "learn" | "practice" | "exam" | "stenography";
export type MatterVisibility = "private" | "public";
export type MyTestMatter = { id: string; title: string; language: TypingLanguage; mode: MatterMode; inputSystemId: string; passage: string; durationSeconds: number; requiredWpm: number; requiredAccuracy: number; backspaceMode: BackspaceMode; wordMethod: WordMethod; highlightMode: HighlightMode; visibility: MatterVisibility; createdAt: string; updatedAt: string };
export type MatterDraft = Omit<MyTestMatter, "id" | "createdAt" | "updatedAt">;

// Real reported bug, recurring: an admin pasting/typing Kruti Dev text
// through any external source (Word, an old converter, a physical
// keyboard's own ligature shortcuts) commonly produces ligature bytes
// (è/Ò/Ø/ç/®/...) that the bundled KrutiDev010 font renders DIFFERENTLY
// than this project's own decode table assumes -- e.g. stored "g®A"
// renders on screen as "हो।" but decodes (and scores) as "हैं।", so a
// student who correctly copies what they see is marked wrong. A one-off
// SQL cleanup only lasts until the next time someone re-saves that same
// test's passage through this exact form, reintroducing the bug -- so the
// fold has to happen HERE, at the one save-time choke point every admin
// edit passes through, not as a retroactive fix that keeps needing to be
// re-run. unicodeToKrutiDev(krutiDevToUnicode(text)) is a no-op for
// already-clean text and swaps every ligature byte for its safe
// keyboard-typeable equivalent otherwise.
function cleanKrutiDevLigatures(text: string) { return unicodeToKrutiDev(krutiDevToUnicode(text)); }

export function validateMatterText(text: string, language: TypingLanguage, inputSystemId: string) { const normalized = text.replace(/\r\n?/g, "\n"); const errors: string[] = []; if (!normalized.trim()) errors.push("Passage cannot be empty."); if (normalized.length > MAX_MATTER_CHARACTERS) errors.push(`Passage cannot exceed ${MAX_MATTER_CHARACTERS.toLocaleString()} characters.`); if (/<script\b|javascript:|<iframe\b|<object\b/i.test(normalized)) errors.push("Executable or embedded content is not allowed."); const hasDevanagari = /\p{Script=Devanagari}/u.test(normalized); const looksLegacy = /[A-Za-z][;'{}\[\]]|f'k|O;fDr/.test(normalized); if (language === "Hindi" && inputSystemId.includes("krutidev") && hasDevanagari) errors.push("Convert to Kruti Dev before saving."); if (language === "Hindi" && !inputSystemId.includes("krutidev") && !hasDevanagari && looksLegacy) errors.push("Convert to Unicode before saving."); const isKrutiDev = inputSystemId.includes("krutidev"); const finalText = isKrutiDev ? cleanKrutiDevLigatures(normalized) : normalized.normalize("NFC"); return { text: finalText, errors, wordCount: finalText.trim() ? finalText.trim().split(/\s+/).length : 0, characterCount: [...finalText].length };
}
export function validateMatterFile(file: Pick<File, "name" | "size" | "type">) { const extension = file.name.toLowerCase().split(".").pop() ?? ""; if (file.size > MAX_MATTER_FILE_BYTES) return "File must be 1 MB or smaller."; if (["exe","js","mjs","html","htm","bat","cmd","ps1","sh"].includes(extension)) return "Executable files are not allowed."; if (extension === "docx") return "DOCX import is not enabled because no reliable parser is installed. Paste the text or upload a .txt file."; if (extension !== "txt") return "Only .txt files are currently supported."; if (file.type && !["text/plain","application/octet-stream"].includes(file.type)) return "The selected file is not a plain-text file."; return null; }
export function createMatter(draft: MatterDraft, id = crypto.randomUUID(), now = new Date().toISOString()): MyTestMatter { const validation = validateMatterText(draft.passage, draft.language, draft.inputSystemId); if (validation.errors.length) throw new Error(validation.errors[0]); return { ...draft, passage: validation.text, id, createdAt: now, updatedAt: now }; }
export function parseMatterList(value: unknown): MyTestMatter[] { if (!Array.isArray(value)) return []; return value.filter((item): item is MyTestMatter => Boolean(item && typeof item === "object" && typeof (item as MyTestMatter).id === "string" && typeof (item as MyTestMatter).title === "string" && typeof (item as MyTestMatter).passage === "string")); }
