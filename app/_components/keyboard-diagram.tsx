"use client";

import type { Finger, KeyCap } from "@/lib/english-tutor-content";

// Shared "next key to press" virtual keyboard, extracted from the two
// near-identical page-local copies in the Kruti Dev and English learn
// tutors (app/typing/learn/krutidev/krutidev-tutor.tsx,
// app/typing/learn/english-tutor/english-tutor.tsx) so the new homepage
// demo can use the same visual without duplicating it a third time. The
// two originals differed only in a hardcoded font family for the glyph
// spans (Kruti Dev's own font vs. a plain monospace stack) and whether
// the small top-left corner key-label was rendered -- both are now the
// `fontFamily` prop and an always-on label, a strict superset of both.
export function KeyboardDiagram({
  keyboardRows,
  fingerColor,
  activeKey,
  activeShift,
  fontFamily,
  compact = false,
}: {
  keyboardRows: KeyCap[][];
  fingerColor: (finger: Finger) => string;
  activeKey: string | null;
  activeShift: boolean;
  fontFamily: string;
  compact?: boolean;
}) {
  return (
    <div className={`rounded-2xl bg-slate-800 p-2 shadow-sm sm:p-3 ${compact ? "min-w-[560px]" : "min-w-[680px]"}`}>
      <div className="space-y-1.5">
        {keyboardRows.map((row, rowIndex) => (
          <div key={rowIndex} className="flex gap-1.5">
            {row.map((cap) => {
              const isGlyph = cap.key.length === 1;
              const isActive = activeKey != null && cap.key.trim() === activeKey.trim();
              const color = fingerColor(cap.finger);
              return (
                <div
                  key={cap.key}
                  style={{
                    flexGrow: cap.width ?? 1,
                    flexBasis: 0,
                    background: isActive ? color : isGlyph ? `${color}2e` : "rgba(255,255,255,0.06)",
                    borderColor: isActive ? "#fff" : "transparent",
                  }}
                  className={`relative flex ${compact ? "h-10 sm:h-11" : "h-12 sm:h-14"} min-w-0 flex-col items-center justify-center rounded-md border text-white`}
                >
                  <span className={`absolute left-1 top-0.5 text-[9px] font-bold ${isActive ? "text-slate-900" : "text-white/45"}`}>
                    {isGlyph ? cap.key.toUpperCase() : cap.key}
                  </span>
                  {isGlyph && cap.shift && cap.shift !== cap.normal && (
                    <span
                      className={`absolute right-1 top-0 text-[13px] leading-none ${isActive && activeShift ? "text-slate-900" : "text-white/50"}`}
                      style={{ fontFamily }}
                    >
                      {cap.shift}
                    </span>
                  )}
                  {isGlyph ? (
                    <span className={`mt-1 text-lg leading-none ${isActive ? "text-slate-900" : "text-white"}`} style={{ fontFamily }}>
                      {cap.normal === " " ? "" : cap.normal}
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-white/70">{cap.key.trim() || "Space"}</span>
                  )}
                  {cap.home && <span className="absolute bottom-1 h-0.5 w-3 rounded-full bg-white/70" />}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
