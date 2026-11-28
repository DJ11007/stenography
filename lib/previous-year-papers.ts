// Previous-year exam papers (migration 202611282000): a label the admin puts on any published test that appeared
// in a real exam -- the exam's name, its date and a description. Shared by the admin form, the highlighted test
// cards and the Old Exam Papers page (/old-exam-papers).

export type PreviousYearSection = "typing" | "stenography" | "word" | "excel";
export const PREVIOUS_YEAR_SECTIONS: PreviousYearSection[] = ["typing", "stenography", "word", "excel"];
export const PREVIOUS_YEAR_SECTION_LABEL: Record<PreviousYearSection, string> = {
  typing: "Typing",
  stenography: "Stenography",
  word: "Word Efficiency",
  excel: "Excel Efficiency",
};

export type PreviousYearPaper = {
  section: PreviousYearSection;
  testId: string;
  examName: string;
  examDate: string | null;
  examYear: number;
  description: string | null;
};

type Row = { section: string; test_id: string; exam_name: string; exam_date: string | null; exam_year: number; description: string | null };
export function paperFromRow(row: Row): PreviousYearPaper {
  return { section: row.section as PreviousYearSection, testId: row.test_id, examName: row.exam_name, examDate: row.exam_date, examYear: row.exam_year, description: row.description };
}

export function isPreviousYearSection(value: unknown): value is PreviousYearSection {
  return typeof value === "string" && (PREVIOUS_YEAR_SECTIONS as string[]).includes(value);
}

/** "15 Sep 2024", or just the year when the exact date is not known. */
export function formatExamDate(paper: Pick<PreviousYearPaper, "examDate" | "examYear">): string {
  if (!paper.examDate) return String(paper.examYear);
  const [year, month, day] = paper.examDate.split("-").map(Number);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  if (!year || !month || !day) return String(paper.examYear);
  return `${day} ${months[month - 1]} ${year}`;
}

/** Checks the admin form. The year comes from the date when one is given. */
export function parsePreviousYearForm(input: { examName: unknown; examDate: unknown; examYear: unknown; description: unknown }):
  | { ok: true; value: { examName: string; examDate: string | null; examYear: number; description: string | null } }
  | { ok: false; error: string } {
  const examName = String(input.examName ?? "").trim();
  if (!examName) return { ok: false, error: "Write the exam name." };
  if (examName.length > 200) return { ok: false, error: "The exam name is too long (200 characters at most)." };
  const rawDate = String(input.examDate ?? "").trim();
  let examDate: string | null = null;
  let examYear = Number(String(input.examYear ?? "").trim());
  if (rawDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(rawDate) || Number.isNaN(Date.parse(`${rawDate}T00:00:00Z`))) return { ok: false, error: "The exam date is not a valid date." };
    examDate = rawDate;
    examYear = Number(rawDate.slice(0, 4));
  }
  if (!Number.isInteger(examYear) || examYear < 1990 || examYear > 2100) return { ok: false, error: "Give the exam date, or at least the exam year (for example 2024)." };
  const description = String(input.description ?? "").trim();
  if (description.length > 2000) return { ok: false, error: "The description is too long (2000 characters at most)." };
  return { ok: true, value: { examName, examDate, examYear, description: description || null } };
}

/** Groups papers by year, newest year first, and newest date first inside a year. */
export function groupPapersByYear<T extends Pick<PreviousYearPaper, "examYear" | "examDate">>(papers: T[]): { year: number; papers: T[] }[] {
  const sorted = [...papers].sort((a, b) => b.examYear - a.examYear || (b.examDate ?? "").localeCompare(a.examDate ?? ""));
  const groups: { year: number; papers: T[] }[] = [];
  for (const paper of sorted) {
    const last = groups[groups.length - 1];
    if (last && last.year === paper.examYear) last.papers.push(paper);
    else groups.push({ year: paper.examYear, papers: [paper] });
  }
  return groups;
}
