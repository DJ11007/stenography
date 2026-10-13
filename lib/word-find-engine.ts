// Search engine behind the Word Efficiency "Find and Replace" dialog, modelled on Word 2013:
// the ^ special codes (^p ^t ^? ^# ^$ ^^ ^+ ^= ^l ^m ^s ^~ ^- ^w ^g ...), Word's wildcard
// syntax (? * [] [!] < > {n,m} @ \n), Match case / Whole words / Prefix / Suffix, Ignore
// punctuation and white-space, Sounds like, All word forms, and format criteria
// (font, size, bold... alignment, highlight).
//
// It works on a linear text view of the editor (`buildDocumentText`) in which every block
// ends with a paragraph mark (\r), so patterns can match across runs and across paragraphs.

export type FindFormat = {
  bold?: boolean; italic?: boolean; underline?: boolean; strike?: boolean; superscript?: boolean; subscript?: boolean;
  highlight?: boolean; fontName?: string; fontSize?: number; color?: string; alignment?: "left" | "center" | "right" | "justify";
};

export type FindEngineOptions = {
  matchCase: boolean; wholeWord: boolean; wildcards: boolean; matchPrefix: boolean; matchSuffix: boolean;
  ignorePunctuation: boolean; ignoreWhitespace: boolean; soundsLike: boolean; allWordForms: boolean;
  direction: "all" | "down" | "up"; format: FindFormat | null;
};

export const DEFAULT_ENGINE_OPTIONS: FindEngineOptions = {
  matchCase: false, wholeWord: false, wildcards: false, matchPrefix: false, matchSuffix: false,
  ignorePunctuation: false, ignoreWhitespace: false, soundsLike: false, allWordForms: false, direction: "all", format: null,
};

export type TextMatch = { index: number; length: number; groups: string[] };

const PARA = "\r", LINE = "\v", PAGE = "\f", GRAPHIC = "￼";
const NEVER = "(?!)";
const PUNCT_JOINER = "[.,/#!$%^&*;:{}=_`~()'\"?\\s\\-]*";

const escapeLiteral = (character: string) => character.replace(/[.*+?^${}()|[\]\\\/]/g, "\\$&");

// A user-visible search string -> one regex fragment per "atom", so the ignore-punctuation /
// ignore-white-space joiners can be placed between atoms.
function codeAtom(code: string): string | null {
  switch (code) {
    case "p": return `[${PARA}]`;
    case "t": return "\\t";
    case "?": return `[^${PARA}${PAGE}${LINE}]`;
    case "#": return "\\d";
    case "$": return "\\p{L}";
    case "^": return "\\^";
    case "+": return "—";
    case "=": return "–";
    case "l": return `[${LINE}]`;
    case "m": return `[${PAGE}]`;
    case "b": return NEVER; // section break: not modelled
    case "n": return NEVER; // column break: not modelled
    case "e": case "f": return NEVER; // endnote / footnote marks: not modelled
    case "d": return NEVER; // field: not modelled
    case "s": return " ";
    case "~": return "‑";
    case "-": return "­";
    case "w": return "[\\s\\u00a0]+";
    case "g": return GRAPHIC;
    case "%": return "§";
    case "v": return "¶";
    default: return null;
  }
}

