import Link from "next/link";
import { VacancyCarousel } from "@/app/_components/vacancy-carousel";
import { VacancySections } from "@/app/_components/vacancy-sections";
import { VACANCIES } from "@/lib/vacancies";

export default function VacanciesPage() {
  return <main className="min-h-screen bg-slate-50 text-slate-950"><header className="border-b border-blue-100 bg-white"><div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4"><Link href="/" className="font-black text-blue-800">← Samradhi Classes</Link><span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-900">Sample data</span></div></header><div className="mx-auto max-w-7xl px-4 py-8"><h1 className="text-4xl font-black">Vacancy updates</h1><p className="mt-3 max-w-3xl text-slate-600">A clean, advertisement-free centre for verified jobs, admit cards and results. Current entries demonstrate the layout only.</p><div className="mt-7"><VacancyCarousel vacancies={VACANCIES}/></div><VacancySections/></div></main>;
}
