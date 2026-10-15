// Font sizes as Word 2013 allows them: 1 to 1638 pt in half points.

export const WORD_FONT_SIZE_MIN = 1;
export const WORD_FONT_SIZE_MAX = 1638;

// The Font Size drop-down list (ribbon and Font dialog).
export const WORD_FONT_SIZE_LIST = [8, 9, 10, 10.5, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72];

// A typed size: any number in range, kept to the nearest half point (18.5 stays 18.5).
export function wordFontSize(value: unknown, min = WORD_FONT_SIZE_MIN, max = WORD_FONT_SIZE_MAX): number | null {
  const number = typeof value === "number" ? value : Number.parseFloat(String(value ?? "").replace(",", "."));
  if (!Number.isFinite(number)) return null;
  const half = Math.round(number * 2) / 2;
  return half >= min && half <= max ? half : null;
}

// Grow Font / Shrink Font (Ctrl+] / Ctrl+[ steps): 1 pt below 8, the list up to 72,
// then 10 pt at a time -- the steps Word 2013 uses.
const GROW_STEPS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72, ...Array.from({ length: 156 }, (_, index) => 80 + index * 10), 1638];
export function nextWordFontSize(current: number, direction: 1 | -1, min = WORD_FONT_SIZE_MIN, max = WORD_FONT_SIZE_MAX): number {
  const steps = GROW_STEPS.filter(size => size >= min && size <= max);
  if (!steps.length) return current;
  const next = direction > 0 ? steps.find(size => size > current + 0.001) : [...steps].reverse().find(size => size < current - 0.001);
  return next ?? (direction > 0 ? steps[steps.length - 1] : steps[0]);
}
