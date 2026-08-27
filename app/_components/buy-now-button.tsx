import Link from "next/link";

function TicketIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden focusable={false} viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v1.3a1.7 1.7 0 0 0 0 3.4V15a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1.3a1.7 1.7 0 0 0 0-3.4Z" />
      <path d="M9.5 7.2v9.6" strokeDasharray="1.8 2.2" />
    </svg>
  );
}

/** A distinct look from the site's usual blue accents on purpose -- this is
 * the one button whose whole job is to say "this is different, this is
 * where you buy something." Links straight to the /courses page (grouped
 * by category), rather than opening a modal, so it works the same from
 * any page and is shareable/bookmarkable on its own. */
export function BuyNowButton({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/courses"
      className={`group relative inline-flex items-center gap-1.5 overflow-hidden rounded-full bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 px-4 py-2 text-sm font-black text-white shadow-md shadow-violet-500/30 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-violet-500/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 ${className}`}
    >
      <span aria-hidden className="absolute inset-0 -translate-x-full bg-white/25 transition-transform duration-700 group-hover:translate-x-full" style={{ clipPath: "polygon(0 0, 30% 0, 10% 100%, -20% 100%)" }} />
      <TicketIcon className="h-4 w-4" />
      Buy Now
    </Link>
  );
}
