import { notFound } from "next/navigation";
import { LessonWorkspace } from "../../_components/lesson-workspace";
import { getPublishedLearningTests } from "@/lib/learning-tests-server";

export default async function LessonPage({ params }: PageProps<"/typing/learn/[lessonId]">) {
  const lessons = await getPublishedLearningTests();
  const { lessonId } = await params;
  const lesson = lessons.find((item) => item.slug === lessonId);
  if (!lesson) notFound();
  return <LessonWorkspace lesson={lesson} lessons={lessons}/>;
}
