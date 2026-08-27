import type { Metadata } from "next";
import { SiteHeader } from "../_components/site-header";
import { SiteFooter } from "../_components/site-footer";
import { getPublishedCoursePackages } from "@/lib/homepage-content-server";
import { COURSE_PACKAGE_CATEGORIES, type CoursePackage } from "@/lib/homepage-content";

export const metadata: Metadata = {
  title: "Buy a Course | Samradhi Classes",
  description: "Typing, Efficiency, Stenography and more, grouped by subject — compare plans and enroll by call or WhatsApp.",
};

const SUPPORT_PHONE = "917014371324";

// Each category gets its own accent so the page reads as distinct sections,
// not one repeated card style — Typing/Efficiency/Stenography reuse the
// same brand colors already used for those subjects elsewhere on the site.
const THEME: Record<string, { gradient: string; text: string; ring: string; chip: string }> = {
  Typing: { gradient: "from-blue-600 to-cyan-500", text: "text-blue-700", ring: "ring-blue-200", chip: "bg-blue-50 text-blue-800" },
  Efficiency: { gradient: "from-emerald-600 to-teal-500", text: "text-emerald-700", ring: "ring-emerald-200", chip: "bg-emerald-50 text-emerald-800" },
  Stenography: { gradient: "from-violet-600 to-fuchsia-500", text: "text-violet-700", ring: "ring-violet-200", chip: "bg-violet-50 text-violet-800" },
  "Combo / All-in-one": { gradient: "from-amber-500 to-orange-500", text: "text-amber-700", ring: "ring-amber-200", chip: "bg-amber-50 text-amber-800" },
};
const FALLBACK_THEME = { gradient: "from-slate-700 to-slate-500", text: "text-slate-700", ring: "ring-slate-200", chip: "bg-slate-100 text-slate-700" };
const themeFor = (category: string) => THEME[category] ?? FALLBACK_THEME;
const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "category";

function whatsappHref(plan: CoursePackage) {
  const message = `Hi Samradhi Classes, I want to buy the "${plan.title}" (${plan.category}) course — ${plan.durationLabel}, ${plan.priceLabel}.`;
  return `https://wa.me/${SUPPORT_PHONE}?text=${encodeURIComponent(message)}`;
}

