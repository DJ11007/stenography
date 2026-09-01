"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { normalizeManagedTestRules, slugifyTest, validateManagedTest, type ManagedTestDraft, type ManagedTestMode, type ManagedTestStatus } from "@/lib/admin-tests";
import { ALL_HALF_ERROR_CATEGORIES } from "@/lib/typing-test";

export type TestFormState = { error?: string; success?: string };
const text = (data: FormData, name: string) => String(data.get(name) ?? "").trim();

function revalidateTestRoutes(mode?: ManagedTestMode, isLive = false) {
  revalidatePath("/admin/tests");
  revalidatePath("/admin/learning-tests");
  revalidatePath("/admin/practice-tests");
  revalidatePath("/admin/exam-tests");
  revalidatePath("/admin/stenography-tests");
  revalidatePath("/tests");
  if (mode === "learn" || !mode) {
    revalidatePath("/typing/learn", "layout");
    revalidatePath("/typing/learn/english");
    revalidatePath("/typing/learn/hindi");
    revalidatePath("/typing/learn/[lessonId]", "page");
  }
  if (mode === "practice" || !mode) revalidatePath("/typing/practice", "layout");
  if (mode === "exam" || !mode) revalidatePath("/typing/exams", "layout");
  if (mode === "stenography" || !mode) { revalidatePath("/typing/stenography", "layout"); revalidatePath("/typing/practice/stenography/library/english"); revalidatePath("/typing/practice/stenography/library/hindi"); }
  if (isLive || !mode) revalidatePath("/live-test");
  revalidatePath("/");
}

function parseDraft(formData: FormData): ManagedTestDraft {
  const language = text(formData, "language") === "Hindi" ? "Hindi" : "English";
  const modeValue = text(formData, "mode");
  const mode = (["learn", "practice", "exam", "stenography"].includes(modeValue) ? modeValue : "practice") as ManagedTestDraft["mode"];
  const isLive = formData.get("isLive") === "on";
  const durationMinutes = text(formData, "durationMinutes");
  const iso = (name: string) => { const value = text(formData, name); const date = value ? new Date(value) : null; return date && Number.isFinite(date.getTime()) ? date.toISOString() : value || null; };
  return normalizeManagedTestRules({
    title: text(formData, "title"), description: text(formData, "description"), slug: slugifyTest(text(formData, "slug") || text(formData, "title")), language,
    inputSystemId: text(formData, "inputSystemId"), mode, durationSeconds: durationMinutes ? Number(durationMinutes) * 60 : 600,
    passage: String(formData.get("passage") ?? "").replace(/\r\n?/g, "\n"), requiredWpm: Number(formData.get("requiredWpm")), requiredAccuracy: Number(formData.get("requiredAccuracy")),
    backspaceMode: (["full", "word", "disabled"].includes(text(formData, "backspaceMode")) ? text(formData, "backspaceMode") : "full") as ManagedTestDraft["backspaceMode"],
    wordMethod: text(formData, "wordMethod") === "spaces" ? "spaces" : "characters",
    highlightMode: (["character", "word", "none"].includes(text(formData, "highlightMode")) ? text(formData, "highlightMode") : "character") as ManagedTestDraft["highlightMode"],
    visibility: text(formData, "visibility") === "public" ? "public" : "private",
    isLive, startsAt: isLive ? iso("startsAt") : null, endsAt: isLive ? iso("endsAt") : null, resultsPublishAt: isLive ? iso("resultsPublishAt") : null,
  });
}

const MAX_AUDIO_BYTES = 50 * 1024 * 1024;

async function resolveAudioPath(formData: FormData, testId: string | null, supabase: Awaited<ReturnType<typeof createClient>>): Promise<{ audioPath: string | null; error?: string }> {
  const removeAudio = formData.get("removeAudio") === "on";
  const existing = text(formData, "existingAudioPath") || null;
  const upload = formData.get("audioFile");
  if (!(upload instanceof File) || !upload.size) return { audioPath: removeAudio ? null : existing };
  if (!upload.type.startsWith("audio/")) return { audioPath: existing, error: "The dictation audio file must be an audio format." };
  if (upload.size > MAX_AUDIO_BYTES) return { audioPath: existing, error: "Dictation audio must be under 50 MB." };
  const bytes = new Uint8Array(await upload.arrayBuffer());
  const safeName = upload.name.normalize("NFKC").replace(/[^a-zA-Z0-9._ -]/g, "_").replace(/\s+/g, "-").slice(0, 120);
  const path = `${testId ?? crypto.randomUUID()}/${crypto.randomUUID()}-${safeName}`;
  const { error } = await supabase.storage.from("stenography-audio").upload(path, bytes, { contentType: upload.type, upsert: false });
  if (error) return { audioPath: existing, error: `Audio upload failed: ${error.message}` };
  return { audioPath: path };
}

