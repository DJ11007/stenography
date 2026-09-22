import type { Metadata } from "next";
import { BackButton } from "@/app/_components/back-button";
import { ErrorDrillPractice } from "./error-drill-practice";

export const metadata: Metadata = { title: "Practice My Errors | Samradhi Classes" };

export default function ErrorDrillPage() {
  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-4xl">
        <BackButton href="/student/results" label="My Results" />
        <section className="mt-4 rounded-2xl bg-white p-6 shadow">
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">Practice tool</p>
          <h1 className="mt-1 text-2xl font-black text-slate-950">Practice My Errors</h1>
          <p className="mt-2 text-sm text-slate-600">Copy the words you got wrong from any test result, paste them here, and drill each one across as many lines as you want.</p>
        </section>
        <ErrorDrillPractice />
      </div>
    </main>
  );
}
