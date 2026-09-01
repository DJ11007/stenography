import Link from "next/link";
import { OFFICIAL_LINKS, OfficialLinkIcon } from "../_components/official-links";
import { SiteFooter } from "../_components/site-footer";
import { SiteHeader } from "../_components/site-header";

export const metadata = {
  title: "Connect With Us | Samradhi Classes",
  description: "Every official Samradhi Classes channel in one place -- YouTube, Instagram, Telegram, our mobile app, website and phone support.",
};

const SUPPORT_NUMBER = "7014371324";

export default function ConnectPage() {
  return (
    <main className="min-h-screen bg-white">
      <SiteHeader />

      <section className="bg-gradient-to-br from-blue-700 via-indigo-800 to-violet-900 px-6 py-14 text-center text-white sm:py-20">
        <p className="text-xs font-black uppercase tracking-widest text-blue-100">Stay in touch</p>
        <h1 className="mt-2 text-3xl font-black sm:text-5xl">Connect With Us</h1>
        <p className="mx-auto mt-4 max-w-2xl text-base text-blue-50 sm:text-lg">
          Every official Samradhi Classes channel, in one place -- follow us, get support, or open the app.
        </p>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-14">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {OFFICIAL_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={link.ariaLabel}
              className="group flex items-center gap-4 rounded-2xl border border-blue-100 bg-blue-50/60 p-5 shadow-sm transition-all hover:-translate-y-1 hover:border-blue-300 hover:shadow-md"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
                <OfficialLinkIcon name={link.icon} className={`h-6 w-6 ${link.iconColor}`} />
              </span>
              <span>
                <span className="block text-base font-black text-slate-950">{link.label}</span>
                <span className="block text-xs font-bold text-blue-700 group-hover:underline">Open →</span>
              </span>
            </a>
          ))}

          <a
            href={`tel:+91${SUPPORT_NUMBER}`}
            aria-label={`Call support now at ${SUPPORT_NUMBER}`}
            className="group flex items-center gap-4 rounded-2xl border-2 border-emerald-600 bg-emerald-50 p-5 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
              <svg aria-hidden focusable={false} viewBox="0 0 24 24" className="h-6 w-6 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0 1 22 16.92Z" />
              </svg>
            </span>
            <span>
              <span className="block text-base font-black text-slate-950">Call Support</span>
              <span className="block text-xs font-bold text-emerald-700 group-hover:underline">{SUPPORT_NUMBER} →</span>
            </span>
          </a>
        </div>

        <p className="mt-10 text-center text-sm text-slate-600">
          Prefer to visit in person? See our address and map on the{" "}
          <Link href="/contact" className="font-bold text-blue-700 hover:underline">Contact page</Link>.
        </p>
      </section>

      <SiteFooter />
    </main>
  );
}
