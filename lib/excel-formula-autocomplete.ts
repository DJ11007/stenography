// Excel's Formula AutoComplete: while a formula is typed ("=su"), the function names starting with the letters before
// the cursor are listed; Tab (or a double-click) puts the chosen name and "(" in their place.

export type FunctionToken = { start: number; end: number; prefix: string };

// The function name being typed at the cursor: letters (then letters, digits or dots) right after "=", "(", ",", an
// operator or a space, in a formula. "I10" also matches, but no function starts with it, so nothing is listed.
export function functionTokenAt(text: string, caret: number): FunctionToken | null {
  if (!text.startsWith("=") || caret < 2 || caret > text.length) return null;
  const before = text.slice(0, caret);
  const match = before.match(/(?:^=|[=(,+\-*/^&<>:;\s])([A-Za-z][A-Za-z0-9.]*)$/);
  if (!match) return null;
  // Inside a quoted text the letters are not a function name.
  if ((before.match(/"/g)?.length ?? 0) % 2 === 1) return null;
  const prefix = match[1];
  return { start: caret - prefix.length, end: caret, prefix };
}

// The function names starting with the typed letters, in alphabetical order (as Excel lists them).
export function functionSuggestions(prefix: string, names: readonly string[], limit = 12): string[] {
  const upper = prefix.toUpperCase();
  return names.filter((name) => name.startsWith(upper)).sort().slice(0, limit);
}

// The formula with the typed letters replaced by NAME( and the cursor right after the bracket.
export function acceptFunction(text: string, token: FunctionToken, name: string): { text: string; caret: number } {
  const rest = text.slice(token.end);
  const insert = rest.startsWith("(") ? name : `${name}(`;
  return { text: text.slice(0, token.start) + insert + rest, caret: token.start + insert.length + (rest.startsWith("(") ? 1 : 0) };
}