export function translateNeedle(needle: string, options: FindEngineOptions): { pattern: string; groupCount: number } | null {
  const atoms: string[] = [];
  let groups = 0;
  for (let i = 0; i < needle.length;) {
    const character = needle[i];
    if (character === "^" && i + 1 < needle.length) {
      const numeric = /^\^0(\d{1,5})/.exec(needle.slice(i));
      if (numeric) { atoms.push(escapeLiteral(String.fromCodePoint(Number(numeric[1])))); i += numeric[0].length; continue; }
      if (/^\^13/.test(needle.slice(i))) { atoms.push(`[${PARA}]`); i += 3; continue; }
      const mapped = codeAtom(needle[i + 1]);
      if (mapped !== null) { atoms.push(mapped); i += 2; continue; }
    }
    if (options.wildcards) {
      if (character === "\\" && i + 1 < needle.length) {
        const next = needle[i + 1];
        atoms.push(/\d/.test(next) ? `\\${next}` : escapeLiteral(next));
        i += 2; continue;
      }
      if (character === "?") { atoms.push(`[^${PARA}${PAGE}${LINE}]`); i++; continue; }
      if (character === "*") { atoms.push("[\\s\\S]*?"); i++; continue; }
      if (character === "<") { atoms.push("\\b(?=\\w)"); i++; continue; }
      if (character === ">") { atoms.push("(?<=\\w)\\b"); i++; continue; }
      if (character === "@") { atoms.push("+"); i++; continue; }
      if (character === "(") { groups++; atoms.push("("); i++; continue; }
      if (character === ")") { atoms.push(")"); i++; continue; }
      if (character === "{") {
        const close = needle.indexOf("}", i);
        const body = close > i ? needle.slice(i + 1, close) : "";
        if (/^\d+(,\d*)?$/.test(body)) { atoms.push(`{${body}}`); i = close + 1; continue; }
        return null;
      }
      if (character === "[") {
        const close = needle.indexOf("]", i + 2);
        if (close < 0) return null;
        let body = needle.slice(i + 1, close);
        const negate = body.startsWith("!");
        if (negate) body = body.slice(1);
        body = body.replace(/\\/g, "\\\\").replace(/\^/g, "\\^");
        atoms.push(`[${negate ? "^" : ""}${body}]`);
        i = close + 1; continue;
      }
    }
    atoms.push(escapeLiteral(character));
    i++;
  }
  if (!atoms.length) return null;
  let pattern: string;
  if (options.wildcards) pattern = atoms.join(""); // quantifiers and groups must stay glued to their neighbours
  else {
    const joiner = options.ignoreWhitespace ? "\\s*" : options.ignorePunctuation ? PUNCT_JOINER : "";
    pattern = joiner ? atoms.join(joiner) : atoms.join("");
  }
  return { pattern, groupCount: groups };
}

// ---- Sounds like (Soundex) and All word forms ----
export function soundex(word: string): string {
  const letters = word.toUpperCase().replace(/[^A-Z]/g, "");
  if (!letters) return "";
  const codes: Record<string, string> = { B: "1", F: "1", P: "1", V: "1", C: "2", G: "2", J: "2", K: "2", Q: "2", S: "2", X: "2", Z: "2", D: "3", T: "3", L: "4", M: "5", N: "5", R: "6" };
  let result = letters[0], previous = codes[letters[0]] ?? "";
  for (const letter of letters.slice(1)) {
    const code = codes[letter] ?? "";
    if (code && code !== previous) result += code;
    if (letter !== "H" && letter !== "W") previous = code;
  }
  return (result + "000").slice(0, 4);
}

const IRREGULAR: string[][] = [
  ["be", "am", "is", "are", "was", "were", "been", "being"], ["go", "goes", "went", "gone", "going"], ["do", "does", "did", "done", "doing"],
  ["have", "has", "had", "having"], ["say", "says", "said", "saying"], ["make", "makes", "made", "making"], ["take", "takes", "took", "taken", "taking"],
  ["see", "sees", "saw", "seen", "seeing"], ["come", "comes", "came", "coming"], ["give", "gives", "gave", "given", "giving"],
  ["find", "finds", "found", "finding"], ["get", "gets", "got", "gotten", "getting"], ["know", "knows", "knew", "known", "knowing"],
  ["think", "thinks", "thought", "thinking"], ["run", "runs", "ran", "running"], ["write", "writes", "wrote", "written", "writing"],
  ["eat", "eats", "ate", "eaten", "eating"], ["child", "children"], ["man", "men"], ["woman", "women"], ["person", "people"], ["foot", "feet"], ["tooth", "teeth"],
];

