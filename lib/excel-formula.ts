export type SheetCells = Record<string, { value: string | number | null; formula: string | null }>;

// The formula engine behind the Excel Efficiency workspace: Excel's operators (+ - * / ^ % & = <> < > <= >=)
// and the functions of Excel 2013's Function Library that the papers use. Results are what Excel shows:
// a number, text, TRUE/FALSE (saved as the text "TRUE"/"FALSE") or an error such as #DIV/0! or #N/A.

const CELL_REF = /^[A-Z]{1,2}[0-9]{1,3}$/;

export type FunctionInfo = { name: string; category: FunctionCategory; syntax: string; description: string };
export type FunctionCategory = "Financial" | "Logical" | "Text" | "Date & Time" | "Lookup & Reference" | "Math & Trig" | "Statistical";
// Shown in the Insert Function dialog and the FORMULAS tab menus, as Excel words them.
export const FUNCTION_LIBRARY: FunctionInfo[] = [
  { name: "PMT", category: "Financial", syntax: "PMT(rate,nper,pv,[fv],[type])", description: "Calculates the payment for a loan based on constant payments and a constant interest rate." },
  { name: "FV", category: "Financial", syntax: "FV(rate,nper,pmt,[pv],[type])", description: "Returns the future value of an investment based on periodic, constant payments and a constant interest rate." },
  { name: "PV", category: "Financial", syntax: "PV(rate,nper,pmt,[fv],[type])", description: "Returns the present value of an investment: the total amount that a series of future payments is worth now." },
  { name: "AND", category: "Logical", syntax: "AND(logical1,[logical2],...)", description: "Checks whether all arguments are TRUE, and returns TRUE if all arguments are TRUE." },
  { name: "FALSE", category: "Logical", syntax: "FALSE()", description: "Returns the logical value FALSE." },
  { name: "IF", category: "Logical", syntax: "IF(logical_test,[value_if_true],[value_if_false])", description: "Checks whether a condition is met, and returns one value if TRUE, and another value if FALSE." },
  { name: "IFERROR", category: "Logical", syntax: "IFERROR(value,value_if_error)", description: "Returns value_if_error if expression is an error and the value of the expression itself otherwise." },
  { name: "NOT", category: "Logical", syntax: "NOT(logical)", description: "Changes FALSE to TRUE, or TRUE to FALSE." },
  { name: "OR", category: "Logical", syntax: "OR(logical1,[logical2],...)", description: "Checks whether any of the arguments are TRUE, and returns TRUE or FALSE. Returns FALSE only if all arguments are FALSE." },
  { name: "TRUE", category: "Logical", syntax: "TRUE()", description: "Returns the logical value TRUE." },
  { name: "CONCATENATE", category: "Text", syntax: "CONCATENATE(text1,[text2],...)", description: "Joins several text strings into one text string." },
  { name: "EXACT", category: "Text", syntax: "EXACT(text1,text2)", description: "Checks whether two text strings are exactly the same, and returns TRUE or FALSE. EXACT is case-sensitive." },
  { name: "FIND", category: "Text", syntax: "FIND(find_text,within_text,[start_num])", description: "Returns the starting position of one text string within another text string. FIND is case-sensitive." },
  { name: "LEFT", category: "Text", syntax: "LEFT(text,[num_chars])", description: "Returns the specified number of characters from the start of a text string." },
  { name: "LEN", category: "Text", syntax: "LEN(text)", description: "Returns the number of characters in a text string." },
  { name: "LOWER", category: "Text", syntax: "LOWER(text)", description: "Converts all letters in a text string to lowercase." },
  { name: "MID", category: "Text", syntax: "MID(text,start_num,num_chars)", description: "Returns the characters from the middle of a text string, given a starting position and length." },
  { name: "PROPER", category: "Text", syntax: "PROPER(text)", description: "Converts a text string to proper case; the first letter in each word to uppercase, and all other letters to lowercase." },
  { name: "REPT", category: "Text", syntax: "REPT(text,number_times)", description: "Repeats text a given number of times." },
  { name: "RIGHT", category: "Text", syntax: "RIGHT(text,[num_chars])", description: "Returns the specified number of characters from the end of a text string." },
  { name: "SUBSTITUTE", category: "Text", syntax: "SUBSTITUTE(text,old_text,new_text,[instance_num])", description: "Replaces existing text with new text in a text string." },
  { name: "TRIM", category: "Text", syntax: "TRIM(text)", description: "Removes all spaces from a text string except for single spaces between words." },
  { name: "UPPER", category: "Text", syntax: "UPPER(text)", description: "Converts a text string to all uppercase letters." },
  { name: "DATE", category: "Date & Time", syntax: "DATE(year,month,day)", description: "Returns the number that represents the date in Microsoft Excel date-time code." },
  { name: "DAY", category: "Date & Time", syntax: "DAY(serial_number)", description: "Returns the day of the month, a number from 1 to 31." },
  { name: "DAYS", category: "Date & Time", syntax: "DAYS(end_date,start_date)", description: "Returns the number of days between the two dates." },
  { name: "MONTH", category: "Date & Time", syntax: "MONTH(serial_number)", description: "Returns the month, a number from 1 (January) to 12 (December)." },
  { name: "NOW", category: "Date & Time", syntax: "NOW()", description: "Returns the current date and time formatted as a date and time." },
  { name: "TODAY", category: "Date & Time", syntax: "TODAY()", description: "Returns the current date formatted as a date." },
  { name: "YEAR", category: "Date & Time", syntax: "YEAR(serial_number)", description: "Returns the year of a date, an integer in the range 1900 - 9999." },
  { name: "CHOOSE", category: "Lookup & Reference", syntax: "CHOOSE(index_num,value1,[value2],...)", description: "Chooses a value or action to perform from a list of values, based on an index number." },
  { name: "HLOOKUP", category: "Lookup & Reference", syntax: "HLOOKUP(lookup_value,table_array,row_index_num,[range_lookup])", description: "Looks for a value in the top row of a table or array of values and returns the value in the same column from a row you specify." },
  { name: "INDEX", category: "Lookup & Reference", syntax: "INDEX(array,row_num,[column_num])", description: "Returns a value or reference of the cell at the intersection of a particular row and column, in a given range." },
  { name: "MATCH", category: "Lookup & Reference", syntax: "MATCH(lookup_value,lookup_array,[match_type])", description: "Returns the relative position of an item in an array that matches a specified value in a specified order." },
  { name: "VLOOKUP", category: "Lookup & Reference", syntax: "VLOOKUP(lookup_value,table_array,col_index_num,[range_lookup])", description: "Looks for a value in the leftmost column of a table, and then returns a value in the same row from a column you specify." },
  { name: "ABS", category: "Math & Trig", syntax: "ABS(number)", description: "Returns the absolute value of a number, a number without its sign." },
  { name: "INT", category: "Math & Trig", syntax: "INT(number)", description: "Rounds a number down to the nearest integer." },
  { name: "MOD", category: "Math & Trig", syntax: "MOD(number,divisor)", description: "Returns the remainder after a number is divided by a divisor." },
  { name: "PI", category: "Math & Trig", syntax: "PI()", description: "Returns the value of Pi, 3.14159265358979, accurate to 15 digits." },
  { name: "POWER", category: "Math & Trig", syntax: "POWER(number,power)", description: "Returns the result of a number raised to a power." },
  { name: "PRODUCT", category: "Math & Trig", syntax: "PRODUCT(number1,[number2],...)", description: "Multiplies all the numbers given as arguments." },
  { name: "ROUND", category: "Math & Trig", syntax: "ROUND(number,num_digits)", description: "Rounds a number to a specified number of digits." },
  { name: "ROUNDDOWN", category: "Math & Trig", syntax: "ROUNDDOWN(number,num_digits)", description: "Rounds a number down, toward zero." },
  { name: "ROUNDUP", category: "Math & Trig", syntax: "ROUNDUP(number,num_digits)", description: "Rounds a number up, away from zero." },
  { name: "SQRT", category: "Math & Trig", syntax: "SQRT(number)", description: "Returns the square root of a number." },
  { name: "SUM", category: "Math & Trig", syntax: "SUM(number1,[number2],...)", description: "Adds all the numbers in a range of cells." },
  { name: "SUMIF", category: "Math & Trig", syntax: "SUMIF(range,criteria,[sum_range])", description: "Adds the cells specified by a given condition or criteria." },
  { name: "SUMPRODUCT", category: "Math & Trig", syntax: "SUMPRODUCT(array1,[array2],...)", description: "Returns the sum of the products of corresponding ranges or arrays." },
  { name: "TRUNC", category: "Math & Trig", syntax: "TRUNC(number,[num_digits])", description: "Truncates a number to an integer by removing the decimal, or fractional, part of the number." },
  { name: "AVERAGE", category: "Statistical", syntax: "AVERAGE(number1,[number2],...)", description: "Returns the average (arithmetic mean) of its arguments, which can be numbers or names, arrays, or references that contain numbers." },
  { name: "AVERAGEIF", category: "Statistical", syntax: "AVERAGEIF(range,criteria,[average_range])", description: "Finds average (arithmetic mean) for the cells specified by a given condition or criteria." },
  { name: "COUNT", category: "Statistical", syntax: "COUNT(value1,[value2],...)", description: "Counts the number of cells in a range that contain numbers." },
  { name: "COUNTA", category: "Statistical", syntax: "COUNTA(value1,[value2],...)", description: "Counts the number of cells in a range that are not empty." },
  { name: "COUNTBLANK", category: "Statistical", syntax: "COUNTBLANK(range)", description: "Counts the number of empty cells in a specified range of cells." },
  { name: "COUNTIF", category: "Statistical", syntax: "COUNTIF(range,criteria)", description: "Counts the number of cells within a range that meet the given condition." },
  { name: "LARGE", category: "Statistical", syntax: "LARGE(array,k)", description: "Returns the k-th largest value in a data set. For example, the fifth largest number." },
  { name: "MAX", category: "Statistical", syntax: "MAX(number1,[number2],...)", description: "Returns the largest value in a set of values. Ignores logical values and text." },
  { name: "MEDIAN", category: "Statistical", syntax: "MEDIAN(number1,[number2],...)", description: "Returns the median, or the number in the middle of the set of given numbers." },
  { name: "MIN", category: "Statistical", syntax: "MIN(number1,[number2],...)", description: "Returns the smallest number in a set of values. Ignores logical values and text." },
  { name: "RANK", category: "Statistical", syntax: "RANK(number,ref,[order])", description: "Returns the rank of a number in a list of numbers: its size relative to other values in the list." },
  { name: "SMALL", category: "Statistical", syntax: "SMALL(array,k)", description: "Returns the k-th smallest value in a data set. For example, the fifth smallest number." },
];
const FUNCTIONS = new Set(FUNCTION_LIBRARY.map((fn) => fn.name));

