import Link from "next/link";

// The one promo card for the offline Windows app, shared so the homepage and the /typing hub
// show the exact same thing instead of two near-identical copies drifting apart.
export function OfflineAppBanner({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/offline-app"
      className={`flex flex-col items-start gap-4 rounded-3xl border border-indigo-200 bg-indigo-50 p-7 transition hover:-translate-y-1 hover:shadow-lg sm:flex-row sm:items-center sm:justify-between ${className}`}
    >
      <div>
        <p className="text-sm font-black uppercase tracking-widest text-indigo-600">New -- for Windows</p>
        <h3 className="mt-2 text-2xl font-black text-slate-900">SCTyping — Offline Typing App</h3>
        <p className="mt-2 max-w-xl text-slate-600">
          Practice every exam board&apos;s pattern without any internet connection -- download, install, and activate once.
        </p>
      </div>
      <span className="inline-flex shrink-0 rounded-xl bg-indigo-600 px-5 py-3 font-black text-white">
        Download for Windows →
      </span>
    </Link>
  );
}
