import Link from "next/link";
import { notFound } from "next/navigation";
import { BackButton } from "@/app/_components/back-button";
import { VACANCY_CATEGORY_LABELS } from "@/lib/homepage-content";
import { getPublishedVacancyBySlug } from "@/lib/homepage-content-server";

function DetailPanel({ title, items }: { title: string; items: string[] }) {
  return <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm"><h2 className="text-lg font-black text-blue-900">{title}</h2><ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">{items.map((item) => <li key={item} className="flex gap-2"><span aria-hidden className="text-blue-600">●</span><span>{item}</span></li>)}</ul></section>;
}

function VacancyBreakdownTable({ rows }: { rows: { postName: string; totalPosts: string; eligibility: string }[] }) {
  if (!rows.length) return null;
  return <section className="mt-8 overflow-x-auto rounded-2xl border border-blue-100 bg-white shadow-sm"><h2 className="border-b border-blue-100 bg-blue-50 px-5 py-3 text-lg font-black text-blue-900">Vacancy Details</h2><table className="w-full min-w-[480px] text-left text-sm"><thead><tr className="border-b border-slate-200 text-xs font-black uppercase text-slate-500"><th className="px-5 py-3">Post Name</th><th className="px-5 py-3">Total Post</th><th className="px-5 py-3">Eligibility</th></tr></thead><tbody className="divide-y divide-slate-100">{rows.map((row, index) => <tr key={index}><td className="px-5 py-3 font-bold text-blue-800">{row.postName}</td><td className="px-5 py-3">{row.totalPosts}</td><td className="px-5 py-3 text-slate-600">{row.eligibility}</td></tr>)}</tbody></table></section>;
}

function UsefulLinksTable({ links }: { links: { label: string; url: string }[] }) {
  if (!links.length) return null;
  return <section className="mt-8 rounded-2xl border border-blue-100 bg-white p-5 shadow-sm"><h2 className="text-lg font-black text-blue-900">Useful Links</h2><ul className="mt-3 grid gap-2 sm:grid-cols-2">{links.map((link) => <li key={link.url}><a href={link.url} target="_blank" rel="noopener noreferrer" className="block rounded-xl border border-blue-100 px-4 py-2.5 font-bold text-blue-800 hover:bg-blue-50">{link.label} →</a></li>)}</ul></section>;
}

function NoticeDocumentsList({ documents }: { documents: { label: string; url: string }[] }) {
  if (!documents.length) return null;
  return <section className="mt-8 rounded-2xl border border-green-100 bg-white p-5 shadow-sm"><h2 className="text-lg font-black text-green-900">Documents &amp; Downloads</h2><ul className="mt-3 grid gap-2">{documents.map((doc) => <li key={doc.url}><a href={doc.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-2 rounded-xl border border-green-100 bg-green-50/60 px-4 py-3 font-bold text-green-900 hover:bg-green-100"><span>{doc.label}</span><span className="text-sm">Click here to download ↓</span></a></li>)}</ul></section>;
}

export default async function VacancyDetailPage({ params }: PageProps<"/vacancies/[slug]">) {
  const vacancy = await getPublishedVacancyBySlug((await params).slug);
  if (!vacancy) notFound();
  return <main className="min-h-screen bg-slate-50 text-slate-950"><header className="border-b border-blue-100 bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4"><BackButton href="/vacancies" label="All vacancy updates" /><Link href="/" className="text-sm font-bold text-slate-600">Home</Link></div></header><article className="mx-auto max-w-6xl px-4 py-8"><span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-black uppercase tracking-wide text-blue-800">{VACANCY_CATEGORY_LABELS[vacancy.category]}</span><h1 className="mt-5 text-3xl font-black sm:text-5xl">{vacancy.title}</h1><p className="mt-3 font-bold text-slate-600">{vacancy.organization}</p><div role="status" className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4 font-bold text-amber-950">{vacancy.status}</div><p className="mt-6 max-w-3xl text-lg leading-8 text-slate-700">{vacancy.summary}</p><div className="mt-8 grid gap-5 md:grid-cols-2"><DetailPanel title="Important dates" items={vacancy.importantDates}/><DetailPanel title="Application fees" items={vacancy.applicationFees}/><DetailPanel title="Eligibility" items={vacancy.eligibility}/><DetailPanel title="Age limit" items={vacancy.ageLimit}/></div><VacancyBreakdownTable rows={vacancy.vacancyBreakdown}/><NoticeDocumentsList documents={vacancy.noticeDocuments}/><UsefulLinksTable links={vacancy.usefulLinks}/><section aria-label="Official vacancy links" className="mt-7 grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 sm:grid-cols-2">{vacancy.notificationUrl ? <a href={vacancy.notificationUrl} target="_blank" rel="noopener noreferrer" className="rounded-xl bg-blue-700 px-5 py-3 text-center font-black text-white">Download Official Notification</a> : <span aria-disabled="true" className="cursor-not-allowed rounded-xl bg-slate-200 px-5 py-3 text-center font-black text-slate-500">Official Notification — Awaiting update</span>}{vacancy.officialUrl ? <a href={vacancy.officialUrl} target="_blank" rel="noopener noreferrer" className="rounded-xl bg-green-700 px-5 py-3 text-center font-black text-white">Apply on Official Website</a> : <span aria-disabled="true" className="cursor-not-allowed rounded-xl bg-slate-200 px-5 py-3 text-center font-black text-slate-500">Official Application — Awaiting update</span>}</section></article></main>;
}
