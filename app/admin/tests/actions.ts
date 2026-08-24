"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { normalizeManagedTestRules, slugifyTest, validateManagedTest, type ManagedTestDraft, type ManagedTestMode, type ManagedTestStatus } from "@/lib/admin-tests";

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
  if (mode === "stenography" || !mode) revalidatePath("/typing/stenography", "layout");
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

async function persistManagedTest(formData: FormData, lockedMode?: ManagedTestMode): Promise<TestFormState> {
  await requireAdmin(); const draft = parseDraft(formData); const validation = validateManagedTest(draft);
  if (lockedMode && draft.mode !== lockedMode) return { error: `This section only accepts ${lockedMode} tests.` };
  if (validation.errors.length) return { error: validation.errors[0] };
  const payload = { title: draft.title, description: draft.description, slug: draft.slug, language: draft.language, input_system_id: draft.inputSystemId, mode: draft.mode, duration_seconds: draft.durationSeconds, passage: validation.passage, required_wpm: draft.requiredWpm, required_accuracy: draft.requiredAccuracy, backspace_mode: draft.backspaceMode, word_method: draft.wordMethod, highlight_mode: draft.highlightMode, visibility: draft.visibility, passage_characters: validation.characterCount, passage_words: validation.wordCount, is_live: draft.isLive, live_starts_at: draft.startsAt, live_ends_at: draft.endsAt, results_publish_at: draft.resultsPublishAt };
  const id = text(formData, "testId") || null; const publish = formData.get("intent") === "publish"; const supabase = await createClient();
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
