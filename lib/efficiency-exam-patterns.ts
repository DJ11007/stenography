// Real government "Efficiency Test" patterns for Word/Excel Efficiency test
// authoring, researched the same way lib/exam-categories.ts and
// lib/stenography-categories.ts were: web-sourced where an official
// notification/pattern is corroborated by multiple independent reports,
// otherwise explicitly flagged as coaching-material-reported rather than
// invented. This is reference information shown to the admin while
// authoring a test -- it does not gate or auto-fill anything, so a test can
// still be authored freely for boards not listed here.

export type EfficiencyExamPattern = {
  id: string;
  board: string;
  examName: string;
  subject: "Word" | "Excel" | "Both";
  durationMinutes: string;
  maximumMarks: string;
  taskFocus: string[];
  font?: string;
  sourced: boolean;
  notes: string[];
};

export const EFFICIENCY_EXAM_PATTERNS: EfficiencyExamPattern[] = [
  {
    id: "rssb-ldc-junior-assistant",
    board: "RSSB (Rajasthan Staff Selection Board)",
    examName: "LDC Grade-II / Junior Assistant",
    subject: "Word",
    durationMinutes: "10 minutes per language (English and Hindi run separately)",
    maximumMarks: "50 (English + Hindi efficiency combined)",
    taskFocus: ["Paragraph formatting", "Page setup", "Header/Footer", "Font", "Page background", "Tables", "Borders", "Spacing", "Find & Replace"],
    font: "Calibri (English), Kruti Dev 010 (Hindi)",
    sourced: true,
    notes: ["A candidate must score at least 9 out of 25 in the efficiency component to qualify, in addition to the separate typing-speed qualifying mark.", "Conducted on MS Word (commonly reported as the MS Word 2007 command set)."],
  },
  {
    id: "rhc-ldc",
    board: "Rajasthan High Court",
    examName: "LDC (Lower Division Clerk)",
    subject: "Word",
    durationMinutes: "10 minutes (Paper II, after a separate 10-minute Paper I speed test)",
    maximumMarks: "50",
    taskFocus: ["Text formatting", "Paragraph formatting", "Page formatting", "Table formatting", "Letter formatting"],
    font: "Calibri (English), Kruti Dev 010 (Hindi)",
    sourced: true,
    notes: ["The computer test has two papers: Paper I is the speed test, Paper II is this efficiency test.", "The language of the efficiency test matches the language of the preceding typing test."],
  },
  {
    id: "rhc-steno-pa",
    board: "Rajasthan High Court",
    examName: "Stenographer / Personal Assistant",
    subject: "Word",
    durationMinutes: "10 minutes (within a 20-minute overall computer test)",
    maximumMarks: "Combined with the speed-test score; not separately published as a fixed total",
    taskFocus: ["Text formatting", "Paragraph formatting", "Page formatting", "Table formatting", "Letter formatting"],
    font: "Calibri (English), Kruti Dev 010 (Hindi)",
    sourced: true,
    notes: ["Same efficiency-test task set as the RHC LDC pattern above.", "The language of the efficiency test matches the language of the shorthand/dictation test taken by that candidate."],
  },
  {
    id: "rsmssb-ldc-excel",
    board: "RSMSSB (Rajasthan Subordinate & Ministerial Services Board)",
    examName: "LDC (Excel component)",
    subject: "Excel",
    durationMinutes: "Reported as similar to the Word efficiency slot (~10 minutes); not independently confirmed",
    maximumMarks: "Not independently confirmed",
    taskFocus: ["Data entry", "SUM / AVERAGE", "SUMIF / SUMIFS", "ROUND / ROUNDUP / ROUNDDOWN", "Sorting a data range"],
    sourced: false,
    notes: ["This task list is reported consistently across coaching platforms (e.g. exam-practice academies), but was not found stated in an official RSMSSB notification during this research pass -- treat duration and marks as an estimate, not a confirmed figure.", "Use this as a reasonable starting task set for an Excel Efficiency test rather than an exact reproduction of a scored exam."],
  },
];
