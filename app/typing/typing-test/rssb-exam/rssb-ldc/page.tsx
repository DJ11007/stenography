import { ConfigurableTypingExam } from "../../../_components/configurable-typing-exam";
import { getExamPreset } from "@/lib/typing-curriculum";

export default function LegacyRssbLdcPage() {
  const preset = getExamPreset("rssb-ldc-english");
  if (!preset) return null;
  return <ConfigurableTypingExam preset={preset} mode="exam" />;
}
