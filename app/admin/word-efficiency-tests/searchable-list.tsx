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
//
// onReorder (8 Nov): the admin drags rows up and down by the ⠿ handle to arrange the tests; the new order is saved at
// once and the student catalogue follows it. Dragging is off while searching (a filtered list has gaps).
export function SearchableList({ items, placeholder, emptyLabel, maxHeightClassName = "max-h-[520px]", onReorder }: { items: { key: string; searchText: string; node: React.ReactNode }[]; placeholder: string; emptyLabel: string; maxHeightClassName?: string; onReorder?: (keys: string[]) => Promise<{ ok: boolean; error: string }> }) {
  const [query, setQuery] = useState("");
  const [order, setOrder] = useState<string[]>(() => items.map((item) => item.key));
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [status, setStatus] = useState<{ text: string; ok: boolean } | null>(null);
  const itemKeys = items.map((item) => item.key).join(",");
  // The server sent a different list (a test added, deleted, or the saved order): start from it again.
  const [orderFor, setOrderFor] = useState(itemKeys);
  if (orderFor !== itemKeys) { setOrderFor(itemKeys); setOrder(itemKeys ? itemKeys.split(",") : []); }
  const byKey = new Map(items.map((item) => [item.key, item]));
  const ordered = [...order.map((key) => byKey.get(key)).filter((item): item is (typeof items)[number] => Boolean(item)), ...items.filter((item) => !order.includes(item.key))];
  const q = query.trim().toLowerCase();
  const filtered = q ? ordered.filter((item) => item.searchText.toLowerCase().includes(q)) : ordered;
  const canDrag = Boolean(onReorder) && !q && ordered.length > 1;

  const move = async (from: string, to: string) => {
    if (from === to || !onReorder) return;
    const keys = ordered.map((item) => item.key);
    const next = keys.filter((key) => key !== from);
    next.splice(next.indexOf(to) + (keys.indexOf(from) < keys.indexOf(to) ? 1 : 0), 0, from);
    const previous = order;
    setOrder(next);
    setStatus({ text: "Saving the order…", ok: true });
    const result = await onReorder(next).catch(() => ({ ok: false, error: "Could not save the order. Check your internet connection and try again." }));
    if (!result.ok) { setOrder(previous); setStatus({ text: result.error, ok: false }); return; }
    setStatus({ text: "Order saved. Students see the tests in this order.", ok: true });
  };
  const nudge = (key: string, step: -1 | 1) => { const keys = ordered.map((item) => item.key); const target = keys[keys.indexOf(key) + step]; if (target) void move(key, target); };

  return (
    <div>
      <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={placeholder} aria-label={placeholder} className="input" />
      {onReorder && <p className="mt-2 text-xs text-slate-500">{q ? "Clear the search to rearrange the tests." : "Drag a test by ⠿ (or use ▲ ▼) to change the order students see."}</p>}
      {status && <p role={status.ok ? "status" : "alert"} className={`mt-1 text-xs font-bold ${status.ok ? "text-green-700" : "text-red-700"}`}>{status.text}</p>}
      <div className={`mt-3 space-y-3 overflow-y-auto pr-1 ${maxHeightClassName}`}>
        {filtered.map((item, index) => (
          <div key={item.key} data-order-key={item.key}
            className={`flex items-stretch gap-1 rounded-xl ${over === item.key && dragging && dragging !== item.key ? "ring-2 ring-blue-400" : ""} ${dragging === item.key ? "opacity-50" : ""}`}
            onDragOver={canDrag ? (event) => { event.preventDefault(); setOver(item.key); } : undefined}
            onDragLeave={canDrag ? () => setOver((current) => (current === item.key ? null : current)) : undefined}
            onDrop={canDrag ? (event) => { event.preventDefault(); const from = dragging; setDragging(null); setOver(null); if (from) void move(from, item.key); } : undefined}>
            {canDrag && (
              <div className="flex flex-none flex-col items-center justify-center gap-0.5">
                <button type="button" aria-label="Move up" title="Move up" disabled={index === 0} onClick={() => nudge(item.key, -1)} className="h-5 w-6 rounded text-[10px] text-slate-500 hover:bg-slate-200 disabled:opacity-30">▲</button>
                <span draggable onDragStart={(event) => { setDragging(item.key); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", item.key); }} onDragEnd={() => { setDragging(null); setOver(null); }}
                  title="Drag to move" aria-hidden className="cursor-grab select-none px-1 text-lg leading-none text-slate-400 active:cursor-grabbing">⠿</span>
                <button type="button" aria-label="Move down" title="Move down" disabled={index === filtered.length - 1} onClick={() => nudge(item.key, 1)} className="h-5 w-6 rounded text-[10px] text-slate-500 hover:bg-slate-200 disabled:opacity-30">▼</button>
              </div>
            )}
            <div className="min-w-0 flex-1">{item.node}</div>
          </div>
        ))}
        {!filtered.length && <p className="rounded-2xl border border-dashed bg-white p-6 text-center text-sm text-slate-500">{query ? `No matches for "${query}".` : emptyLabel}</p>}
      </div>
    </div>
  );
}
