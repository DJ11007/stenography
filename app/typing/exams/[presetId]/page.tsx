import { notFound } from "next/navigation";
import { ConfigurableTypingExam } from "../../_components/configurable-typing-exam";
import { getExamPreset } from "@/lib/typing-curriculum";

export default async function ExamPresetPage({ params }: PageProps<"/typing/exams/[presetId]">) { const preset = getExamPreset((await params).presetId); if (!preset) notFound(); return <ConfigurableTypingExam preset={preset} mode="exam"/>; }