export function columnLetters(index: number): string {
  let value = index, letters = "";
  while (value >= 0) { letters = String.fromCharCode(65 + (value % 26)) + letters; value = Math.floor(value / 26) - 1; }
  return letters;
}
export function columnIndex(letters: string): number {
  let value = 0;
  for (const char of letters.toUpperCase()) value = value * 26 + (char.charCodeAt(0) - 64);
  return value - 1;
}
export function parseCellRef(ref: string): { col: number; row: number } | null {
  const match = ref.toUpperCase().match(/^([A-Z]{1,2})([0-9]{1,3})$/);
  if (!match) return null;
  return { col: columnIndex(match[1]), row: Number(match[2]) };
}

// ---------- values ----------
type Scalar = number | string | boolean | null;
type Range = { kind: "range"; rows: Scalar[][] };
type Value = Scalar | Range;
class FormulaError extends Error { code: string; constructor(code: string) { super(code); this.code = code; } }
const fail = (code: string): never => { throw new FormulaError(code); };
const isRange = (value: Value): value is Range => Boolean(value && typeof value === "object" && (value as Range).kind === "range");
const cellsOf = (value: Value): Scalar[] => (isRange(value) ? value.rows.flat() : [value]);
const ERROR_TEXT = /^#(DIV\/0!|N\/A|NAME\?|NUM!|REF!|VALUE!|NULL!|ERROR!)$/;

