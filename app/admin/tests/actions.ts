"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeManagedTestRules, slugifyTest, validateManagedTest, type ManagedTestDraft, type ManagedTestMode, type ManagedTestStatus } from "@/lib/admin-tests";
import { EXAM_CATEGORIES } from "@/lib/exam-categories";
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
  // Practice (non-live) and Exam (non-live) tests don't ask the admin to
  // configure typing-behaviour settings at all any more -- the form
  // doesn't even render duration/required-speed/accuracy/backspace/word-
  // method/highlight fields for these modes (see test-manager.tsx's
  // showAdminRules). Force the same fixed platform defaults here too,
  // authoritatively, so a tampered or stale form submission can't sneak in
  // an arbitrary value where nothing is meant to be admin-configurable.
  // These values are exactly what this form's own defaultValues already
  // were before the fields were removed (DEFAULT_TYPING_SETTINGS' full
  // backspace / 5-character words / character highlighting, plus the same
  // 30 WPM / 90% reference target plain Practice already used) -- so no
  // existing test's stored settings change on its next save, and Exam-mode
  // students see exactly the same defaults the exam simulator's own
  // built-in presets already use.
  const forcedDefaultRules = (mode === "practice" || mode === "exam") && !isLive;
  // Exam (non-live) tests must belong to one of the 25 real exam categories
  // -- once chosen, that category's OWN researched pattern (duration/speed/
  // accuracy/backspace/wordMethod/highlightMode) is forced instead of the
  // flat generic default plain Practice uses. wordMethod/highlightMode fall
  // back to the flat "characters"/"character" default for any category that
  // doesn't specify its own (every category except Rajasthan LDC, today) --
  // this must mirror categoryPreset()'s own fallback in
  // lib/typing-curriculum.ts exactly, or an admin-managed exercise linked to
  // a category ends up with different typing behaviour than that same
  // category's own hardcoded "Official Pattern" preset. Practice mode is
  // completely unaffected -- it never had an examCategory and its own
  // forcedDefaultRules branch is unchanged.
  const examCategory = mode === "exam" && !isLive ? (text(formData, "examCategory") || null) : null;
  const examCategoryDefinition = examCategory ? EXAM_CATEGORIES.find((category) => category.slug === examCategory) : undefined;
  return normalizeManagedTestRules({
    title: text(formData, "title"), description: text(formData, "description"), slug: slugifyTest(text(formData, "slug") || text(formData, "title")), language,
    inputSystemId: text(formData, "inputSystemId"), mode, durationSeconds: forcedDefaultRules ? (examCategoryDefinition ? examCategoryDefinition.durationMinutes * 60 : 600) : (durationMinutes ? Number(durationMinutes) * 60 : 600),
    passage: String(formData.get("passage") ?? "").replace(/\r\n?/g, "\n"),
    requiredWpm: forcedDefaultRules ? (examCategoryDefinition ? (language === "Hindi" ? examCategoryDefinition.speedHindi : examCategoryDefinition.speedEnglish) : 30) : Number(formData.get("requiredWpm")),
    requiredAccuracy: forcedDefaultRules ? (examCategoryDefinition ? examCategoryDefinition.accuracy : 90) : Number(formData.get("requiredAccuracy")),
    backspaceMode: forcedDefaultRules ? (examCategoryDefinition ? examCategoryDefinition.backspaceMode : "full") : (["full", "word", "disabled"].includes(text(formData, "backspaceMode")) ? text(formData, "backspaceMode") : "full") as ManagedTestDraft["backspaceMode"],
    wordMethod: forcedDefaultRules ? (examCategoryDefinition?.wordMethod ?? "characters") : (text(formData, "wordMethod") === "spaces" ? "spaces" : "characters"),
    highlightMode: forcedDefaultRules ? (examCategoryDefinition?.highlightMode ?? "character") : (["character", "word", "none"].includes(text(formData, "highlightMode")) ? text(formData, "highlightMode") : "character") as ManagedTestDraft["highlightMode"],
    visibility: text(formData, "visibility") === "public" ? "public" : "private",
    isLive, startsAt: isLive ? iso("startsAt") : null, endsAt: isLive ? iso("endsAt") : null, resultsPublishAt: isLive ? iso("resultsPublishAt") : null,
    examCategory,
  });
}

