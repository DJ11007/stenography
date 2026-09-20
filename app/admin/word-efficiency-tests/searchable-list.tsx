"use client";

import { useState } from "react";

// Real reported feedback: this page's Managed tests list and its Attempts
// and results list both grow unbounded with the admin's own real data (a
// test with 37+ attempts, or many managed tests) -- every row rendered
// inline made the whole page "very long in scrolling" with no way to
// jump straight to what you're looking for. A capped-height scrollable
// panel plus a plain substring search keeps the page itself short
// regardless of how much data is in either list, while still rendering
// every row server-side (this component only filters/scrolls already-
// rendered nodes, passed in as children -- no data duplicated or
// refetched client-side).
export function SearchableList({ items, placeholder, emptyLabel, maxHeightClassName = "max-h-[520px]" }: { items: { key: string; searchText: string; node: React.ReactNode }[]; placeholder: string; emptyLabel: string; maxHeightClassName?: string }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const filtered = q ? items.filter((item) => item.searchText.toLowerCase().includes(q)) : items;
  return (
    <div>
      <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={placeholder} aria-label={placeholder} className="input" />
      <div className={`mt-3 space-y-3 overflow-y-auto pr-1 ${maxHeightClassName}`}>
        {filtered.map((item) => <div key={item.key}>{item.node}</div>)}
        {!filtered.length && <p className="rounded-2xl border border-dashed bg-white p-6 text-center text-sm text-slate-500">{query ? `No matches for "${query}".` : emptyLabel}</p>}
      </div>
    </div>
  );
}
