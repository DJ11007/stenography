// A typing-test attempt is kept in the browser until the server confirms it was
// saved. The result screen used to show the score even when saving failed
// (signed out, network drop, or the site redeployed while the test was open),
// so the attempt silently never reached the student's results or the admin.
// With the copy kept here, it is retried, and re-sent the next time the test
// page opens (for example after the "Refresh page" a redeploy needs).

const KEY_PREFIX = "pending-typing-attempt:";
const MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;

export function savePendingAttempt(key: string, payload: unknown) {
  try { localStorage.setItem(KEY_PREFIX + key, JSON.stringify({ savedAt: Date.now(), payload })); } catch { /* storage unavailable: nothing to keep */ }
}

export function readPendingAttempt<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(KEY_PREFIX + key);
    if (!raw) return null;
    const stored = JSON.parse(raw) as { savedAt?: number; payload?: T };
    if (!stored.payload || typeof stored.savedAt !== "number" || Date.now() - stored.savedAt > MAX_AGE_MS) { clearPendingAttempt(key); return null; }
    return stored.payload;
  } catch { return null; }
}

export function clearPendingAttempt(key: string) {
  try { localStorage.removeItem(KEY_PREFIX + key); } catch { /* storage unavailable */ }
}

// A live exam typing part keeps a running copy of the answer while it is typed (separately from the attempt kept
// above, so a reload during the part never hands it in early). Only the exam's Final Submit sends it, and only for a
// part the server never received.
const DRAFT_PREFIX = "live-exam-draft:";
export function saveLiveExamDraft(sectionId: string, job: unknown) {
  try { localStorage.setItem(DRAFT_PREFIX + sectionId, JSON.stringify({ savedAt: Date.now(), payload: job })); } catch { /* storage unavailable */ }
}
export function readLiveExamDraft<T>(sectionId: string): T | null {
  try {
    const raw = localStorage.getItem(DRAFT_PREFIX + sectionId);
    const stored = raw ? (JSON.parse(raw) as { payload?: T }) : null;
    return stored?.payload ?? null;
  } catch { return null; }
}
export function clearLiveExamDraft(sectionId: string) {
  try { localStorage.removeItem(DRAFT_PREFIX + sectionId); } catch { /* storage unavailable */ }
}

// Next.js gives every Server Action a new id at each deploy; a page loaded
// before the deploy can no longer call it until it is refreshed.
export function isStaleServerActionError(error: unknown) {
  return error instanceof Error && /Server Action ".*" was not found on the server|Failed to find Server Action/i.test(error.message);
}
