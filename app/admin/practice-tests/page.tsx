import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { HINDI_INPUT_SYSTEMS } from "@/lib/typing-curriculum";
import { SectionTestPage } from "../tests/section-test-page";

export default async function AdminPracticeTestsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const params = await searchParams;
  const language = params.language === "Hindi" ? "Hindi" as const : params.language === "English" ? "English" as const : null;

  if (!language) {
    return (
      <main className="min-h-screen bg-slate-100 p-4 sm:p-6">
        <div className="mx-auto max-w-3xl">
          <Link href="/admin" className="text-sm font-semibold text-blue-700">← Admin dashboard</Link>
          <h1 className="mt-2 text-3xl font-black">Practice Tests</h1>
          <p className="mt-1 text-slate-600">Pure practice, not an exam simulator -- students choose their own duration, backspace, highlight and word-calculation settings. Pick a language to manage tests for it.</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Link href="/admin/practice-tests?language=English" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-400 hover:shadow-md">
              <h2 className="text-xl font-black text-slate-900">English</h2>
              <p className="mt-1 text-sm text-slate-600">QWERTY practice tests.</p>
            </Link>
            <Link href="/admin/practice-tests?language=Hindi" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-400 hover:shadow-md">
              <h2 className="text-xl font-black text-slate-900">Hindi</h2>
              <p className="mt-1 text-sm text-slate-600">Choose a keyboard/font next -- Kruti Dev, Mangal, Remington, InScript and more.</p>
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (language === "Hindi" && !params.input) {
    return (
      <main className="min-h-screen bg-slate-100 p-4 sm:p-6">
        <div className="mx-auto max-w-3xl">
          <Link href="/admin/practice-tests" className="text-sm font-semibold text-blue-700">← Choose language</Link>
          <h1 className="mt-2 text-3xl font-black">Practice Tests · Hindi</h1>
          <p className="mt-1 text-slate-600">Choose the keyboard/font this batch of tests will use. You'll manage tests for just this one input system next.</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {HINDI_INPUT_SYSTEMS.map((system) => (
              <Link key={system.id} href={`/admin/practice-tests?language=Hindi&input=${encodeURIComponent(system.id)}`} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-400 hover:shadow-md">
                <strong className="block">{system.label}</strong>
                <span className="mt-1 block text-xs text-slate-500">{system.keyboardLayout}</span>
              </Link>
            ))}
          </div>
        </div>
      </main>
    );
  }

  const inputSystemId = language === "Hindi" ? params.input : "english-qwerty";
  const backHref = language === "Hindi" ? "/admin/practice-tests?language=Hindi" : "/admin/practice-tests";
  return <SectionTestPage mode="practice" language={language} inputSystemId={inputSystemId} backHref={backHref} />;
}
