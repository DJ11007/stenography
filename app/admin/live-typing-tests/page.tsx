import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { BackButton } from "@/app/_components/back-button";
import { SectionTestPage } from "../tests/section-test-page";

export default async function AdminLiveTypingTestsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const params = await searchParams;
  const language = params.language === "Hindi" ? "Hindi" as const : params.language === "English" ? "English" as const : null;

  if (!language) {
    return (
      <main className="min-h-screen bg-slate-100 p-4 sm:p-6">
        <div className="mx-auto max-w-3xl">
          <BackButton href="/admin" label="Admin dashboard" />
          <h1 className="mt-2 text-3xl font-black">Live Typing Test</h1>
          <p className="mt-1 text-slate-600">Scheduled, free live typing tests -- every test created here always has a start/end/results window and shows up on the public Live Test hub. Pick a language to manage tests for it.</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Link href="/admin/live-typing-tests?language=English" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-400 hover:shadow-md">
              <h2 className="text-xl font-black text-slate-900">English</h2>
              <p className="mt-1 text-sm text-slate-600">QWERTY live typing tests.</p>
            </Link>
            <Link href="/admin/live-typing-tests?language=Hindi" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-400 hover:shadow-md">
              <h2 className="text-xl font-black text-slate-900">Hindi</h2>
              <p className="mt-1 text-sm text-slate-600">Mangal, Kruti Dev, InScript, and Remington GAIL live typing tests.</p>
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // Locked to "exam" mode -- the same mode the existing Exam Simulator uses,
  // since a scheduled live typing test is functionally a graded exam event.
  // Unlike /admin/exam-tests, live=true here: SectionTestPage queries
  // is_live=true instead of false, and TestManager's lockedLive prop forces
  // the schedule fields on and routes saves through save_scheduled_managed_test
  // instead of save_section_managed_test (which rejects is_live outright).
  return <SectionTestPage mode="exam" live language={language} backHref="/admin/live-typing-tests" />;
}
