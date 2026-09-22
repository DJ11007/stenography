import Link from "next/link";
import { formatISTDate } from "@/lib/format-datetime";

// Real requested feature: a result from a few days back used to scroll
// off the latest-30 ticker and become unfindable. Plain Links with a
// ?date= query param (not client state) so each date's results are their
// own server-rendered fetch -- a full day's results aren't bounded to 30
// rows the way the "latest overall" feed is, so re-fetching per date
// keeps the page from ever loading months of history at once.
export function LiveResultDateTabs({ dates, selected }: { dates: string[]; selected: string | undefined }) {
  return (
    <div role="tablist" aria-label="Filter results by date" className="mt-4 flex flex-wrap gap-2">
      {dates.map((date) => {
        const active = date === selected;
        return (
          <Link
            key={date}
            href={`/live-test?date=${date}#results`}
            role="tab"
            aria-selected={active}
            className={`rounded-full px-3 py-1.5 text-xs font-black ${active ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
          >
            {formatISTDate(date, { day: "numeric", month: "short" }) || date}
          </Link>
        );
      })}
    </div>
  );
}
