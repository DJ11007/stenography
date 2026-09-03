// Hand-designed per-category exam badges, keyed by category slug -- as
// opposed to exam-category-icon.tsx's generic per-iconKind glyph (shared
// across every category of that kind, e.g. every "commission"-type
// category reuses the same shield). Built from a real logo the admin
// provided for that specific board, redrawn (not reproduced) to keep the
// board's own real colour palette and every generic/decorative motif
// (laurel wreaths, ribbons, zigzag rims, mottoes) faithfully, while
// deliberately excluding two specific things Indian law restricts from
// private/commercial reproduction regardless of who authorises it: the
// State Emblem of India (the Lion Capital -- State Emblem of India
// (Prohibition of Improper Use) Act, 2005) and the national flag (Flag
// Code of India / Prevention of Insults to National Honour Act) -- both
// get generic stand-ins (a star medallion, or a plain wheel/pennant
// motif) where the source logo had them. Every other element -- text,
// colours, wreath shape, ribbon/banner layout, zigzag rims -- is drawn to
// match the real source logo as closely as possible, per explicit
// admin request. Add one entry per slug as the admin provides more
// reference logos; every category without an entry here keeps using the
// generic iconKind-based badge, unaffected.
import type { JSX } from "react";

export const CUSTOM_EXAM_BADGES: Partial<Record<string, () => JSX.Element>> = {
  // Redrawn from a later, cleaner reference the admin sent specifically
  // for SSC CHSL -- a generic "exam preparation" badge with no government
  // emblem or flag in it at all (it even says "UNOFFICIAL EDUCATIONAL
  // CONTENT" on itself), so unlike the seal-style badges below this one
  // is reproduced closely, not redrawn around a legal substitution.
  "ssc-chsl": SscChslBadge,
  "ssc-cgl": () => <SscSealBadge code="SSC CGL" />,
  "crpf-hcm": CrpfHcmBadge,
};

// Precomputed (not runtime-generated) 32-point zigzag/sunburst ring, matching
// the gold triangular rim around the SSC seal's outer edge. Static points
// keep this identical every render and avoid any client-side generation step.
const ZIGZAG_RIM_POINTS = [
  "94.50,50.00 99.26,54.85 93.64,58.68", "93.64,58.68 97.37,64.37 91.11,67.03", "91.11,67.03 93.66,73.33 87.00,74.72", "87.00,74.72 88.26,81.40 81.47,81.47",
  "81.47,81.47 81.40,88.26 74.72,87.00", "74.72,87.00 73.33,93.66 67.03,91.11", "67.03,91.11 64.37,97.37 58.68,93.64", "58.68,93.64 54.85,99.26 50.00,94.50",
  "50.00,94.50 45.15,99.26 41.32,93.64", "41.32,93.64 35.63,97.37 32.97,91.11", "32.97,91.11 26.67,93.66 25.28,87.00", "25.28,87.00 18.60,88.26 18.53,81.47",
  "18.53,81.47 11.74,81.40 13.00,74.72", "13.00,74.72 6.34,73.33 8.89,67.03", "8.89,67.03 2.63,64.37 6.36,58.68", "6.36,58.68 0.74,54.85 5.50,50.00",
  "5.50,50.00 0.74,45.15 6.36,41.32", "6.36,41.32 2.63,35.63 8.89,32.97", "8.89,32.97 6.34,26.67 13.00,25.28", "13.00,25.28 11.74,18.60 18.53,18.53",
  "18.53,18.53 18.60,11.74 25.28,13.00", "25.28,13.00 26.67,6.34 32.97,8.89", "32.97,8.89 35.63,2.63 41.32,6.36", "41.32,6.36 45.15,0.74 50.00,5.50",
  "50.00,5.50 54.85,0.74 58.68,6.36", "58.68,6.36 64.37,2.63 67.03,8.89", "67.03,8.89 73.33,6.34 74.72,13.00", "74.72,13.00 81.40,11.74 81.47,18.53",
  "81.47,18.53 88.26,18.60 87.00,25.28", "87.00,25.28 93.66,26.67 91.11,32.97", "91.11,32.97 97.37,35.63 93.64,41.32", "93.64,41.32 99.26,45.15 94.50,50.00",
];

