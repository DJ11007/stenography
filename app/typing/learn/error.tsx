"use client";

export default function LearningCatalogueError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-16">
      <section className="mx-auto max-w-2xl rounded-3xl border border-red-200 bg-white p-8 text-center shadow-lg">
        <p className="text-sm font-black uppercase tracking-widest text-red-600">Database error</p>
        <h1 className="mt-3 text-3xl font-black text-slate-950">The learning catalogue could not be loaded.</h1>
        <p className="mt-3 text-slate-600">The website could not read the published learning tests. Please try again or ask an administrator to check the database connection.</p>
        <button type="button" onClick={reset} className="mt-6 rounded-xl bg-red-600 px-6 py-3 font-black text-white hover:bg-red-700">Try again</button>
      </section>
    </main>
  );
}
