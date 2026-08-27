"use client";
import { useEffect, useMemo, useState } from "react";
import { COURSE_PACKAGE_CATEGORIES, type CoursePackage } from "@/lib/homepage-content";

const SUPPORT_PHONE = "917014371324";

function whatsappHref(plan: CoursePackage) {
  const message = `Hi Samradhi Classes, I want to buy the "${plan.title}" (${plan.category}) course — ${plan.durationLabel}, ${plan.priceLabel}.`;
  return `https://wa.me/${SUPPORT_PHONE}?text=${encodeURIComponent(message)}`;
}

function TagIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden focusable={false} viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.6 2.7 21 11.1a2 2 0 0 1 0 2.8l-6.6 6.6a2 2 0 0 1-2.8 0L3.2 12.1a2 2 0 0 1-.6-1.4V4.3A1.6 1.6 0 0 1 4.2 2.7h6.4c.5 0 1 .2 1.4.6Z" />
      <circle cx="7.5" cy="7.5" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function BuyNowButton({ packages }: { packages: CoursePackage[] }) {
  const [open, setOpen] = useState(false);
  const categories = useMemo(() => {
    const found = [...new Set(packages.map((plan) => plan.category))];
    const ordered = [...COURSE_PACKAGE_CATEGORIES.filter((category) => found.includes(category)), ...found.filter((category) => !COURSE_PACKAGE_CATEGORIES.includes(category))];
    return ordered.length ? ordered : COURSE_PACKAGE_CATEGORIES;
  }, [packages]);
  const [category, setCategory] = useState(categories[0]);
  useEffect(() => { if (!categories.includes(category)) setCategory(categories[0]); }, [categories, category]);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const visible = packages.filter((plan) => plan.category === category);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group relative inline-flex items-center gap-1.5 overflow-hidden rounded-full bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 px-4 py-2 text-sm font-black text-white shadow-md shadow-orange-500/30 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-orange-500/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600"
      >
        <span aria-hidden className="absolute inset-0 -translate-x-full bg-white/25 transition-transform duration-700 group-hover:translate-x-full" style={{ clipPath: "polygon(0 0, 30% 0, 10% 100%, -20% 100%)" }} />
        <TagIcon className="h-4 w-4" />
        Buy Now
      </button>

      {open && (
        <div role="dialog" aria-modal="true" aria-label="Buy a course" className="fixed inset-0 z-[100] grid place-items-end bg-slate-950/60 p-0 sm:place-items-center sm:p-4" onClick={() => setOpen(false)}>
          <section onClick={(event) => event.stopPropagation()} className="max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:max-w-2xl sm:rounded-3xl">
            <header className="sticky top-0 z-10 flex items-center justify-between gap-3 bg-gradient-to-r from-slate-950 to-orange-900 px-5 py-4 text-white sm:rounded-t-3xl">
              <div>
                <p className="text-[11px] font-black uppercase tracking-widest text-orange-300">Samradhi Classes</p>
                <h2 className="text-xl font-black">Choose your course</h2>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="rounded-full bg-white/10 px-3 py-1.5 text-lg font-black hover:bg-white/20">✕</button>
            </header>

            <nav aria-label="Course categories" className="flex gap-2 overflow-x-auto border-b border-slate-100 px-5 py-3">
              {categories.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setCategory(item)}
                  aria-current={item === category ? "true" : undefined}
                  className={`shrink-0 rounded-full px-4 py-2 text-sm font-black transition-colors ${item === category ? "bg-orange-600 text-white shadow-sm" : "bg-slate-100 text-slate-700 hover:bg-orange-50 hover:text-orange-700"}`}
                >
                  {item}
                </button>
              ))}
            </nav>

            <div className="grid gap-3 p-5 sm:grid-cols-2">
              {visible.length === 0 && (
                <p className="col-span-full rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">Plans for {category} are coming soon. Call or WhatsApp us and we'll set one up for you.</p>
              )}
              {visible.map((plan) => (
                <article key={plan.id} className={`relative flex flex-col rounded-2xl border p-4 shadow-sm ${plan.isPopular ? "border-orange-500 ring-2 ring-orange-200" : "border-slate-200"}`}>
                  {plan.isPopular && <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-orange-600 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-white shadow">Most Popular</span>}
                  <h3 className="font-black text-slate-950">{plan.title}</h3>
                  <p className="mt-1 text-xs font-bold text-slate-500">{plan.durationLabel}</p>
                  <p className="mt-2 text-2xl font-black text-orange-700">
                    {plan.priceLabel}
                    {plan.originalPriceLabel && <span className="ml-2 text-sm font-bold text-slate-400 line-through">{plan.originalPriceLabel}</span>}
                  </p>
                  <ul className="mt-3 flex-1 space-y-1.5 text-sm text-slate-600">
                    {plan.features.map((feature) => <li key={feature} className="flex gap-2"><span aria-hidden>✓</span><span>{feature}</span></li>)}
                  </ul>
                  {plan.couponCode && <p className="mt-3 rounded-lg border border-dashed border-amber-400 bg-amber-50 px-3 py-2 text-xs font-black text-amber-900">Coupon <span className="font-mono">{plan.couponCode}</span>{plan.couponDescription ? ` — ${plan.couponDescription}` : ""}</p>}
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <a href={`tel:+${SUPPORT_PHONE}`} className="rounded-xl bg-slate-900 px-3 py-2.5 text-center text-xs font-black text-white transition-colors hover:bg-slate-800">📞 Call to Buy</a>
                    <a href={whatsappHref(plan)} target="_blank" rel="noopener noreferrer" className="rounded-xl bg-[#25D366] px-3 py-2.5 text-center text-xs font-black text-white transition-colors hover:bg-[#1fb959]">💬 WhatsApp</a>
                  </div>
                </article>
              ))}
            </div>
            <p className="px-5 pb-5 text-center text-xs text-slate-400">Enrollment is completed by phone or WhatsApp with our team — no payment is collected on this page.</p>
          </section>
        </div>
      )}
    </>
  );
}
