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

type EfficiencyKind = "word" | "excel";
export type LiveEfficiencySection =
  | { kind: "word"; attemptId: string; snapshot: unknown; status: string; durationSeconds: number; remainingSeconds: number; initialDocument: unknown }
  | { kind: "excel"; attemptId: string; snapshot: unknown; status: string; remainingSeconds: number; original: unknown; initialDocument: unknown };

// When a part is open: the section's timeline slot, or a reason it cannot be used now.
async function openSection(supabase: Awaited<ReturnType<typeof createClient>>, sectionId: string, kinds: string[]) {
  const { data: section } = await supabase.from("live_exam_sections").select("id,exam_id,kind,test_id").eq("id", sectionId).maybeSingle();
  if (!section || !kinds.includes(section.kind)) return { error: "This part is not available." } as const;
  const { data: timeline } = await supabase.rpc("live_exam_timeline", { p_exam_id: section.exam_id });
  const slot = ((timeline ?? []) as { section_id: string; starts_at: string; ends_at: string }[]).find((row) => row.section_id === sectionId);
  const now = Date.now();
  if (!slot || now < Date.parse(slot.starts_at)) return { error: "This part has not started yet." } as const;
  if (now >= Date.parse(slot.ends_at)) return { error: "This part is over." } as const;
  return { section, startsAt: slot.starts_at, secondsLeft: Math.max(1, Math.floor((Date.parse(slot.ends_at) - now) / 1000)) } as const;
}

// The test's duration option to start with: the shortest that covers the time left in the part (the screen's own
// timer is then capped at the part's end, so the part's end always comes first), else the longest there is.
const durationFor = (options: number[] | null | undefined, secondsLeft: number) => {
  const sorted = [...(options ?? [])].filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  return sorted.find((value) => value >= secondsLeft) ?? sorted[sorted.length - 1] ?? null;
};

// A Word / Excel part: starts the student's attempt of the part's test when the part opens — or carries on with the one
// they already started in this part (a refresh), linking it to the part if it was already submitted.
export async function startLiveExamEfficiencySection(sectionId: string): Promise<{ ok: true; section: LiveEfficiencySection } | { ok: true; submitted: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in again to continue." };
  const open = await openSection(supabase, sectionId, ["word", "excel"]);
  if ("error" in open) return { ok: false, error: open.error ?? "This part is not available." };
  const kind = open.section.kind as EfficiencyKind, testId = open.section.test_id as string;
  const table = kind === "word" ? "word_efficiency_attempts" : "excel_efficiency_attempts";
  const columns = kind === "word" ? "id,status,started_at,selected_duration_seconds,snapshot,document_autosave" : "id,status,started_at,selected_duration_seconds,snapshot,original_document_snapshot,document_autosave";
  const findAttempt = async () => (await supabase.from(table).select(columns).eq("student_id", user.id).eq("test_id", testId).gte("started_at", open.startsAt).order("started_at", { ascending: false }).limit(1).maybeSingle()).data as Record<string, unknown> | null;
  let attempt = await findAttempt();
  if (attempt && (attempt.status === "submitted" || attempt.status === "completed")) {
    await supabase.rpc("record_live_exam_section", { p_section_id: sectionId, p_attempt_id: attempt.id });
    return { ok: true, submitted: true };
  }
  if (!attempt) {
    const versions = kind === "word" ? "word_efficiency_versions" : "excel_efficiency_versions";
    const { data: test } = await supabase.from(kind === "word" ? "word_efficiency_tests" : "excel_efficiency_tests").select("current_version_id").eq("id", testId).maybeSingle();
    const { data: version } = test?.current_version_id ? await supabase.from(versions).select("*").eq("id", test.current_version_id).maybeSingle() : { data: null };
    const duration = durationFor(version?.duration_options as number[] | undefined, open.secondsLeft);
    if (!version || !duration) return { ok: false, error: "The test for this part could not be loaded. Tell the exam supervisor." };
    if (kind === "word") {
      const delivery = version.delivery_onscreen ? "onscreen" : version.delivery_pdf ? "pdf" : null;
      if (!delivery) return { ok: false, error: "This Word test is set to a real-file paper, which cannot run inside a live exam. Tell the exam supervisor." };
      const { data: prepared, error } = await supabase.rpc("prepare_word_efficiency_attempt", { p_test_id: testId, p_duration_seconds: duration, p_delivery: delivery, p_live: false });
      if (error || !prepared) return { ok: false, error: error?.message ?? "This part could not be started." };
      const { error: initError } = await supabase.rpc("initialize_word_efficiency_document", { p_attempt_id: prepared, p_show_questions: true });
      if (initError) return { ok: false, error: initError.message };
      const { error: startError } = await supabase.rpc("start_word_efficiency_attempt", { p_attempt_id: prepared });
      if (startError) return { ok: false, error: "This part could not be started." };
    } else {
      const { error } = await supabase.rpc("prepare_excel_efficiency_attempt", { p_test_id: testId, p_duration_seconds: duration, p_show_questions: true, p_live: false });
      if (error) return { ok: false, error: error.message };
    }
    attempt = await findAttempt();
    if (!attempt) return { ok: false, error: "This part could not be started." };
  }
  // Time left: the attempt's own (server start time + its duration), never past the part's end.
  const snapshot = attempt.snapshot as { duration_seconds?: number; working_matter?: unknown };
  const durationSeconds = Number(attempt.selected_duration_seconds) || Number(snapshot?.duration_seconds) || open.secondsLeft;
  const ownLeft = attempt.started_at ? Math.max(0, durationSeconds - Math.floor((Date.now() - Date.parse(String(attempt.started_at))) / 1000)) : durationSeconds;
  const remainingSeconds = Math.min(ownLeft, open.secondsLeft);
  if (kind === "word") return { ok: true, section: { kind, attemptId: String(attempt.id), snapshot, status: String(attempt.status), durationSeconds, remainingSeconds, initialDocument: attempt.document_autosave ?? null } };
  return { ok: true, section: { kind, attemptId: String(attempt.id), snapshot, status: String(attempt.status), remainingSeconds, original: attempt.original_document_snapshot, initialDocument: attempt.document_autosave ?? null } };
}

