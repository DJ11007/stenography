// Word 2013's PAGE LAYOUT data: margin presets, paper sizes, orientation and the
// Page Setup dialog's values, plus the conversions between what the dialog shows
// (centimetres) and what the editor saves.
//
// Saved form (pageLayout in the document snapshot):
//   padding         "T R B L" in mm  -- the MARGINS only (never includes the gutter,
//                   so a margin answer is graded the same with or without a gutter)
//   maxWidth        page width in px (paper size; landscape swaps with height)
//   aspectRatio     "1 / 1.414" portrait, "1.414 / 1" landscape (A4-style ratio kept
//                   for the existing grading), or the exact paper ratio
//   gutter          "12.7mm" (or null)       -- Page Setup > Gutter
//   gutterPosition  "left" | "top" (or null) -- Page Setup > Gutter position

export const CM_PER_INCH = 2.54;
export const PX_PER_CM = 96 / CM_PER_INCH;

export type MarginsCm = { top: number; bottom: number; left: number; right: number };
export type MarginPreset = { id: string; name: string; margins: MarginsCm; mirrored?: boolean };

// Word 2013 (metric) margin gallery.
export const MARGIN_PRESETS: MarginPreset[] = [
  { id: "normal", name: "Normal", margins: { top: 2.54, bottom: 2.54, left: 2.54, right: 2.54 } },
  { id: "narrow", name: "Narrow", margins: { top: 1.27, bottom: 1.27, left: 1.27, right: 1.27 } },
  { id: "moderate", name: "Moderate", margins: { top: 2.54, bottom: 2.54, left: 1.91, right: 1.91 } },
  { id: "wide", name: "Wide", margins: { top: 2.54, bottom: 2.54, left: 5.08, right: 5.08 } },
  { id: "mirrored", name: "Mirrored", margins: { top: 2.54, bottom: 2.54, left: 3.18, right: 2.54 }, mirrored: true },
  { id: "office2003", name: "Office 2003 Default", margins: { top: 2.54, bottom: 2.54, left: 3.18, right: 3.18 } },
];

export type PaperSize = { id: string; name: string; width: number; height: number; icon?: boolean };
// Word 2013's Size gallery, in Word's order (width x height in cm, portrait). `icon`:
// Word draws a page picture beside these entries only.
export const PAPER_SIZES: PaperSize[] = [
  { id: "letter", name: "Letter", width: 21.59, height: 27.94, icon: true },
  { id: "legal", name: "Legal", width: 21.59, height: 35.56, icon: true },
  { id: "statement", name: "Statement", width: 13.97, height: 21.59 },
  { id: "executive", name: "Executive", width: 18.41, height: 26.67, icon: true },
  { id: "a4", name: "A4", width: 21, height: 29.7, icon: true },
  { id: "a5", name: "A5", width: 14.8, height: 21, icon: true },
  { id: "b5", name: "B5 (JIS)", width: 18.2, height: 25.7 },
  { id: "envelope10", name: "Envelope #10", width: 10.48, height: 24.13 },
  { id: "envelopedl", name: "Envelope DL", width: 11, height: 22 },
  { id: "envelopec5", name: "Envelope C5", width: 16.2, height: 22.9 },
  { id: "envelopec6", name: "Envelope C6", width: 11.4, height: 16.2 },
  { id: "envelopemonarch", name: "Envelope Monarch", width: 9.84, height: 19.05 },
  { id: "a3", name: "A3", width: 29.7, height: 42, icon: true },
  { id: "b4", name: "B4 (JIS)", width: 25.7, height: 36.4 },
];
export const PAPER_WIDTH_PX: Record<string, number> = { letter: 816, legal: 816, statement: 528, executive: 696, a3: 1123, a4: 794, a5: 559, b4: 971, b5: 688, envelope10: 396, envelopedl: 416, envelopec5: 612, envelopec6: 431, envelopemonarch: 372 };

const round2 = (value: number) => Math.round(value * 100) / 100;
export const cmText = (value: number) => `${round2(value)} cm`;
/** "20mm" / "20.32mm": the saved margin form (no trailing zeros, max 2 decimals). */
export const mmText = (cm: number) => `${round2(cm * 10)}mm`;

/** Saved padding "T R B L" (mm) -> margins in cm. A single value means all four. */
export function parsePadding(padding: string | null | undefined): MarginsCm | null {
  if (!padding) return null;
  const parts = padding.trim().split(/\s+/).map(part => (part.endsWith("mm") ? Number.parseFloat(part) / 10 : part.endsWith("cm") ? Number.parseFloat(part) : part.endsWith("in") ? Number.parseFloat(part) * CM_PER_INCH : part.endsWith("px") ? Number.parseFloat(part) / PX_PER_CM : Number.NaN));
  if (parts.some(part => !Number.isFinite(part))) return null;
  const [t, r = t, b = t, l = r] = parts;
  // 4 decimals in cm (= 0.001 mm): 2.032 cm must stay 20.32mm, not become 20.3mm.
  const keep = (value: number) => Math.round(value * 10000) / 10000;
  return { top: keep(t), right: keep(r), bottom: keep(b), left: keep(l) };
}
export const paddingText = (margins: MarginsCm) => `${mmText(margins.top)} ${mmText(margins.right)} ${mmText(margins.bottom)} ${mmText(margins.left)}`;
export const sameMargins = (a: MarginsCm | null, b: MarginsCm) => Boolean(a) && (["top", "bottom", "left", "right"] as const).every(key => Math.abs(a![key] - b[key]) < 0.006);

/** The paper size whose saved page width matches (px), or null for a custom width. */
export function paperFromWidth(px: number | null): PaperSize | null {
  if (!px) return null;
  const id = Object.keys(PAPER_WIDTH_PX).find(key => Math.abs(PAPER_WIDTH_PX[key] - px) < 1);
  return PAPER_SIZES.find(size => size.id === id) ?? null;
}

export type PageSetupValues = {
  top: number; bottom: number; left: number; right: number;
  gutter: number; gutterPosition: "left" | "top";
  orientation: "portrait" | "landscape";
  multiplePages: "normal" | "mirror";
  paper: string; width: number; height: number;
  lineNumbers: boolean;
};
export const DEFAULT_PAGE_SETUP: PageSetupValues = { top: 2, bottom: 2, left: 2, right: 2, gutter: 0, gutterPosition: "left", orientation: "portrait", multiplePages: "normal", paper: "a4", width: 21, height: 29.7, lineNumbers: false };

/** The rendered page padding: the margins plus the gutter on its side. */
export function renderedPadding(margins: MarginsCm, gutterCm: number, position: "left" | "top") {
  const g = Math.max(0, gutterCm);
  return paddingText({ ...margins, left: position === "left" ? margins.left + g : margins.left, top: position === "top" ? margins.top + g : margins.top });
}
