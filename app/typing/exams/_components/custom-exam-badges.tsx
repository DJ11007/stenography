// Hand-designed per-category exam badges, keyed by category slug -- as
// opposed to exam-category-icon.tsx's generic per-iconKind glyph (shared
// across every category of that kind, e.g. every "commission"-type
// category reuses the same shield). Built from a real logo the admin
// provided for that specific board. Where the source logo carries a
// protected government symbol (the State Emblem of India -- State Emblem
// of India (Prohibition of Improper Use) Act, 2005 -- or the national
// flag -- Flag Code of India), a generic stand-in is used instead,
// regardless of who authorises it; that isn't the case for any badge
// below -- every one of these is redrawn from a generic "exam
// preparation" style reference logo (no government emblem, no flag; each
// source image even labels itself "UNOFFICIAL EDUCATIONAL CONTENT"), so
// each is reproduced closely. Add one entry per slug as the admin
// provides more reference logos; every category without an entry here
// keeps using the generic iconKind-based badge, unaffected.
import type { JSX } from "react";

export const CUSTOM_EXAM_BADGES: Partial<Record<string, () => JSX.Element>> = {
  "ssc-chsl": SscChslBadge,
  "ssc-cgl": SscCglBadge,
  "rrb-ntpc": RrbNtpcBadge,
  "crpf-hcm": CrpfHcmBadge,
  "dsssb-ldc": DsssbLdcBadge,
  "up-police-computer-operator": UpPoliceComputerOperatorBadge,
  "rajasthan-high-court-ldc": RajasthanHighCourtLdcBadge,
  "delhi-police-hcm": DelhiPoliceHcmBadge,
  "csir-jsa": CsirJsaBadge,
  "ssb-hcm": SsbHcmBadge,
  "aiims-cre-ldc": AiimsBadge,
  "ncert-ldc": NcertLdcBadge,
  "bsf-hcm": BsfHcmBadge,
  "delhi-hc-jja": DelhiHcJjaBadge,
  "bombay-hc-clerk": BombayHcClerkBadge,
  "mp-cpct": MpCpctBadge,
  "kvs-jsa": KvsJsaBadge,
  "patna-hc-computer-operator": PatnaHcComputerOperatorBadge,
  "supreme-court-jca": SupremeCourtJcaBadge,
  "allahabad-hc-ro-aro": AllahabadHcRoAroBadge,
  "allahabad-hc-ps": AllahabadHcPsBadge,
  "bihar-civil-court-clerk": BiharCivilCourtClerkBadge,
  "upsssc-assistants": UpssscAssistantsBadge,
  "rajasthan-ldc": RajasthanLdcBadge,
  "jharkhand-hc-assistant": JharkhandHcAssistantBadge,
  "emrs-jsa": EmrsJsaBadge,
};

// Shared bottom section (the "EXAM PREPARATION" pill + "UNOFFICIAL
// EDUCATIONAL CONTENT" subtitle) every one of these reference logos
// carries. Geometry proven safe against the circle's r=49 boundary (see
// SSC CHSL's own badge, which caught and fixed a real clipping bug at
// exactly this spot) -- reused as-is rather than re-derived per badge.
function ExamPrepFooter({ pillFill, pillText, subColor }: { pillFill: string; pillText: string; subColor: string }) {
  return (
    <>
      <path d="M22 74 L78 74 L78 80.5 Q50 84.5 22 80.5 Z" fill={pillFill} />
      <text x="50" y="79" fontSize="4.6" fontWeight="800" letterSpacing="0.1" fill={pillText} textAnchor="middle">EXAM PREPARATION</text>
      <text x="50" y="89.5" fontSize="2.7" fontWeight="700" letterSpacing="0.2" fill={subColor} textAnchor="middle">UNOFFICIAL EDUCATIONAL CONTENT</text>
    </>
  );
}

// A second footer variant for the reference logos that show "EXAM
// PREPARATION" as plain colored text with no pill/banner shape behind it
// (KVS JSA, Supreme Court JCA, both Allahabad High Court badges). Same
// proven-safe y-coordinates as ExamPrepFooter, just without the path.
function ExamPrepFooterText({ examColor, subColor }: { examColor: string; subColor: string }) {
  return (
    <>
      <text x="50" y="80" fontSize="4.8" fontWeight="800" letterSpacing="0.3" fill={examColor} textAnchor="middle">EXAM PREPARATION</text>
      <text x="50" y="89.5" fontSize="2.7" fontWeight="700" letterSpacing="0.2" fill={subColor} textAnchor="middle">UNOFFICIAL EDUCATIONAL CONTENT</text>
    </>
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
      <ExamPrepFooter pillFill="#f59e0b" pillText="#16305c" subColor="#cbd5e1" />
    </svg>
  );
}

function SscCglBadge() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%">
      <circle cx="50" cy="50" r="49" fill="white" stroke="#6d28d9" strokeWidth="1.4" />
      <path d="M50 3 A47 47 0 0 1 92 30" fill="none" stroke="#6d28d9" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M92 30 A47 47 0 0 1 78 84" fill="none" stroke="#f87171" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M78 84 A47 47 0 0 1 22 92" fill="none" stroke="#9ca3af" strokeWidth="2.4" strokeLinecap="round" />
      {/* bar chart + magnifying glass + pencil */}
      <g>
        <rect x="34" y="46" width="4.5" height="12" fill="#9ca3af" />
        <rect x="40.5" y="40" width="4.5" height="18" fill="#f87171" />
        <rect x="47" y="34" width="4.5" height="24" fill="#6d28d9" />
        <line x1="30" y1="58" x2="58" y2="58" stroke="#374151" strokeWidth="1" />
      </g>
      <circle cx="38" cy="47" r="7.5" fill="none" stroke="#6d28d9" strokeWidth="2" />
      <line x1="43.3" y1="52.3" x2="48" y2="57" stroke="#6d28d9" strokeWidth="2.2" strokeLinecap="round" />
      <g transform="translate(60,34) rotate(45)">
        <rect x="-1.6" y="0" width="3.2" height="16" fill="#f87171" />
        <polygon points="-1.6,16 1.6,16 0,20" fill="#f87171" />
        <rect x="-1.6" y="-3" width="3.2" height="3" fill="#374151" />
      </g>
      <text x="50" y="68" fontSize="8.4" fontWeight="900" fill="#6d28d9" textAnchor="middle">SSC CGL</text>
      <ExamPrepFooter pillFill="none" pillText="#f87171" subColor="#6d28d9" />
    </svg>
  );
}

