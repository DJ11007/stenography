import Link from "next/link";
import { signOut } from "@/app/auth/actions";
import { requireAdmin } from "@/lib/auth";

const sections = [
  ["/admin/learning-tests", "Learning Tests", "Create public learning lessons."],
  ["/admin/practice-tests", "Practice Tests", "Create practice-mode tests."],
  ["/admin/exam-tests", "Exam Tests", "Create exam-mode simulations."],
  ["/admin/stenography-tests", "Stenography Tests", "Create stenography-mode tests."],
  ["/admin/tests", "General Test Management", "Manage all tests with an explicit mode selector."],
  ["/admin/font-converter", "Font & Text Converter", "Convert locally between Unicode Hindi and Kruti Dev 010."],
  ["/admin/word-efficiency-tests", "Word Efficiency Tests", "Manage document-efficiency questions, instructions, and private PDFs."],
] as const;

export default async function AdminPage() {
  const { user, profile } = await requireAdmin();
  return <main className="min-h-screen bg-slate-100 p-6"><div className="mx-auto max-w-5xl"><header className="flex items-center justify-between rounded-2xl bg-slate-900 p-6 text-white shadow"><div><p className="text-sm font-semibold text-blue-300">SAMRADHI CLASSES</p><h1 className="text-2xl font-bold">Admin panel</h1><p className="mt-1 text-slate-300">{profile?.full_name || user.email}</p></div><form action={signOut}><button className="rounded-lg bg-white px-4 py-2 font-semibold text-slate-800">Sign out</button></form></header><section className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">{sections.map(([href,title,text])=><Link key={href} href={href} className="rounded-2xl bg-white p-6 shadow transition hover:-translate-y-1 hover:shadow-lg"><h2 className="text-lg font-bold">{title}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{text}</p><span className="mt-5 inline-block rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-800">Manage tests →</span></Link>)}</section></div></main>;
}
