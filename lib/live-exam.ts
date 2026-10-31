// Live Exam Center (docs/live-exam-center-plan.md): the shapes shared by the admin builder and the student exam page,
// the exam patterns the builder starts from, and India-time helpers (the admin types times in IST; the server may run
// in UTC, so a bare datetime-local value must never be parsed in the server's own time zone).
export type LiveExamSectionKind = "typing" | "word" | "excel";
export type LiveExamLanguage = "English" | "Hindi";
export type LiveExamSection = {
  kind: LiveExamSectionKind;
  language: LiveExamLanguage;
  label: string;
  testId: string;
  durationSeconds: number;
  gapAfterSeconds: number;
  maxMarks: number;
};
export type LiveExamPattern = {
  id: string;
  name: string;
  description: string;
  sections: Omit<LiveExamSection, "testId">[];
  instructions: string[];
};

export const RSMSSB_LDC_PATTERN: LiveExamPattern = {
  id: "rsmssb-ldc",
  name: "RSMSSB LDC",
  description: "Hindi typing 10 min → 2 min break → English typing 10 min → 5 min break → Word efficiency 10 min → 2 min break → Excel efficiency 10 min. 25 marks each, 100 in total.",
  sections: [
    { kind: "typing", language: "Hindi", label: "Hindi Typing", durationSeconds: 600, gapAfterSeconds: 120, maxMarks: 25 },
    { kind: "typing", language: "English", label: "English Typing", durationSeconds: 600, gapAfterSeconds: 300, maxMarks: 25 },
    { kind: "word", language: "English", label: "Word Efficiency", durationSeconds: 600, gapAfterSeconds: 120, maxMarks: 25 },
    { kind: "excel", language: "English", label: "Excel Efficiency", durationSeconds: 600, gapAfterSeconds: 0, maxMarks: 25 },
  ],
  instructions: [
    "The exam has four parts in this order: Hindi Typing (10 minutes), English Typing (10 minutes), Word Efficiency (10 minutes) and Excel Efficiency (10 minutes).",
    "After Hindi Typing there is a 2-minute break, after English Typing a 5-minute break and after Word Efficiency a 2-minute break. The next part starts by itself when the break timer reaches 00:00.",
    "Each part is submitted automatically when its time is over. You cannot go back to a part once it has ended.",
    "Each part carries 25 marks; the total is 100 marks. Typing is marked on correct words as per the RSMSSB scheme; there is no negative marking.",
    "Do not refresh, close or leave the exam page. If your internet stops, open the page again: the exam continues from the part that is running, but the time already passed is not given back.",
    "All timings follow the exam server's clock, the same for every candidate, not your computer's clock.",
    "Mobile phones and any outside help are not allowed. Use only the keyboard and mouse of your computer.",
  ],
};

export const LIVE_EXAM_PATTERNS: LiveExamPattern[] = [RSMSSB_LDC_PATTERN];
export const patternById = (id: string | null | undefined) => LIVE_EXAM_PATTERNS.find((pattern) => pattern.id === id) ?? null;

export const SECTION_KIND_LABEL: Record<LiveExamSectionKind, string> = { typing: "Typing", word: "Word Efficiency", excel: "Excel Efficiency" };

// India Standard Time is UTC+05:30 all year (no daylight saving).
/** "2026-11-02T10:00" typed in a datetime-local box, read as IST → ISO string; null when empty or invalid. */
export function istInputToIso(value: string | null | undefined): string | null {
  const text = (value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(text)) return null;
  const date = new Date(`${text}:00+05:30`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
/** An ISO time → "YYYY-MM-DDTHH:mm" in IST, for a datetime-local box. */
export function isoToIstInput(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() + 330 * 60000).toISOString().slice(0, 16);
}
/** Total length of an exam, sections and breaks (the last break counts too). */
export const examLengthSeconds = (sections: Pick<LiveExamSection, "durationSeconds" | "gapAfterSeconds">[]) =>
  sections.reduce((total, section) => total + section.durationSeconds + section.gapAfterSeconds, 0);
/** Whether a published exam has already started (its sections and times can no longer change). */
export const liveExamStarted = (exam: { status: string; starts_at: string }) => exam.status === "published" && new Date(exam.starts_at).getTime() <= Date.now();