function RrbNtpcBadge() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%">
      <circle cx="50" cy="50" r="49" fill="#f5efdc" stroke="#16305c" strokeWidth="3" />
      <path d="M4 50 A46 46 0 0 1 50 4 V12 A38 38 0 0 0 12 50 Z" fill="#16305c" opacity="0.9" />
      {/* route + clock + pin, generic */}
      <g fill="none" stroke="#16305c" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M28 44 L38 44 L44 34 L54 34 L60 44 L70 44" />
      </g>
      <circle cx="28" cy="44" r="2" fill="#7dd3c0" /><circle cx="70" cy="44" r="2" fill="#7dd3c0" /><circle cx="49" cy="34" r="2" fill="#e8823c" />
      <circle cx="46" cy="52" r="9" fill="white" stroke="#16305c" strokeWidth="1.6" />
      <line x1="46" y1="52" x2="46" y2="46.5" stroke="#16305c" strokeWidth="1.3" strokeLinecap="round" />
      <line x1="46" y1="52" x2="50" y2="52" stroke="#e8823c" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M64 30 c0-3.3 2.7-6 6-6s6 2.7 6 6c0 4.5-6 10-6 10s-6-5.5-6-10Z" fill="#e8823c" />
      <circle cx="70" cy="30" r="2" fill="white" />
      <path d="M22 68 L78 68 L78 74.5 Q50 78.5 22 74.5 Z" fill="#16305c" />
      <text x="38" y="73.3" fontSize="6.6" fontWeight="900" fill="#7dd3c0" textAnchor="middle">RRB</text>
      <text x="63" y="73.3" fontSize="6.6" fontWeight="900" fill="#e8823c" textAnchor="middle">NTPC</text>
      <text x="50" y="83.5" fontSize="4.4" fontWeight="800" fill="#16305c" textAnchor="middle">EXAM PREPARATION</text>
      <path d="M28 87 L72 87 L72 91 Q50 93.5 28 91 Z" fill="#7dd3c0" />
      <text x="50" y="90.5" fontSize="2.5" fontWeight="700" fill="#16305c" textAnchor="middle">UNOFFICIAL EDUCATIONAL CONTENT</text>
    </svg>
  );
}

function CrpfHcmBadge() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%">
      <circle cx="50" cy="50" r="49" fill="#111827" stroke="white" strokeWidth="0.5" strokeDasharray="1.6 2.2" />
      <circle cx="50" cy="50" r="46" fill="#111827" />
      <path d="M12 30 L26 30 L20 42 Z" fill="#2563eb" opacity="0.5" />
      <path d="M88 30 L74 30 L80 42 Z" fill="#2563eb" opacity="0.5" />
      {/* stacked documents + hourglass */}
      <g>
        <rect x="40" y="26" width="18" height="24" rx="1.4" fill="#e5e7eb" transform="translate(4,-2) rotate(6 49 38)" />
        <rect x="36" y="28" width="18" height="24" rx="1.4" fill="white" stroke="#9ca3af" strokeWidth="0.6" />
        <line x1="39" y1="33" x2="51" y2="33" stroke="#2563eb" strokeWidth="1.2" />
        <line x1="39" y1="37" x2="51" y2="37" stroke="#6b7280" strokeWidth="0.9" />
        <line x1="39" y1="40" x2="51" y2="40" stroke="#6b7280" strokeWidth="0.9" />
        <line x1="39" y1="43" x2="47" y2="43" stroke="#84cc16" strokeWidth="1.4" />
      </g>
      <g stroke="white" strokeWidth="1.2" fill="none">
        <path d="M62 30 h8 M62 46 h8 M62.5 30 L69.5 46 M69.5 30 L62.5 46" />
      </g>
      <text x="50" y="63" fontSize="7.6" fontWeight="900" fill="#4ade80" textAnchor="middle">CRPF</text>
      <text x="50" y="72" fontSize="6.4" fontWeight="900" fill="white" textAnchor="middle">HCM</text>
      <path d="M20 78 L80 78 L80 84.5 Q50 88.5 20 84.5 Z" fill="#2563eb" />
      <text x="50" y="83" fontSize="4.3" fontWeight="800" fill="white" textAnchor="middle">EXAM PREPARATION</text>
      <text x="50" y="93.5" fontSize="2.6" fontWeight="700" fill="#cbd5e1" textAnchor="middle">UNOFFICIAL EDUCATIONAL CONTENT</text>
    </svg>
  );
}

function DsssbLdcBadge() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%">
      <circle cx="50" cy="50" r="49" fill="#fdf3e7" stroke="#0f766e" strokeWidth="2" />
      <g fill="#0f766e"><circle cx="20" cy="42" r="1" /><circle cx="20" cy="47" r="1" /><circle cx="20" cy="52" r="1" /><circle cx="80" cy="42" r="1" /><circle cx="80" cy="47" r="1" /><circle cx="80" cy="52" r="1" /></g>
      {/* file tray with cards */}
      <g>
        <rect x="38" y="26" width="20" height="10" rx="1.5" fill="#e07a5f" />
        <rect x="36" y="32" width="24" height="10" rx="1.5" fill="#f2c8a4" />
        <rect x="34" y="38" width="28" height="12" rx="1.5" fill="white" stroke="#0f766e" strokeWidth="0.8" />
        <line x1="42" y1="42" x2="42" y2="47" stroke="#e07a5f" strokeWidth="1.4" />
        <line x1="46" y1="43" x2="56" y2="43" stroke="#6b7280" strokeWidth="0.8" />
        <line x1="46" y1="46" x2="54" y2="46" stroke="#6b7280" strokeWidth="0.8" />
        <path d="M28 50 h44 v9 q-22 4 -44 0 Z" fill="#0f766e" />
      </g>
      <text x="50" y="70" fontSize="7.6" fontWeight="900" fill="#0f766e" textAnchor="middle">DSSSB LDC</text>
      <ExamPrepFooter pillFill="#e07a5f" pillText="white" subColor="#0f766e" />
    </svg>
  );
}

function UpPoliceComputerOperatorBadge() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%">
      <circle cx="50" cy="50" r="49" fill="white" stroke="#1e1b4b" strokeWidth="2.4" />
      <g>
        <rect x="30" y="28" width="24" height="17" rx="1.4" fill="white" stroke="#1e1b4b" strokeWidth="1.4" />
        <g fill="#312e81">
          <rect x="32.5" y="30" width="2.6" height="2.6" /><rect x="35.5" y="30" width="2.6" height="2.6" fill="#db2777" /><rect x="38.5" y="30" width="2.6" height="2.6" />
          <rect x="32.5" y="33" width="2.6" height="2.6" fill="#a78bfa" /><rect x="35.5" y="33" width="2.6" height="2.6" /><rect x="38.5" y="33" width="2.6" height="2.6" fill="#db2777" />
        </g>
        <line x1="42.5" y1="30.5" x2="51" y2="30.5" stroke="#1e1b4b" strokeWidth="0.8" />
        <line x1="42.5" y1="33.5" x2="49" y2="33.5" stroke="#1e1b4b" strokeWidth="0.8" />
        <circle cx="58" cy="41" r="4.4" fill="none" stroke="#a78bfa" strokeWidth="2" />
        <circle cx="58" cy="41" r="1.4" fill="#db2777" />
      </g>
      <text x="50" y="60.5" fontSize="6.2" fontWeight="900" fill="#1e1b4b" textAnchor="middle">POLICE</text>
      <path d="M28 62.5 L72 62.5 L72 69 L28 69 Z" fill="#db2777" />
      <text x="50" y="67.7" fontSize="5.6" fontWeight="900" fill="white" textAnchor="middle">COMPUTER</text>
      <text x="50" y="72.5" fontSize="6.2" fontWeight="900" fill="#1e1b4b" textAnchor="middle">OPERATOR</text>
      <ExamPrepFooter pillFill="#a78bfa" pillText="#1e1b4b" subColor="#1e1b4b" />
    </svg>
  );
}

