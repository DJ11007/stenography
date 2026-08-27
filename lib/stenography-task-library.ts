export const STENOGRAPHY_TASK_CATEGORIES = ["Task", "Basic", "Paper", "Court", "Books", "Editor", "Speech", "Article"] as const;
export type StenographyTaskCategory = (typeof STENOGRAPHY_TASK_CATEGORIES)[number];

export function normalizeTaskCategory(value: unknown): StenographyTaskCategory {
  return typeof value === "string" && (STENOGRAPHY_TASK_CATEGORIES as readonly string[]).includes(value) ? (value as StenographyTaskCategory) : "Task";
}

export type StenographyTaskSummary = {
  testId: string;
  slug: string;
  title: string;
  category: StenographyTaskCategory;
  language: "English" | "Hindi";
  inputSystemId: string;
  durationSeconds: number;
  requiredWpm: number;
  requiredAccuracy: number;
  hasAudio: boolean;
};
