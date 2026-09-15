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

// Icon-only, solid, high-contrast by design -- the previous pill-with-text
// version used a translucent/pale background (white/10 on dark headers,
// white/90 on light pages) that students reported as hard to notice. label
// still carries the real destination (e.g. "Admin panel", "Typing Hub") via
// title/aria-label, so hovering or a screen reader still gets that context;
// it's just never shown as visible text any more.
export function BackButton({ href, label = "Back", dark = false, className = "" }: { href?: string; label?: string; dark?: boolean; className?: string }) {
  const router = useRouter();
  const base = "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full shadow-sm transition-transform hover:scale-105 active:scale-95";
  const theme = dark
    ? "bg-white text-slate-900 hover:bg-blue-50"
    : "bg-slate-900 text-white hover:bg-blue-700";
  const content = <ArrowIcon className="h-5 w-5" />;
  if (href) return <Link href={href} aria-label={label} title={label} className={`${base} ${theme} ${className}`}>{content}</Link>;
  return <button type="button" onClick={() => router.back()} aria-label={label} title={label} className={`${base} ${theme} ${className}`}>{content}</button>;
}