export function wordForms(word: string): string[] {
  const lower = word.toLowerCase();
  const forms = new Set<string>([lower]);
  for (const group of IRREGULAR) if (group.includes(lower)) group.forEach(item => forms.add(item));
  const bases = new Set<string>([lower]);
  if (lower.endsWith("ing") && lower.length > 4) { const stem = lower.slice(0, -3); bases.add(stem); bases.add(stem + "e"); if (/(.)\1$/.test(stem)) bases.add(stem.slice(0, -1)); }
  if (lower.endsWith("ied") && lower.length > 4) bases.add(lower.slice(0, -3) + "y");
  else if (lower.endsWith("ed") && lower.length > 3) { const stem = lower.slice(0, -2); bases.add(stem); bases.add(stem + "e"); if (/(.)\1$/.test(stem)) bases.add(stem.slice(0, -1)); }
  if (lower.endsWith("ies") && lower.length > 4) bases.add(lower.slice(0, -3) + "y");
  else if (lower.endsWith("es") && lower.length > 3) { bases.add(lower.slice(0, -2)); bases.add(lower.slice(0, -1)); }
  else if (lower.endsWith("s") && lower.length > 2) bases.add(lower.slice(0, -1));
  for (const base of bases) {
    forms.add(base);
    for (const group of IRREGULAR) if (group.includes(base)) group.forEach(item => forms.add(item));
    const consonantY = /[^aeiou]y$/.test(base);
    forms.add(consonantY ? base.slice(0, -1) + "ies" : /(s|x|z|ch|sh|o)$/.test(base) ? base + "es" : base + "s");
    forms.add(base.endsWith("e") ? base + "d" : consonantY ? base.slice(0, -1) + "ied" : base + "ed");
    forms.add(base.endsWith("e") && !base.endsWith("ee") ? base.slice(0, -1) + "ing" : base + "ing");
    if (/[^aeiou][aeiou][^aeiouwxy]$/.test(base) && base.length <= 5) { forms.add(base + base.slice(-1) + "ed"); forms.add(base + base.slice(-1) + "ing"); }
  }
  return [...forms];
}

// ---- Matching ----
export function findMatches(text: string, needle: string, options: FindEngineOptions): TextMatch[] {
  if (!needle) return [];
  const flags = (options.matchCase || options.wildcards ? "" : "i") + "gu";
  const results: TextMatch[] = [];
  const collect = (regex: RegExp) => {
    for (const found of text.matchAll(regex)) {
      if (!found[0].length) continue;
      results.push({ index: found.index ?? 0, length: found[0].length, groups: found.slice(1).map(group => group ?? "") });
    }
  };
  if (options.soundsLike && !options.wildcards) {
    const words = needle.match(/\p{L}+/gu) ?? [];
    if (!words.length) return [];
    const wanted = words.map(soundex);
    const found = [...text.matchAll(/\p{L}+/gu)];
    for (let i = 0; i + words.length <= found.length; i++) {
      let ok = true;
      for (let k = 0; k < words.length && ok; k++) ok = soundex(found[i + k][0]) === wanted[k];
      if (!ok) continue;
      const last = found[i + words.length - 1];
      results.push({ index: found[i].index ?? 0, length: (last.index ?? 0) + last[0].length - (found[i].index ?? 0), groups: [] });
    }
    return results;
  }
  let pattern: string;
  if (options.allWordForms && !options.wildcards && /^\p{L}+$/u.test(needle.trim())) {
    pattern = `(?<![\\p{L}\\p{N}_])(?:${wordForms(needle.trim()).map(escapeLiteral).join("|")})(?![\\p{L}\\p{N}_])`;
  } else {
    const translated = translateNeedle(needle, options);
    if (!translated) return [];
    pattern = translated.pattern;
    if (options.wholeWord && !options.wildcards) pattern = `(?<![\\p{L}\\p{N}_])(?:${pattern})(?![\\p{L}\\p{N}_])`;
    else if (!options.wildcards) {
      if (options.matchPrefix) pattern = `(?<![\\p{L}\\p{N}_])(?:${pattern})`;
      if (options.matchSuffix) pattern = `(?:${pattern})(?![\\p{L}\\p{N}_])`;
    }
  }
  try { collect(new RegExp(pattern, flags)); } catch { return []; }
  return results;
}

// Replacement text: ^& found text, ^c nothing, ^t ^^ ^l ^m ^s ^~ ^- ^+ ^= and, with wildcards, \1..\9.
// A ^p becomes a real paragraph mark ("\r") which the editor turns into a paragraph break.
export function expandReplacement(replacement: string, match: { text: string; groups: string[] }, options: Pick<FindEngineOptions, "wildcards">): string {
  let output = "";
  for (let i = 0; i < replacement.length;) {
    const character = replacement[i];
    if (character === "^" && i + 1 < replacement.length) {
      const numeric = /^\^0(\d{1,5})/.exec(replacement.slice(i));
      if (numeric) { output += String.fromCodePoint(Number(numeric[1])); i += numeric[0].length; continue; }
      if (/^\^13/.test(replacement.slice(i))) { output += PARA; i += 3; continue; }
      const next = replacement[i + 1];
      const table: Record<string, string> = { "&": match.text, p: PARA, t: "\t", "^": "^", l: LINE, m: PAGE, s: " ", "~": "‑", "-": "­", "+": "—", "=": "–", "%": "§", v: "¶", c: "" };
      if (next in table) { output += table[next]; i += 2; continue; }
    }
    if (options.wildcards && character === "\\" && i + 1 < replacement.length) {
      const next = replacement[i + 1];
      if (/[1-9]/.test(next)) { output += match.groups[Number(next) - 1] ?? ""; i += 2; continue; }
      output += next; i += 2; continue;
    }
    output += character; i++;
  }
  return output;
}

