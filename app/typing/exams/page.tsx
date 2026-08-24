import type { Metadata } from "next";
import Link from "next/link";
import { EXAM_PRESETS } from "@/lib/typing-curriculum";
import { getPublishedManagedTests } from "@/lib/managed-test-catalogue-server";
import { ManagedTestCards } from "../_components/managed-test-cards";
import { TypingBrandHeader } from "../_components/typing-brand";

export const metadata:Metadata={title:"Exam Simulators | Samradhi Classes",description:"Published exam simulations with transparent configuration and no examination-authority affiliation claim."};

export default async function ExamCataloguePage() {
  const managed = await getPublishedManagedTests("exam");
  const presets = EXAM_PRESETS.filter((preset) => preset.category !== "stenography");
  return <main className="min-h-screen bg-slate-100"><TypingBrandHeader/><section className="mx-auto max-w-7xl px-4 py-10"><Link href="/typing" className="font-black text-blue-700">← Typing Hub</Link><h1 className="mt-5 text-4xl font-black">Exam Simulators</h1><p className="mt-2 text-slate-600">Published exam-mode tests and independent practice simulations.</p><h2 className="mt-8 text-2xl font-black">Managed exam tests</h2><div className="mt-5"><ManagedTestCards tests={managed}/></div><h2 className="mt-10 text-2xl font-black">Exam presets</h2><div className="mt-5 grid gap-5 md:grid-cols-2">{presets.map((preset)=><article key={preset.id} className="rounded-2xl bg-white p-6 shadow"><h3 className="text-xl font-black">{preset.title}</h3><p className="mt-2 text-sm text-slate-600">{preset.subtitle}</p><Link href={`/typing/exams/${preset.slug}`} className="mt-5 block rounded-xl bg-blue-700 px-4 py-3 text-center font-black text-white">Open simulator</Link></article>)}</div></section></main>;
}
