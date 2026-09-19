import { VacancyCarousel } from "@/app/_components/vacancy-carousel";
import { VacancySections } from "@/app/_components/vacancy-sections";
import { BackButton } from "@/app/_components/back-button";
import { getPublishedOfficialWebsites, getPublishedVacancies } from "@/lib/homepage-content-server";

export default async function VacanciesPage() {
  const [vacancies, officialWebsites] = await Promise.all([getPublishedVacancies(), getPublishedOfficialWebsites()]);
  return <main className="min-h-screen bg-slate-50 text-slate-950"><header className="border-b border-blue-100 bg-white"><div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4"><BackButton href="/" label="Samradhi Classes" /></div></header><div className="mx-auto max-w-7xl px-4 py-8"><h1 className="text-4xl font-black">Vacancy updates</h1><p className="mt-3 max-w-3xl text-slate-600">A clean, advertisement-free centre for jobs, admit cards and results, maintained by Samradhi Classes.</p><div className="mt-7"><VacancyCarousel vacancies={vacancies}/></div><VacancySections vacancies={vacancies} officialWebsites={officialWebsites}/></div></main>;
}
