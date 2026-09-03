"use client";
import { useId } from "react";
import type { ExamCategoryIconKind } from "@/lib/exam-categories";
import { CUSTOM_EXAM_BADGES } from "./custom-exam-badges";

type IconableCategory = { slug: string; tone: string; toneDark: string; iconKind: ExamCategoryIconKind; badge?: string };

function Glyph({ kind }: { kind: ExamCategoryIconKind }) {
  const common = { fill: "none", stroke: "white", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (kind) {
    case "commission":
      return <g {...common}><path d="M12 3 L19 6 V11 C19 16 16 19.5 12 21 C8 19.5 5 16 5 11 V6 Z" /><path d="M9 12 L11 14.2 L15.2 9" /></g>;
    case "medical":
      return <g {...common}><circle cx="12" cy="12" r="8.3" /><path d="M12 8v8M8 12h8" /></g>;
    case "train":
      return <g {...common}><rect x="4.5" y="8" width="15" height="7.5" rx="2" /><path d="M4.5 11.5h15" /><circle cx="8.5" cy="17.5" r="1.4" /><circle cx="15.5" cy="17.5" r="1.4" /><path d="M9 8V5.5h6V8" /></g>;
    case "police":
      return <g {...common}><path d="M12 3 L19 6 V11 C19 16 16 19.5 12 21 C8 19.5 5 16 5 11 V6 Z" /><circle cx="12" cy="11.5" r="2.6" fill="white" stroke="none" /></g>;
    case "scales":
      return <g {...common}><path d="M12 4v16M6 8h12" /><path d="M4 8l2.5 5H3.5L6 8ZM18 8l2.5 5h-5L18 8Z" /><path d="M9 20h6" /></g>;
    case "book":
      return <g {...common}><path d="M4 6.5c3-1.7 6-1.7 8 0v11.5c-2-1.7-5-1.7-8 0Z" /><path d="M20 6.5c-3-1.7-6-1.7-8 0v11.5c2-1.7 5-1.7 8 0Z" /></g>;
    case "flask":
      return <g {...common}><path d="M9.5 3.5h5" /><path d="M10.3 3.5v6L5.7 17.7c-.7 1.3.2 2.8 1.6 2.8h9.4c1.4 0 2.3-1.5 1.6-2.8L13.7 9.5v-6" /><path d="M7.7 15.5h8.6" /></g>;
    case "monitor":
      return <g {...common}><rect x="3.5" y="5" width="17" height="12" rx="1.6" /><path d="M8.5 20.5h7M12 17v3.5" /></g>;
    default:
      return null;
  }
}

const TICK_COUNT = 24;

export function ExamCategoryIcon({ category, size = 84 }: { category: IconableCategory; size?: number }) {
  // A hand-designed badge for this exact board (built from a real logo
  // the admin provided, redrawn -- see custom-exam-badges.tsx) takes
  // priority over the generic shared-per-iconKind glyph below. Falls
  // through to the generic badge for every category without one yet.
  const CustomBadge = CUSTOM_EXAM_BADGES[category.slug];
  const uid = useId().replace(/[:]/g, "");
  const gradientId = `exam-cat-gradient-${uid}`;
  const arcId = `exam-cat-arc-${uid}`;
  const ticks = Array.from({ length: TICK_COUNT }, (_, index) => {
    const angle = (index / TICK_COUNT) * 2 * Math.PI;
    const inner = 45, outer = 48.5;
    return {
      x1: 50 + inner * Math.cos(angle), y1: 50 + inner * Math.sin(angle),
      x2: 50 + outer * Math.cos(angle), y2: 50 + outer * Math.sin(angle),
    };
  });
  if (CustomBadge) {
    return (
      <span className="relative flex shrink-0 items-center justify-center drop-shadow-md" style={{ width: size, height: size }} aria-hidden="true">
        <CustomBadge />
      </span>
    );
  }
  return (
    <span className="relative flex shrink-0 items-center justify-center drop-shadow-md" style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 100 100" width={size} height={size}>
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={category.tone} />
            <stop offset="100%" stopColor={category.toneDark} />
          </linearGradient>
          <path id={arcId} d="M 20 68 A 30 30 0 0 0 80 68" fill="none" />
        </defs>
        <circle cx="50" cy="50" r="49" fill="white" opacity="0.12" />
        <g stroke="white" strokeOpacity="0.55" strokeWidth="1.1">
          {ticks.map((tick, index) => <line key={index} x1={tick.x1} y1={tick.y1} x2={tick.x2} y2={tick.y2} />)}
        </g>
        <circle cx="50" cy="50" r="42" fill={`url(#${gradientId})`} stroke="white" strokeOpacity="0.5" strokeWidth="1.5" />
        <circle cx="50" cy="50" r="36" fill="none" stroke="white" strokeOpacity="0.3" strokeWidth="1" />
        <g transform="translate(30, 20) scale(1.65)"><Glyph kind={category.iconKind} /></g>
        {category.badge && (
          <text fontSize="9" fontWeight="800" letterSpacing="1.5" fill="white">
            <textPath href={`#${arcId}`} startOffset="50%" textAnchor="middle">{category.badge}</textPath>
          </text>
        )}
      </svg>
    </span>
  );
}
