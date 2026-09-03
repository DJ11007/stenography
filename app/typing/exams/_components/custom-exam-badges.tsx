// Hand-designed per-category exam badges, keyed by category slug -- as
// opposed to exam-category-icon.tsx's generic per-iconKind glyph (shared
// across every category of that kind, e.g. every "commission"-type
// category reuses the same shield). Built from a real logo the admin
// provided for that specific board, redrawn (not reproduced) to keep the
// board's own real colour palette and any generic/decorative motifs
// (laurel wreaths, ribbons, stars) while deliberately excluding any
// protected government emblem (the State Emblem of India, in particular)
// -- see the conversation that approved the SSC CHSL badge below for why
// that line matters here specifically. Add one entry per slug as the
// admin provides more reference logos; every category without an entry
// here keeps using the generic iconKind-based badge, unaffected.
import type { JSX } from "react";

export const CUSTOM_EXAM_BADGES: Partial<Record<string, () => JSX.Element>> = {
  "ssc-chsl": SscChslBadge,
};

function SscChslBadge() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%">
      <defs>
        <linearGradient id="ssc-chsl-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#dc2626" />
          <stop offset="100%" stopColor="#7f1d1d" />
        </linearGradient>
        <linearGradient id="ssc-chsl-gold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="50%" stopColor="#d4af37" />
          <stop offset="100%" stopColor="#a16207" />
        </linearGradient>
        <path id="ssc-chsl-arc-top" d="M 18 38 A 34 34 0 0 1 82 38" fill="none" />
      </defs>
      <circle cx="50" cy="50" r="49" fill="white" opacity="0.08" />
      <circle cx="50" cy="50" r="44" fill="url(#ssc-chsl-bg)" stroke="url(#ssc-chsl-gold)" strokeWidth="2" />
      <circle cx="50" cy="50" r="40" fill="none" stroke="#fde68a" strokeOpacity="0.35" strokeWidth="0.75" />
      <g stroke="url(#ssc-chsl-gold)" strokeWidth="1.6" fill="none" strokeLinecap="round">
        <path d="M22 62 C16 54 16 42 23 33" />
        <g strokeWidth="1.3">
          <path d="M20 58 l-4.5 -1.3" /><path d="M19 53 l-4.6 -0.4" /><path d="M18.6 48 l-4.6 0.6" />
          <path d="M19 43 l-4.4 1.6" /><path d="M20.5 38.5 l-4 2.4" /><path d="M22.5 34.5 l-3.6 3" />
        </g>
      </g>
      <g stroke="url(#ssc-chsl-gold)" strokeWidth="1.6" fill="none" strokeLinecap="round">
        <path d="M78 62 C84 54 84 42 77 33" />
        <g strokeWidth="1.3">
          <path d="M80 58 l4.5 -1.3" /><path d="M81 53 l4.6 -0.4" /><path d="M81.4 48 l4.6 0.6" />
          <path d="M81 43 l4.4 1.6" /><path d="M79.5 38.5 l4 2.4" /><path d="M77.5 34.5 l3.6 3" />
        </g>
      </g>
      <text fontSize="6.4" fontWeight="800" letterSpacing="0.6" fill="#fef9c3">
        <textPath href="#ssc-chsl-arc-top" startOffset="50%" textAnchor="middle">STAFF SELECTION COMMISSION</textPath>
      </text>
      <g transform="translate(50,49)">
        <path d="M0 -13 L3.6 -4.2 L13 -3.6 L5.8 2.4 L8 11.6 L0 6.4 L-8 11.6 L-5.8 2.4 L-13 -3.6 L-3.6 -4.2 Z" fill="url(#ssc-chsl-gold)" stroke="#78350f" strokeWidth="0.4" />
      </g>
      <path d="M14 72 L86 72 L86 84 Q50 90 14 84 Z" fill="#991b1b" stroke="url(#ssc-chsl-gold)" strokeWidth="1" />
      <path d="M14 72 L86 72" stroke="url(#ssc-chsl-gold)" strokeWidth="1" />
      <text x="50" y="81.5" fontSize="10.5" fontWeight="900" letterSpacing="1" fill="white" textAnchor="middle">SSC CHSL</text>
      <text x="50" y="66.5" fontSize="4.6" fontWeight="700" fill="#fde68a" textAnchor="middle">कर्मचारी चयन आयोग</text>
    </svg>
  );
}