function scalar(value: Value): Scalar {
  if (!isRange(value)) return value;
  return value.rows[0]?.[0] ?? null;
}
function toNumber(value: Value): number {
  const v = scalar(value);
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (v === null || v === "") return 0;
  const parsed = Number(String(v).replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : fail("#VALUE!");
}
function toText(value: Value): string {
  const v = scalar(value);
  if (v === null) return "";
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : String(Math.round(v * 1e10) / 1e10);
  return v;
}
function toBool(value: Value): boolean {
  const v = scalar(value);
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (v === null || v === "") return false;
  if (/^true$/i.test(v)) return true;
  if (/^false$/i.test(v)) return false;
  return fail("#VALUE!");
}
/** Numbers only, as SUM/AVERAGE/MAX read their arguments: text and blanks in ranges are skipped. */
function numbersOf(args: Value[]): number[] {
  return args.flatMap((arg) => (isRange(arg) ? arg.rows.flat().filter((v): v is number => typeof v === "number") : [toNumber(arg)]));
}
/** COUNTIF/SUMIF criteria: 5, ">5", "<=10", "<>x", "=x", text with * and ? wildcards. */
function criteriaTest(criteria: Value): (cell: Scalar) => boolean {
  const raw = scalar(criteria);
  if (typeof raw === "number") return (cell) => typeof cell === "number" ? cell === raw : cell !== null && Number(cell) === raw;
  const text = toText(raw);
  const match = text.match(/^(<=|>=|<>|<|>|=)?([\s\S]*)$/)!;
  const operator = match[1] ?? "=", operand = match[2];
  const number = operand.trim() !== "" && Number.isFinite(Number(operand)) ? Number(operand) : null;
  if (number !== null && operator !== "=" && operator !== "<>") return (cell) => typeof cell === "number" && (operator === "<" ? cell < number : operator === ">" ? cell > number : operator === "<=" ? cell <= number : cell >= number);
  const pattern = new RegExp(`^${operand.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".")}$`, "i");
  const equal = (cell: Scalar) => number !== null && typeof cell === "number" ? cell === number : operand === "" ? cell === null || cell === "" : pattern.test(toText(cell));
  return operator === "<>" ? (cell) => !equal(cell) : equal;
}
const compareValues = (a: Scalar, b: Scalar) => {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return toText(a).toLowerCase().localeCompare(toText(b).toLowerCase());
};

// Dates are Excel serial numbers: 1 = 1 January 1900 (day 0 = 30 December 1899, as Excel counts).
const EPOCH = Date.UTC(1899, 11, 30);
export const serialToDate = (serial: number) => new Date(EPOCH + Math.round(serial * 86400000));
export const dateToSerial = (date: Date) => (Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds()) - EPOCH) / 86400000;
const round = (value: number, digits: number, mode: "half" | "up" | "down") => {
  const factor = 10 ** digits, scaled = Math.abs(value) * factor;
  const r = mode === "half" ? Math.round(scaled + 1e-9) : mode === "up" ? Math.ceil(scaled - 1e-9) : Math.floor(scaled + 1e-9);
  return (Math.sign(value) * r) / factor;
};
function lookupPosition(needle: Scalar, haystack: Scalar[], exact: boolean): number {
  if (exact) { const test = criteriaTest(needle === null ? "" : typeof needle === "number" ? needle : `=${toText(needle)}`); return haystack.findIndex((cell) => test(cell)); }
  let found = -1;
  for (let i = 0; i < haystack.length; i++) { if (haystack[i] === null) continue; if (compareValues(haystack[i], needle) <= 0) found = i; else break; }
  return found;
}

