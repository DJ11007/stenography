import Link from "next/link";
import { TypingBrandHeader } from "../../_components/typing-brand";
import { BuyNowButton } from "../../../_components/buy-now-button";

// Shown instead of the exam workspace once a student has used up their free
// "Take Tests" (mode="practice") attempts. Deliberately does not appear for
// exam/stenography/learn/live tests -- only the free-practice allowance is
// gated this way.
export function FreePracticeLimitPaywall({ used, limit }: { used: number; limit: number }) {
  return (
    <main className="min-h-screen bg-slate-100">
      <TypingBrandHeader />
      <section className="mx-auto flex max-w-2xl flex-col items-center px-4 py-16 text-center">
        <div className="w-full rounded-3xl border border-slate-200 bg-white p-8 shadow-xl sm:p-12">
          <span className="text-5xl" aria-hidden>🔒</span>
          <h1 className="mt-5 text-3xl font-black text-slate-900">You&apos;ve used all your free practice tests</h1>
          <p className="mx-auto mt-3 max-w-xl text-slate-600">
            You&apos;ve completed {used} of {limit} free tests. Buy a course to keep practising with unlimited tests, or contact Samradhi Classes if you think this is a mistake.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <BuyNowButton />
            <Link href="/typing" className="rounded-xl border border-slate-300 px-5 py-3 font-black text-slate-700 hover:bg-slate-50">Back to Typing Hub</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