// Shared by SSC CHSL and SSC CGL -- same seal, same layout, only the
// bottom bar's exam code differs (matching how the two real logos you
// sent are identical except for that one line of text).
function SscSealBadge({ code }: { code: string }) {
  const gradId = `ssc-seal-bg-${code.replace(/\s+/g, "")}`;
  const arcId = `ssc-seal-arc-${code.replace(/\s+/g, "")}`;
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%">
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#dc2626" />
          <stop offset="100%" stopColor="#a11d1d" />
        </linearGradient>
        <path id={arcId} d="M 15 50 A 35 35 0 0 1 85 50" fill="none" />
      </defs>
      <circle cx="50" cy="50" r="49" fill="#d4af37" />
      <circle cx="50" cy="50" r="43.5" fill={`url(#${gradId})`} />
      <g fill="#d4af37" stroke="#a16207" strokeWidth="0.25">
        {ZIGZAG_RIM_POINTS.map((points) => <polygon key={points} points={points} />)}
      </g>
      <g stroke="#d4af37" strokeWidth="1.5" fill="none" strokeLinecap="round">
        <path d="M20 58 C15 50 15 38 21 29" />
        <path d="M18 54 l-4.3 -1.1" /><path d="M17.2 49 l-4.4 -0.2" /><path d="M17 44 l-4.4 0.7" />
        <path d="M17.5 39 l-4.2 1.6" /><path d="M19 34.5 l-3.8 2.4" /><path d="M21 30.5 l-3.4 3" />
        <path d="M80 58 C85 50 85 38 79 29" />
        <path d="M82 54 l4.3 -1.1" /><path d="M82.8 49 l4.4 -0.2" /><path d="M83 44 l4.4 0.7" />
        <path d="M82.5 39 l4.2 1.6" /><path d="M81 34.5 l3.8 2.4" /><path d="M79 30.5 l3.4 3" />
      </g>
      {/* Generic star medallion in place of the State Emblem of India */}
      <g transform="translate(50,22)">
        <path d="M0 -6.4 L1.9 -2 L6.4 -1.8 L2.8 1.1 L4 5.6 L0 3 L-4 5.6 L-2.8 1.1 L-6.4 -1.8 L-1.9 -2 Z" fill="#d4af37" stroke="#78350f" strokeWidth="0.3" />
      </g>
      <text x="50" y="30.5" fontSize="3.6" fontWeight="700" fill="#fef9c3" textAnchor="middle">सत्यमेव जयते</text>
      <text fontSize="5" fontWeight="800" letterSpacing="0.2" fill="#fef9c3">
        <textPath href={`#${arcId}`} startOffset="50%" textAnchor="middle">STAFF SELECTION COMMISSION</textPath>
      </text>
      <path d="M17 68 L83 68 L83 78 Q50 83 17 78 Z" fill="#d4af37" stroke="#a16207" strokeWidth="0.6" />
      <text x="50" y="74.5" fontSize="6" fontWeight="800" fill="#7f1d1d" textAnchor="middle">कर्मचारी चयन आयोग</text>
      <text x="50" y="80" fontSize="4" fontWeight="700" fill="#7f1d1d" textAnchor="middle">भारत सरकार</text>
      <path d="M20 84 L80 84 L80 89 Q50 92.5 20 89 Z" fill="#991b1b" />
      <text x="50" y="88.5" fontSize={code.length > 8 ? 5.6 : 6.6} fontWeight="900" letterSpacing="0.5" fill="white" textAnchor="middle">{code}</text>
    </svg>
  );
}

