import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { AccessNavigation } from "./access-navigation";
import { BuyNowButton } from "./buy-now-button";

function ConnectIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden focusable={false} viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.07 0l2.5-2.5a5 5 0 0 0-7.07-7.07L11 4.88" />
      <path d="M14 11a5 5 0 0 0-7.07 0l-2.5 2.5a5 5 0 0 0 7.07 7.07L13 19.12" />
    </svg>
  );
}

export async function SiteHeader() {
  const user = await getCurrentUser();
  let account: { fullName: string; role: "student" | "admin" } | null = null;
  if (user) {
    const supabase = await createClient();
    const { data: profile } = await supabase.from("profiles").select("full_name, role").eq("id", user.id).maybeSingle();
    if (profile?.role === "student" || profile?.role === "admin") {
      account = { fullName: profile.full_name?.trim() || "Student", role: profile.role };
    }
  }
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 shadow-sm backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-3 py-3 sm:gap-3 sm:px-6">
        <Link href="/" className="group flex min-w-0 items-center gap-3 text-sm font-black tracking-wide text-blue-800 sm:text-base">
          <Image
            src="/samradhi-classes-logo.png"
            alt="Samradhi Classes logo"
            width={40}
            height={40}
            priority
            className="h-10 w-10 shrink-0 rounded-full object-contain transition-transform duration-300 group-hover:scale-110"
          />
          <span className="hidden sm:block">SAMRADHI CLASSES</span>
        </Link>
        <div className="flex items-center gap-2">
          <Link href="/typing" className="hidden rounded-lg px-3 py-2 text-sm font-bold text-blue-700 transition-colors hover:bg-blue-50 md:block">
            Typing Hub
          </Link>
          <Link href="/live-test" className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-rose-50 px-3.5 py-2 text-xs font-black text-rose-700 shadow-sm ring-1 ring-rose-200 transition-all hover:-translate-y-0.5 hover:bg-rose-100 sm:px-4 sm:text-sm">
            <span className="relative flex h-2 w-2" aria-hidden>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-600" />
            </span>
            Join Live Test
          </Link>
          <Link href="/connect" className="group relative inline-flex items-center gap-1.5 overflow-hidden whitespace-nowrap rounded-full bg-gradient-to-r from-teal-500 via-cyan-500 to-sky-500 px-3.5 py-2 text-xs font-black text-white shadow-md shadow-cyan-500/30 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-cyan-500/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600 sm:px-4 sm:text-sm">
            <span aria-hidden className="absolute inset-0 -translate-x-full bg-white/25 transition-transform duration-700 group-hover:translate-x-full" style={{ clipPath: "polygon(0 0, 30% 0, 10% 100%, -20% 100%)" }} />
            <ConnectIcon className="h-4 w-4" />
            Connect
          </Link>
          <BuyNowButton />
          <AccessNavigation account={account} />
        </div>
      </div>
    </header>
  );
}
