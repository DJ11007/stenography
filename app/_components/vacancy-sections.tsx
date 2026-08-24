import Link from "next/link";
import { VACANCY_CATEGORY_LABELS, vacanciesByCategory, type VacancyCategory } from "@/lib/vacancies";

const categories: VacancyCategory[] = ["jobs", "admit-cards", "results"];

export function VacancySections({ compact = false }: { compact?: boolean }) {
  return (
    <section aria-labelledby="vacancy-updates-title" className="py-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-xs font-black uppercase tracking-widest text-blue-700">Government exam updates</p><h2 id="vacancy-updates-title" className="mt-1 text-3xl font-black text-slate-950">Jobs, admit cards and results</h2><p className="mt-2 max-w-3xl text-sm text-slate-600">Sample entries are clearly marked. Official information and links will be published only after verification.</p></div>
        {compact && <Link href="/vacancies" className="rounded-xl border border-blue-700 px-4 py-2 text-sm font-black text-blue-700 hover:bg-blue-50">Open all updates</Link>}
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        {categories.map((category) => {
          const vacancies = vacanciesByCategory(category).slice(0, compact ? 3 : undefined);
          return <article key={category} id={category} className="flex min-h-80 flex-col rounded-2xl border border-blue-100 bg-white shadow-sm"><h3 className="rounded-t-2xl bg-blue-800 px-5 py-4 text-xl font-black text-white">{VACANCY_CATEGORY_LABELS[category]}</h3><ul className="flex-1 divide-y divide-slate-100 px-5">{vacancies.map((vacancy) => <li key={vacancy.slug} className="py-4"><Link href={`/vacancies/${vacancy.slug}`} className="font-bold leading-6 text-blue-800 underline-offset-4 hover:underline">{vacancy.title}</Link><span className="mt-1 block text-xs font-bold text-amber-700">{vacancy.status}</span></li>)}</ul><Link href={`/vacancies#${category}`} className="m-5 mt-3 self-end rounded-full bg-blue-700 px-5 py-2.5 text-sm font-black text-white hover:bg-blue-800">View More</Link></article>;
        })}
      </div>
    </section>
  );
}