function SscChslBadge() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%">
      <defs>
        <path id="ssc-chsl-arc-top" d="M 19 40 A 33 33 0 0 1 81 40" fill="none" />
      </defs>
      <circle cx="50" cy="50" r="49" fill="#16305c" />
      <circle cx="50" cy="50" r="34" fill="white" stroke="#0f766e" strokeWidth="1.6" />
      <g fill="white">
        <path d="M12 40 l1 2.6 2.6.2-2 1.8.6 2.6-2.2-1.5-2.2 1.5.6-2.6-2-1.8 2.6-.2Z" />
        <path d="M9 50 l1 2.6 2.6.2-2 1.8.6 2.6-2.2-1.5-2.2 1.5.6-2.6-2-1.8 2.6-.2Z" />
      </g>
      <g fill="#eab308">
        <path d="M12 60 l1 2.6 2.6.2-2 1.8.6 2.6-2.2-1.5-2.2 1.5.6-2.6-2-1.8 2.6-.2Z" />
      </g>
      <g fill="white">
        <path d="M88 40 l1 2.6 2.6.2-2 1.8.6 2.6-2.2-1.5-2.2 1.5.6-2.6-2-1.8 2.6-.2Z" />
        <path d="M91 50 l1 2.6 2.6.2-2 1.8.6 2.6-2.2-1.5-2.2 1.5.6-2.6-2-1.8 2.6-.2Z" />
      </g>
      <g fill="#eab308">
        <path d="M88 60 l1 2.6 2.6.2-2 1.8.6 2.6-2.2-1.5-2.2 1.5.6-2.6-2-1.8 2.6-.2Z" />
      </g>
      <line x1="17" y1="50" x2="22" y2="50" stroke="#7dd3c0" strokeWidth="1" />
      <line x1="78" y1="50" x2="83" y2="50" stroke="#7dd3c0" strokeWidth="1" />
      <text fontSize="8.6" fontWeight="900" letterSpacing="0.3" fill="white">
        <textPath href="#ssc-chsl-arc-top" startOffset="50%" textAnchor="middle">SSC CHSL</textPath>
      </text>
      <g stroke="#f59e0b" strokeWidth="1.4" strokeLinecap="round">
        <line x1="50" y1="40" x2="50" y2="33" />
        <line x1="44" y1="41" x2="40" y2="35" />
        <line x1="56" y1="41" x2="60" y2="35" />
        <line x1="39" y1="44.5" x2="34" y2="40.5" />
        <line x1="61" y1="44.5" x2="66" y2="40.5" />
      </g>
      <g fill="none" stroke="#16305c" strokeWidth="1.6" strokeLinejoin="round">
        <path d="M50 46 C46 43 40 42 36 43 V58 C40 57 46 58 50 61 C54 58 60 57 64 58 V43 C60 42 54 43 50 46 Z" />
        <path d="M50 46 V60" />
      </g>
      <g stroke="#16305c" strokeWidth="0.7">
        <line x1="39" y1="46.5" x2="47" y2="45.5" /><line x1="39" y1="49.5" x2="47" y2="48.5" /><line x1="39" y1="52.5" x2="47" y2="51.5" />
        <line x1="61" y1="46.5" x2="53" y2="45.5" /><line x1="61" y1="49.5" x2="53" y2="48.5" /><line x1="61" y1="52.5" x2="53" y2="51.5" />
      </g>
      <rect x="36" y="61" width="28" height="8" rx="1.5" fill="#0f766e" />
      <g fill="white">
        <rect x="38.3" y="62.8" width="2.1" height="1.8" rx="0.35" /><rect x="41.1" y="62.8" width="2.1" height="1.8" rx="0.35" /><rect x="43.9" y="62.8" width="2.1" height="1.8" rx="0.35" />
        <rect x="46.7" y="62.8" width="2.1" height="1.8" rx="0.35" /><rect x="49.5" y="62.8" width="2.1" height="1.8" rx="0.35" /><rect x="52.3" y="62.8" width="2.1" height="1.8" rx="0.35" />
        <rect x="55.1" y="62.8" width="2.1" height="1.8" rx="0.35" /><rect x="57.9" y="62.8" width="2.1" height="1.8" rx="0.35" />
        <rect x="39" y="65.8" width="22" height="1.6" rx="0.6" />
      </g>
      <circle cx="50" cy="61.5" r="5" fill="white" stroke="#0f766e" strokeWidth="1.3" />
      <path d="M47.4 61.6 L49.3 63.6 L52.8 59.5" fill="none" stroke="#0f766e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M22 74 L78 74 L78 80.5 Q50 84.5 22 80.5 Z" fill="#f59e0b" />
      <text x="50" y="79" fontSize="4.6" fontWeight="800" letterSpacing="0.1" fill="#16305c" textAnchor="middle">EXAM PREPARATION</text>
      <text x="50" y="89.5" fontSize="2.7" fontWeight="700" letterSpacing="0.2" fill="#cbd5e1" textAnchor="middle">UNOFFICIAL EDUCATIONAL CONTENT</text>
    </svg>
  );
}

