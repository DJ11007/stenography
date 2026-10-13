import type { WorkingMatterSnapshot } from "./word-docx";

// The working document is designed on its own full-screen page and handed back to the test form.
// Between the two pages it is parked in this browser's localStorage under a key for the test being
// edited ("new" for a test that has not been saved yet):
//   staged - the finished document, picked up by the test form and saved with the test
//   wip    - work in progress while the editor page is open (so a refresh or crash loses nothing)

export type MatterTarget = string; // a test id, or "new"
export type MatterSlot = "staged" | "wip";

const keyFor = (target: MatterTarget, slot: MatterSlot) => `samradhi-word-matter-${slot}:${target || "new"}`;

function safeStorage(): Storage | null {
  try { return typeof window === "undefined" ? null : window.localStorage; } catch { return null; }
}

export function isWorkingMatter(value: unknown): value is WorkingMatterSnapshot {
  const matter = value as Partial<WorkingMatterSnapshot> | null;
  return Boolean(matter && typeof matter === "object" && Array.isArray(matter.paragraphs) && matter.paragraphs.length > 0 && (matter.language === "English" || matter.language === "Hindi"));
}

export function readMatterDraft(target: MatterTarget, slot: MatterSlot): WorkingMatterSnapshot | null {
  const storage = safeStorage();
  if (!storage) return null;
  try {
    const parsed = JSON.parse(storage.getItem(keyFor(target, slot)) ?? "null");
    return isWorkingMatter(parsed) ? parsed : null;
  } catch { return null; }
}

export function writeMatterDraft(target: MatterTarget, slot: MatterSlot, matter: WorkingMatterSnapshot): boolean {
  const storage = safeStorage();
  if (!storage) return false;
  try { storage.setItem(keyFor(target, slot), JSON.stringify(matter)); return true; } catch { return false; }
}

export function clearMatterDraft(target: MatterTarget, slot?: MatterSlot) {
  const storage = safeStorage();
  if (!storage) return;
  try { for (const item of slot ? [slot] : (["staged", "wip"] as const)) storage.removeItem(keyFor(target, item)); } catch { /* ignore */ }
}

export function clearAllMatterDrafts() {
  const storage = safeStorage();
  if (!storage) return;
  try {
    const keys: string[] = [];
    for (let index = 0; index < storage.length; index++) { const key = storage.key(index); if (key && key.startsWith("samradhi-word-matter-")) keys.push(key); }
    for (const key of keys) storage.removeItem(key);
  } catch { /* ignore */ }
}

// A short readable summary of a document, for the card on the test form.
export function describeMatter(matter: WorkingMatterSnapshot): { paragraphs: number; tables: number; words: number; preview: string[] } {
  const texts = matter.paragraphs.map(item => (item.type === "table" ? item.rows.flat().join(" ") : item.runs.map(run => run.text).join("")));
  const words = texts.join(" ").split(/\s+/).filter(Boolean).length;
  return { paragraphs: matter.paragraphs.length, tables: matter.paragraphs.filter(item => item.type === "table").length, words, preview: texts.filter(text => text.trim()).slice(0, 3).map(text => (text.length > 160 ? `${text.slice(0, 160)}…` : text)) };
}
