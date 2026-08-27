import type { Metadata } from "next";
import Link from "next/link";
import { TypingBrandHeader } from "../../../_components/typing-brand";
import { BackButton } from "../../../../_components/back-button";

export const metadata: Metadata = { title: "Stenography Task Library | Samradhi Classes" };

export default function StenographyTaskLibraryLanguagePage() {
  return (
    <main className="min-h-screen bg-slate-100">
      <TypingBrandHeader />
      <section className="mx-auto max-w-4xl px-4 py-10">
        <BackButton href="/typing/practice/stenography" label="Stenography" />
        <h1 className="mt-5 text-3xl font-black">Task / Topic Wise Tests</h1>
        <p className="mt-2 text-slate-600">Browse stenography tests by category — Task, Basic, Paper, Court, Books, Editor, Speech, Article.</p>
        <div className="mt-7 grid gap-4 sm:grid-cols-2">
          <Link href="/typing/practice/stenography/library/english" className="rounded-2xl border border-violet-200 bg-white p-6 shadow-sm hover:border-violet-400 hover:shadow-md">
            <h2 className="text-xl font-black text-violet-900">English</h2>
            <p className="mt-1 text-sm text-slate-600">Browse English stenography tests by category.</p>
          </Link>
          <Link href="/typing/practice/stenography/library/hindi" className="rounded-2xl border border-violet-200 bg-white p-6 shadow-sm hover:border-violet-400 hover:shadow-md">
            <h2 className="text-xl font-black text-violet-900">हिंदी (Hindi)</h2>
            <p className="mt-1 text-sm text-slate-600">Browse Hindi stenography tests by category.</p>
          </Link>
        </div>
      </section>
    </main>
  );
}
