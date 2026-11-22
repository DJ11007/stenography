// A Word page border has, besides its line (style, colour, width) and its sides, the choices of Word's
// Borders and Shading > Page Border > Options: Measure from (Edge of page | Text), the distance from each of the
// four sides, and -- when measured from the text -- whether the border surrounds the header and the footer.
//
// Saved text (pageLayout.border, at most 100 characters, checked by the server only for length):
//   "<css>"                                       Edge of page, 24 pt on every side (Word's default, and what a
//                                                 border saved before these options existed meant)
//   "<css> measure:text"                          measured from the text, 4 pt on every side
//   "<css> measure:text gap:6,6,12,6 nohdr noftr" 6 pt top, right and left, 12 pt bottom; the header and the footer
//                                                 are left outside the border
//   "<css> gap:20,20,20,20"                       Edge of page, 20 pt
//   "... apply:s2"                                Apply to: This section (here section 2), all its pages
//   "... apply:s1-first" / "... apply:s1-rest"    Apply to: This section - First page only / - All except first page
//                                                 (no apply part: Whole document, as every border saved before)
//   "... sides:top,bottom"                        only some sides (always last; read by the server's borderSides)
// Distances are whole points, top, right, bottom, left. A part equal to its default is not written.

export type BorderMeasure = "page" | "text";
export type PageBorderOptions = { measure: BorderMeasure; top: number; right: number; bottom: number; left: number; surroundHeader: boolean; surroundFooter: boolean };
/** Word's Page Border "Apply to": the whole document, or one section (1 = the first) -- all of it, only its first
 *  page, or all but its first page. */
export type PageBorderApply = { section: number | null; part: "all" | "first" | "rest" };
export const WHOLE_DOCUMENT: PageBorderApply = { section: null, part: "all" };
export type ParsedPageBorder = { css: string; sides: string[] | null; options: PageBorderOptions; apply: PageBorderApply };

export const PT_PX = 96 / 72;
/** Word accepts 0 to 31 pt. */
export const MAX_BORDER_DISTANCE = 31;
export const defaultBorderDistance = (measure: BorderMeasure) => (measure === "text" ? 4 : 24);
export function defaultBorderOptions(measure: BorderMeasure = "page"): PageBorderOptions {
  const distance = defaultBorderDistance(measure);
  return { measure, top: distance, right: distance, bottom: distance, left: distance, surroundHeader: true, surroundFooter: true };
}

const clampDistance = (value: unknown, fallback: number) => {
  const number = Math.round(Number(value));
  return Number.isFinite(number) ? Math.min(MAX_BORDER_DISTANCE, Math.max(0, number)) : fallback;
};
export function normalizeBorderOptions(options: Partial<PageBorderOptions> | null | undefined): PageBorderOptions {
  const measure: BorderMeasure = options?.measure === "text" ? "text" : "page";
  const base = defaultBorderOptions(measure), fallback = defaultBorderDistance(measure);
  return {
    measure,
    top: clampDistance(options?.top ?? base.top, fallback), right: clampDistance(options?.right ?? base.right, fallback),
    bottom: clampDistance(options?.bottom ?? base.bottom, fallback), left: clampDistance(options?.left ?? base.left, fallback),
    surroundHeader: options?.surroundHeader !== false, surroundFooter: options?.surroundFooter !== false,
  };
}

/** The saved text taken apart; null when there is no border. */
export function parsePageBorder(text: string | null | undefined): ParsedPageBorder | null {
  if (!text || !text.trim()) return null;
  let rest = text.trim(), sides: string[] | null = null;
  const sideMatch = / sides:([a-z,]+)$/.exec(rest);
  if (sideMatch) { sides = sideMatch[1].split(",").filter(side => ["top", "right", "bottom", "left"].includes(side)); rest = rest.slice(0, sideMatch.index); }
  let apply: PageBorderApply = WHOLE_DOCUMENT;
  const applyMatch = / apply:s(\d+)(?:-(first|rest))?(?= |$)/.exec(rest);
  if (applyMatch) { apply = { section: Math.max(1, Number(applyMatch[1])), part: (applyMatch[2] as "first" | "rest" | undefined) ?? "all" }; rest = rest.replace(applyMatch[0], ""); }
  const partial: Partial<PageBorderOptions> = { measure: "page" };
  const gap = / gap:(\d+),(\d+),(\d+),(\d+)(?= |$)/.exec(rest);
  if (gap) { partial.top = Number(gap[1]); partial.right = Number(gap[2]); partial.bottom = Number(gap[3]); partial.left = Number(gap[4]); rest = rest.replace(gap[0], ""); }
  if (/ measure:text(?= |$)/.test(rest)) { partial.measure = "text"; rest = rest.replace(" measure:text", ""); }
  if (/ nohdr(?= |$)/.test(rest)) { partial.surroundHeader = false; rest = rest.replace(" nohdr", ""); }
  if (/ noftr(?= |$)/.test(rest)) { partial.surroundFooter = false; rest = rest.replace(" noftr", ""); }
  // A distance that is not written is the default of its mode (24 from the edge, 4 from the text).
  const options = normalizeBorderOptions(gap ? partial : { measure: partial.measure, surroundHeader: partial.surroundHeader, surroundFooter: partial.surroundFooter });
  return { css: rest.trim(), sides, options, apply };
}