function CrpfHcmBadge() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%">
      <circle cx="50" cy="50" r="49" fill="#fdfdfb" stroke="#eab308" strokeWidth="1.4" />
      {/* Generic crossed pennants in place of the national flag */}
      <g stroke="#92400e" strokeWidth="1.1">
        <line x1="38" y1="38" x2="30" y2="18" />
        <line x1="62" y1="38" x2="70" y2="18" />
      </g>
      <path d="M30 18 L42 21 L34 25 Z" fill="#ca8a04" />
      <path d="M70 18 L58 21 L66 25 Z" fill="#ca8a04" />
      {/* laurel wreath, opening at the top where the pennants cross */}
      <g stroke="#d4af37" strokeWidth="1.6" fill="none" strokeLinecap="round">
        <path d="M22 40 C15 48 15 62 23 70 C29 75 38 77 46 76" />
        <path d="M24 44 l-4.6 0.6" /><path d="M23 49 l-4.6 1.2" /><path d="M23.4 54.5 l-4.4 1.8" />
        <path d="M25 60 l-4 2.4" /><path d="M28 65 l-3.4 3" /><path d="M32.5 69.5 l-2.6 3.4" />
        <path d="M78 40 C85 48 85 62 77 70 C71 75 62 77 54 76" />
        <path d="M76 44 l4.6 0.6" /><path d="M77 49 l4.6 1.2" /><path d="M76.6 54.5 l4.4 1.8" />
        <path d="M75 60 l4 2.4" /><path d="M72 65 l3.4 3" /><path d="M67.5 69.5 l2.6 3.4" />
      </g>
      {/* Generic multi-spoke wheel in place of the Ashoka Chakra */}
      <circle cx="50" cy="52" r="16" fill="none" stroke="#1e3a8a" strokeWidth="3" />
      <g stroke="#1e3a8a" strokeWidth="1.1">
        {Array.from({ length: 24 }, (_, i) => {
          const a = (i / 24) * 2 * Math.PI;
          return <line key={i} x1={50 + 4 * Math.cos(a)} y1={52 + 4 * Math.sin(a)} x2={50 + 15 * Math.cos(a)} y2={52 + 15 * Math.sin(a)} />;
        })}
      </g>
      <circle cx="50" cy="52" r="4" fill="#1e3a8a" />
      <path d="M22 76 L78 76 L78 82.5 Q50 86 22 82.5 Z" fill="#fdf6e3" stroke="#92400e" strokeWidth="0.6" />
      <text x="50" y="81" fontSize="4.4" fontWeight="800" fill="#1e293b" textAnchor="middle">CENTRAL RESERVE POLICE FORCE</text>
      <text x="50" y="94.5" fontSize="8" fontWeight="900" letterSpacing="0.6" fill="#f97316" textAnchor="middle">HCM</text>
    </svg>
  );
}
