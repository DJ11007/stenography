import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { AccessNavigation } from "./access-navigation";
import { BuyNowButton } from "./buy-now-button";

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
          <Link href="/connect" className="whitespace-nowrap rounded-full bg-blue-700 px-3.5 py-2 text-xs font-black text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-blue-800 hover:shadow-md sm:px-4 sm:text-sm">
            Connect
          </Link>
          <BuyNowButton />
          <AccessNavigation account={account} />
        </div>
      </div>
    </header>
  );
}
