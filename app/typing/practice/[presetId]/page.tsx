import { notFound } from "next/navigation";
import { getExamPreset } from "@/lib/typing-curriculum";
import { ConfigurableTypingExam } from "../../_components/configurable-typing-exam";

export default async function PracticePresetPage({ params }: PageProps<"/typing/practice/[presetId]">) {
  const preset = getExamPreset((await params).presetId);
  if (!preset) notFound();
  return <ConfigurableTypingExam preset={preset} mode="practice" />;
}