function callFunction(name: string, args: Value[]): Value {
  const n = (i: number, fallback?: number) => (args[i] === undefined ? (fallback ?? fail("#VALUE!")) : toNumber(args[i]));
  const t = (i: number) => (args[i] === undefined ? "" : toText(args[i]));
  const range = (i: number): Range => { const value = args[i]; return isRange(value) ? value : { kind: "range", rows: [[scalar(value ?? null)]] }; };
  switch (name) {
    // Math & Trig
    case "SUM": return numbersOf(args).reduce((a, b) => a + b, 0);
    case "PRODUCT": return numbersOf(args).reduce((a, b) => a * b, 1);
    case "ROUND": return round(n(0), n(1, 0), "half");
    case "ROUNDUP": return round(n(0), n(1, 0), "up");
    case "ROUNDDOWN": case "TRUNC": return round(n(0), n(1, 0), "down");
    case "INT": return Math.floor(n(0));
    case "ABS": return Math.abs(n(0));
    case "SQRT": return n(0) < 0 ? fail("#NUM!") : Math.sqrt(n(0));
    case "POWER": return n(0) ** n(1);
    case "MOD": { const d = n(1); if (d === 0) fail("#DIV/0!"); const x = n(0); return x - d * Math.floor(x / d); }
    case "PI": return Math.PI;
    case "SUMIF": { const test = criteriaTest(args[1] ?? null), keys = range(0).rows.flat(), sums = args[2] !== undefined ? range(2).rows.flat() : keys; return keys.reduce<number>((total, key, i) => total + (test(key) && typeof sums[i] === "number" ? (sums[i] as number) : 0), 0); }
    case "SUMPRODUCT": { const lists = args.map((_, i) => range(i).rows.flat()); const length = lists[0]?.length ?? 0; if (lists.some((list) => list.length !== length)) fail("#VALUE!"); let total = 0; for (let i = 0; i < length; i++) total += lists.reduce((p, list) => p * (typeof list[i] === "number" ? (list[i] as number) : 0), 1); return total; }
    // Statistical
    case "AVERAGE": { const values = numbersOf(args); return values.length ? values.reduce((a, b) => a + b, 0) / values.length : fail("#DIV/0!"); }
    case "AVERAGEIF": { const test = criteriaTest(args[1] ?? null), keys = range(0).rows.flat(), values = args[2] !== undefined ? range(2).rows.flat() : keys; const picked = keys.flatMap((key, i) => (test(key) && typeof values[i] === "number" ? [values[i] as number] : [])); return picked.length ? picked.reduce((a, b) => a + b, 0) / picked.length : fail("#DIV/0!"); }
    case "COUNT": return args.flatMap(cellsOf).filter((v) => typeof v === "number").length;
    case "COUNTA": return args.flatMap(cellsOf).filter((v) => v !== null && v !== "").length;
    case "COUNTBLANK": return range(0).rows.flat().filter((v) => v === null || v === "").length;
    case "COUNTIF": { const test = criteriaTest(args[1] ?? null); return range(0).rows.flat().filter((v) => test(v)).length; }
    case "MAX": { const values = numbersOf(args); return values.length ? Math.max(...values) : 0; }
    case "MIN": { const values = numbersOf(args); return values.length ? Math.min(...values) : 0; }
    case "MEDIAN": { const values = numbersOf(args).sort((a, b) => a - b); if (!values.length) fail("#NUM!"); const mid = Math.floor(values.length / 2); return values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2; }
    case "LARGE": case "SMALL": { const values = numbersOf([args[0] ?? null]).sort((a, b) => (name === "LARGE" ? b - a : a - b)); const k = n(1); return k >= 1 && k <= values.length ? values[Math.floor(k) - 1] : fail("#NUM!"); }
    case "RANK": { const value = n(0), list = numbersOf([args[1] ?? null]); if (!list.includes(value)) fail("#N/A"); const ascending = args[2] !== undefined && n(2) !== 0; return 1 + list.filter((v) => (ascending ? v < value : v > value)).length; }
    // Logical
    case "IF": return toBool(args[0] ?? false) ? (args[1] === undefined ? true : scalar(args[1])) : (args[2] === undefined ? false : scalar(args[2]));
    case "AND": return args.flatMap(cellsOf).filter((v) => v !== null).every((v) => toBool(v));
    case "OR": return args.flatMap(cellsOf).filter((v) => v !== null).some((v) => toBool(v));
    case "NOT": return !toBool(args[0] ?? false);
    case "TRUE": return true;
    case "FALSE": return false;
    // Text
    case "CONCATENATE": return args.map((arg) => toText(arg)).join("");
    case "LEFT": return t(0).slice(0, n(1, 1));
    case "RIGHT": { const count = n(1, 1); return count <= 0 ? "" : t(0).slice(-count); }
    case "MID": return t(0).substr(Math.max(0, n(1) - 1), Math.max(0, n(2)));
    case "LEN": return t(0).length;
    case "LOWER": return t(0).toLowerCase();
    case "UPPER": return t(0).toUpperCase();
    case "PROPER": return t(0).toLowerCase().replace(/(^|[^a-z])([a-z])/g, (_, before: string, letter: string) => before + letter.toUpperCase());
    case "TRIM": return t(0).trim().replace(/ {2,}/g, " ");
    case "REPT": return t(0).repeat(Math.max(0, Math.floor(n(1))));
    case "EXACT": return t(0) === t(1);
    case "FIND": { const at = t(1).indexOf(t(0), n(2, 1) - 1); return at < 0 ? fail("#VALUE!") : at + 1; }
    case "SUBSTITUTE": { const text = t(0), from = t(1), to = t(2); if (!from) return text; if (args[3] === undefined) return text.split(from).join(to); let count = 0; return text.replace(new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), (m) => (++count === n(3) ? to : m)); }
    // Date & Time
    case "TODAY": return Math.floor(dateToSerial(new Date()));
    case "NOW": return dateToSerial(new Date());
    case "DATE": return dateToSerial(new Date(n(0), n(1) - 1, n(2)));
    case "YEAR": return serialToDate(n(0)).getUTCFullYear();
    case "MONTH": return serialToDate(n(0)).getUTCMonth() + 1;
    case "DAY": return serialToDate(n(0)).getUTCDate();
    case "DAYS": return Math.floor(n(0)) - Math.floor(n(1));
    // Lookup & Reference
    case "VLOOKUP": case "HLOOKUP": {
      const table = range(1).rows, index = Math.floor(n(2)), exact = args[3] !== undefined && !toBool(args[3]);
      const vertical = name === "VLOOKUP";
      const keys = vertical ? table.map((row) => row[0]) : table[0] ?? [];
      if (index < 1 || index > (vertical ? table[0]?.length ?? 0 : table.length)) fail("#REF!");
      const at = lookupPosition(scalar(args[0] ?? null), keys, exact);
      if (at < 0) fail("#N/A");
      return (vertical ? table[at][index - 1] : table[index - 1][at]) ?? 0;
    }
    case "INDEX": { const rows = range(0).rows; const r = Math.floor(n(1)), c = Math.floor(n(2, 1)); const single = rows.length === 1 && args[2] === undefined; const value = single ? rows[0][r - 1] : rows[r - 1]?.[c - 1]; return value === undefined ? fail("#REF!") : value ?? 0; }
    case "MATCH": { const list = range(1).rows.flat(), type = args[2] === undefined ? 1 : n(2); const at = lookupPosition(scalar(args[0] ?? null), list, type === 0); return at < 0 ? fail("#N/A") : at + 1; }
    case "CHOOSE": { const i = Math.floor(n(0)); return i >= 1 && i < args.length ? scalar(args[i]) : fail("#VALUE!"); }
    // Financial
    case "PMT": { const rate = n(0), periods = n(1), pv = n(2), fv = n(3, 0), type = n(4, 0); if (rate === 0) return -(pv + fv) / periods; const f = (1 + rate) ** periods; return (-rate * (pv * f + fv)) / ((1 + rate * type) * (f - 1)); }
    case "FV": { const rate = n(0), periods = n(1), pmt = n(2), pv = n(3, 0), type = n(4, 0); if (rate === 0) return -(pv + pmt * periods); const f = (1 + rate) ** periods; return -(pv * f + (pmt * (1 + rate * type) * (f - 1)) / rate); }
    case "PV": { const rate = n(0), periods = n(1), pmt = n(2), fv = n(3, 0), type = n(4, 0); if (rate === 0) return -(fv + pmt * periods); const f = (1 + rate) ** periods; return -(fv + (pmt * (1 + rate * type) * (f - 1)) / rate) / f; }
  }
  return fail("#NAME?");
}

