import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { SectionTestPage } from "../tests/section-test-page";

export default async function AdminExamTestsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const params = await searchParams;
  const language = params.language === "Hindi" ? "Hindi" as const : params.language === "English" ? "English" as const : null;

  if (!language) {
    return (
      <main className="min-h-screen bg-slate-100 p-4 sm:p-6">
        <div className="mx-auto max-w-3xl">
          <Link href="/admin" className="text-sm font-semibold text-blue-700">← Admin dashboard</Link>
          <h1 className="mt-2 text-3xl font-black">Typing Exam Simulator</h1>
          <p className="mt-1 text-slate-600">Formal, official-preset exam simulations. Pick a language to manage tests for it.</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Link href="/admin/exam-tests?language=English" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-400 hover:shadow-md">
              <h2 className="text-xl font-black text-slate-900">English</h2>
              <p className="mt-1 text-sm text-slate-600">QWERTY exam simulations.</p>
            </Link>
            <Link href="/admin/exam-tests?language=Hindi" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-400 hover:shadow-md">
              <h2 className="text-xl font-black text-slate-900">Hindi</h2>
              <p className="mt-1 text-sm text-slate-600">Mangal, Kruti Dev, InScript, and Remington GAIL exam simulations.</p>
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // Like Stenography (and unlike Practice, which is locked to Kruti Dev
  // 010), Exam Simulator Hindi tests can use any of the Hindi input
  // systems -- this scopes by language only and leaves the input-system
  // picker in the create form and the filter dropdown below untouched.
  return <SectionTestPage mode="exam" language={language} backHref="/admin/exam-tests" />;
}
