import type { TypingLesson, TypingLessonCategory } from "./typing-curriculum";

export type ManagedLearningTest = TypingLesson & { slug: string; durationSeconds: number };
type LearningTestRow = { id: string; slug: string; title: string; language?: string | null; current_version_id: string | null; published_at: string | null };
type LearningVersionRow = { id: string; description: string | null; passage: string; required_accuracy: number; duration_seconds: number; configuration?: Record<string, unknown> | null };
const categories = new Set<TypingLessonCategory>(["home-row", "upper-row", "lower-row", "capitals", "numbers", "punctuation", "passages"]);

export function buildManagedLearningTests(tests: LearningTestRow[], versions: LearningVersionRow[]): ManagedLearningTest[] {
  const versionMap = new Map(versions.map((version) => [version.id, version]));
  return tests.flatMap((test, index) => {
    const version = test.current_version_id ? versionMap.get(test.current_version_id) : null;
    if (!version) return [];
    const configuredCategory = version.configuration?.learning_category;
    const category = typeof configuredCategory === "string" && categories.has(configuredCategory as TypingLessonCategory) ? configuredCategory as TypingLessonCategory : "passages";
    return [{ id: test.id, slug: test.slug, order: index + 1, title: test.title, shortDescription: version.description || "Guided typing lesson created by Samradhi Classes.", category, targetKeys: [], content: version.passage, timedContent: version.passage, unlockAccuracy: Number(version.required_accuracy), durationSeconds: version.duration_seconds }];
  });
}

