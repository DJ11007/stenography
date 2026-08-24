export type VacancyCategory = "jobs" | "admit-cards" | "results";

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
};

export const VACANCIES: Vacancy[] = [
  {
    slug: "sample-rajasthan-clerk-recruitment",
    category: "jobs",
    title: "Sample Rajasthan Clerk Recruitment",
    organization: "Organization verification pending",
    summary: "Sample listing demonstrating how a verified clerk vacancy will appear.",
    status: "Sample data · Not open for applications",
    importantDates: ["Notification date: To be verified", "Application window: To be verified", "Exam date: To be verified"],
    applicationFees: ["General/OBC/EWS: To be verified", "SC/ST/PwBD: To be verified"],
    eligibility: ["Educational qualification: To be verified from the official notification", "Typing requirement: To be verified"],
    ageLimit: ["Minimum age: To be verified", "Maximum age and relaxations: To be verified"],
    notificationUrl: null,
    officialUrl: null,
  },
  {
    slug: "sample-informatics-assistant-recruitment",
    category: "jobs",
    title: "Sample Informatics Assistant Recruitment",
    organization: "Organization verification pending",
    summary: "Sample listing for a technology and typing-based government vacancy.",
    status: "Sample data · Verification pending",
    importantDates: ["Notification date: To be verified", "Last date: To be verified"],
    applicationFees: ["Application fee: To be verified"],
    eligibility: ["Degree/diploma requirement: To be verified", "Typing qualification: To be verified"],
    ageLimit: ["Age criteria: To be verified from the official notification"],
    notificationUrl: null,
    officialUrl: null,
  },
  {
    slug: "sample-stenographer-recruitment",
    category: "jobs",
    title: "Sample Stenographer Recruitment",
    organization: "Organization verification pending",
    summary: "Sample listing for stenography candidates; official requirements are not yet supplied.",
    status: "Sample data · Verification pending",
    importantDates: ["Application dates: To be verified", "Skill-test date: To be verified"],
    applicationFees: ["Category-wise fee: To be verified"],
    eligibility: ["Education and shorthand speed: To be verified"],
    ageLimit: ["Age limit and relaxation: To be verified"],
    notificationUrl: null,
    officialUrl: null,
  },
  {
    slug: "sample-clerk-admit-card",
    category: "admit-cards",
    title: "Sample Clerk Admit Card Update",
    organization: "Exam authority verification pending",
    summary: "Sample admit-card notice. Download information will be added after official verification.",
    status: "Sample data · Admit card link pending",
    importantDates: ["Admit-card release: To be verified", "Exam date: To be verified"],
    applicationFees: ["Not applicable"],
    eligibility: ["For applicants registered for the corresponding examination"],
    ageLimit: ["Refer to the verified recruitment notification"],
    notificationUrl: null,
    officialUrl: null,
  },
  {
    slug: "sample-stenographer-admit-card",
    category: "admit-cards",
    title: "Sample Stenographer Admit Card Update",
    organization: "Exam authority verification pending",
    summary: "Sample notice showing the future placement of an official admit-card update.",
    status: "Sample data · Official link pending",
    importantDates: ["Release date: To be verified", "Skill-test date: To be verified"],
    applicationFees: ["Not applicable"],
    eligibility: ["For eligible registered candidates"],
    ageLimit: ["Refer to the verified recruitment notification"],
    notificationUrl: null,
    officialUrl: null,
  },
  {
    slug: "sample-typing-test-result",
    category: "results",
    title: "Sample Typing Test Result Update",
    organization: "Result authority verification pending",
    summary: "Sample result listing. No score or result link has been copied from the references.",
    status: "Sample data · Result link pending",
    importantDates: ["Result publication: To be verified"],
    applicationFees: ["Not applicable"],
    eligibility: ["For candidates who appeared in the corresponding test"],
    ageLimit: ["Not applicable"],
    notificationUrl: null,
    officialUrl: null,
  },
  {
    slug: "sample-efficiency-test-result",
    category: "results",
    title: "Sample Efficiency Test Result Update",
    organization: "Result authority verification pending",
    summary: "Sample result notice ready to receive a genuine official result URL.",
    status: "Sample data · Verification pending",
    importantDates: ["Result date: To be verified"],
    applicationFees: ["Not applicable"],
    eligibility: ["For candidates who appeared in the corresponding efficiency test"],
    ageLimit: ["Not applicable"],
    notificationUrl: null,
    officialUrl: null,
  },
];

export const VACANCY_CATEGORY_LABELS: Record<VacancyCategory, string> = {
  jobs: "Latest Jobs",
  "admit-cards": "Admit Cards",
  results: "Results",
};

export function vacanciesByCategory(category: VacancyCategory) {
  return VACANCIES.filter((vacancy) => vacancy.category === category);
}

export function vacancyBySlug(slug: string) {
  return VACANCIES.find((vacancy) => vacancy.slug === slug);
}