// ---------- parsing ----------
function tokenize(expression: string): string[] {
  const tokens: string[] = [];
  const pattern = /\s*(?:("(?:[^"]|"")*")|(\d+(?:\.\d+)?(?:E[+-]?\d+)?)|([A-Z][A-Z0-9.]*)|(<>|<=|>=)|([(),:+\-*/^&%=<>]))/giy;
  let match: RegExpExecArray | null, last = 0;
  while ((match = pattern.exec(expression))) { tokens.push(match[1] ?? match[2] ?? match[3] ?? match[4] ?? match[5]); last = pattern.lastIndex; }
  if (expression.slice(last).trim() !== "") fail("#NAME?");
  return tokens;
}

function evaluateTokens(tokens: string[], resolve: (ref: string) => Scalar, names?: Record<string, string>): Value {
  let position = 0;
  const peek = () => tokens[position];
  const next = () => tokens[position++];

  function primary(): Value {
    const token = next();
    if (token === undefined) fail("#ERROR!");
    if (token === "(") { const value = comparison(); if (next() !== ")") fail("#ERROR!"); return value; }
    if (/^\d/.test(token)) return Number(token);
    if (token.startsWith('"')) return token.slice(1, -1).replace(/""/g, '"');
    const upper = token.toUpperCase();
    if (peek() === "(") {
      next();
      if (!FUNCTIONS.has(upper) && upper !== "IFERROR") fail("#NAME?");
      // IFERROR has to see an error in its first argument rather than stop at it.
      if (upper === "IFERROR") {
        let first: Value | FormulaError;
        const start = position;
        try { first = comparison(); } catch (error) { if (!(error instanceof FormulaError)) throw error; first = error; position = start; skipArgument(); }
        if (next() !== ",") fail("#ERROR!");
        const fallback = comparison();
        if (next() !== ")") fail("#ERROR!");
        return first instanceof FormulaError ? fallback : first;
      }
      const args: Value[] = [];
      if (peek() !== ")") { args.push(comparison()); while (peek() === ",") { next(); args.push(comparison()); } }
      if (next() !== ")") fail("#ERROR!");
      return callFunction(upper, args);
    }
    if (CELL_REF.test(upper)) {
      if (peek() === ":") {
        next(); const end = next()?.toUpperCase();
        if (!end || !CELL_REF.test(end)) fail("#REF!");
        const a = parseCellRef(upper)!, b = parseCellRef(end)!;
        const rows: Scalar[][] = [];
        for (let row = Math.min(a.row, b.row); row <= Math.max(a.row, b.row); row++) {
          const line: Scalar[] = [];
          for (let col = Math.min(a.col, b.col); col <= Math.max(a.col, b.col); col++) line.push(resolve(`${columnLetters(col)}${row}`));
          rows.push(line);
        }
        return { kind: "range", rows };
      }
      return resolve(upper);
    }
    if (upper === "TRUE") return true;
    if (upper === "FALSE") return false;
    // A defined name (Formulas > Define Name) stands for its cell or range.
    const named = names && Object.entries(names).find(([name]) => name.toUpperCase() === upper)?.[1];
    if (named) {
      const [start, end = start] = named.replace(/\$/g, "").toUpperCase().split(":");
      const a = parseCellRef(start), b = parseCellRef(end);
      if (!a || !b) fail("#REF!");
      if (start === end) return resolve(start);
      const rows: Scalar[][] = [];
      for (let row = Math.min(a!.row, b!.row); row <= Math.max(a!.row, b!.row); row++) {
        const line: Scalar[] = [];
        for (let col = Math.min(a!.col, b!.col); col <= Math.max(a!.col, b!.col); col++) line.push(resolve(`${columnLetters(col)}${row}`));
        rows.push(line);
      }
      return { kind: "range", rows };
    }
    return fail("#NAME?");
  }
  // Moves past one function argument (up to its "," or ")"), after an error stopped it part way.
  function skipArgument() {
    let depth = 0;
    while (position < tokens.length) {
      const token = tokens[position];
      if (depth === 0 && (token === "," || token === ")")) return;
      if (token === "(") depth++; else if (token === ")") depth--;
      position++;
    }
  }
  function percent(): Value { let value = primary(); while (peek() === "%") { next(); value = toNumber(value) / 100; } return value; }
  function unary(): Value { if (peek() === "-") { next(); return -toNumber(unary()); } if (peek() === "+") { next(); return unary(); } return percent(); }
  function power(): Value { let value = unary(); while (peek() === "^") { next(); value = toNumber(value) ** toNumber(unary()); } return value; }
  function product(): Value {
    let value = power();
    while (peek() === "*" || peek() === "/") {
      const op = next(), right = toNumber(power()), left = toNumber(value);
      if (op === "/" && right === 0) fail("#DIV/0!");
      value = op === "*" ? left * right : left / right;
    }
    return value;
  }
  function sum(): Value { let value = product(); while (peek() === "+" || peek() === "-") { const op = next(), right = toNumber(product()); value = op === "+" ? toNumber(value) + right : toNumber(value) - right; } return value; }
  function concat(): Value { let value = sum(); while (peek() === "&") { next(); value = toText(value) + toText(sum()); } return value; }
  function comparison(): Value {
    let value = concat();
    while (["=", "<>", "<", ">", "<=", ">="].includes(peek() ?? "")) {
      const op = next(), a = scalar(value), b = scalar(concat());
      const c = compareValues(a, b);
      value = op === "=" ? c === 0 : op === "<>" ? c !== 0 : op === "<" ? c < 0 : op === ">" ? c > 0 : op === "<=" ? c <= 0 : c >= 0;
    }
    return value;
  }
  const result = comparison();
  if (position < tokens.length) fail("#ERROR!");
  return result;
}

