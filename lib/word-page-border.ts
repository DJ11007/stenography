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
//   "... sides:top,bottom"                        only some sides (always last; read by the server's borderSides)
// Distances are whole points, top, right, bottom, left. A part equal to its default is not written.

export type BorderMeasure = "page" | "text";
export type PageBorderOptions = { measure: BorderMeasure; top: number; right: number; bottom: number; left: number; surroundHeader: boolean; surroundFooter: boolean };
export type ParsedPageBorder = { css: string; sides: string[] | null; options: PageBorderOptions };

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
  const partial: Partial<PageBorderOptions> = { measure: "page" };
  const gap = / gap:(\d+),(\d+),(\d+),(\d+)(?= |$)/.exec(rest);
  if (gap) { partial.top = Number(gap[1]); partial.right = Number(gap[2]); partial.bottom = Number(gap[3]); partial.left = Number(gap[4]); rest = rest.replace(gap[0], ""); }
  if (/ measure:text(?= |$)/.test(rest)) { partial.measure = "text"; rest = rest.replace(" measure:text", ""); }
  if (/ nohdr(?= |$)/.test(rest)) { partial.surroundHeader = false; rest = rest.replace(" nohdr", ""); }
  if (/ noftr(?= |$)/.test(rest)) { partial.surroundFooter = false; rest = rest.replace(" noftr", ""); }
  // A distance that is not written is the default of its mode (24 from the edge, 4 from the text).
  const options = normalizeBorderOptions(gap ? partial : { measure: partial.measure, surroundHeader: partial.surroundHeader, surroundFooter: partial.surroundFooter });
  return { css: rest.trim(), sides, options };
}

/** The text to save: the line, the options that differ from their defaults, and the sides when not all four. */
export function formatPageBorder(css: string, sides: readonly string[] | null, options: Partial<PageBorderOptions> | null | undefined): string {
  if (!css) return "";
  const o = normalizeBorderOptions(options), fallback = defaultBorderDistance(o.measure);
  const parts = [css];
  if (o.measure === "text") parts.push("measure:text");
  if ([o.top, o.right, o.bottom, o.left].some(distance => distance !== fallback)) parts.push(`gap:${o.top},${o.right},${o.bottom},${o.left}`);
  if (o.measure === "text" && !o.surroundHeader) parts.push("nohdr");
  if (o.measure === "text" && !o.surroundFooter) parts.push("noftr");
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
