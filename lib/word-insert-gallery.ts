// Content of Word 2013's Insert-tab galleries, shared by the ribbon menus that
// show them (components/word-efficiency/word-insert-menus.tsx) and the editor
// that applies them (rich-document-editor.tsx).

export type HeaderFooterStyle = { name: string; html: string; preview: "blank" | "three" | "austin" | "banded" | "facet" | "facet-odd" | "alphabet" | "annual" };

const year = () => new Date().getFullYear();
const center = (text: string, extra = "") => `<span style="display:block;text-align:center${extra}">${text}</span>`;
const three = (a: string, b: string, c: string) => `<span style="display:inline-block;width:33%">${a}</span><span style="display:inline-block;width:33%;text-align:center">${b}</span><span style="display:inline-block;width:33%;text-align:right">${c}</span>`;

export const HEADER_STYLES: HeaderFooterStyle[] = [
  { name: "Blank", preview: "blank", html: "[Type here]" },
  { name: "Blank (Three Columns)", preview: "three", html: three("[Type here]", "[Type here]", "[Type here]") },
  { name: "Austin", preview: "austin", html: '<span style="display:block;border:1px solid #7f7f7f;padding:4px 8px;color:#2e74b5">[Document title]</span>' },
  { name: "Banded", preview: "banded", html: center("[DOCUMENT TITLE]", ";background:#5b9bd5;color:#ffffff;padding:3px 0;letter-spacing:1px") },
  { name: "Facet (Even Page)", preview: "facet", html: '<span style="display:block;color:#5b9bd5;font-weight:700">[Document title]</span>' },
  { name: "Facet (Odd Page)", preview: "facet-odd", html: '<span style="display:block;color:#5b9bd5;font-weight:700;text-align:right">[Document title]</span>' },
  { name: "Alphabet", preview: "alphabet", html: '<span style="display:block;border-bottom:2px solid #94a3b8;padding-bottom:4px;font-weight:700">[Type the document title]</span>' },
  { name: "Annual", preview: "annual", html: `<span style="display:block;border-bottom:1px solid #cbd5e1;padding-bottom:4px">[Type the document title] &middot; ${year()}</span>` },
];

export const FOOTER_STYLES: HeaderFooterStyle[] = [
  { name: "Blank", preview: "blank", html: "[Type here]" },
  { name: "Blank (Three Columns)", preview: "three", html: three("[Type here]", "[Type here]", "[Type here]") },
  { name: "Austin", preview: "austin", html: '<span style="display:block;border:1px solid #7f7f7f;padding:4px 8px;color:#2e74b5">pg. 1</span>' },
  { name: "Banded", preview: "banded", html: center("1", ";background:#5b9bd5;color:#ffffff;padding:3px 0") },
  { name: "Facet (Even Page)", preview: "facet", html: '<span style="display:block;color:#7f7f7f;font-size:9pt">[Author name] | [SCHOOL]</span>' },
  { name: "Facet (Odd Page)", preview: "facet-odd", html: '<span style="display:block;color:#7f7f7f;font-size:9pt;text-align:right">[Author name] | [SCHOOL]</span>' },
];

