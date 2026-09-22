import Link from "next/link";
import { OFFICIAL_LINKS, OfficialLinkIcon } from "./official-links";

const COMPANY_LINKS = [
  { href: "/about", label: "About Us" },
  { href: "/contact", label: "Contact" },
] as const;

const LEGAL_LINKS = [
  { href: "/terms", label: "Terms & Conditions" },
  { href: "/privacy-policy", label: "Privacy Policy" },
  { href: "/refund-policy", label: "Refund Policy" },
] as const;

export function SiteFooter() {
  return (
    <footer className="relative border-t border-blue-100 bg-blue-950 px-6 py-10 text-white">
      <div aria-hidden className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-400 via-blue-500 to-violet-500" />
      <div className="mx-auto grid max-w-7xl gap-8 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.7fr)_minmax(0,1.2fr)]">
        <div className="text-center md:text-left">
          <p className="font-black tracking-wide">SAMRADHI CLASSES</p>
          <p className="mt-1 text-sm text-blue-200">Typing, stenography and competitive-exam preparation.</p>
          <p className="mt-3 text-sm text-blue-200">
            26, Bairwa Colony, near Shri Ram Marriage Garden, near Sanganer Airport, behind Choudhary Petrol Pump, Sanganer, Jaipur – 302029
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2 md:justify-start">
            <a href="tel:+917014371324" className="inline-flex items-center rounded-lg bg-white px-4 py-2 text-sm font-black text-blue-950 transition-colors hover:bg-blue-50">
              Call 7014371324
            </a>
            <a href="https://www.google.com/maps/search/?api=1&query=26%2C%20Bairwa%20Colony%2C%20Sanganer%2C%20Jaipur%20302029" target="_blank" rel="noopener noreferrer" className="inline-flex items-center rounded-lg border border-blue-400 px-4 py-2 text-sm font-black text-white transition-colors hover:bg-blue-900">
              Open in Google Maps
            </a>
          </div>
        </div>

        <nav aria-label="Company links" className="text-center md:text-left">
          <p className="text-xs font-bold uppercase tracking-widest text-blue-300">Company</p>
          <ul className="mt-3 space-y-2">
            {COMPANY_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="text-sm font-semibold text-blue-100 transition-colors hover:text-white">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Official links">
          <p className="text-xs font-bold uppercase tracking-widest text-blue-300">Official links</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2 md:justify-start">
            {OFFICIAL_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={link.ariaLabel}
                className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-blue-400 bg-white px-3 py-2 text-sm font-bold text-blue-950 transition-all hover:-translate-y-0.5 hover:bg-blue-50 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                <OfficialLinkIcon name={link.icon} className={link.iconColor} />
                <span>{link.label}</span>
              </a>
            ))}
          </div>
        </nav>
      </div>

      <div className="mx-auto mt-8 flex max-w-7xl flex-col items-center gap-3 border-t border-white/10 pt-6 text-center text-xs text-blue-300 sm:flex-row sm:justify-between sm:text-left">
        <p>&copy; {new Date().getFullYear()} Samradhi Classes. All rights reserved.</p>
        <nav aria-label="Legal links">
          <ul className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
            {LEGAL_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="hover:text-white">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
