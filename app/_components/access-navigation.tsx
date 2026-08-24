import Link from "next/link";

const accessLinks = [
  { href: "/login", label: "Student Login" },
  { href: "/signup", label: "Sign Up" },
  { href: "/admin/login", label: "Admin Login" },
];

const supportNumber = "7014371324";

export function AccessNavigation({ dark = false }: { dark?: boolean }) {
  const linkClass = dark ? "text-white hover:bg-white/10" : "text-slate-700 hover:bg-blue-50 hover:text-blue-700";
  return <><nav aria-label="Account and support links" className="hidden items-center gap-1 md:flex"><a href={`tel:+91${supportNumber}`} aria-label={`Call support at ${supportNumber}`} className={`rounded-lg px-3 py-2 text-sm font-bold ${linkClass}`}>Support: {supportNumber}</a>{accessLinks.map((link) => <Link key={link.href} href={link.href} className={`rounded-lg px-3 py-2 text-sm font-bold ${linkClass}`}>{link.label}</Link>)}</nav><details className="relative md:hidden"><summary aria-label="Open account menu" className={`cursor-pointer list-none rounded-lg border px-3 py-2 text-sm font-black ${dark ? "border-blue-300 text-white" : "border-slate-300 text-slate-800"}`}>Menu</summary><nav aria-label="Mobile account and support links" className="absolute right-0 z-[90] mt-2 grid min-w-56 gap-1 rounded-xl border border-slate-200 bg-white p-2 text-slate-800 shadow-xl"><a href={`tel:+91${supportNumber}`} aria-label={`Call support at ${supportNumber}`} className="rounded-lg bg-blue-50 px-3 py-2 text-sm font-bold text-blue-700 hover:bg-blue-100">Support: {supportNumber}</a>{accessLinks.map((link) => <Link key={link.href} href={link.href} className="rounded-lg px-3 py-2 text-sm font-bold hover:bg-blue-50 hover:text-blue-700">{link.label}</Link>)}</nav></details></>;
}
