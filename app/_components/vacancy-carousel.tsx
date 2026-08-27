"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Vacancy } from "@/lib/homepage-content";

export function VacancyCarousel({ vacancies }: { vacancies: Vacancy[] }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || vacancies.length < 2) return;
    const timer = window.setInterval(() => setActive((current) => (current + 1) % vacancies.length), 5000);
    return () => window.clearInterval(timer);
  }, [paused, vacancies.length]);

  if (!vacancies.length) return null;
  const vacancy = vacancies[active];
  const move = (offset: number) => setActive((current) => (current + offset + vacancies.length) % vacancies.length);

  return (
    <section aria-label="Latest vacancy highlights" className="relative overflow-hidden rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-950 via-blue-800 to-blue-600 text-white shadow-lg" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocusCapture={() => setPaused(true)} onBlurCapture={() => setPaused(false)}>
      <div aria-live="polite" className="min-h-56 p-6 sm:p-7">
        <p className="text-xs font-black uppercase tracking-[.2em] text-blue-200">Vacancy highlight · {active + 1} of {vacancies.length}</p>
        <div key={vacancy.slug} className="animate-[vacancy-slide_.45s_ease-out]">
          <h2 className="mt-3 text-2xl font-black sm:text-3xl">{vacancy.title}</h2>
          <p className="mt-2 text-sm font-bold text-amber-200">{vacancy.status}</p>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-blue-100">{vacancy.summary}</p>
          <Link href={`/vacancies/${vacancy.slug}`} className="mt-5 inline-flex rounded-xl bg-white px-5 py-3 text-sm font-black text-blue-800 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">View vacancy details</Link>
        </div>
      </div>
      <button type="button" onClick={() => move(-1)} aria-label="Previous vacancy" className="absolute left-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/50 bg-blue-950/75 text-2xl font-black hover:bg-blue-950">‹</button>
      <button type="button" onClick={() => move(1)} aria-label="Next vacancy" className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/50 bg-blue-950/75 text-2xl font-black hover:bg-blue-950">›</button>
      <p className="sr-only">Carousel advances from right to left every five seconds and pauses while hovered or focused.</p>
    </section>
  );
}