// After a Word / Excel part is submitted: link the attempt to the part (its marks are read from the attempt).
export async function recordLiveExamEfficiency(sectionId: string, attemptId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("record_live_exam_section", { p_section_id: sectionId, p_attempt_id: attemptId });
  if (error && !/already submitted/i.test(error.message)) return { ok: false, error: error.message };
  return { ok: true };
}

// Final Submit, after the last part: every Word / Excel part the server has not received is handed in now — the
// student's own attempt of that part's test, started during the part, from its last autosave — and linked to the part.
export async function finalizeLiveExamEfficiency(examId: string): Promise<{ ok: boolean; handedIn: number }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, handedIn: 0 };
  const { data: sections } = await supabase.from("live_exam_sections").select("id,kind,test_id").eq("exam_id", examId).in("kind", ["word", "excel"]);
  const { data: timeline } = await supabase.rpc("live_exam_timeline", { p_exam_id: examId });
  const { data: linked } = await supabase.from("live_exam_section_attempts").select("section_id").eq("exam_id", examId);
  const done = new Set((linked ?? []).map((row) => row.section_id as string));
  let handedIn = 0;
  for (const section of sections ?? []) {
    if (done.has(section.id as string)) continue;
    const slot = ((timeline ?? []) as { section_id: string; starts_at: string; ends_at: string }[]).find((row) => row.section_id === section.id);
    if (!slot) continue;
    const table = section.kind === "word" ? "word_efficiency_attempts" : "excel_efficiency_attempts";
    const { data: attempt } = await supabase.from(table).select("id,status,document_autosave").eq("student_id", user.id).eq("test_id", section.test_id)
      .gte("started_at", new Date(Date.parse(slot.starts_at) - 60000).toISOString()).lte("started_at", slot.ends_at).order("started_at", { ascending: false }).limit(1).maybeSingle();
    if (!attempt) continue;
    if (attempt.status === "active") {
      // Past its time the submit takes the last autosave itself; before it, the autosave is what is handed in.
      const { error } = await supabase.rpc(section.kind === "word" ? "submit_word_efficiency_document" : "submit_excel_efficiency_document", { p_attempt_id: attempt.id, p_document: attempt.document_autosave ?? {} });
      if (error) continue;
    }
    const { error } = await supabase.rpc("record_live_exam_section", { p_section_id: section.id, p_attempt_id: attempt.id });
    if (!error) handedIn += 1;
  }
  return { ok: true, handedIn };
}
