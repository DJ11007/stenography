"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

function ArrowIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

export function BackButton({ href, label = "Back", dark = false, className = "" }: { href?: string; label?: string; dark?: boolean; className?: string }) {
  const router = useRouter();
  const base = "group inline-flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-4 text-sm font-bold shadow-sm backdrop-blur transition-all hover:pl-2 hover:pr-5 hover:shadow-md";
  const theme = dark
    ? "border border-white/20 bg-white/10 text-white hover:border-white/40 hover:bg-white/20"
    : "border border-slate-200 bg-white/90 text-slate-700 hover:border-blue-300 hover:bg-blue-50";
  const badgeTheme = dark ? "bg-white/15 text-white group-hover:bg-white group-hover:text-slate-900" : "bg-slate-100 text-slate-600 group-hover:bg-blue-600 group-hover:text-white";
  const content = (
    <>
      <span className={`flex h-6 w-6 items-center justify-center rounded-full transition-colors ${badgeTheme}`}>
        <ArrowIcon className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
      </span>
      {label}
    </>
  );
  if (href) return <Link href={href} className={`${base} ${theme} ${className}`}>{content}</Link>;
  return <button type="button" onClick={() => router.back()} className={`${base} ${theme} ${className}`}>{content}</button>;
}