/** The text to save: the line, the options that differ from their defaults, and the sides when not all four. */
export function formatPageBorder(css: string, sides: readonly string[] | null, options: Partial<PageBorderOptions> | null | undefined, apply: PageBorderApply = WHOLE_DOCUMENT): string {
  if (!css) return "";
  const o = normalizeBorderOptions(options), fallback = defaultBorderDistance(o.measure);
  const parts = [css];
  if (o.measure === "text") parts.push("measure:text");
  if ([o.top, o.right, o.bottom, o.left].some(distance => distance !== fallback)) parts.push(`gap:${o.top},${o.right},${o.bottom},${o.left}`);
  if (o.measure === "text" && !o.surroundHeader) parts.push("nohdr");
  if (o.measure === "text" && !o.surroundFooter) parts.push("noftr");
  if (apply.section !== null) parts.push(`apply:s${Math.max(1, Math.round(apply.section))}${apply.part === "all" ? "" : `-${apply.part}`}`);
  const kept = sides && sides.length > 0 && sides.length < 4 ? sides : null;
  if (kept) parts.push(`sides:${kept.join(",")}`);
  return parts.join(" ");
}

/** Server-side graded values (migration 202610291200): "page" | "text" and "top,right,bottom,left" in points. */
export function pageBorderMeasure(text: string | null | undefined): BorderMeasure | null {
  const parsed = parsePageBorder(text);
  return parsed && !/(^|\s)none(\s|$)/i.test(parsed.css) ? parsed.options.measure : null;
}
export function pageBorderDistance(text: string | null | undefined): string | null {
  const parsed = parsePageBorder(text);
  if (!parsed || /(^|\s)none(\s|$)/i.test(parsed.css)) return null;
  const { top, right, bottom, left } = parsed.options;
  return `${top},${right},${bottom},${left}`;
}

export type SheetGeometry = {
  /** CSS pixels, unzoomed. */
  pageWidth: number; sheetHeight: number; marginTop: number; marginRight: number; marginBottom: number; marginLeft: number;
  /** Where the header ends / the footer starts, from the top of this sheet; null when this sheet has none. */
  headerBottom: number | null; footerTop: number | null;
};

/**
 * The rectangle of the border on one sheet, in unzoomed pixels from the sheet's top-left corner.
 *  - Edge of page: each distance is measured from the paper's edge inward; the margins play no part.
 *  - Text: each distance is measured from the text boundary (the margin line) outward, so a margin change moves
 *    the border. A header (footer) that is not surrounded stays outside: the border starts below it (ends above it).
 */
export function pageBorderRect(options: Partial<PageBorderOptions>, g: SheetGeometry) {
  const o = normalizeBorderOptions(options);
  const top = o.top * PT_PX, right = o.right * PT_PX, bottom = o.bottom * PT_PX, left = o.left * PT_PX;
  if (o.measure === "page") return { left, top, width: g.pageWidth - left - right, height: g.sheetHeight - top - bottom };
  let from = g.marginTop - top, to = g.sheetHeight - g.marginBottom + bottom;
  if (!o.surroundHeader && g.headerBottom !== null) from = g.headerBottom - top;
  if (!o.surroundFooter && g.footerTop !== null) to = g.footerTop + bottom;
  return { left: g.marginLeft - left, top: from, width: g.pageWidth - g.marginLeft - g.marginRight + left + right, height: to - from };
}

/** Server-side graded value (migration 202611222200): "whole" | "s2" | "s1-first" | "s2-rest"; null without a border. */
export function pageBorderApply(text: string | null | undefined): string | null {
  const parsed = parsePageBorder(text);
  if (!parsed || /(^|\s)none(\s|$)/i.test(parsed.css)) return null;
  const { section, part } = parsed.apply;
  return section === null ? "whole" : `s${section}${part === "all" ? "" : `-${part}`}`;
}

/** Whether the border is drawn on a sheet: `section` is the sheet's section (1 = the first), `firstOfSection` whether
 *  the sheet is that section's first page. */
export function borderOnSheet(apply: PageBorderApply, section: number, firstOfSection: boolean) {
  if (apply.section === null) return true;
  if (apply.section !== section) return false;
  return apply.part === "all" || (apply.part === "first") === firstOfSection;
}
