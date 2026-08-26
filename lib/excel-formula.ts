export type SheetCells = Record<string, { value: string | number | null; formula: string | null }>;

const CELL_REF = /^[A-Z]{1,2}[0-9]{1,3}$/;
const FUNCTIONS = new Set(["SUM", "AVERAGE", "COUNT", "COUNTA", "MAX", "MIN", "IF"]);

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
function rangeRefs(start: string, end: string): string[] {
  const from = parseCellRef(start), to = parseCellRef(end);
  if (!from || !to) return [];
  const refs: string[] = [];
  for (let row = Math.min(from.row, to.row); row <= Math.max(from.row, to.row); row++)
    for (let col = Math.min(from.col, to.col); col <= Math.max(from.col, to.col); col++)
      refs.push(`${columnLetters(col)}${row}`);
  return refs;
}

class FormulaError extends Error {}

function tokenize(expression: string): string[] {
  const tokens: string[] = [];
  const pattern = /\s*(?:([A-Z]{1,2}[0-9]{1,3})|([A-Z]+)|(\d+(?:\.\d+)?)|("(?:[^"]|"")*")|([(),:+\-*/])|(\S))\s*/gi;
  let match: RegExpExecArray | null;
  pattern.lastIndex = 0;
  while ((match = pattern.exec(expression))) {
    if (match[0].trim() === "" && match.index >= expression.length) break;
    const token = match[1] ?? match[2] ?? match[3] ?? match[4] ?? match[5] ?? match[6];
    if (token === undefined) break;
    tokens.push(token);
    if (pattern.lastIndex === match.index) pattern.lastIndex++;
  }
  return tokens;
}

function evaluateExpression(tokens: string[], resolve: (ref: string) => number | string | null): number | string {
  let position = 0;
  const peek = () => tokens[position];
  const next = () => tokens[position++];

  function parsePrimary(): number | string | number[] {
    const token = next();
    if (token === undefined) throw new FormulaError("Unexpected end of formula");
    if (token === "(") { const value = parseAddSub(); if (next() !== ")") throw new FormulaError("Missing )"); return value; }
    if (/^\d/.test(token)) return Number(token);
    if (token.startsWith('"')) return token.slice(1, -1).replace(/""/g, '"');
    if (CELL_REF.test(token)) {
      if (peek() === ":") { next(); const end = next(); if (!end || !CELL_REF.test(end)) throw new FormulaError("Invalid range"); return rangeRefs(token, end).map(ref => resolve(ref)).filter((value): value is number => typeof value === "number"); }
      const resolved = resolve(token);
      if (typeof resolved === "string" && resolved.startsWith("#")) throw new FormulaError(resolved);
      return typeof resolved === "number" ? resolved : resolved === null ? 0 : Number(resolved) || 0;
    }
    if (FUNCTIONS.has(token.toUpperCase())) return parseFunction(token.toUpperCase());
    throw new FormulaError(`Unsupported term: ${token}`);
  }
  function parseFunction(name: string): number | string {
    if (next() !== "(") throw new FormulaError("Expected (");
    const args: (number | number[] | string)[] = [];
    if (peek() !== ")") { args.push(parseAddSub()); while (peek() === ",") { next(); args.push(parseAddSub()); } }
    if (next() !== ")") throw new FormulaError("Missing ) after function arguments");
    const flat = args.flatMap(arg => Array.isArray(arg) ? arg : [arg]).filter((value): value is number => typeof value === "number");
    if (name === "SUM") return flat.reduce((sum, value) => sum + value, 0);
    if (name === "AVERAGE") return flat.length ? flat.reduce((sum, value) => sum + value, 0) / flat.length : 0;
    if (name === "COUNT") return flat.length;
    if (name === "COUNTA") return args.flatMap(arg => Array.isArray(arg) ? arg : [arg]).filter(value => value !== null && value !== "").length;
    if (name === "MAX") return flat.length ? Math.max(...flat) : 0;
    if (name === "MIN") return flat.length ? Math.min(...flat) : 0;
    if (name === "IF") { const [condition, whenTrue, whenFalse] = args; return (typeof condition === "number" ? condition !== 0 : Boolean(condition)) ? (whenTrue ?? 0) as number : (whenFalse ?? 0) as number; }
    throw new FormulaError(`Unsupported function: ${name}`);
  }
  function parseUnary(): number | string | number[] {
    if (peek() === "-") { next(); const value = parseUnary(); return typeof value === "number" ? -value : 0; }
    return parsePrimary();
  }
  function parseMulDiv(): number | string | number[] {
    let value = parseUnary();
    while (peek() === "*" || peek() === "/") {
      const operator = next();
      const right = parseUnary();
      const left = typeof value === "number" ? value : Number(value) || 0, rightNumber = typeof right === "number" ? right : Number(right) || 0;
      value = operator === "*" ? left * rightNumber : rightNumber === 0 ? 0 : left / rightNumber;
    }
    return value;
  }
  function parseAddSub(): number | string | number[] {
    let value = parseMulDiv();
    while (peek() === "+" || peek() === "-") {
      const operator = next();
      const right = parseMulDiv();
      const left = typeof value === "number" ? value : Number(value) || 0, rightNumber = typeof right === "number" ? right : Number(right) || 0;
      value = operator === "+" ? left + rightNumber : left - rightNumber;
    }
    return value;
  }
  const result = parseAddSub();
  if (position < tokens.length) throw new FormulaError("Unexpected trailing input");
  return Array.isArray(result) ? (result.length ? result[0] : 0) : result;
}

export function evaluateFormula(formula: string, cells: SheetCells, depth = 0): number | string {
  if (depth > 10) return "#REF!";
  if (!formula.startsWith("=")) return formula;
  try {
    const tokens = tokenize(formula.slice(1));
    return evaluateExpression(tokens, ref => {
      const cell = cells[ref];
      if (!cell) return null;
      if (cell.formula) return evaluateFormula(cell.formula, cells, depth + 1);
      return cell.value;
    });
  } catch {
    return "#ERROR!";
  }
}

export function computedCellValue(ref: string, cells: SheetCells): number | string | null {
  const cell = cells[ref];
  if (!cell) return null;
  if (cell.formula) return evaluateFormula(cell.formula, cells);
  return cell.value;
}
