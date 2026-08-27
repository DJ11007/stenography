export type VacancyCategory = "jobs" | "admit-cards" | "results";

export type VacancyBreakdownItem = { postName: string; totalPosts: string; eligibility: string };
export type UsefulLink = { label: string; url: string };

export type Vacancy = {
  slug: string;
  category: VacancyCategory;
  title: string;
  organization: string;
  summary: string;
  status: string;
  importantDates: string[];
  applicationFees: string[];
  eligibility: string[];
  ageLimit: string[];
  notificationUrl: string | null;
  officialUrl: string | null;
  vacancyBreakdown: VacancyBreakdownItem[];
  usefulLinks: UsefulLink[];
  noticeDocuments: UsefulLink[];
};

export type CoursePackage = {
  id: string;
  title: string;
  category: string;
  durationLabel: string;
  priceLabel: string;
  originalPriceLabel: string | null;
  features: string[];
  couponCode: string | null;
  couponDescription: string | null;
  isPopular: boolean;
};

/** Suggested categories shown in the admin's category field and used to
 * order the homepage Buy Now tabs. Not an enum -- a package's `category` is
 * free text so the admin can add new subjects without a migration; any
 * category found in published packages that isn't in this list still gets
 * its own tab, just ordered after these. */
export const COURSE_PACKAGE_CATEGORIES = ["Typing", "Efficiency", "Stenography", "Combo / All-in-one"];

export type StudentFeedback = {
  id: string;
  displayName: string;
  rating: number | null;
  message: string;
  createdAt: string;
};

export const VACANCY_CATEGORY_LABELS: Record<VacancyCategory, string> = {
  jobs: "Latest Jobs",
  "admit-cards": "Admit Cards",
  results: "Results",
};

type VacancyRow = {
  slug: string; category: string; title: string; organization: string; summary: string; status: string;
  important_dates: string[] | null; application_fees: string[] | null; eligibility: string[] | null; age_limit: string[] | null;
  notification_url: string | null; official_url: string | null;
  vacancy_breakdown: VacancyBreakdownItem[] | null; useful_links: UsefulLink[] | null; notice_documents: UsefulLink[] | null;
};

export function mapVacancyRow(row: VacancyRow): Vacancy {
  return {
    slug: row.slug, category: row.category as VacancyCategory, title: row.title, organization: row.organization,
    summary: row.summary, status: row.status, importantDates: row.important_dates ?? [], applicationFees: row.application_fees ?? [],
    eligibility: row.eligibility ?? [], ageLimit: row.age_limit ?? [], notificationUrl: row.notification_url, officialUrl: row.official_url,
    vacancyBreakdown: row.vacancy_breakdown ?? [], usefulLinks: row.useful_links ?? [], noticeDocuments: row.notice_documents ?? [],
  };
}

type CoursePackageRow = {
  id: string; title: string; category: string | null; duration_label: string; price_label: string; original_price_label: string | null;
  features: string[] | null; coupon_code: string | null; coupon_description: string | null; is_popular: boolean;
};

export function mapCoursePackageRow(row: CoursePackageRow): CoursePackage {
  return {
    id: row.id, title: row.title, category: row.category ?? "Typing", durationLabel: row.duration_label, priceLabel: row.price_label,
    originalPriceLabel: row.original_price_label, features: row.features ?? [], couponCode: row.coupon_code,
    couponDescription: row.coupon_description, isPopular: row.is_popular,
  };
}

type FeedbackRow = { id: string; display_name: string; rating: number | null; message: string; created_at: string };

export function mapFeedbackRow(row: FeedbackRow): StudentFeedback {
  return { id: row.id, displayName: row.display_name, rating: row.rating, message: row.message, createdAt: row.created_at };
}

export type OfficialWebsite = { id: string; name: string; url: string; description: string };

type OfficialWebsiteRow = { id: string; name: string; url: string; description: string };

export function mapOfficialWebsiteRow(row: OfficialWebsiteRow): OfficialWebsite {
  return { id: row.id, name: row.name, url: row.url, description: row.description };
}