function RajasthanHighCourtLdcBadge() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%">
      <circle cx="50" cy="50" r="49" fill="#4c1d95" stroke="#1e293b" strokeWidth="2" />
      <path d="M50 1 A49 49 0 0 1 84.7 84.7 L15.3 84.7 Z" fill="#d4a72c" />
      <g stroke="#eab308" strokeWidth="1.2" strokeLinecap="round">
        {Array.from({ length: 24 }, (_, i) => {
          const a = (i / 24) * 2 * Math.PI;
          return <line key={i} x1={50 + 44 * Math.cos(a)} y1={50 + 44 * Math.sin(a)} x2={50 + 47.5 * Math.cos(a)} y2={50 + 47.5 * Math.sin(a)} />;
        })}
      </g>
      <g fill="white">
        <path d="M39 38 a11 11 0 0 1 22 0 v3 h-22 Z" />
        <rect x="37" y="41" width="4" height="16" /><rect x="59" y="41" width="4" height="16" />
        <rect x="47" y="41" width="6" height="26" fill="#e5e7eb" stroke="#4c1d95" strokeWidth="0.6" />
        <circle cx="50" cy="45" r="1.4" fill="#4c1d95" />
      </g>
      <rect x="35" y="61" width="30" height="2.6" fill="white" /><rect x="35" y="65" width="30" height="2.6" fill="white" />
      <text x="50" y="72" fontSize="7.4" fontWeight="900" fill="white" textAnchor="middle">RHC LDC</text>
      <ExamPrepFooter pillFill="#1e293b" pillText="white" subColor="white" />
    </svg>
  );
}

function DelhiPoliceHcmBadge() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%">
      <circle cx="50" cy="50" r="49" fill="#fdf6e3" stroke="#166534" strokeWidth="2.4" />
      <circle cx="50" cy="50" r="44.5" fill="none" stroke="#e8823c" strokeWidth="1" strokeDasharray="2.4 2" />
      <g>
        <path d="M38 26 h20 a2 2 0 0 1 2 2 v18 l-4 4 h-16 l-4 -4 v-18 a2 2 0 0 1 2 -2 Z" fill="white" stroke="#166534" strokeWidth="1.2" />
        <line x1="38" y1="32" x2="58" y2="32" stroke="#166534" strokeWidth="1" />
        <circle cx="42" cy="24" r="1.6" fill="none" stroke="#166534" strokeWidth="1" /><circle cx="48" cy="24" r="1.6" fill="none" stroke="#166534" strokeWidth="1" /><circle cx="54" cy="24" r="1.6" fill="none" stroke="#166534" strokeWidth="1" />
      </g>
      <path d="M30 46 a5 5 0 0 1 5 -5 h6 a5 5 0 0 1 0 10 h-8 l-3 3 v-3 a5 5 0 0 1 0 -5Z" fill="#e8823c" />
      <path d="M70 46 a5 5 0 0 0 -5 -5 h-6 a5 5 0 0 0 0 10 h8 l3 3 v-3 a5 5 0 0 0 0 -5Z" fill="#7fb8d8" />
      <g fill="none" stroke="#166534" strokeWidth="1.4" strokeLinecap="round"><circle cx="38" cy="59" r="2.6" /><path d="M36.5 59 l1 1 2 -2.2" /></g>
      <g fill="none" stroke="#166534" strokeWidth="1.4" strokeLinecap="round"><circle cx="50" cy="59" r="2.6" /><path d="M48.5 59 l1 1 2 -2.2" /></g>
      <g fill="none" stroke="#166534" strokeWidth="1.4" strokeLinecap="round"><circle cx="62" cy="59" r="2.6" /><path d="M60.5 59 l1 1 2 -2.2" /></g>
      <text x="50" y="70" fontSize="6.4" fontWeight="900" fill="#166534" textAnchor="middle">DELHI POLICE HCM</text>
      <ExamPrepFooter pillFill="#78350f" pillText="white" subColor="#166534" />
    </svg>
  );
}

function CsirJsaBadge() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%">
      <circle cx="50" cy="50" r="49" fill="white" stroke="#4c1d95" strokeWidth="2" />
      <circle cx="50" cy="50" r="45" fill="none" stroke="#a3a3a3" strokeWidth="0.7" strokeDasharray="3 2.4" />
      <polygon points="34,48 44,28 44,48" fill="#4c1d95" />
      <polygon points="44,28 44,48 50,44" fill="#e5e7eb" />
      <g stroke="#bef264" strokeWidth="1"><line x1="44" y1="34" x2="60" y2="26" /></g>
      <g stroke="#93c5fd" strokeWidth="1"><line x1="44" y1="38" x2="60" y2="38" /></g>
      <g stroke="#a78bfa" strokeWidth="1"><line x1="44" y1="42" x2="60" y2="48" /></g>
      <rect x="60" y="22" width="8" height="8" rx="1.2" fill="#bef264" /><rect x="70" y="22" width="8" height="8" rx="1.2" fill="#93c5fd" />
      <rect x="60" y="32" width="8" height="8" rx="1.2" fill="#a78bfa" /><rect x="70" y="32" width="8" height="8" rx="1.2" fill="#bef264" />
      <rect x="60" y="42" width="8" height="8" rx="1.2" fill="#93c5fd" /><rect x="70" y="42" width="8" height="8" rx="1.2" fill="#a78bfa" />
      <text x="50" y="66" fontSize="7.6" fontWeight="900" fill="#4c1d95" textAnchor="middle">CSIR JSA</text>
      <ExamPrepFooter pillFill="#4c1d95" pillText="white" subColor="#4c1d95" />
    </svg>
  );
}

function SsbHcmBadge() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%">
      <circle cx="50" cy="50" r="49" fill="#f2e8d5" stroke="#1c1917" strokeWidth="2.2" />
      <circle cx="50" cy="33" r="8" fill="#ea580c" />
      <polygon points="50,26 62,50 38,50" fill="#4d7c0f" />
      <polygon points="35,50 47,32 59,50" fill="#3f6212" opacity="0.85" />
      <polygon points="41,50 50,36 66,50" fill="#65a30d" opacity="0.8" />
      <rect x="46" y="52" width="4" height="8" fill="#f2e8d5" /><rect x="51" y="46" width="4" height="14" fill="#a3a3a3" /><rect x="56" y="41" width="4" height="19" fill="#ea580c" />
      <polygon points="40,60 44,50 48,60" fill="white" opacity="0.9" />
      <text x="30" y="72" fontSize="7.6" fontWeight="900" fill="#1c1917" textAnchor="middle">SSB</text>
      <text x="66" y="72" fontSize="7.6" fontWeight="900" fill="#ea580c" textAnchor="middle">HCM</text>
      <ExamPrepFooter pillFill="#3f6212" pillText="white" subColor="#1c1917" />
    </svg>
  );
}

