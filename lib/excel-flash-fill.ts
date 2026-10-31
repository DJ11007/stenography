// HOME > Editing > Fill > Flash Fill (Ctrl+E), as in Excel 2013: from a few typed examples in a column, find how
// each example is made from the other cells of its row, and fill the rest of the column the same way.
// A "program" takes a piece of one cell (all of it, the n-th word / last word, the part before or after a
// separator, the first letters, the digits...) in its own case or in UPPER / lower / Proper case, optionally joined
// to a second piece with a separator, or with fixed text before or after it.
export type FlashRow = { sources: (string | number | null)[]; output: string | null };

const DELIMITERS = [" ", ",", "-", "@", ".", "_", "/", ";", ":"];
const SEPARATORS = ["", " ", ", ", ",", "-", " - ", ".", "_", "/", "@", ": ", " "];
const SPLIT = /[\s,;\-_.@/()]+/;
const proper = (text: string) => text.toLowerCase().replace(/(^|[^\p{L}\p{N}'])(\p{L})/gu, (_, before: string, letter: string) => before + letter.toUpperCase());

// Every piece a row offers, as program id -> text.
function pieces(sources: FlashRow["sources"]): Map<string, string> {
  const base = new Map<string, string>();
  sources.forEach((raw, column) => {
    if (raw === null || raw === undefined || raw === "") return;
    const text = String(raw), id = `c${column}`;
    base.set(id, text);
    const words = text.split(SPLIT).filter(Boolean);
    words.forEach((word, i) => { base.set(`${id}w${i}`, word); base.set(`${id}W${words.length - 1 - i}`, word); });
    if (words.length > 1) { base.set(`${id}I`, words.map((word) => word[0]).join("")); base.set(`${id}I.`, words.map((word) => `${word[0]}.`).join("")); }
    base.set(`${id}f`, text[0]);
    const digits = text.replace(/\D+/g, ""), letters = text.replace(/[^\p{L}]+/gu, "");
    if (digits) base.set(`${id}D`, digits);
    if (letters) base.set(`${id}L`, letters);
    for (const d of DELIMITERS) {
      const first = text.indexOf(d), last = text.lastIndexOf(d);
      if (first < 0) continue;
      base.set(`${id}b${d}`, text.slice(0, first)); base.set(`${id}a${d}`, text.slice(first + d.length));
      base.set(`${id}B${d}`, text.slice(0, last)); base.set(`${id}A${d}`, text.slice(last + d.length));
    }
  });
  const all = new Map<string, string>();
  for (const [id, text] of base) {
    if (!text) continue;
    all.set(id, text); all.set(`${id}|u`, text.toUpperCase()); all.set(`${id}|l`, text.toLowerCase()); all.set(`${id}|p`, proper(text));
  }
  return all;
}

type Program = { kind: "one"; id: string; prefix: string; suffix: string } | { kind: "two"; first: string; separator: string; second: string };
function run(program: Program, piecesOfRow: Map<string, string>): string | null {
  if (program.kind === "one") { const value = piecesOfRow.get(program.id); return value === undefined ? null : program.prefix + value + program.suffix; }
  const a = piecesOfRow.get(program.first), b = piecesOfRow.get(program.second);
  return a === undefined || b === undefined ? null : a + program.separator + b;
}

// Programs that turn the first example's row into its output.
function candidates(row: Map<string, string>, output: string): Program[] {
  const found: Program[] = [];
  for (const [id, value] of row) {
    if (value === output) found.push({ kind: "one", id, prefix: "", suffix: "" });
  }
  for (const [id, value] of row) {
    if (value.length >= output.length) continue;
    if (output.endsWith(value) && /^[^\p{L}\p{N}]*[\p{L}\p{N}. ]*[^\p{L}\p{N}]*$/u.test(output.slice(0, output.length - value.length))) found.push({ kind: "one", id, prefix: output.slice(0, output.length - value.length), suffix: "" });
    if (output.startsWith(value)) found.push({ kind: "one", id, prefix: "", suffix: output.slice(value.length) });
  }
  const byValue = new Map<string, string[]>();
  for (const [id, value] of row) byValue.set(value, [...(byValue.get(value) ?? []), id]);
  for (const [first, value] of row) {
    if (!output.startsWith(value) || value.length >= output.length) continue;
    const rest = output.slice(value.length);
    for (const separator of new Set(SEPARATORS)) {
      if (!rest.startsWith(separator)) continue;
      for (const second of byValue.get(rest.slice(separator.length)) ?? []) if (second !== first) found.push({ kind: "two", first, separator, second });
    }
  }
  return found;
}

// The outputs for the rows that have none, or null when no single way of making the examples is found.
export function flashFill(rows: FlashRow[]): (string | null)[] | null {
  const prepared = rows.map((row) => ({ ...row, pieces: pieces(row.sources) }));
  const examples = prepared.filter((row) => row.output !== null && row.output !== "");
  if (!examples.length || examples.length === prepared.length) return null;
  const working = candidates(examples[0].pieces, examples[0].output!).filter((program) => examples.every((example) => run(program, example.pieces) === example.output));
  // Prefer the program that fills the most rows (a piece every row has); then, as Excel does, the one that uses the
  // row's own cells most: a whole piece, then two pieces joined, and fixed text ("Mr. ", " - Jaipur") last.
  const rank = (program: Program) => (program.kind === "two" ? 1 : program.prefix || program.suffix ? 2 : 0);
  const scored = working.map((program) => ({ program, filled: prepared.filter((row) => row.output === null && run(program, row.pieces) !== null).length }));
  scored.sort((a, b) => b.filled - a.filled || rank(a.program) - rank(b.program));
  const best = scored[0];
  if (!best || !best.filled) return null;
  return prepared.map((row) => (row.output === null ? run(best.program, row.pieces) : null));
}
