"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { extractVacancyFromDocument, extractVacancyFromUrl } from "@/lib/vacancy-extraction-server";
import type { ExtractedVacancyDraft } from "@/lib/vacancy-extraction";
import { safePdfName, validatePdfUpload } from "@/lib/word-efficiency";

export type HomepageActionState = { error?: string; success?: string };

const ALLOWED_EXTRACTION_TYPES = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp"]);
const MAX_EXTRACTION_FILE_BYTES = 8 * 1024 * 1024;

export async function extractVacancyDraft(form: FormData): Promise<{ ok: true; draft: ExtractedVacancyDraft } | { ok: false; error: string }> {
  await requireAdmin();
  const url = String(form.get("extractionUrl") ?? "").trim();
  if (url) return extractVacancyFromUrl(url);
  const upload = form.get("extractionFile");
  if (!(upload instanceof File) || !upload.size) return { ok: false, error: "Choose a PDF/image, or paste a notice URL." };
  if (!ALLOWED_EXTRACTION_TYPES.has(upload.type)) return { ok: false, error: "Only PDF, PNG, JPEG, or WebP files are supported." };
  if (upload.size > MAX_EXTRACTION_FILE_BYTES) return { ok: false, error: "File is too large — please use a file under 8 MB." };
  const bytes = new Uint8Array(await upload.arrayBuffer());
  return extractVacancyFromDocument(bytes, upload.type);
}

const lines = (value: FormDataEntryValue | null) => String(value ?? "").split("\n").map((line) => line.trim()).filter(Boolean);

function parseBreakdownLines(value: FormDataEntryValue | null) {
  return lines(value).map((line) => {
    const [postName = "", totalPosts = "", eligibility = ""] = line.split("|").map((part) => part.trim());
    return { postName, totalPosts, eligibility };
  }).filter((row) => row.postName);
}

function parseLinkLines(value: FormDataEntryValue | null) {
  return lines(value).map((line) => {
    const [label = "", url = ""] = line.split("|").map((part) => part.trim());
    return { label, url };
  }).filter((row) => row.label && row.url);
}

type NoticeDocument = { label: string; url: string };

async function collectNoticeDocuments(formData: FormData, supabase: Awaited<ReturnType<typeof createClient>>): Promise<{ documents: NoticeDocument[]; error?: string }> {
  let kept: NoticeDocument[] = [];
  try {
    const raw = JSON.parse(String(formData.get("existingDocuments") ?? "[]"));
    if (Array.isArray(raw)) kept = raw.filter((item): item is NoticeDocument => Boolean(item?.label) && Boolean(item?.url));
  } catch { /* ignore malformed hidden field, treat as no kept documents */ }

  const labels = formData.getAll("documentLabel").map((value) => String(value).trim());
  const files = formData.getAll("documentFile");
  const uploaded: NoticeDocument[] = [];
  for (let index = 0; index < files.length; index++) {
    const file = files[index];
    const label = labels[index] ?? "";
    if (!(file instanceof File) || !file.size || !label) continue;
    const checked = validatePdfUpload(file);
    if (checked.errors.length) return { documents: [], error: checked.errors[0] };
    const bytes = new Uint8Array(await file.arrayBuffer());
    const fileName = safePdfName(checked.name);
    const path = `${crypto.randomUUID()}/${crypto.randomUUID()}-${fileName}`;
    const { error } = await supabase.storage.from("vacancy-notice-documents").upload(path, bytes, { contentType: "application/pdf", upsert: false });
    if (error) return { documents: [], error: `Document upload failed: ${error.message}` };
    const { data: publicUrlData } = supabase.storage.from("vacancy-notice-documents").getPublicUrl(path);
    uploaded.push({ label, url: publicUrlData.publicUrl });
  }
  return { documents: [...kept, ...uploaded] };
}

export async function saveCoursePackage(_: HomepageActionState, formData: FormData): Promise<HomepageActionState> {
  await requireAdmin();
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "").trim() || null;
  const { error } = await supabase.rpc("admin_save_course_package", {
    p_id: id,
    p_title: String(formData.get("title") ?? "").trim(),
    p_duration_label: String(formData.get("durationLabel") ?? "").trim(),
    p_price_label: String(formData.get("priceLabel") ?? "").trim(),
    p_original_price_label: String(formData.get("originalPriceLabel") ?? "").trim() || null,
    p_features: lines(formData.get("features")),
    p_coupon_code: String(formData.get("couponCode") ?? "").trim() || null,
    p_coupon_description: String(formData.get("couponDescription") ?? "").trim() || null,
    p_is_popular: formData.get("isPopular") === "on",
    p_is_published: formData.get("isPublished") === "on",
    p_display_order: Number(formData.get("displayOrder") ?? 0) || 0,
  });
  if (error) return { error: error.message };
  revalidatePath("/admin/homepage");
  revalidatePath("/");
  return { success: "Course package saved." };
}