export function evaluateFormula(formula: string, cells: SheetCells, depth = 0, names?: Record<string, string>): number | string {
  if (depth > 20) return "#REF!";
  if (!formula.startsWith("=")) return formula;
  // Excel accepts lower-case references and functions (=sum(i3:i4)) and absolute references ($I$3).
  const normalized = formula.slice(1).replace(/("(?:[^"]|"")*")|[^"]+/g, (part, quoted) => (quoted ? part : part.replace(/\$/g, "").toUpperCase()));
  const resolve = (ref: string): Scalar => {
    const cell = cells[ref];
    if (!cell) return null;
    const value = cell.formula ? evaluateFormula(cell.formula, cells, depth + 1, names) : cell.value;
    if (typeof value === "string" && ERROR_TEXT.test(value)) fail(value);
    if (value === "TRUE" && cell.formula) return true;
    if (value === "FALSE" && cell.formula) return false;
    return value;
  };
  try {
    const value = scalar(evaluateTokens(tokenize(normalized), resolve, names));
    if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
    if (typeof value === "number" && !Number.isFinite(value)) return "#NUM!";
    return value === null ? 0 : value;
  } catch (error) {
    if (error instanceof FormulaError) return error.code;
    return "#ERROR!";
  }
}

export function computedCellValue(ref: string, cells: SheetCells, names?: Record<string, string>): number | string | null {
  const cell = cells[ref];
  if (!cell) return null;
  if (cell.formula) return evaluateFormula(cell.formula, cells, 0, names);
  return cell.value;
}
