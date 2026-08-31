// Powers the Word Efficiency workspace's Find and Replace dialog (Search
// Options + the Special/Format menus). Pulled out of the client editor
// component into a plain module so this matching logic -- whole word,
// prefix/suffix, ignore punctuation/whitespace, wildcards -- can be unit
// tested directly instead of only checked by grepping the component's
// source text.
export type FindOptions = {
  matchCase: boolean;
  wholeWord: boolean;
  wildcards: boolean;
  matchPrefix: boolean;
  matchSuffix: boolean;
  ignorePunctuation: boolean;
  ignoreWhitespace: boolean;
  formatHighlight: boolean;
};
export const DEFAULT_FIND_OPTIONS: FindOptions = { matchCase: false, wholeWord: false, wildcards: false, matchPrefix: false, matchSuffix: false, ignorePunctuation: false, ignoreWhitespace: false, formatHighlight: false };

// "Use wildcards" treats Find what as a JS regex fragment directly (an
// approximation of Word's own wildcard syntax, not a byte-for-byte port of
// it) -- every other combination builds a real regex from the literal
// characters so Match whole word/prefix/suffix and the two "ignore"
// options are genuine matching behavior, not decoration.
export function buildFindRegex(needle: string, options: FindOptions, global = false): RegExp | null {
  if (!needle) return null;
  let pattern: string;
  if (options.wildcards) pattern = needle;
  else {
    const escaped = [...needle].map(character => character.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    const joiner = options.ignoreWhitespace ? "\\s*" : options.ignorePunctuation ? "[.,/#!$%^&*;:{}=_`~()'\"?\\s-]*" : "";
    pattern = joiner ? escaped.join(joiner) : escaped.join("");
  }
  if (options.wholeWord) pattern = `\\b(?:${pattern})\\b`;
  else {
    if (options.matchPrefix) pattern = `\\b(?:${pattern})`;
    if (options.matchSuffix) pattern = `(?:${pattern})\\b`;
  }
  try {
    return new RegExp(pattern, `${options.matchCase ? "" : "i"}${global ? "g" : ""}`);
  } catch {
    return null;
  }
}