async function persistManagedTest(formData: FormData, lockedMode?: ManagedTestMode): Promise<TestFormState> {
  await requireAdmin(); const draft = parseDraft(formData); const validation = validateManagedTest(draft);
  if (lockedMode && draft.mode !== lockedMode) return { error: `This section only accepts ${lockedMode} tests.` };
  if (validation.errors.length) return { error: validation.errors[0] };
  const id = text(formData, "testId") || null; const publish = formData.get("intent") === "publish"; const supabase = await createClient();
  let audioPath: string | null = null;
  if (draft.mode === "stenography") {
    const resolved = await resolveAudioPath(formData, id, supabase);
    if (resolved.error) return { error: resolved.error };
    audioPath = resolved.audioPath;
  }
  const taskCategory = draft.mode === "stenography" ? (text(formData, "taskCategory") || "Task") : null;
  // "Offer to student" categories not in ALL_HALF_ERROR_CATEGORIES (a
  // tampered form field, or a category name from a future/older client)
  // are silently dropped rather than stored -- managedVersionToPreset()
  // reads this back with the same validation, so a malformed value here
  // would just fall back to "offer everything" there anyway; filtering it
  // here keeps what's actually stored honest.
  const dictationCategories = draft.mode === "stenography" ? (() => {
    const parse = (name: string) => text(formData, name).split(",").map((item) => item.trim()).filter((item) => (ALL_HALF_ERROR_CATEGORIES as string[]).includes(item));
    const available = parse("dictationAvailable");
    const defaults = parse("dictationDefaults").filter((item) => available.includes(item));
    return { available, defaults };
  })() : null;
  const payload = { title: draft.title, description: draft.description, slug: draft.slug, language: draft.language, input_system_id: draft.inputSystemId, mode: draft.mode, duration_seconds: draft.durationSeconds, passage: validation.passage, required_wpm: draft.requiredWpm, required_accuracy: draft.requiredAccuracy, backspace_mode: draft.backspaceMode, word_method: draft.wordMethod, highlight_mode: draft.highlightMode, visibility: draft.visibility, passage_characters: validation.characterCount, passage_words: validation.wordCount, is_live: draft.isLive, live_starts_at: draft.startsAt, live_ends_at: draft.endsAt, results_publish_at: draft.resultsPublishAt, audio_path: audioPath, task_category: taskCategory, dictation_categories: dictationCategories };
  const { error } = lockedMode
    ? await supabase.rpc("save_section_managed_test", { p_test_id: id, p_payload: payload, p_publish: publish, p_mode: lockedMode })
    : draft.isLive
    ? await supabase.rpc("save_scheduled_managed_test", { p_test_id: id, p_payload: payload, p_publish: publish })
    : await supabase.rpc("save_managed_test", { p_test_id: id, p_payload: payload, p_publish: publish });
  if (error) {
    if (error.code === "23505") return { error: "That URL slug is already in use." };
    if (error.message?.toLowerCase().includes("aal2") || error.message?.toLowerCase().includes("authorized")) return { error: "Please verify admin MFA and sign in again before saving this test." };
    if (error.code === "PGRST202" || error.message?.toLowerCase().includes("schema cache")) return { error: "The required admin test migration has not been applied to Supabase yet." };
    return { error: `The test could not be saved (${error.code || "database error"}).` };
  }
  revalidateTestRoutes(draft.mode, draft.isLive);
  return { success: publish ? "A new immutable version was saved and published." : "A new immutable draft version was saved." };
}

export async function saveManagedTest(_: TestFormState, formData: FormData): Promise<TestFormState> { return persistManagedTest(formData); }

export async function saveLearningManagedTest(state: TestFormState, formData: FormData): Promise<TestFormState> {
  formData.set("mode", "learn");
  formData.set("visibility", "public");
  formData.set("intent", "publish");
  void state;
  return persistManagedTest(formData, "learn");
}

export async function savePracticeManagedTest(_: TestFormState, formData: FormData): Promise<TestFormState> { formData.set("mode", "practice"); return persistManagedTest(formData, "practice"); }
export async function saveExamManagedTest(_: TestFormState, formData: FormData): Promise<TestFormState> { formData.set("mode", "exam"); return persistManagedTest(formData, "exam"); }
export async function saveStenographyManagedTest(_: TestFormState, formData: FormData): Promise<TestFormState> { formData.set("mode", "stenography"); return persistManagedTest(formData, "stenography"); }

export async function setManagedTestStatus(formData: FormData) { await requireAdmin(); const id=text(formData,"testId"); const value=text(formData,"status"); if(!id||!["draft","published","unpublished","archived"].includes(value))return; const supabase=await createClient(); await supabase.rpc("set_managed_test_status",{p_test_id:id,p_status:value as ManagedTestStatus}); revalidateTestRoutes(); }
export async function duplicateManagedTest(formData: FormData) { await requireAdmin(); const id=text(formData,"testId"); if(!id)return; const supabase=await createClient(); await supabase.rpc("duplicate_managed_test",{p_test_id:id}); revalidateTestRoutes(); }
export async function deleteManagedTest(formData: FormData) { await requireAdmin(); const id=text(formData,"testId"); if(!id)return; const supabase=await createClient(); await supabase.rpc("delete_managed_test_if_safe",{p_test_id:id}); revalidateTestRoutes(); }