function AiimsBadge() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%">
      <circle cx="50" cy="50" r="49" fill="#fdf3e7" stroke="#7f1d3a" strokeWidth="2" />
      <g stroke="#7f1d3a" strokeWidth="1" strokeLinecap="round">
        <line x1="50" y1="20" x2="50" y2="26" /><line x1="44" y1="22" x2="47" y2="27" /><line x1="56" y1="22" x2="53" y2="27" />
      </g>
      <path d="M46 30 h8 v9 l7 12 a4 4 0 0 1 -3.4 6 h-15.2 a4 4 0 0 1 -3.4 -6 l7 -12 Z" fill="none" stroke="#7f1d3a" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M39 48 h22 l3.5 6 a2.2 2.2 0 0 1 -1.9 3.4 h-24.2 a2.2 2.2 0 0 1 -1.9 -3.4 Z" fill="#b91c3c" />
      <circle cx="30" cy="38" r="3.4" fill="#f9a8c4" /><circle cx="70" cy="38" r="3.4" fill="#7fd8c8" />
      <line x1="33" y1="39" x2="43" y2="43" stroke="#7f1d3a" strokeWidth="0.9" />
      <line x1="67" y1="39" x2="57" y2="43" stroke="#7f1d3a" strokeWidth="0.9" />
      <text x="50" y="70" fontSize="8.4" fontWeight="900" fill="#7f1d3a" textAnchor="middle">AIIMS</text>
      <ExamPrepFooter pillFill="#7f1d3a" pillText="white" subColor="#7f1d3a" />
    </svg>
  );
}

function NcertLdcBadge() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%">
      <circle cx="50" cy="50" r="49" fill="white" stroke="#d63456" strokeWidth="2.4" />
      <path d="M18 15 A38 38 0 0 1 45 8" fill="none" stroke="#3fae9d" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M55 8 A38 38 0 0 1 84 22" fill="none" stroke="#eeaa1f" strokeWidth="1.6" strokeLinecap="round" />
      <g>
        <rect x="31" y="18" width="17" height="17" rx="3" fill="#d63456" />
        <text x="39.5" y="30.5" fontSize="10" fontWeight="900" fill="white" textAnchor="middle">A</text>
        <rect x="50" y="18" width="17" height="17" rx="3" fill="#eeaa1f" />
        <text x="58.5" y="30.5" fontSize="10" fontWeight="900" fill="white" textAnchor="middle">2</text>
        <rect x="31" y="37" width="17" height="17" rx="3" fill="#3fae9d" />
        <circle cx="39.5" cy="42.5" r="1.6" fill="white" /><circle cx="35" cy="49.5" r="1.6" fill="white" /><circle cx="44" cy="49.5" r="1.6" fill="white" />
        <path d="M39.5 42.5 L35 49.5 M39.5 42.5 L44 49.5 M35 49.5 L44 49.5" stroke="white" strokeWidth="1" />
        <rect x="50" y="37" width="17" height="17" rx="3" fill="#3a2a1e" />
        <g stroke="white" strokeWidth="1" strokeLinecap="round"><line x1="58.5" y1="40" x2="58.5" y2="43.5" /><line x1="58.5" y1="49" x2="58.5" y2="52.5" /><line x1="53.5" y1="45.5" x2="55" y2="45.5" /><line x1="62" y1="45.5" x2="63.5" y2="45.5" /></g>
        <circle cx="58.5" cy="45.5" r="1.6" fill="white" />
      </g>
      <text x="50" y="66" fontSize="8.4" fontWeight="900" fill="#3a2a1e" textAnchor="middle">NCERT</text>
      <path d="M25 71 L75 71 L75 76.5 Q50 79 25 76.5 Z" fill="#d63456" />
      <text x="50" y="75.3" fontSize="4.6" fontWeight="800" fill="white" textAnchor="middle">LEARNING RESOURCES</text>
      <text x="50" y="89.5" fontSize="2.7" fontWeight="700" letterSpacing="0.2" fill="#3a2a1e" textAnchor="middle">UNOFFICIAL EDUCATIONAL CONTENT</text>
    </svg>
  );
}

function BsfHcmBadge() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%">
      <circle cx="50" cy="50" r="49" fill="white" stroke="#0d5c63" strokeWidth="2.2" />
      <g stroke="#0d5c63" strokeWidth="1.6" strokeLinecap="round" fill="none">
        <path d="M42 22 L50 16 L58 22" /><path d="M42 28 L50 22 L58 28" /><path d="M42 34 L50 28 L58 34" />
      </g>
      <path d="M39 38 h22 a2 2 0 0 1 2 2 v16 l-13 5 -13 -5 v-16 a2 2 0 0 1 2 -2 Z" fill="#1c1917" />
      <path d="M42 41 h16 v14 l-8 3 -8 -3 Z" fill="white" />
      <path d="M45 44 h10 M45 47 h10 M45 50 h6" stroke="#0d5c63" strokeWidth="1" />
      <text x="50" y="72" fontSize="8.2" fontWeight="900" fill="#0d5c63" textAnchor="middle">BSF HCM</text>
      <path d="M22 76 L78 76 L78 82.5 Q50 86.5 22 82.5 Z" fill="#b91c1c" />
      <text x="50" y="81" fontSize="4.5" fontWeight="800" letterSpacing="0.1" fill="white" textAnchor="middle">EXAM PREPARATION</text>
      <text x="50" y="91.5" fontSize="2.6" fontWeight="700" fill="#0d5c63" textAnchor="middle">UNOFFICIAL EDUCATIONAL CONTENT</text>
    </svg>
  );
}

function DelhiHcJjaBadge() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%">
      <defs>
        <path id="dhc-jja-top" d="M 12 50 A 38 38 0 0 1 88 50" fill="none" />
        <path id="dhc-jja-bottom" d="M 12 50 A 38 38 0 0 0 88 50" fill="none" />
        <clipPath id="dhc-jja-inner"><circle cx="50" cy="50" r="37.5" /></clipPath>
      </defs>
      <circle cx="50" cy="50" r="49" fill="#3730a3" stroke="#eab308" strokeWidth="2.4" />
      <g clipPath="url(#dhc-jja-inner)">
        <rect x="12.5" y="12.5" width="37.5" height="75" fill="#fde68a" />
        <rect x="50" y="12.5" width="37.5" height="75" fill="#86c9a8" />
      </g>
      <g fill="#3730a3">
        <path d="M32 33 c-6 0 -9 5 -9 10 c0 6 4 12 9 15 v-6 c-3 -2 -5 -5 -5 -9 c0 -3 2 -5 5 -5 Z" />
      </g>
      <g fill="white">
        <path d="M68 33 c6 0 9 5 9 10 c0 6 -4 12 -9 15 v-6 c3 -2 5 -5 5 -9 c0 -3 -2 -5 -5 -5 Z" />
      </g>
      <line x1="43" y1="55" x2="57" y2="55" stroke="#3730a3" strokeWidth="1" /><line x1="43" y1="59" x2="53" y2="59" stroke="#86c9a8" strokeWidth="1" />
      <circle cx="50" cy="50" r="7.5" fill="white" stroke="#3730a3" strokeWidth="1.3" />
      <text x="50" y="52.6" fontSize="6" fontWeight="900" fill="#3730a3" textAnchor="middle">12</text>
      <text fontSize="6.4" fontWeight="900" letterSpacing="0.2" fill="white">
        <textPath href="#dhc-jja-top" startOffset="50%" textAnchor="middle">DELHI HIGH COURT JJA</textPath>
      </text>
      <text fontSize="5.4" fontWeight="800" letterSpacing="0.2" fill="#3730a3" stroke="white" strokeWidth="0.3">
        <textPath href="#dhc-jja-bottom" startOffset="50%" textAnchor="middle">EXAM PREPARATION</textPath>
      </text>
      <text x="50" y="92.5" fontSize="2.4" fontWeight="700" fill="white" textAnchor="middle">UNOFFICIAL EDUCATIONAL CONTENT</text>
    </svg>
  );
}