const MAX_AUDIO_BYTES = 150 * 1024 * 1024;
const MAX_PDF_BYTES = 20 * 1024 * 1024;

async function resolveAudioPath(formData: FormData, testId: string | null, supabase: Awaited<ReturnType<typeof createClient>>): Promise<{ audioPath: string | null; error?: string }> {
  const removeAudio = formData.get("removeAudio") === "on";
  const existing = text(formData, "existingAudioPath") || null;
  const upload = formData.get("audioFile");
  if (!(upload instanceof File) || !upload.size) return { audioPath: removeAudio ? null : existing };
  if (!upload.type.startsWith("audio/")) return { audioPath: existing, error: "The dictation audio file must be an audio format." };
  if (upload.size > MAX_AUDIO_BYTES) return { audioPath: existing, error: "Dictation audio must be under 150 MB." };
  const bytes = new Uint8Array(await upload.arrayBuffer());
  const safeName = upload.name.normalize("NFKC").replace(/[^a-zA-Z0-9._ -]/g, "_").replace(/\s+/g, "-").slice(0, 120);
  const path = `${testId ?? crypto.randomUUID()}/${crypto.randomUUID()}-${safeName}`;
  const { error } = await supabase.storage.from("stenography-audio").upload(path, bytes, { contentType: upload.type, upsert: false });
  if (error) return { audioPath: existing, error: `Audio upload failed: ${error.message}` };
  return { audioPath: path };
}