function CategoryIcon({ category, className }: { category: string; className?: string }) {
  const common = { "aria-hidden": true as const, focusable: false, viewBox: "0 0 24 24", className, fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const lower = category.toLowerCase();
  if (lower.includes("typing")) return <svg {...common}><rect x="2.5" y="6" width="19" height="12" rx="2" /><path d="M6 10h.01M9.5 10h.01M13 10h.01M16.5 10h.01M6 14h12" /></svg>;
  if (lower.includes("efficiency")) return <svg {...common}><path d="M4 15a8 8 0 1 1 16 0" /><path d="M12 15l4-5" /><circle cx="12" cy="15" r="1" fill="currentColor" stroke="none" /></svg>;
  if (lower.includes("steno")) return <svg {...common}><rect x="9" y="2.5" width="6" height="11" rx="3" /><path d="M6 11a6 6 0 0 0 12 0M12 17v4M9 21h6" /></svg>;
  return <svg {...common}><path d="M20 7h-9M20 12h-9M20 17h-9M4 7h.01M4 12h.01M4 17h.01" /></svg>;
}

function WhatsAppIcon({ className }: { className?: string }) {
  return <svg viewBox="0 0 24 24" aria-hidden className={className} fill="currentColor"><path d="M17.5 14.4c-.3-.1-1.7-.9-2-1s-.5-.1-.7.1-.8 1-.9 1.2-.3.2-.6.1a8.2 8.2 0 0 1-2.4-1.5 9 9 0 0 1-1.7-2.1c-.2-.3 0-.5.1-.6l.4-.5.3-.4c.1-.1.1-.3 0-.4s-.7-1.7-1-2.3-.5-.5-.7-.5h-.6a1.1 1.1 0 0 0-.8.4A3.4 3.4 0 0 0 5.8 9c0 1.3.9 2.5 1 2.7.1.1 1.8 2.8 4.4 3.9a15 15 0 0 0 1.5.5c.6.2 1.2.2 1.6.1.5-.1 1.7-.7 1.9-1.3s.3-1.2.2-1.3-.2-.1-.5-.2Z" /><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5.1-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Z" /></svg>;
}

function groupByCategory(packages: CoursePackage[]) {
  const found = [...new Set(packages.map((plan) => plan.category))];
  const ordered = [...COURSE_PACKAGE_CATEGORIES.filter((category) => found.includes(category)), ...found.filter((category) => !COURSE_PACKAGE_CATEGORIES.includes(category))];
  return ordered.map((category) => ({ category, plans: packages.filter((plan) => plan.category === category) }));
}

export default async function CoursesPage() {
  const packages = await getPublishedCoursePackages();
  const groups = groupByCategory(packages);

  return (
    <main className="min-h-screen bg-slate-50">
      <SiteHeader />

      <section className="bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 px-4 py-14 text-white">
        <div className="mx-auto max-w-5xl text-center">
          <p className="text-xs font-black uppercase tracking-[.25em] text-indigo-300">Samradhi Classes</p>
          <h1 className="mt-3 text-3xl font-black sm:text-4xl">Choose Your Course</h1>
          <p className="mx-auto mt-3 max-w-2xl text-slate-300">Every plan below is set up by our teaching team. Pick your subject, compare plans, and enroll directly by phone or WhatsApp — no online payment needed.</p>
          {groups.length > 0 && (
            <nav aria-label="Jump to a course category" className="mt-7 flex flex-wrap justify-center gap-2">
              {groups.map(({ category }) => {
                const theme = themeFor(category);
                return (
                  <a key={category} href={`#${slugify(category)}`} className={`inline-flex items-center gap-2 rounded-full bg-gradient-to-r ${theme.gradient} px-4 py-2 text-sm font-black text-white shadow-md transition-transform hover:-translate-y-0.5`}>
                    <CategoryIcon category={category} className="h-4 w-4" />
                    {category}
                  </a>
                );
              })}
            </nav>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-14 px-4 py-12">
        {groups.length === 0 && (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <p className="text-lg font-black text-slate-700">Courses are being set up.</p>
            <p className="mt-2 text-slate-500">Call or WhatsApp us and our team will help you enroll right away.</p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <a href={`tel:+${SUPPORT_PHONE}`} className="rounded-xl bg-slate-900 px-5 py-3 font-black text-white">📞 Call Us</a>
              <a href={`https://wa.me/${SUPPORT_PHONE}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-5 py-3 font-black text-white"><WhatsAppIcon className="h-5 w-5" />WhatsApp</a>
            </div>
          </div>
        )}

        {groups.map(({ category, plans }) => {
          const theme = themeFor(category);
          return (
            <section key={category} id={slugify(category)} aria-labelledby={`${slugify(category)}-title`} className="scroll-mt-24">
              <div className="mb-5 flex items-center gap-3">
                <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br ${theme.gradient} text-white shadow-md`}>
                  <CategoryIcon category={category} className="h-6 w-6" />
                </span>
                <div>
                  <p className={`text-xs font-black uppercase tracking-widest ${theme.text}`}>Course category</p>
                  <h2 id={`${slugify(category)}-title`} className="text-2xl font-black text-slate-950">{category}</h2>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {plans.map((plan) => (
                  <article key={plan.id} className={`relative flex flex-col rounded-2xl border bg-white p-5 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg ${plan.isPopular ? `border-transparent ring-2 ${theme.ring}` : "border-slate-200"}`}>
                    {plan.isPopular && (
                      <span className={`absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-gradient-to-r ${theme.gradient} px-3 py-1 text-[11px] font-black uppercase tracking-wide text-white shadow`}>
                        Most Popular
                      </span>
                    )}
                    <span className={`w-fit rounded-full px-2.5 py-1 text-[11px] font-black ${theme.chip}`}>{plan.durationLabel}</span>
                    <h3 className="mt-3 font-black text-slate-950">{plan.title}</h3>
                    <p className={`mt-2 text-2xl font-black ${theme.text}`}>
                      {plan.priceLabel}
                      {plan.originalPriceLabel && <span className="ml-2 text-sm font-bold text-slate-400 line-through">{plan.originalPriceLabel}</span>}
                    </p>
                    <ul className="mt-3 flex-1 space-y-1.5 text-sm text-slate-600">
                      {plan.features.map((feature) => <li key={feature} className="flex gap-2"><span aria-hidden>✓</span><span>{feature}</span></li>)}
                    </ul>
                    {plan.couponCode && (
                      <p className="mt-3 rounded-lg border border-dashed border-amber-400 bg-amber-50 px-3 py-2 text-xs font-black text-amber-900">
                        Coupon <span className="font-mono">{plan.couponCode}</span>{plan.couponDescription ? ` — ${plan.couponDescription}` : ""}
                      </p>
                    )}
                    <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
                      <a href={`tel:+${SUPPORT_PHONE}`} className={`rounded-xl bg-gradient-to-r ${theme.gradient} px-4 py-2.5 text-center text-sm font-black text-white shadow-sm transition-transform hover:-translate-y-0.5`}>Enroll Now</a>
                      <a href={whatsappHref(plan)} target="_blank" rel="noopener noreferrer" aria-label={`Enroll in ${plan.title} via WhatsApp`} className="grid place-items-center rounded-xl bg-[#25D366] px-3 text-white transition-transform hover:-translate-y-0.5">
                        <WhatsAppIcon className="h-5 w-5" />
                      </a>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <SiteFooter />
    </main>
  );
}
