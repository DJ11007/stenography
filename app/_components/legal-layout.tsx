import type { ReactNode } from "react";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

export function LegalLayout({
  title,
  updated,
  intro,
  children,
}: {
  title: string;
  updated: string;
  intro?: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-white">
      <SiteHeader />
      <section className="bg-gradient-to-br from-blue-700 via-indigo-800 to-violet-900 px-6 py-12 text-center text-white">
        <h1 className="text-3xl font-black sm:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-blue-100">Last updated: {updated}</p>
      </section>
      <article className="mx-auto max-w-3xl px-6 py-12">
        {intro && <p className="mb-8 text-base text-slate-600">{intro}</p>}
        <div className="space-y-8 text-sm text-slate-700 sm:text-base [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:font-black [&_h2]:text-slate-950 [&_li]:leading-relaxed [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
          {children}
        </div>
      </article>
      <SiteFooter />
    </main>
  );
}
