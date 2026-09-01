import { createClient } from "./supabase/server";
import { mapCoursePackageRow, mapFeedbackRow, mapOfficialWebsiteRow, mapVacancyRow, type CoursePackage, type OfficialWebsite, type Vacancy, type VacancyCategory, type StudentFeedback } from "./homepage-content";

// A PostgrestError extends Error, and Error instances lose their own
// properties (message/code/details/hint) when Next.js forwards a server
// console.error call to the browser's dev overlay -- they render as an
// unhelpful "{}" there even though the error itself is populated. Logging
// the specific fields as a plain object survives that forwarding intact,
// so the next time one of these listings fails the actual cause (a
// Postgres error code, an RLS denial, a missing function) is visible
// instead of a blank object.
function logRpcFailure(label: string, error: { message: string; code: string; details: string; hint: string }) {
  console.error(label, { message: error.message, code: error.code, details: error.details, hint: error.hint });
}

export async function getPublishedCoursePackages(): Promise<CoursePackage[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_published_course_packages");
  if (error) { logRpcFailure("Course package listing failed", error); return []; }
  return (data ?? []).map(mapCoursePackageRow);
}

export async function getPublishedVacancies(category?: VacancyCategory, limit?: number): Promise<Vacancy[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_published_vacancy_notices", { p_category: category ?? null, p_limit: limit ?? null });
  if (error) { logRpcFailure("Vacancy notice listing failed", error); return []; }
  return (data ?? []).map(mapVacancyRow);
}

export async function getPublishedVacancyBySlug(slug: string): Promise<Vacancy | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_published_vacancy_notice", { p_slug: slug });
  if (error || !data || !("slug" in data)) return null;
  return mapVacancyRow(data);
}

export async function getApprovedFeedback(limit = 20): Promise<StudentFeedback[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_approved_feedback", { p_limit: limit });
  if (error) { logRpcFailure("Feedback listing failed", error); return []; }
  return (data ?? []).map(mapFeedbackRow);
}

export async function getPublishedOfficialWebsites(): Promise<OfficialWebsite[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_published_official_websites");
  if (error) { logRpcFailure("Official website listing failed", error); return []; }
  return (data ?? []).map(mapOfficialWebsiteRow);
}
