import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { HINDI_KRUTI_DEV } from "@/lib/typing-curriculum";
import { SectionTestPage } from "../tests/section-test-page";

export default async function AdminLearningTestsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const params = await searchParams;
  const language = params.language === "Hindi" ? "Hindi" as const : params.language === "English" ? "English" as const : null;

  if (!language) {
    return (
      <main className="min-h-screen bg-slate-100 p-4 sm:p-6">
        <div className="mx-auto max-w-3xl">
          <Link href="/admin" className="text-sm font-semibold text-blue-700">← Admin dashboard</Link>
          <h1 className="mt-2 text-3xl font-black">Learn Typing tests</h1>
          <p className="mt-1 text-slate-600">Guided lessons students work through to build accuracy from the basics. Pick a language to manage tests for it.</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Link href="/admin/learning-tests?language=English" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-400 hover:shadow-md">
              <h2 className="text-xl font-black text-slate-900">English</h2>
              <p className="mt-1 text-sm text-slate-600">QWERTY learn lessons.</p>
            </Link>
            <Link href="/admin/learning-tests?language=Hindi" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-400 hover:shadow-md">
              <h2 className="text-xl font-black text-slate-900">Hindi</h2>
              <p className="mt-1 text-sm text-slate-600">Kruti Dev 010 learn lessons.</p>
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // Hindi Learn Typing offers Kruti Dev 010 only (Practice Tests matches) --
  // there's nothing left to pick between, so this skips straight to the
  // scoped list instead of showing a one-option keyboard picker. Mangal/
  // InScript/Remington GAIL/CBI stay available for Exam Simulators and
  // Stenography, which this page never touches.
  const inputSystemId = language === "Hindi" ? HINDI_KRUTI_DEV.id : "english-qwerty";
  const backHref = "/admin/learning-tests";
  return <SectionTestPage mode="learn" language={language} inputSystemId={inputSystemId} backHref={backHref} />;
}
