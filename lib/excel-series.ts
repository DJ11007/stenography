// HOME > Editing > Fill > Series... (Excel 2013): the values one row or column of the selection gets.
//   Linear   first value + step, + 2 x step, ...        Growth  first value x step, x step^2, ...
//   Date     first date + step days / weekdays / months / years
//   Trend    (Linear / Growth) the best-fit line / curve through the starting values replaces them; step is ignored
//   Stop     the series ends before a value would pass the stop value
// AutoFill is the fill handle's own logic (lib/excel-autofill.ts), so it is not here.
export type SeriesType = "linear" | "growth" | "date" | "autofill";
export type DateUnit = "day" | "weekday" | "month" | "year";
export type SeriesOptions = { type: Exclude<SeriesType, "autofill">; dateUnit: DateUnit; step: number; stop: number | null; trend: boolean };

const DAY = 86400000, EPOCH = Date.UTC(1899, 11, 30);
const toDate = (serial: number) => new Date(EPOCH + Math.round(serial) * DAY);
const toSerial = (date: Date) => Math.round((Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - EPOCH) / DAY);
const round = (value: number) => Math.round(value * 1e10) / 1e10;

// Months / years added as Excel's EDATE does: the 31st becomes the last day of a shorter month.
function addMonths(serial: number, months: number): number {
  const date = toDate(serial), day = date.getUTCDate();
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, last));
  return toSerial(target) + (serial - Math.floor(serial));
}
function addWeekdays(serial: number, count: number): number {
  let date = toDate(serial), left = Math.abs(count);
  const direction = count < 0 ? -1 : 1;
  while (left > 0) { date = new Date(date.getTime() + direction * DAY); const weekday = date.getUTCDay(); if (weekday !== 0 && weekday !== 6) left--; }
  return toSerial(date);
}

// Least squares through (0, y0), (1, y1), ...: y = a + b x.
function fitLine(values: number[]): [number, number] {
  const n = values.length, meanX = (n - 1) / 2, meanY = values.reduce((sum, value) => sum + value, 0) / n;
  let top = 0, bottom = 0;
  values.forEach((value, x) => { top += (x - meanX) * (value - meanY); bottom += (x - meanX) ** 2; });
  const slope = bottom ? top / bottom : 0;
  return [meanY - slope * meanX, slope];
}

// The values for positions 0 .. length-1 of one row / column: a number to write, or null to leave the cell as it is.
// `line` holds the cells' current values; the series starts from the leading numbers. Returns null when the line
// does not start with a number (Excel leaves such a line alone).
export function seriesLine(line: unknown[], length: number, options: SeriesOptions): (number | null)[] | null {
  const starts: number[] = [];
  for (const value of line) { if (typeof value === "number" && Number.isFinite(value)) starts.push(value); else break; }
  if (!starts.length) return null;
  const out: (number | null)[] = Array(length).fill(null);
  const beyond = (value: number) => options.stop !== null && (options.type === "growth" ? (options.step >= 1 ? value > options.stop : value < options.stop) : options.step >= 0 ? value > options.stop : value < options.stop);
  if (options.trend && options.type !== "date" && starts.length >= 2) {
    const positive = starts.every((value) => value > 0);
    if (options.type === "growth" && positive) {
      const [a, b] = fitLine(starts.map(Math.log));
      for (let i = 0; i < length; i++) out[i] = round(Math.exp(a + b * i));
    } else {
      const [a, b] = fitLine(starts);
      for (let i = 0; i < length; i++) out[i] = round(a + b * i);
    }
    return out;
  }
  const first = starts[0];
  for (let k = 1; k < length; k++) {
    let value: number;
    if (options.type === "linear") value = first + options.step * k;
    else if (options.type === "growth") value = first * options.step ** k;
    else if (options.dateUnit === "day") value = first + options.step * k;
    else if (options.dateUnit === "weekday") value = addWeekdays(first, options.step * k);
    else if (options.dateUnit === "month") value = addMonths(first, options.step * k);
    else value = addMonths(first, options.step * k * 12);
    value = round(value);
    if (beyond(value)) break;
    out[k] = value;
  }
  return out;
}
