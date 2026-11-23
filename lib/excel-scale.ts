// Excel's Scale box (PAGE LAYOUT > Scale to Fit > Scale, Page Setup > Page > Adjust to): 10% to 400%.
export const MIN_SCALE = 10, MAX_SCALE = 400;

/** The percent a typed text means: digits with an optional % (and spaces), rounded and kept within 10-400; null when
 *  there is no number in it (the box then keeps its value). */
export function parseScale(text: string): number | null {
  const match = /^\s*(\d+(?:\.\d+)?)\s*%?\s*$/.exec(text);
  if (!match) return null;
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.round(Number(match[1]))));
}