export async function deleteCoursePackage(_: HomepageActionState, formData: FormData): Promise<HomepageActionState> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_delete_course_package", { p_id: String(formData.get("id") ?? "") });
  if (error) return { error: error.message };
  revalidatePath("/admin/homepage");
  revalidatePath("/");
  return { success: "Course package removed." };
}

export async function saveVacancyNotice(_: HomepageActionState, formData: FormData): Promise<HomepageActionState> {
  await requireAdmin();
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "").trim() || null;
  const { documents, error: documentsError } = await collectNoticeDocuments(formData, supabase);
  if (documentsError) return { error: documentsError };
  const { error } = await supabase.rpc("admin_save_vacancy_notice", {
    p_id: id,
    p_category: String(formData.get("category") ?? "jobs"),
    p_title: String(formData.get("title") ?? "").trim(),
    p_organization: String(formData.get("organization") ?? "").trim(),
    p_summary: String(formData.get("summary") ?? "").trim(),
    p_status: String(formData.get("status") ?? "").trim(),
    p_important_dates: lines(formData.get("importantDates")),
    p_application_fees: lines(formData.get("applicationFees")),
    p_eligibility: lines(formData.get("eligibility")),
    p_age_limit: lines(formData.get("ageLimit")),
    p_notification_url: String(formData.get("notificationUrl") ?? "").trim() || null,
    p_official_url: String(formData.get("officialUrl") ?? "").trim() || null,
    p_is_published: formData.get("isPublished") === "on",
    p_display_order: Number(formData.get("displayOrder") ?? 0) || 0,
    p_slug: String(formData.get("slug") ?? "").trim() || null,
    p_vacancy_breakdown: parseBreakdownLines(formData.get("vacancyBreakdown")),
    p_useful_links: parseLinkLines(formData.get("usefulLinks")),
    p_notice_documents: documents,
  });
  if (error) return { error: error.message };
  revalidatePath("/admin/homepage");
  revalidatePath("/");
  revalidatePath("/vacancies");
  return { success: "Vacancy notice saved." };
}

export async function deleteVacancyNotice(_: HomepageActionState, formData: FormData): Promise<HomepageActionState> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_delete_vacancy_notice", { p_id: String(formData.get("id") ?? "") });
  if (error) return { error: error.message };
  revalidatePath("/admin/homepage");
  revalidatePath("/");
  revalidatePath("/vacancies");
  return { success: "Vacancy notice removed." };
}

export async function setFeedbackApproved(_: HomepageActionState, formData: FormData): Promise<HomepageActionState> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_feedback_approved", { p_id: String(formData.get("id") ?? ""), p_approved: formData.get("approved") === "true" });
  if (error) return { error: error.message };
  revalidatePath("/admin/homepage");
  revalidatePath("/");
  return { success: "Feedback updated." };
}

export async function deleteFeedback(_: HomepageActionState, formData: FormData): Promise<HomepageActionState> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_delete_feedback", { p_id: String(formData.get("id") ?? "") });
  if (error) return { error: error.message };
  revalidatePath("/admin/homepage");
  revalidatePath("/");
  return { success: "Feedback removed." };
}

export async function saveOfficialWebsite(_: HomepageActionState, formData: FormData): Promise<HomepageActionState> {
  await requireAdmin();
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "").trim() || null;
  const { error } = await supabase.rpc("admin_save_official_website", {
    p_id: id,
    p_name: String(formData.get("name") ?? "").trim(),
    p_url: String(formData.get("url") ?? "").trim(),
    p_description: String(formData.get("description") ?? "").trim(),
    p_is_published: formData.get("isPublished") === "on",
    p_display_order: Number(formData.get("displayOrder") ?? 0) || 0,
  });
  if (error) return { error: error.message };
  revalidatePath("/admin/homepage");
  revalidatePath("/");
  revalidatePath("/vacancies");
  return { success: "Official website saved." };
}

export async function deleteOfficialWebsite(_: HomepageActionState, formData: FormData): Promise<HomepageActionState> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_delete_official_website", { p_id: String(formData.get("id") ?? "") });
  if (error) return { error: error.message };
  revalidatePath("/admin/homepage");
  revalidatePath("/");
  revalidatePath("/vacancies");
  return { success: "Official website removed." };
}