// ---- Linear text view of the editor ----
export type Segment = { start: number; end: number; node: Node; kind: "text" | "mark" | "break" | "graphic" };
const BLOCK_TAGS = new Set(["P", "LI", "H1", "H2", "H3", "H4", "H5", "H6", "DIV", "TD", "TH", "BLOCKQUOTE", "PRE", "SECTION", "HEADER", "FOOTER"]);

export function buildDocumentText(root: HTMLElement): { text: string; segments: Segment[] } {
  const segments: Segment[] = [];
  let text = "";
  const push = (value: string, node: Node, kind: Segment["kind"]) => { segments.push({ start: text.length, end: text.length + value.length, node, kind }); text += value; };
  const walk = (parent: Node) => {
    for (const child of Array.from(parent.childNodes)) {
      if (child.nodeType === 3) { const value = child.textContent ?? ""; if (value) push(value, child, "text"); }
      else if (child.nodeType === 1) {
        const element = child as HTMLElement, tag = element.tagName;
        if (tag === "BR") push(LINE, element, "break");
        else if (tag === "HR") push(PAGE, element, "break");
        else if (tag === "IMG") push(GRAPHIC, element, "graphic");
        else if (BLOCK_TAGS.has(tag)) { walk(element); push(PARA, element, "mark"); }
        else walk(element);
      }
    }
  };
  walk(root);
  return { text, segments };
}

// Linear offset -> DOM boundary point. `isEnd` picks the side when an offset sits between two segments.
export function pointAt(segments: Segment[], offset: number, isEnd: boolean): { node: Node; offset: number } | null {
  for (const segment of segments) {
    const inside = isEnd ? offset > segment.start && offset <= segment.end : offset >= segment.start && offset < segment.end;
    if (!inside) continue;
    if (segment.kind === "text") return { node: segment.node, offset: offset - segment.start };
    const parent = segment.node.parentNode;
    if (!parent) return null;
    const index = Array.prototype.indexOf.call(parent.childNodes, segment.node) as number;
    if (segment.kind === "mark") return { node: segment.node, offset: segment.node.childNodes.length };
    return { node: parent, offset: isEnd ? index + 1 : index };
  }
  const last = segments[segments.length - 1];
  if (last && offset >= last.end) return last.kind === "text" ? { node: last.node, offset: (last.node.textContent ?? "").length } : { node: last.node, offset: last.node.childNodes.length };
  return null;
}

export function rangeForMatch(segments: Segment[], index: number, length: number): Range | null {
  const start = pointAt(segments, index, false), end = pointAt(segments, index + length, true);
  if (!start || !end) return null;
  const range = document.createRange();
  try { range.setStart(start.node, start.offset); range.setEnd(end.node, end.offset); } catch { return null; }
  return range;
}

// ---- Format criteria ----
const rgbToHex = (value: string) => {
  const found = value.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  return found ? "#" + found.slice(1, 4).map(part => Number(part).toString(16).padStart(2, "0")).join("") : value.toLowerCase();
};

