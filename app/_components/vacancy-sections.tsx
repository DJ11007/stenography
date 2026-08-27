import Link from "next/link";
import { VACANCY_CATEGORY_LABELS, type OfficialWebsite, type Vacancy, type VacancyCategory } from "@/lib/homepage-content";

const categories: VacancyCategory[] = ["jobs", "admit-cards", "results"];

export function VacancySections({ vacancies, officialWebsites = [], compact = false }: { vacancies: Vacancy[]; officialWebsites?: OfficialWebsite[]; compact?: boolean }) {
  const websites = officialWebsites.slice(0, compact ? 3 : undefined);
  return (
    <section aria-labelledby="vacancy-updates-title" className="py-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-xs font-black uppercase tracking-widest text-blue-700">Government exam updates</p><h2 id="vacancy-updates-title" className="mt-1 text-3xl font-black text-slate-950">Jobs, admit cards, results &amp; official websites</h2><p className="mt-2 max-w-3xl text-sm text-slate-600">Updated by Samradhi Classes administrators.</p></div>
        {compact && <Link href="/vacancies" className="rounded-xl border border-blue-700 px-4 py-2 text-sm font-black text-blue-700 hover:bg-blue-50">Open all updates</Link>}
      </div>
      <div className="grid gap-5 lg:grid-cols-4">
        {categories.map((category) => {
          const items = vacancies.filter((vacancy) => vacancy.category === category).slice(0, compact ? 3 : undefined);
          return <article key={category} id={category} className="flex min-h-80 flex-col rounded-2xl border border-blue-100 bg-white shadow-sm"><h3 className="rounded-t-2xl bg-blue-800 px-5 py-4 text-xl font-black text-white">{VACANCY_CATEGORY_LABELS[category]}</h3><ul className="flex-1 divide-y divide-slate-100 px-5">{items.length===0 && <li className="py-4 text-sm text-slate-500">No {VACANCY_CATEGORY_LABELS[category].toLowerCase()} published yet.</li>}{items.map((vacancy) => <li key={vacancy.slug} className="py-4"><Link href={`/vacancies/${vacancy.slug}`} className="font-bold leading-6 text-blue-800 underline-offset-4 hover:underline">{vacancy.title}</Link><span className="mt-1 block text-xs font-bold text-amber-700">{vacancy.status}</span></li>)}</ul><Link href={`/vacancies#${category}`} className="m-5 mt-3 self-end rounded-full bg-blue-700 px-5 py-2.5 text-sm font-black text-white hover:bg-blue-800">View More</Link></article>;
        })}
        <article id="official-websites" className="flex min-h-80 flex-col rounded-2xl border border-emerald-100 bg-white shadow-sm">
          <h3 className="rounded-t-2xl bg-emerald-800 px-5 py-4 text-xl font-black text-white">Official Websites</h3>
          <ul className="flex-1 divide-y divide-slate-100 px-5">
            {websites.length === 0 && <li className="py-4 text-sm text-slate-500">No official websites published yet.</li>}
            {websites.map((site) => (
              <li key={site.id} className="py-4">
                <a href={site.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-2 font-bold leading-6 text-emerald-800 underline-offset-4 hover:underline">
                  {site.name}<span aria-hidden className="text-xs">↗</span>
                </a>
                {site.description && <span className="mt-1 block text-xs text-slate-500">{site.description}</span>}
              </li>
            ))}
          </ul>
          <Link href="/vacancies#official-websites" className="m-5 mt-3 self-end rounded-full bg-emerald-700 px-5 py-2.5 text-sm font-black text-white hover:bg-emerald-800">View More</Link>
        </article>
      </div>
    </section>
  );
}
