import type { MetadataRoute } from "next";
import { getPublishedVacancies } from "@/lib/homepage-content-server";
import { absoluteUrl } from "@/lib/seo";

// Public pages only -- everything under /typing needs a login (see robots.ts).
const PAGES: { path: string; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"]; priority: number }[] = [
  { path: "/", changeFrequency: "daily", priority: 1 },
  { path: "/courses", changeFrequency: "weekly", priority: 0.9 },
  { path: "/live-test", changeFrequency: "daily", priority: 0.8 },
  { path: "/vacancies", changeFrequency: "daily", priority: 0.8 },
  { path: "/about", changeFrequency: "monthly", priority: 0.7 },
  { path: "/contact", changeFrequency: "monthly", priority: 0.7 },
  { path: "/connect", changeFrequency: "monthly", priority: 0.5 },
  { path: "/signup", changeFrequency: "yearly", priority: 0.5 },
  { path: "/login", changeFrequency: "yearly", priority: 0.3 },
  { path: "/privacy-policy", changeFrequency: "yearly", priority: 0.2 },
  { path: "/refund-policy", changeFrequency: "yearly", priority: 0.2 },
  { path: "/terms", changeFrequency: "yearly", priority: 0.2 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const vacancies = await getPublishedVacancies().catch(() => []);
  return [
    ...PAGES.map((page) => ({ url: absoluteUrl(page.path), changeFrequency: page.changeFrequency, priority: page.priority })),
    ...vacancies.map((vacancy) => ({ url: absoluteUrl(`/vacancies/${encodeURIComponent(vacancy.slug)}`), changeFrequency: "weekly" as const, priority: 0.6 })),
  ];
}
