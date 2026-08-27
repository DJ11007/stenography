import Image from "next/image";
import Link from "next/link";
import { AccessNavigation } from "./access-navigation";
import { BuyNowButton } from "./buy-now-button";
import { OFFICIAL_LINKS, OfficialLinkIcon } from "./official-links";

export function SiteHeader() {
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
          <details className="group relative">
            <summary className="cursor-pointer list-none whitespace-nowrap rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 sm:px-4 sm:text-sm">
              Connect <span aria-hidden="true" className="ml-1 inline-block transition-transform group-open:rotate-180">▾</span>
            </summary>
            <nav aria-label="Samradhi Classes social and official links" className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-xl border border-blue-100 bg-white p-2 shadow-xl">
              {OFFICIAL_LINKS.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={link.ariaLabel}
                  className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-bold text-blue-800 transition-colors hover:bg-blue-50 focus-visible:bg-blue-50 focus-visible:outline-2 focus-visible:outline-blue-700"
                >
                  <OfficialLinkIcon name={link.icon} className={link.iconColor} />
                  <span>{link.label}</span>
                </a>
              ))}
            </nav>
          </details>
          <BuyNowButton />
          <AccessNavigation />
        </div>
      </div>
    </header>
  );
}