function BombayHcClerkBadge() {
  const rIn = 44.5, rOut = 49;
  const scallops = Array.from({ length: 28 }, (_, i) => {
    const a = (i / 28) * 2 * Math.PI;
    return `${50 + rOut * Math.cos(a)},${50 + rOut * Math.sin(a)}`;
  }).join(" ");
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%">
      <polygon points={scallops} fill="#0d3b4f" />
      <circle cx="50" cy="50" r={rIn} fill="#fdf6ec" stroke="#f0857a" strokeWidth="1.4" />
      <text x="50" y="32" fontSize="6.4" fontWeight="900" fill="#0d3b4f" textAnchor="middle">BOMBAY</text>
      <text x="50" y="40.5" fontSize="6.4" fontWeight="900" fill="#0d3b4f" textAnchor="middle">HIGH COURT</text>
      <text x="50" y="49" fontSize="6.4" fontWeight="900" fill="#0d3b4f" textAnchor="middle">CLERK</text>
      <line x1="30" y1="55" x2="70" y2="55" stroke="#0d3b4f" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="30" y1="65" x2="70" y2="65" stroke="#0d3b4f" strokeWidth="1.4" strokeLinecap="round" />
      <g stroke="#0d3b4f" strokeWidth="1" fill="none">
        <line x1="32" y1="55" x2="32" y2="65" /><line x1="44" y1="55" x2="44" y2="65" /><line x1="56" y1="55" x2="56" y2="65" /><line x1="68" y1="55" x2="68" y2="65" />
      </g>
      <g>
        <circle cx="34" cy="60" r="2.4" fill="#0d3b4f" /><circle cx="41" cy="60" r="2.4" fill="#f0857a" /><circle cx="50" cy="60" r="2.4" fill="#eeaa1f" /><circle cx="59" cy="60" r="2.4" fill="#f0857a" /><circle cx="66" cy="60" r="2.4" fill="#0d3b4f" />
      </g>
      <path d="M22 73 L78 73 L78 79.5 Q50 83.5 22 79.5 Z" fill="#f0857a" />
      <text x="50" y="78" fontSize="4.6" fontWeight="800" fill="white" textAnchor="middle">EXAM PREPARATION</text>
      <text x="50" y="88.5" fontSize="2.7" fontWeight="700" fill="#0d3b4f" textAnchor="middle">UNOFFICIAL EDUCATIONAL CONTENT</text>
    </svg>
  );
}

function MpCpctBadge() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%">
      <defs>
        <path id="mp-cpct-top" d="M 14 42 A 38 38 0 0 1 86 42" fill="none" />
        <path id="mp-cpct-bottom" d="M 14 58 A 38 38 0 0 0 86 58" fill="none" />
      </defs>
      <circle cx="50" cy="50" r="49" fill="#7f1d3a" stroke="#3fae9d" strokeWidth="2.2" />
      <rect x="30" y="28" width="40" height="40" rx="6" fill="#1c1917" stroke="#3fae9d" strokeWidth="1.6" transform="rotate(45 50 48)" />
      <path d="M38 48 A12 12 0 0 1 62 48" fill="none" stroke="#eeaa1f" strokeWidth="2.4" strokeLinecap="round" />
      <g stroke="white" strokeWidth="1" strokeLinecap="round">
        <line x1="38" y1="48" x2="36.5" y2="45.5" /><line x1="50" y1="36" x2="50" y2="38.5" /><line x1="62" y1="48" x2="63.5" y2="45.5" />
      </g>
      <line x1="50" y1="48" x2="58" y2="41" stroke="white" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="50" cy="48" r="2" fill="white" />
      <text fontSize="7.2" fontWeight="900" letterSpacing="0.3" fill="#3fae9d">
        <textPath href="#mp-cpct-top" startOffset="50%" textAnchor="middle">MP CPCT</textPath>
      </text>
      <text fontSize="4" fontWeight="800" fill="white">
        <textPath href="#mp-cpct-bottom" startOffset="50%" textAnchor="middle">COMPUTER PROFICIENCY PREPARATION</textPath>
      </text>
      <text x="50" y="92" fontSize="2.4" fontWeight="700" fill="#eeaa1f" textAnchor="middle">UNOFFICIAL EDUCATIONAL CONTENT</text>
    </svg>
  );
}

function KvsJsaBadge() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%">
      <circle cx="50" cy="50" r="49" fill="#fdf6e7" />
      <path d="M50 1 A49 49 0 0 1 97.5 42" fill="none" stroke="#3730a3" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M97.5 58 A49 49 0 0 1 50 99" fill="none" stroke="#e8823c" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M50 99 A49 49 0 0 1 2.5 58" fill="none" stroke="#e8823c" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M2.5 42 A49 49 0 0 1 50 1" fill="none" stroke="#3730a3" strokeWidth="2.4" strokeLinecap="round" />
      <text x="50" y="45" fontSize="12" fontWeight="900" fill="#3730a3" textAnchor="middle">KVS</text>
      <g transform="translate(24,55) rotate(20)">
        <polygon points="0,6 20,0 0,-6 4,0" fill="#3fae9d" />
      </g>
      <path d="M28 58 Q42 66 50 58" fill="none" stroke="#1c1917" strokeWidth="1" strokeDasharray="1.5 1.5" />
      <g>
        <rect x="52" y="55" width="4.5" height="8" fill="#3fae9d" /><rect x="58" y="50" width="4.5" height="13" fill="#e8823c" /><rect x="64" y="44" width="4.5" height="19" fill="#3730a3" />
        <path d="M52 55 L58 50 L64 44 L70 40" fill="none" stroke="#1c1917" strokeWidth="1" strokeDasharray="1.5 1.5" />
        <polygon points="70,40 66,41 69,44" fill="#1c1917" />
      </g>
      <text x="50" y="76" fontSize="5.2" fontWeight="800" letterSpacing="0.2" fill="#e8823c" textAnchor="middle">EXAM PREPARATION</text>
      <text x="50" y="87" fontSize="2.7" fontWeight="700" fill="#3730a3" textAnchor="middle">UNOFFICIAL EDUCATIONAL CONTENT</text>
    </svg>
  );
}

