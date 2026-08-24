import { ConfigurableTypingExam } from "@/app/typing/_components/configurable-typing-exam";
import { getExamPreset } from "@/lib/typing-curriculum";

export default function EnglishTypingPage() {
  const preset = getExamPreset("rssb-ldc-english");
  if (!preset) return null;
  return <ConfigurableTypingExam preset={preset} mode="practice"/>;
}