// Page Number > Top of Page / Bottom of Page / Page Margins / Current Position.
// `style` is how the number is written, `alignment` where it sits.
export type PageNumberDesign = { id: string; name: string; group: string; style: "plain" | "pageX" | "accentBar" | "pageOfX"; alignment: "left" | "center" | "right" };
export const PAGE_NUMBER_GALLERIES: Record<"top" | "bottom" | "margins" | "current", PageNumberDesign[]> = {
  top: [
    { id: "plain-1", name: "Plain Number 1", group: "Simple", style: "plain", alignment: "left" },
    { id: "plain-2", name: "Plain Number 2", group: "Simple", style: "plain", alignment: "center" },
    { id: "plain-3", name: "Plain Number 3", group: "Simple", style: "plain", alignment: "right" },
    { id: "accent-1", name: "Accent Bar 1", group: "Page X", style: "accentBar", alignment: "left" },
    { id: "accent-2", name: "Accent Bar 2", group: "Page X", style: "accentBar", alignment: "right" },
    { id: "page-x", name: "Page X of Y", group: "Page X", style: "pageOfX", alignment: "right" },
  ],
  bottom: [
    { id: "plain-1", name: "Plain Number 1", group: "Simple", style: "plain", alignment: "left" },
    { id: "plain-2", name: "Plain Number 2", group: "Simple", style: "plain", alignment: "center" },
    { id: "plain-3", name: "Plain Number 3", group: "Simple", style: "plain", alignment: "right" },
    { id: "accent-1", name: "Accent Bar 1", group: "Page X", style: "accentBar", alignment: "left" },
    { id: "accent-2", name: "Accent Bar 2", group: "Page X", style: "accentBar", alignment: "right" },
    { id: "page-x", name: "Page X of Y", group: "Page X", style: "pageOfX", alignment: "center" },
  ],
  margins: [
    { id: "accent-left", name: "Accent Bar, Left", group: "Page X", style: "accentBar", alignment: "left" },
    { id: "accent-right", name: "Accent Bar, Right", group: "Page X", style: "accentBar", alignment: "right" },
    { id: "vertical-left", name: "Vertical, Left", group: "Page X", style: "pageX", alignment: "left" },
    { id: "vertical-right", name: "Vertical, Right", group: "Page X", style: "pageX", alignment: "right" },
    { id: "border-left", name: "Border, Left", group: "Plain Number", style: "plain", alignment: "left" },
    { id: "border-right", name: "Border, Right", group: "Plain Number", style: "plain", alignment: "right" },
    { id: "large-left", name: "Large, Left", group: "Plain Number", style: "plain", alignment: "left" },
  ],
  current: [
    { id: "plain", name: "Plain Number", group: "Simple", style: "plain", alignment: "left" },
    { id: "accent-1", name: "Accent Bar 1", group: "Page X", style: "accentBar", alignment: "left" },
    { id: "accent-2", name: "Accent Bar 2", group: "Page X", style: "pageX", alignment: "left" },
    { id: "accent-3", name: "Accent Bar 3", group: "Page X", style: "pageX", alignment: "left" },
  ],
};

// Page Number Format dialog: Word 2013's number formats.
export const PAGE_NUMBER_FORMATS: { id: string; label: string }[] = [
  { id: "1", label: "1, 2, 3, …" },
  { id: "dash", label: "- 1 -, - 2 -, - 3 -, …" },
  { id: "a", label: "a, b, c, …" },
  { id: "A", label: "A, B, C, …" },
  { id: "i", label: "i, ii, iii, …" },
  { id: "I", label: "I, II, III, …" },
];
function toAlpha(n: number) { let value = "", remaining = Math.max(1, Math.round(n)); while (remaining > 0) { remaining--; value = String.fromCharCode(65 + (remaining % 26)) + value; remaining = Math.floor(remaining / 26); } return value; }
function toRoman(n: number) { const table: [number, string][] = [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]]; let remaining = Math.max(1, Math.round(n)), value = ""; for (const [amount, symbol] of table) while (remaining >= amount) { value += symbol; remaining -= amount; } return value; }
export function formatPageNumber(n: number, format: string) {
  if (format === "a") return toAlpha(n).toLowerCase();
  if (format === "A") return toAlpha(n);
  if (format === "i") return toRoman(n).toLowerCase();
  if (format === "I") return toRoman(n);
  if (format === "dash") return `- ${n} -`;
  return String(n);
}
export function pageNumberLabel(style: string, number: string) {
  if (style === "pageX") return `Page ${number}`;
  if (style === "accentBar") return `${number} | Page`;
  if (style === "pageOfX") return `Page ${number} of 1`;
  return number;
}

// Symbol button: Word shows the 20 most recently used symbols, starting with these.
export const DEFAULT_SYMBOLS = ["€", "£", "¥", "©", "®", "™", "±", "≠", "≤", "≥", "÷", "×", "∞", "µ", "α", "β", "π", "Ω", "∑", "☺"];