function PatnaHcComputerOperatorBadge() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%">
      <defs>
        <path id="patna-hc-top" d="M 8 44 A 43 43 0 0 1 92 44" fill="none" />
        <pattern id="patna-hc-diamond" width="8" height="8" patternUnits="userSpaceOnUse">
          <rect width="8" height="8" fill="white" /><polygon points="4,1 7,4 4,7 1,4" fill="#e5e7eb" />
        </pattern>
      </defs>
      <circle cx="50" cy="50" r="49" fill="url(#patna-hc-diamond)" stroke="#1e293b" strokeWidth="2.4" />
      <circle cx="50" cy="50" r="44.5" fill="none" stroke="#65a30d" strokeWidth="0.8" />
      <line x1="12" y1="50" x2="88" y2="50" stroke="#1e293b" strokeWidth="1" />
      <text fontSize="3.8" fontWeight="900" letterSpacing="0" fill="#1e293b">
        <textPath href="#patna-hc-top" startOffset="50%" textAnchor="middle">PATNA HIGH COURT COMPUTER OPERATOR</textPath>
      </text>
      <g>
        <ellipse cx="34" cy="33" rx="7" ry="2.4" fill="#1e293b" /><rect x="27" y="33" width="14" height="7" fill="#1e293b" /><ellipse cx="34" cy="40" rx="7" ry="2.4" fill="#0f2338" />
        <ellipse cx="34" cy="45" rx="7" ry="2.4" fill="#65a30d" /><rect x="27" y="45" width="14" height="7" fill="#65a30d" /><ellipse cx="34" cy="52" rx="7" ry="2.4" fill="#4d7c0f" />
        <ellipse cx="34" cy="57" rx="7" ry="2.4" fill="#e8746a" /><rect x="27" y="57" width="14" height="7" fill="#e8746a" /><ellipse cx="34" cy="64" rx="7" ry="2.4" fill="#c05f56" />
      </g>
      <circle cx="63" cy="49" r="4" fill="none" stroke="#1e293b" strokeWidth="1.6" />
      <g stroke="#1e293b" strokeWidth="1" strokeDasharray="1.6 1.2">
        <path d="M41 36.5 L57 44" /><path d="M41 48.5 L59 49" /><path d="M41 60.5 L57 54" />
      </g>
      <circle cx="70" cy="41" r="2" fill="none" stroke="#65a30d" strokeWidth="1.2" /><circle cx="72" cy="49" r="2" fill="none" stroke="#9ca3af" strokeWidth="1.2" /><circle cx="70" cy="57" r="2" fill="none" stroke="#e8746a" strokeWidth="1.2" />
      <path d="M22 74 L78 74 L78 80.5 Q50 84.5 22 80.5 Z" fill="#1e293b" />
      <text x="50" y="79" fontSize="4.6" fontWeight="800" letterSpacing="0.1" fill="#bef264" textAnchor="middle">EXAM PREPARATION</text>
      <text x="50" y="89.5" fontSize="2.6" fontWeight="700" fill="#1e293b" textAnchor="middle">UNOFFICIAL EDUCATIONAL CONTENT</text>
    </svg>
  );
}

function SupremeCourtJcaBadge() {
  const rings = ["#4d5a1a", "#4d5a1a", "#6d3fa0", "#6d3fa0", "#c2691d", "#c2691d"];
  const dashes = Array.from({ length: 48 }, (_, i) => {
    const a = (i / 48) * 2 * Math.PI;
    const color = rings[Math.floor(i / 8) % rings.length];
    return <line key={i} x1={50 + 45 * Math.cos(a)} y1={50 + 45 * Math.sin(a)} x2={50 + 48.5 * Math.cos(a)} y2={50 + 48.5 * Math.sin(a)} stroke={color} strokeWidth="1.6" strokeLinecap="round" />;
  });
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%">
      <circle cx="50" cy="50" r="49" fill="#fdf6e7" />
      <g>{dashes}</g>
      <text x="50" y="32" fontSize="6.6" fontWeight="900" fill="#4d5a1a" textAnchor="middle">SUPREME</text>
      <text x="50" y="40" fontSize="6.6" fontWeight="900" fill="#4d5a1a" textAnchor="middle">COURT JCA</text>
      <line x1="34" y1="44" x2="66" y2="44" stroke="#1c1917" strokeWidth="0.7" />
      <circle cx="50" cy="44" r="1.2" fill="#c2691d" />
      <g transform="translate(28,52) rotate(-20)">
        <rect x="-2" y="0" width="10" height="4" rx="1" fill="#4d5a1a" />
        <rect x="1" y="-4" width="4" height="12" rx="1" fill="#8a6a3a" />
        <rect x="-3" y="9" width="12" height="3" rx="1" fill="#4d5a1a" />
      </g>
      <g>
        <rect x="46" y="52" width="6" height="16" fill="#4d5a1a" /><rect x="53" y="52" width="6" height="16" fill="#6d3fa0" /><rect x="60" y="52" width="6" height="16" fill="#c2691d" />
        <line x1="48" y1="55" x2="50" y2="55" stroke="white" strokeWidth="0.6" /><line x1="55" y1="55" x2="57" y2="55" stroke="white" strokeWidth="0.6" /><line x1="62" y1="55" x2="64" y2="55" stroke="white" strokeWidth="0.6" />
      </g>
      <ExamPrepFooterText examColor="#6d3fa0" subColor="#1c1917" />
    </svg>
  );
}

function AllahabadHcRoAroBadge() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%">
      <circle cx="50" cy="50" r="49" fill="white" stroke="#1e293b" strokeWidth="2" />
      <path d="M50 1 A49 49 0 0 1 92 24" fill="none" stroke="#b91c3c" strokeWidth="2.2" strokeLinecap="round" />
      <rect x="14" y="32" width="7" height="48" fill="#4ba3c3" opacity="0.5" /><rect x="79" y="32" width="7" height="48" fill="#c9b896" opacity="0.6" />
      <text x="50" y="30" fontSize="6.2" fontWeight="900" fill="#1e293b" textAnchor="middle">ALLAHABAD</text>
      <text x="50" y="38" fontSize="6.2" fontWeight="900" fill="#1e293b" textAnchor="middle">HIGH COURT</text>
      <text x="50" y="49" fontSize="7.2" fontWeight="900" fill="#b91c3c" textAnchor="middle">RO/ARO</text>
      <g stroke="#1e293b" strokeWidth="1" strokeLinecap="round">
        <line x1="30" y1="55" x2="70" y2="55" /><line x1="30" y1="59" x2="44" y2="59" /><line x1="56" y1="59" x2="70" y2="59" />
        <line x1="30" y1="63" x2="70" y2="63" /><line x1="30" y1="67" x2="60" y2="67" /><line x1="63" y1="67" x2="66" y2="67" />
      </g>
      <path d="M47 57.5 l2 -2.5 l2 2.5" fill="none" stroke="#4ba3c3" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="50" cy="61" r="1.4" fill="none" stroke="#4ba3c3" strokeWidth="1" />
      <ExamPrepFooterText examColor="#0d7d8f" subColor="#1e293b" />
    </svg>
  );
}

