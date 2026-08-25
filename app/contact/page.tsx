import { OFFICIAL_LINKS, OfficialLinkIcon } from "../_components/official-links";
import { SiteFooter } from "../_components/site-footer";
import { SiteHeader } from "../_components/site-header";

export const metadata = {
  title: "Contact Us | Samradhi Classes",
  description: "Call, visit or message Samradhi Classes in Sanganer, Jaipur for typing, efficiency and stenography coaching.",
};

const MAPS_URL =
  "https://www.google.com/maps/search/?api=1&query=26%2C%20Bairwa%20Colony%2C%20Sanganer%2C%20Jaipur%20302029";

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-white">
      <SiteHeader />

      <section className="bg-gradient-to-br from-blue-700 via-indigo-800 to-violet-900 px-6 py-14 text-center text-white sm:py-20">
        <p className="text-xs font-black uppercase tracking-widest text-blue-100">Get in touch</p>
        <h1 className="mt-2 text-3xl font-black sm:text-5xl">Contact Us</h1>
        <p className="mx-auto mt-4 max-w-2xl text-base text-blue-50 sm:text-lg">
          The fastest way to reach Samradhi Classes is by phone. You&apos;re also welcome to visit our Sanganer
          centre in person.
        </p>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-14">
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-6">
            <h2 className="text-lg font-black text-slate-950">Call us</h2>
            <p className="mt-2 text-sm text-slate-600">For admissions, course fees and general queries.</p>
            <a
              href="tel:+917014371324"
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-black text-white transition-colors hover:bg-blue-800"
            >
              7014371324
            </a>
          </div>

          <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-6">
            <h2 className="text-lg font-black text-slate-950">Visit us</h2>
            <p className="mt-2 text-sm text-slate-600">
              26, Bairwa Colony, near Shri Ram Marriage Garden, near Sanganer Airport, behind Choudhary Petrol
              Pump, Sanganer, Jaipur – 302029
            </p>
            <a
              href={MAPS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 rounded-xl border-2 border-blue-700 px-5 py-2.5 text-sm font-black text-blue-700 transition-colors hover:bg-blue-100"
            >
              Open in Google Maps
            </a>
          </div>
        </div>

        <div className="mt-10">
          <h2 className="text-lg font-black text-slate-950">Follow &amp; message us</h2>
          <div className="mt-4 flex flex-wrap gap-3">
            {OFFICIAL_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={link.ariaLabel}
                className="inline-flex items-center gap-2 rounded-lg border border-blue-100 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"
              >
                <OfficialLinkIcon name={link.icon} className={link.iconColor} />
                {link.label}
              </a>
            ))}
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
