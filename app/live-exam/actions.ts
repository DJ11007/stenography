"use server";

import { managedVersionToPreset, type ManagedTestVersion } from "@/lib/admin-tests";
import { PATTERN_TYPING_CATEGORY } from "@/lib/live-exam";
import { createClient } from "@/lib/supabase/server";
import type { ExamPreset } from "@/lib/typing-curriculum";

export type LiveTypingSection = { preset: ExamPreset; managedTest: { testId: string; versionId: string; mode: "learn" | "practice" | "exam" | "stenography"; isLive: false } };

// A typing section's test, handed to the exam page only once that section has started (so its passage is not in the
// page beforehand). Its rules and marks are the exam pattern's (RSMSSB LDC → the Rajasthan LDC scheme).
export async function loadLiveExamTypingSection(sectionId: string): Promise<{ ok: true; section: LiveTypingSection } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data: section } = await supabase.from("live_exam_sections").select("id,exam_id,kind,test_id,live_exams(pattern)").eq("id", sectionId).maybeSingle();
  if (!section || section.kind !== "typing") return { ok: false, error: "This part is not available." };
  const { data: timeline } = await supabase.rpc("live_exam_timeline", { p_exam_id: section.exam_id });
  const slot = ((timeline ?? []) as { section_id: string; starts_at: string; ends_at: string }[]).find((row) => row.section_id === sectionId);
  const now = Date.now();
  if (!slot || now < Date.parse(slot.starts_at)) return { ok: false, error: "This part has not started yet." };
  if (now >= Date.parse(slot.ends_at)) return { ok: false, error: "This part is over." };
  const { data: test } = await supabase.from("tests").select("id,slug,current_version_id").eq("id", section.test_id).maybeSingle();
  const { data: v } = test?.current_version_id ? await supabase.from("test_versions").select("*").eq("id", test.current_version_id).maybeSingle() : { data: null };
  if (!test || !v) return { ok: false, error: "The test for this part could not be loaded. Tell the exam supervisor." };
  const configuration = v.configuration as Record<string, unknown> | null;
  const version: ManagedTestVersion = { id: v.id, testId: v.test_id, versionNumber: v.version_number, title: v.title, description: v.description ?? "", slug: test.slug, language: v.language, inputSystemId: v.input_system_id, mode: v.mode, durationSeconds: v.duration_seconds, passage: v.passage, requiredWpm: Number(v.required_wpm), requiredAccuracy: Number(v.required_accuracy), backspaceMode: v.backspace_mode, wordMethod: v.word_method, highlightMode: v.highlight_mode, visibility: v.visibility, audioPath: (configuration?.audio_path as string | null) ?? null, examCategory: (configuration?.exam_category as string | null) ?? null };
  const pattern = (section.live_exams as unknown as { pattern: string } | null)?.pattern ?? "custom";
  const preset = managedVersionToPreset(version, PATTERN_TYPING_CATEGORY[pattern]);
  return { ok: true, section: { preset, managedTest: { testId: test.id, versionId: v.id, mode: version.mode, isLive: false } } };
}
