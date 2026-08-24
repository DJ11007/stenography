import { ConfigurableTypingExam } from "@/app/typing/_components/configurable-typing-exam";
import { getExamPreset } from "@/lib/typing-curriculum";

export default function HindiTypingPage() {
  const preset = getExamPreset("rssb-ldc-hindi");
  if (!preset) return null;
  return <ConfigurableTypingExam preset={preset} mode="practice"/>;
}