// Available for every managed test mode (not just stenography) -- a
// ready-made question-paper PDF is useful regardless of mode, distinct
// from the Print/PDF toolbar button which prints the typed passage text
// itself rather than an admin-uploaded file.
async function resolvePdfPath(formData: FormData, testId: string | null, supabase: Awaited<ReturnType<typeof createClient>>): Promise<{ pdfPath: string | null; pdfFileName: string | null; error?: string }> {
  const removePdf = formData.get("removePdf") === "on";
  const existingPath = text(formData, "existingPdfPath") || null;
  const existingName = text(formData, "existingPdfFileName") || null;
  const upload = formData.get("pdfFile");
  if (!(upload instanceof File) || !upload.size) return removePdf ? { pdfPath: null, pdfFileName: null } : { pdfPath: existingPath, pdfFileName: existingName };
  if (upload.type !== "application/pdf") return { pdfPath: existingPath, pdfFileName: existingName, error: "The question paper must be a PDF file." };
  if (upload.size > MAX_PDF_BYTES) return { pdfPath: existingPath, pdfFileName: existingName, error: "The question paper PDF must be under 20 MB." };
  const bytes = new Uint8Array(await upload.arrayBuffer());
  if (new TextDecoder("latin1").decode(bytes.slice(0, 5)) !== "%PDF-") return { pdfPath: existingPath, pdfFileName: existingName, error: "Invalid PDF file signature." };
  const safeName = upload.name.normalize("NFKC").replace(/[^a-zA-Z0-9._ -]/g, "_").replace(/\s+/g, "-").slice(0, 120);
  const path = `${testId ?? crypto.randomUUID()}/${crypto.randomUUID()}-${safeName}`;
  const { error } = await supabase.storage.from("managed-test-pdfs").upload(path, bytes, { contentType: "application/pdf", upsert: false });
  if (error) return { pdfPath: existingPath, pdfFileName: existingName, error: `PDF upload failed: ${error.message}` };
  return { pdfPath: path, pdfFileName: safeName };
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
  const resolvedPdf = await resolvePdfPath(formData, id, supabase);
  if (resolvedPdf.error) return { error: resolvedPdf.error };
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
  const payload = { title: draft.title, description: draft.description, slug: draft.slug, language: draft.language, input_system_id: draft.inputSystemId, mode: draft.mode, duration_seconds: draft.durationSeconds, passage: validation.passage, required_wpm: draft.requiredWpm, required_accuracy: draft.requiredAccuracy, backspace_mode: draft.backspaceMode, word_method: draft.wordMethod, highlight_mode: draft.highlightMode, visibility: draft.visibility, passage_characters: validation.characterCount, passage_words: validation.wordCount, is_live: draft.isLive, live_starts_at: draft.startsAt, live_ends_at: draft.endsAt, results_publish_at: draft.resultsPublishAt, audio_path: audioPath, task_category: taskCategory, dictation_categories: dictationCategories, pdf_path: resolvedPdf.pdfPath, pdf_file_name: resolvedPdf.pdfFileName, exam_category: draft.examCategory ?? null };
  const runSave = (attemptPayload: typeof payload) => lockedMode
    ? supabase.rpc("save_section_managed_test", { p_test_id: id, p_payload: attemptPayload, p_publish: publish, p_mode: lockedMode })
    : draft.isLive
    ? supabase.rpc("save_scheduled_managed_test", { p_test_id: id, p_payload: attemptPayload, p_publish: publish })
    : supabase.rpc("save_managed_test", { p_test_id: id, p_payload: attemptPayload, p_publish: publish });
  let { error } = await runSave(payload);
  let finalSlug = draft.slug;
  // Real friction hit live, twice, by the same admin: creating a new test
  // whose title happens to match another in spirit (e.g. a Hindi
  // "EXERCISE-2" alongside an existing English "EXERCISE - 2") derives
  // the exact same slug and gets hard-blocked, even though the admin
  // never typed a URL slug themselves -- the collision is purely an
  // artifact of deriving one from the title. Auto-resolve it here
  // (WordPress-style "-2", "-3" suffixing) instead of making the admin
  // manually retry, but ONLY when creating a brand-new test (id is null)
  // and the admin left the "URL slug" field's own value empty -- an
  // admin who explicitly typed a slug into that field gets the
  // informative error below instead, since silently overriding their
  // explicit choice would be more surprising than helpful.
  const explicitSlug = text(formData, "slug");
  if (error?.code === "23505" && !id && !explicitSlug) {
    for (let suffix = 2; error?.code === "23505" && suffix <= 20; suffix += 1) {
      finalSlug = `${draft.slug}-${suffix}`;
      ({ error } = await runSave({ ...payload, slug: finalSlug }));
    }
  }
  if (error) {
    // A test's URL slug is derived from its title only once, when it's
    // first created -- renaming a test afterward does NOT regenerate it
    // unless the admin also edits the "URL slug" field directly. Over
    // time that lets an old, renamed test quietly keep holding a slug
    // that a brand new, differently-titled test collides with, with
    // nothing in the admin UI to explain why. Rather than leave the
    // admin guessing at a bare "already in use", look up which test
    // actually holds this slug today and name it -- this is exactly the
    // confusion a real admin hit. (Only reached here if auto-resolving
    // above didn't apply or ran out of attempts.)
    if (error.code === "23505") {
      const { data: conflict } = await supabase.from("tests").select("title,mode,status").eq("slug", finalSlug).maybeSingle();
      return { error: conflict
        ? `The web address "/tests/${finalSlug}" is already used by another test, currently titled "${conflict.title}" (${conflict.mode}, ${conflict.status}). A test's address comes from its title only when it's first created and doesn't change if you rename it later -- rename that other test, or type a different address into this test's own "URL slug" field.`
        : `The web address "/tests/${finalSlug}" is already in use by another test.` };
    }
    if (error.message?.toLowerCase().includes("aal2") || error.message?.toLowerCase().includes("authorized")) return { error: "Please verify admin MFA and sign in again before saving this test." };
    if (error.code === "PGRST202" || error.message?.toLowerCase().includes("schema cache")) return { error: "The required admin test migration has not been applied to Supabase yet." };
    return { error: `The test could not be saved (${error.code || "database error"}).` };
  }
  revalidateTestRoutes(draft.mode, draft.isLive);
  const slugNote = finalSlug !== draft.slug ? ` "${draft.slug}" was already taken by another test, so this one was saved at /tests/${finalSlug} instead.` : "";
  return { success: (publish ? "A new immutable version was saved and published." : "A new immutable draft version was saved.") + slugNote };
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

export type PermanentDeleteState = { error?: string; result?: { title: string; mode: string; versionCount: number; attemptCount: number; audioFileCount: number; pdfFileCount: number; cleanupJobs: { id: string; bucket: string; path: string; status: string; attempt_count: number }[] } };
type CleanupJob = { id: string; bucket: string; path: string; status: string; attempt_count: number };

// The two buckets a general managed test's files ever live in:
// stenography-audio (test_versions.configuration->>'audio_path',
// stenography dictation only) and managed-test-pdfs
// (->>'pdf_path', any mode) -- mirrors word-efficiency's cleanup-job
// processor, narrower because there are only these two buckets here.
async function processTestCleanupJob(job: CleanupJob): Promise<{ failed: boolean }> {
  const admin = createAdminClient();
  if (!admin) return { failed: true };
  const safeBucket = job.bucket === "stenography-audio" || job.bucket === "managed-test-pdfs";
  const safePath = Boolean(job.path) && !job.path.startsWith("/") && !job.path.includes("\\") && !job.path.split("/").includes("..");
  const configKey = job.bucket === "managed-test-pdfs" ? "pdf_path" : "audio_path";
  let status: "removed" | "failed" | "retained_shared" = "failed"; let cleanupError: string | null = null;
  if (!safeBucket || !safePath) cleanupError = "Cleanup job failed application scope validation.";
  else {
    const { data: references, error: referenceError } = await admin.from("test_versions").select("id").contains("configuration", { [configKey]: job.path }).limit(1);
    if (referenceError) cleanupError = `Reference check failed: ${referenceError.message}`;
    else if (references?.length) status = "retained_shared";
    else { const { error: removeError } = await admin.storage.from(job.bucket).remove([job.path]); cleanupError = removeError?.message ?? null; status = cleanupError ? "failed" : "removed"; }
  }
  await admin.from("test_storage_cleanup").update({ status, attempt_count: (job.attempt_count ?? 0) + 1, last_error: cleanupError?.slice(0, 1000) ?? null, last_attempted_at: new Date().toISOString() }).eq("id", job.id);
  return { failed: status === "failed" };
}

export async function permanentlyDeleteManagedTest(_: PermanentDeleteState, formData: FormData): Promise<PermanentDeleteState> {
  await requireAdmin();
  const testId = text(formData, "testId"); const typedTitle = String(formData.get("typedTitle") ?? "");
  if (!testId || !typedTitle || formData.get("destroyAcknowledged") !== "on") return { error: "Exact title and destruction acknowledgement are required." };
  const requestId = text(formData, "requestId") || crypto.randomUUID();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("permanently_delete_managed_test", { p_test_id: testId, p_typed_title: typedTitle, p_acknowledged: true, p_request_id: requestId });
  if (error || !data) return { error: error?.message ?? "Permanent deletion failed." };
  const result = data as { title: string; mode: string; version_count: number; attempt_count: number; audio_file_count: number; pdf_file_count: number; cleanup_jobs?: CleanupJob[] };
  for (const job of result.cleanup_jobs ?? []) { if (job.status === "removed" || job.status === "retained_shared") continue; await processTestCleanupJob(job); }
  revalidateTestRoutes();
  return { result: { title: result.title, mode: result.mode, versionCount: result.version_count, attemptCount: result.attempt_count, audioFileCount: result.audio_file_count, pdfFileCount: result.pdf_file_count, cleanupJobs: result.cleanup_jobs ?? [] } };
}