const RECENT_SYMBOLS_KEY = "word-editor-recent-symbols";
export function recentSymbols(): string[] {
  let saved: unknown = [];
  try { saved = JSON.parse(localStorage.getItem(RECENT_SYMBOLS_KEY) ?? "[]"); } catch { saved = []; }
  const list = Array.isArray(saved) ? saved.filter((item): item is string => typeof item === "string" && [...item].length === 1) : [];
  return [...new Set([...list, ...DEFAULT_SYMBOLS])].slice(0, 20);
}
export function rememberSymbol(char: string) {
  try { localStorage.setItem(RECENT_SYMBOLS_KEY, JSON.stringify([char, ...recentSymbols().filter((item) => item !== char)].slice(0, 20))); } catch { /* storage unavailable */ }
}

// Header/Footer > Save Selection to Gallery keeps the student's own designs in this browser.
export const CUSTOM_HEADER_FOOTER_KEY: Record<"header" | "footer", string> = { header: "word-editor-custom-headers", footer: "word-editor-custom-footers" };
export type CustomHeaderFooterStyle = { name: string; preview: string; html: string };
export function loadCustomHeaderFooterStyles(which: "header" | "footer"): CustomHeaderFooterStyle[] {
  try {
    const raw = localStorage.getItem(CUSTOM_HEADER_FOOTER_KEY[which]);
    const value = raw ? JSON.parse(raw) : [];
    return Array.isArray(value) ? value.filter((item): item is CustomHeaderFooterStyle => Boolean(item) && typeof item.name === "string" && typeof item.preview === "string" && typeof item.html === "string").slice(0, 20) : [];
  } catch { return []; }
}

// More Symbols… subsets (Word's "Subset" list) as code-point ranges.
export const SYMBOL_SUBSETS: { name: string; from: number; to: number }[] = [
  { name: "Latin-1 Supplement", from: 0xa1, to: 0xff },
  { name: "Latin Extended-A", from: 0x100, to: 0x17f },
  { name: "Greek and Coptic", from: 0x391, to: 0x3c9 },
  { name: "General Punctuation", from: 0x2010, to: 0x205e },
  { name: "Currency Symbols", from: 0x20a0, to: 0x20bf },
  { name: "Letterlike Symbols", from: 0x2100, to: 0x214f },
  { name: "Number Forms", from: 0x2150, to: 0x218b },
  { name: "Arrows", from: 0x2190, to: 0x21ff },
  { name: "Mathematical Operators", from: 0x2200, to: 0x22ff },
  { name: "Geometric Shapes", from: 0x25a0, to: 0x25ff },
  { name: "Miscellaneous Symbols", from: 0x2600, to: 0x26ff },
  { name: "Dingbats", from: 0x2700, to: 0x27bf },
];
export function symbolsInSubset(name: string) {
  const subset = SYMBOL_SUBSETS.find((item) => item.name === name) ?? SYMBOL_SUBSETS[0];
  const out: string[] = [];
  for (let code = subset.from; code <= subset.to; code++) {
    const char = String.fromCodePoint(code);
    if (/\p{C}|\p{Z}/u.test(char)) continue;
    out.push(char);
  }
  return out;
}

// More Symbols… > Special Characters tab.
export const SPECIAL_CHARACTERS: { name: string; char: string; shortcut: string }[] = [
  { name: "Em Dash", char: "—", shortcut: "Alt+Ctrl+Num -" },
  { name: "En Dash", char: "–", shortcut: "Ctrl+Num -" },
  { name: "Nonbreaking Hyphen", char: "‑", shortcut: "Ctrl+Shift+_" },
  { name: "Em Space", char: " ", shortcut: "" },
  { name: "En Space", char: " ", shortcut: "" },
  { name: "1/4 Em Space", char: " ", shortcut: "" },
  { name: "Nonbreaking Space", char: " ", shortcut: "Ctrl+Shift+Space" },
  { name: "Copyright", char: "©", shortcut: "Alt+Ctrl+C" },
  { name: "Registered", char: "®", shortcut: "Alt+Ctrl+R" },
  { name: "Trademark", char: "™", shortcut: "Alt+Ctrl+T" },
  { name: "Section", char: "§", shortcut: "" },
  { name: "Paragraph", char: "¶", shortcut: "" },
  { name: "Ellipsis", char: "…", shortcut: "Alt+Ctrl+." },
  { name: "Single Opening Quote", char: "‘", shortcut: "Ctrl+`,`" },
  { name: "Single Closing Quote", char: "’", shortcut: "Ctrl+','" },
  { name: "Double Opening Quote", char: "“", shortcut: "Ctrl+`,\"" },
  { name: "Double Closing Quote", char: "”", shortcut: "Ctrl+',\"" },
];