function AllahabadHcPsBadge() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%">
      <circle cx="50" cy="50" r="49" fill="#fdf6ec" stroke="#1e293b" strokeWidth="2" />
      <rect x="14" y="20" width="6" height="60" fill="#e07a9c" opacity="0.55" /><rect x="80" y="20" width="6" height="60" fill="#c9b896" opacity="0.6" />
      <text x="50" y="26" fontSize="5.6" fontWeight="900" fill="#1e293b" textAnchor="middle">ALLAHABAD</text>
      <text x="50" y="34" fontSize="5.6" fontWeight="900" fill="#1e293b" textAnchor="middle">HIGH COURT</text>
      <text x="50" y="42.5" fontSize="6.6" fontWeight="900" fill="#1e293b" textAnchor="middle">P.S.</text>
      <g fill="none" stroke="#1e293b" strokeWidth="1.4" strokeLinecap="round">
        <path d="M30 54 c3 -3 3 -6 0 -6 c-3 0 -1 5 2 5" /><circle cx="30" cy="58" r="1.2" fill="#1e293b" />
        <path d="M46 54 c1 3 5 4 5 0 c0 -3 -4 -2 -3 2 c1 3 4 3 4 -1" /><circle cx="53" cy="58" r="1.2" fill="#e07a9c" />
        <path d="M65 54 l3 -3 M65 51 l3 3" /><circle cx="70" cy="58" r="1.2" fill="#1e293b" />
      </g>
      <g stroke="#e07a9c" strokeWidth="1" strokeLinecap="round">
        <line x1="30" y1="65" x2="30" y2="70" /><line x1="34" y1="63" x2="34" y2="72" /><line x1="38" y1="66" x2="38" y2="69" /><line x1="42" y1="62" x2="42" y2="73" />
        <line x1="46" y1="65" x2="46" y2="70" /><line x1="50" y1="64" x2="50" y2="71" /><line x1="54" y1="66" x2="54" y2="69" /><line x1="58" y1="62" x2="58" y2="73" />
        <line x1="62" y1="65" x2="62" y2="70" /><line x1="66" y1="64" x2="66" y2="71" /><line x1="70" y1="66" x2="70" y2="69" />
      </g>
      <ExamPrepFooterText examColor="#c2477a" subColor="#1e293b" />
    </svg>
  );
}

function BiharCivilCourtClerkBadge() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%">
      <defs><clipPath id="bihar-clip"><circle cx="50" cy="50" r="49" /></clipPath></defs>
      <circle cx="50" cy="50" r="49" fill="#fdf6ec" />
      <g clipPath="url(#bihar-clip)">
        <rect x="1" y="63" width="98" height="40" fill="#1e3a6e" />
      </g>
      <path d="M17 21 A47 47 0 0 1 39 4" fill="none" stroke="#1e3a6e" strokeWidth="3" strokeLinecap="round" />
      <path d="M41 4 A47 47 0 0 1 64 5" fill="none" stroke="#7f1d3a" strokeWidth="3" strokeLinecap="round" />
      <path d="M66 5 A47 47 0 0 1 87 22" fill="none" stroke="#e8a33d" strokeWidth="3" strokeLinecap="round" />
      <rect x="27" y="33" width="15" height="26" rx="1.5" fill="#1e3a6e" /><line x1="30" y1="39" x2="39" y2="39" stroke="white" strokeWidth="1" />
      <rect x="42" y="27" width="16" height="32" rx="1.5" fill="#a8c8b8" /><line x1="45" y1="34" x2="55" y2="34" stroke="#1e3a6e" strokeWidth="1" />
      <rect x="58" y="24" width="16" height="35" rx="1.5" fill="#7f1d3a" /><line x1="61" y1="31" x2="71" y2="31" stroke="white" strokeWidth="1" /><line x1="61" y1="36" x2="69" y2="36" stroke="white" strokeWidth="1" />
      <rect x="24" y="58" width="54" height="5" rx="2" fill="#1e3a6e" />
      <circle cx="72" cy="60.5" r="4" fill="white" stroke="#1e3a6e" strokeWidth="1.4" /><circle cx="72" cy="60.5" r="1.6" fill="#a8c8b8" />
      <text x="50" y="76" fontSize="6.6" fontWeight="900" fill="white" textAnchor="middle">BIHAR CIVIL</text>
      <text x="50" y="85" fontSize="6.6" fontWeight="900" fill="white" textAnchor="middle">COURT CLERK</text>
      <line x1="30" y1="89" x2="70" y2="89" stroke="#e8a33d" strokeWidth="0.6" /><circle cx="50" cy="89" r="1" fill="#e8a33d" />
      <text x="50" y="92.5" fontSize="3.6" fontWeight="800" letterSpacing="0.2" fill="#a8c8b8" textAnchor="middle">EXAM PREPARATION</text>
    </svg>
  );
}

function UpssscAssistantsBadge() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%">
      <circle cx="50" cy="50" r="49" fill="#fdf6ec" />
      <path d="M50 2 A48 48 0 0 1 96 47" fill="none" stroke="#e8746a" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M96 53 A48 48 0 0 1 50 98" fill="none" stroke="#8faa5c" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M50 98 A48 48 0 0 1 4 53" fill="none" stroke="#e8a33d" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M4 47 A48 48 0 0 1 50 2" fill="none" stroke="#1e3a6e" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="50" cy="50" r="41" fill="#fbeee0" opacity="0.6" />
      <path d="M38 30 a9 9 0 0 0 0 18 v-6 a3 3 0 0 1 0 -6 Z" fill="#1e3a6e" />
      <path d="M62 30 a9 9 0 0 1 0 18 v-6 a3 3 0 0 0 0 -6 Z" fill="#e8746a" />
      <circle cx="50" cy="34" r="2.2" fill="#e8746a" /><circle cx="50" cy="45" r="3" fill="#8faa5c" /><circle cx="50" cy="56" r="2.2" fill="#1e3a6e" />
      <line x1="44" y1="39" x2="56" y2="39" stroke="#8faa5c" strokeWidth="1.4" />
      <text x="50" y="65" fontSize="8" fontWeight="900" fill="#1e3a6e" textAnchor="middle">UPSSSC</text>
      <text x="50" y="73.5" fontSize="7" fontWeight="900" fill="#e8746a" textAnchor="middle">ASSISTANT</text>
      <ExamPrepFooterText examColor="#1e3a6e" subColor="#1e3a6e" />
    </svg>
  );
}