export function describeFormat(format: FindFormat | null): string {
  if (!format) return "";
  const font: string[] = [];
  if (format.fontName) font.push(format.fontName);
  if (format.fontSize) font.push(`${format.fontSize} pt`);
  if (format.bold === true) font.push("Bold"); else if (format.bold === false) font.push("Not Bold");
  if (format.italic === true) font.push("Italic"); else if (format.italic === false) font.push("Not Italic");
  if (format.underline === true) font.push("Underline"); else if (format.underline === false) font.push("No Underline");
  if (format.strike === true) font.push("Strikethrough"); else if (format.strike === false) font.push("No Strikethrough");
  if (format.superscript) font.push("Superscript");
  if (format.subscript) font.push("Subscript");
  if (format.color) font.push(`Font color: ${format.color}`);
  if (format.highlight) font.push("Highlight");
  const parts: string[] = [];
  if (font.length) parts.push(`Font: ${font.join(", ")}`);
  if (format.alignment) parts.push(`Paragraph: ${({ left: "Left", center: "Centered", right: "Right", justify: "Justified" } as const)[format.alignment]}`);
  return parts.join("; ");
}

export function textNodeMatchesFormat(node: Node, root: HTMLElement, format: FindFormat): boolean {
  const element = node.nodeType === 1 ? (node as HTMLElement) : node.parentElement;
  if (!element) return false;
  const style = getComputedStyle(element);
  const chain: HTMLElement[] = [];
  for (let current: HTMLElement | null = element; current && current !== root; current = current.parentElement) chain.push(current);
  const hasTag = (...tags: string[]) => chain.some(item => tags.includes(item.tagName));
  const decoration = () => chain.map(item => item.style.textDecorationLine || item.style.textDecoration || "").join(" ") + " " + chain.map(item => getComputedStyle(item).textDecorationLine).join(" ");
  if (format.bold !== undefined && (Number(style.fontWeight) >= 600 || hasTag("B", "STRONG")) !== format.bold) return false;
  if (format.italic !== undefined && (style.fontStyle === "italic" || hasTag("I", "EM")) !== format.italic) return false;
  if (format.underline !== undefined && (hasTag("U") || chain.some(item => item.dataset?.underlineStyle) || /underline/.test(decoration())) !== format.underline) return false;
  if (format.strike !== undefined && (hasTag("S", "STRIKE", "DEL") || chain.some(item => item.dataset?.doubleStrike) || /line-through/.test(decoration())) !== format.strike) return false;
  if (format.superscript && !(hasTag("SUP") || style.verticalAlign === "super")) return false;
  if (format.subscript && !(hasTag("SUB") || style.verticalAlign === "sub")) return false;
  if (format.highlight) {
    const colored = chain.some(item => { const background = getComputedStyle(item).backgroundColor; return Boolean(background) && background !== "transparent" && !/rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)/.test(background) && !/^rgb\(\s*(255\s*,\s*255\s*,\s*255)\s*\)$/.test(background); });
    if (!colored) return false;
  }
  if (format.fontName && style.fontFamily.replace(/["']/g, "").split(",")[0].trim().toLowerCase() !== format.fontName.replace(/ \((Headings|Body)\)$/u, "").toLowerCase()) return false;
  if (format.fontSize && Math.round(Number.parseFloat(style.fontSize) * 0.75 * 2) / 2 !== format.fontSize) return false;
  if (format.color && rgbToHex(style.color) !== format.color.toLowerCase()) return false;
  if (format.alignment) {
    let block: HTMLElement | null = element;
    while (block && block.parentElement !== root) block = block.parentElement;
    const align = block ? getComputedStyle(block).textAlign : "";
    const normalized = align === "start" ? "left" : align;
    if (normalized !== format.alignment) return false;
  }
  return true;
}

// Does the whole matched range satisfy the format? (Every text node it touches must.)
export function matchSatisfiesFormat(segments: Segment[], root: HTMLElement, index: number, length: number, format: FindFormat): boolean {
  let any = false;
  for (const segment of segments) {
    if (segment.kind !== "text" || segment.end <= index || segment.start >= index + length) continue;
    any = true;
    if (!textNodeMatchesFormat(segment.node, root, format)) return false;
  }
  return any;
}

// Format-only search (empty Find what): every maximal run of text with the format.
export function formatOnlyMatches(segments: Segment[], root: HTMLElement, format: FindFormat): TextMatch[] {
  const results: TextMatch[] = [];
  let runStart = -1, runEnd = -1;
  const flush = () => { if (runStart >= 0) results.push({ index: runStart, length: runEnd - runStart, groups: [] }); runStart = -1; };
  for (const segment of segments) {
    if (segment.kind === "text" && textNodeMatchesFormat(segment.node, root, format)) { if (runStart < 0) runStart = segment.start; runEnd = segment.end; }
    else flush();
  }
  flush();
  return results;
}
