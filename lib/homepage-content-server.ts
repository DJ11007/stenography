import { createClient } from "./supabase/server";
import { mapCoursePackageRow, mapFeedbackRow, mapOfficialWebsiteRow, mapVacancyRow, type CoursePackage, type OfficialWebsite, type Vacancy, type VacancyCategory, type StudentFeedback } from "./homepage-content";

export async function getPublishedCoursePackages(): Promise<CoursePackage[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_published_course_packages");
  if (error) { console.error("Course package listing failed", error); return []; }
  return (data ?? []).map(mapCoursePackageRow);
}

export async function getPublishedVacancies(category?: VacancyCategory, limit?: number): Promise<Vacancy[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_published_vacancy_notices", { p_category: category ?? null, p_limit: limit ?? null });
  if (error) { console.error("Vacancy notice listing failed", error); return []; }
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
  if (error) { console.error("Feedback listing failed", error); return []; }
  return (data ?? []).map(mapFeedbackRow);
}

export async function getPublishedOfficialWebsites(): Promise<OfficialWebsite[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_published_official_websites");
  if (error) { console.error("Official website listing failed", error); return []; }
  return (data ?? []).map(mapOfficialWebsiteRow);
}