function RajasthanLdcBadge() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%">
      <defs><clipPath id="rssb-clip"><circle cx="50" cy="50" r="49" /></clipPath></defs>
      <circle cx="50" cy="50" r="49" fill="#3a2a1e" />
      <circle cx="50" cy="50" r="44" fill="#fdf3e2" />
      <g clipPath="url(#rssb-clip)">
        <rect x="1" y="66" width="98" height="34" fill="#3a2a1e" />
      </g>
      <g stroke="#3a2a1e" strokeWidth="2" strokeLinecap="round">
        {Array.from({ length: 32 }, (_, i) => {
          const a = (i / 32) * 2 * Math.PI;
          const colors = ["#b91c3c", "#e8a33d", "#0f766e"];
          return (
            <line key={i} x1={50 + 45.5 * Math.cos(a)} y1={50 + 45.5 * Math.sin(a)} x2={50 + 48.5 * Math.cos(a)} y2={50 + 48.5 * Math.sin(a)} stroke={colors[i % 3]} />
          );
        })}
      </g>
      <path d="M28 33 h20 l8 8 v4 h-28 a2 2 0 0 1 -2 -2 v-8 a2 2 0 0 1 2 -2 Z" fill="#0f766e" />
      <path d="M24 45 h44 v10 a2 2 0 0 1 -2 2 h-40 a2 2 0 0 1 -2 -2 Z" fill="#0f766e" />
      <path d="M56 50 l14 -3 v3.5 l6 -0.5 v6 l-6 -0.5 v3.5 Z" fill="#1c1917" />
      <rect x="68" y="47" width="4" height="4" rx="0.6" fill="#e8a33d" />
      <circle cx="26" cy="59" r="1.6" fill="#0f766e" /><circle cx="32" cy="61" r="1.6" fill="#0f766e" /><circle cx="38" cy="63" r="1.6" fill="#0f766e" />
      <text x="35" y="79" fontSize="8.6" fontWeight="900" fontStyle="italic" fill="white" textAnchor="middle">RSSB</text>
      <text x="66" y="79" fontSize="8.6" fontWeight="900" fontStyle="italic" fill="#0f766e" textAnchor="middle">LDC</text>
      <path d="M22 82 L78 82 L78 88 Q50 91.5 22 88 Z" fill="#3a2a1e" stroke="#e8a33d" strokeWidth="0.5" />
      <text x="50" y="87" fontSize="4.4" fontWeight="800" letterSpacing="0.1" fill="#e8a33d" textAnchor="middle">EXAM PREPARATION</text>
      <text x="50" y="93" fontSize="2.3" fontWeight="700" fill="white" textAnchor="middle">UNOFFICIAL EDUCATIONAL CONTENT</text>
    </svg>
  );
}

function JharkhandHcAssistantBadge() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%">
      <defs><path id="jha-top" d="M 12 50 A 38 38 0 0 1 88 50" fill="none" /></defs>
      <circle cx="50" cy="50" r="49" fill="#fdf6ec" stroke="#241b3a" strokeWidth="2" />
      <circle cx="50" cy="50" r="45" fill="none" stroke="#a78bd6" strokeWidth="0.8" />
      <path d="M6 46 Q28 38 50 46 T94 46 V60 H6 Z" fill="#a78bd6" opacity="0.28" />
      <path d="M6 52 Q28 45 50 52 T94 52 V62 H6 Z" fill="#8faa5c" opacity="0.3" />
      <text fontSize="6.6" fontWeight="900" letterSpacing="0.1" fill="#241b3a">
        <textPath href="#jha-top" startOffset="50%" textAnchor="middle">JHARKHAND HIGH COURT</textPath>
      </text>
      <g stroke="#a78bd6" strokeWidth="2.4" strokeLinecap="round">
        <line x1="50" y1="42" x2="36" y2="60" />
      </g>
      <g stroke="#8faa5c" strokeWidth="2.4" strokeLinecap="round">
        <line x1="50" y1="42" x2="64" y2="60" />
      </g>
      <line x1="36" y1="60" x2="64" y2="60" stroke="#241b3a" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="50" cy="42" r="3.4" fill="#241b3a" stroke="white" strokeWidth="1" />
      <circle cx="36" cy="60" r="3.4" fill="#241b3a" stroke="white" strokeWidth="1" />
      <circle cx="64" cy="60" r="3.4" fill="#241b3a" stroke="white" strokeWidth="1" />
      <rect x="46.5" y="56.5" width="7" height="7" rx="1.4" fill="#8faa5c" stroke="#241b3a" strokeWidth="1" />
      <text x="50" y="73" fontSize="7.2" fontWeight="900" fill="#241b3a" textAnchor="middle">ASSISTANT</text>
      <ExamPrepFooterText examColor="#8a6fc2" subColor="#241b3a" />
    </svg>
  );
}

function EmrsJsaBadge() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%">
      <circle cx="50" cy="50" r="49" fill="#fdf6ec" stroke="#1e3a6e" strokeWidth="2" />
      <g stroke="#1e3a6e" strokeWidth="1.4" strokeLinecap="round">
        {Array.from({ length: 40 }, (_, i) => {
          const a = (i / 40) * 2 * Math.PI;
          const colors = ["#1e3a6e", "#1e3a6e", "#e8746a", "#0f766e"];
          return i % 2 === 0 ? (
            <line key={i} x1={50 + 45 * Math.cos(a)} y1={50 + 45 * Math.sin(a)} x2={50 + 47.5 * Math.cos(a)} y2={50 + 47.5 * Math.sin(a)} stroke={colors[i % 4]} />
          ) : (
            <circle key={i} cx={50 + 46.2 * Math.cos(a)} cy={50 + 46.2 * Math.sin(a)} r="0.6" fill="#1c1917" />
          );
        })}
      </g>
      <path d="M25 32 Q30 22 37 30 Q43 21 50 30 Q57 21 63 30 Q70 22 75 32 Z" fill="#1e3a6e" />
      <rect x="33" y="38" width="8" height="8" rx="1.6" fill="#e8746a" /><path d="M37 32 v6" stroke="#1e3a6e" strokeWidth="1.2" />
      <rect x="46" y="38" width="8" height="8" rx="1.6" fill="#0f766e" /><path d="M50 32 v6" stroke="#1e3a6e" strokeWidth="1.2" />
      <rect x="59" y="38" width="8" height="8" rx="1.6" fill="#1e3a6e" /><path d="M63 32 v6" stroke="#1e3a6e" strokeWidth="1.2" />
      <g stroke="#1c1917" strokeWidth="0.8" strokeDasharray="1.2 1.2">
        <path d="M37 46 L50 55" /><path d="M50 46 L50 55" /><path d="M63 46 L50 55" />
      </g>
      <circle cx="50" cy="55" r="3" fill="none" stroke="#1c1917" strokeWidth="1.2" /><circle cx="50" cy="55" r="1.3" fill="#e8746a" />
      <text x="50" y="70" fontSize="7.4" fontWeight="900" fill="#1e3a6e" textAnchor="middle">EMRS JSA</text>
      <ExamPrepFooterText examColor="#e8746a" subColor="#1c1917" />
    </svg>
  );
}
