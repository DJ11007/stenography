import Link from "next/link";

const accessLinks = [
  { href: "/login", label: "Student Login" },
  { href: "/signup", label: "Sign Up" },
  { href: "/admin/login", label: "Admin Login" },
];

const supportNumber = "7014371324";

function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      focusable={false}
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0 1 22 16.92Z" />
    </svg>
  );
}

export function AccessNavigation({ dark = false }: { dark?: boolean }) {
  const linkClass = dark ? "text-white hover:bg-white/10" : "text-slate-700 hover:bg-blue-50 hover:text-blue-700";
  return (
    <>
      <nav aria-label="Account and support links" className="hidden items-center gap-1 md:flex">
        {accessLinks.map((link) => (
          <Link key={link.href} href={link.href} className={`rounded-lg px-3 py-2 text-sm font-bold ${linkClass}`}>
            {link.label}
          </Link>
        ))}
        <a
          href={`tel:+91${supportNumber}`}
          aria-label={`Call support now at ${supportNumber}`}
          className="ml-1 inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3.5 py-2 text-sm font-black text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-emerald-700 hover:shadow-md"
        >
          <PhoneIcon className="h-4 w-4" />
          Call Now
        </a>
      </nav>
      <details className="relative md:hidden">
        <summary
          aria-label="Open account menu"
          className={`cursor-pointer list-none rounded-lg border px-3 py-2 text-sm font-black ${dark ? "border-blue-300 text-white" : "border-slate-300 text-slate-800"}`}
        >
          Menu
        </summary>
        <nav
          aria-label="Mobile account and support links"
          className="absolute right-0 z-[90] mt-2 grid min-w-56 gap-1 rounded-xl border border-slate-200 bg-white p-2 text-slate-800 shadow-xl"
        >
          {accessLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg px-3 py-2 text-sm font-bold hover:bg-blue-50 hover:text-blue-700"
            >
              {link.label}
            </Link>
          ))}
          <a
            href={`tel:+91${supportNumber}`}
            aria-label={`Call support now at ${supportNumber}`}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2.5 text-sm font-black text-white transition-colors hover:bg-emerald-700"
          >
            <PhoneIcon className="h-4 w-4" />
            Call Now
          </a>
        </nav>
      </details>
    </>
  );
}