// Date and Time dialog: the "Available formats" list, in Word 2013's order.
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const DATE_LANGUAGES = ["English (United States)", "English (United Kingdom)", "English (India)"] as const;
export function dateTimeFormats(date: Date, language: string = DATE_LANGUAGES[0]) {
  const d = date.getDate(), m = date.getMonth() + 1, y = date.getFullYear(), yy = String(y).slice(-2);
  const month = MONTHS[date.getMonth()], mon = month.slice(0, 3), day = DAYS[date.getDay()];
  const h24 = date.getHours(), h12 = h24 % 12 || 12, mm = String(date.getMinutes()).padStart(2, "0"), ss = String(date.getSeconds()).padStart(2, "0"), ampm = h24 < 12 ? "AM" : "PM";
  const pad = (n: number) => String(n).padStart(2, "0");
  const us = language === "English (United States)";
  const numeric = us ? `${m}/${d}/${y}` : `${pad(d)}/${pad(m)}/${y}`;
  return [
    numeric,
    us ? `${day}, ${month} ${d}, ${y}` : `${day}, ${d} ${month} ${y}`,
    us ? `${month} ${d}, ${y}` : `${d} ${month} ${y}`,
    us ? `${m}/${d}/${yy}` : `${pad(d)}/${pad(m)}/${yy}`,
    `${y}-${pad(m)}-${pad(d)}`,
    `${d}-${mon}-${yy}`,
    us ? `${m}.${d}.${y}` : `${pad(d)}.${pad(m)}.${y}`,
    us ? `${mon}. ${d}, ${yy}` : `${d} ${mon}. ${yy}`,
    `${d} ${month} ${y}`,
    `${month} ${yy}`,
    `${mon}-${yy}`,
    `${numeric} ${h12}:${mm} ${ampm}`,
    `${numeric} ${h12}:${mm}:${ss} ${ampm}`,
    `${h12}:${mm} ${ampm}`,
    `${h12}:${mm}:${ss} ${ampm}`,
    `${pad(h24)}:${mm}`,
    `${pad(h24)}:${mm}:${ss}`,
  ];
}

// Insert > Table > Quick Tables.
export const QUICK_TABLES: { id: string; name: string; rows: string[][] }[] = [
  { id: "tabular", name: "Tabular List", rows: [["ITEM", "NEEDED"], ["Books", "1"], ["Magazines", "3"], ["Notebooks", "1"], ["Paper pads", "1"], ["Pens", "3"]] },
  { id: "subheads", name: "With Subheads", rows: [["College", "New students", "Graduating students", "Change"], ["Undergraduate", "", "", ""], ["Cedar University", "110", "103", "+7"], ["Elm College", "223", "214", "+9"]] },
  { id: "double", name: "Double Table", rows: [["Gas giants", "Diameter", "Moons", "Rocky planets", "Diameter"], ["Jupiter", "142,984 km", "67", "Mercury", "4,879 km"], ["Saturn", "120,536 km", "62", "Venus", "12,104 km"]] },
  { id: "matrix", name: "Matrix", rows: [["City or Town", "Point A", "Point B", "Point C"], ["Point A", "—", "", ""], ["Point B", "87", "—", ""], ["Point C", "64", "56", "—"]] },
];
