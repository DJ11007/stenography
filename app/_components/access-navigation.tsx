import Link from "next/link";
import { signOut } from "@/app/auth/actions";

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

function CallNowLink({ mobile = false }: { mobile?: boolean }) {
  return (
    <a
      href={`tel:+91${supportNumber}`}
      aria-label={`Call support now at ${supportNumber}`}
      className={
        mobile
          ? "inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2.5 text-sm font-black text-white transition-colors hover:bg-emerald-700"
          : "inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3.5 py-2 text-xs font-black text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-emerald-700 hover:shadow-md sm:px-4 sm:text-sm"
      }
    >
      <PhoneIcon className="h-4 w-4" />
      Call Now
    </a>
  );
}

type Account = { fullName: string; role: "student" | "admin" } | null;

export function AccessNavigation({ account = null, dark = false }: { account?: Account; dark?: boolean }) {
  // Same pill family as Connect (site-header.tsx) and Call Now above: rounded-full,
  // px-3.5/py-2 sizing that steps up at sm:, font-black -- outlined rather than
  // solid so it reads as the secondary action next to Connect's solid fill.
  const portalClass = dark
    ? "border-white text-white hover:bg-white/10"
    : "border-blue-700 text-blue-700 hover:bg-blue-50";

  if (account) {
    const initials = account.fullName.split(/\s+/u).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "ST";
    const dashboardHref = account.role === "admin" ? "/admin" : "/student";
    return (
      <details className="group relative">
        <summary
          aria-label="Open account menu"
          className={`flex cursor-pointer list-none items-center gap-2 rounded-xl border p-1.5 pr-3 transition ${dark ? "border-white/20 bg-white/10 hover:bg-white/15" : "border-slate-200 bg-slate-50 hover:bg-blue-50"}`}
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-cyan-300 to-violet-300 text-xs font-black text-blue-950 ring-2 ring-white/50">
            {initials}
          </span>
          <span className={`hidden max-w-28 truncate text-sm font-black sm:block ${dark ? "text-white" : "text-slate-800"}`}>{account.fullName}</span>
          <span aria-hidden="true" className="text-xs transition group-open:rotate-180">▾</span>
        </summary>
        <nav aria-label="Account menu" className="absolute right-0 z-[90] mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white p-2 text-slate-800 shadow-xl">
          <Link href={dashboardHref} className="block rounded-lg px-3 py-2.5 text-sm font-bold hover:bg-blue-50 hover:text-blue-700">Dashboard</Link>
          {account.role === "student" && <Link href="/student/profile" className="block rounded-lg px-3 py-2.5 text-sm font-bold hover:bg-blue-50 hover:text-blue-700">My Profile</Link>}
          <Link href="/account/security" className="block rounded-lg px-3 py-2.5 text-sm font-bold hover:bg-blue-50 hover:text-blue-700">Security</Link>
          <form action={signOut} className="mt-1 border-t border-slate-100 pt-1">
            <button className="w-full rounded-lg px-3 py-2.5 text-left text-sm font-black text-red-700 hover:bg-red-50">Sign out</button>
          </form>
        </nav>
      </details>
    );
  }

  return (
    <>
      <nav aria-label="Account and support links" className="hidden items-center gap-2 md:flex">
        <Link href="/login" className={`whitespace-nowrap rounded-full border-2 px-3.5 py-2 text-xs font-black transition-all hover:-translate-y-0.5 sm:px-4 sm:text-sm ${portalClass}`}>
          Student Portal
        </Link>
        <CallNowLink />
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
          <Link href="/login" className="rounded-lg px-3 py-2 text-sm font-bold hover:bg-blue-50 hover:text-blue-700">
            Student Portal
          </Link>
          <CallNowLink mobile />
        </nav>
      </details>
    </>
  );
}
