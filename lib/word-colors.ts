// Word 2013's colour palette (Office theme): ten theme colours, each with five
// tints/shades below it, then the ten Standard Colors. Shared by the Table
// Tools ribbon and the Borders and Shading dialog.

export type NamedColor = { name: string; hex: string };

export const THEME_BASE: NamedColor[] = [
  { name: "White, Background 1", hex: "FFFFFF" }, { name: "Black, Text 1", hex: "000000" }, { name: "Tan, Background 2", hex: "E7E6E6" }, { name: "Dark Blue, Text 2", hex: "44546A" },
  { name: "Blue, Accent 1", hex: "5B9BD5" }, { name: "Orange, Accent 2", hex: "ED7D31" }, { name: "Gray, Accent 3", hex: "A5A5A5" }, { name: "Gold, Accent 4", hex: "FFC000" },
  { name: "Blue, Accent 5", hex: "4472C4" }, { name: "Green, Accent 6", hex: "70AD47" },
];
export const STANDARD_COLORS: NamedColor[] = [
  { name: "Dark Red", hex: "C00000" }, { name: "Red", hex: "FF0000" }, { name: "Orange", hex: "FFC000" }, { name: "Yellow", hex: "FFFF00" }, { name: "Light Green", hex: "92D050" },
  { name: "Green", hex: "00B050" }, { name: "Light Blue", hex: "00B0F0" }, { name: "Blue", hex: "0070C0" }, { name: "Dark Blue", hex: "002060" }, { name: "Purple", hex: "7030A0" },
];

const hex2 = (value: number) => Math.round(Math.max(0, Math.min(255, value))).toString(16).padStart(2, "0").toUpperCase();
const channels = (hex: string) => [0, 2, 4].map(i => Number.parseInt(hex.slice(i, i + 2), 16));
/** amount > 0 lightens towards white, < 0 darkens towards black (Word's "Lighter 40%" / "Darker 25%"). */
export function shadeColor(hex: string, amount: number) {
  return channels(hex).map(c => hex2(amount >= 0 ? c + (255 - c) * amount : c * (1 + amount))).join("");
}
/** Mixes a pattern colour over a fill at the given strength (Shading > Patterns). */
export function mixColors(fill: string, pattern: string, strength: number) {
  const a = channels(fill), b = channels(pattern);
  return a.map((c, i) => hex2(c * (1 - strength) + b[i] * strength)).join("");
}

const THEME_STEPS = (hex: string): [string, number][] =>
  hex === "FFFFFF" ? [["Darker 5%", -0.05], ["Darker 15%", -0.15], ["Darker 25%", -0.25], ["Darker 35%", -0.35], ["Darker 50%", -0.5]]
    : hex === "000000" ? [["Lighter 50%", 0.5], ["Lighter 35%", 0.35], ["Lighter 25%", 0.25], ["Lighter 15%", 0.15], ["Lighter 5%", 0.05]]
      : hex === "E7E6E6" ? [["Darker 10%", -0.1], ["Darker 25%", -0.25], ["Darker 50%", -0.5], ["Darker 75%", -0.75], ["Darker 90%", -0.9]]
        : [["Lighter 80%", 0.8], ["Lighter 60%", 0.6], ["Lighter 40%", 0.4], ["Darker 25%", -0.25], ["Darker 50%", -0.5]];

/** Row 0 = the theme colours; rows 1-5 = their tints and shades. */
export const THEME_GRID: NamedColor[][] = [THEME_BASE, ...[0, 1, 2, 3, 4].map(step => THEME_BASE.map(color => { const [label, amount] = THEME_STEPS(color.hex)[step]; return { name: `${color.name}, ${label}`, hex: shadeColor(color.hex, amount) }; }))];
export const ALL_WORD_COLORS: NamedColor[] = [...THEME_GRID.flat(), ...STANDARD_COLORS];
export const colorName = (hex: string | null | undefined) => (hex ? ALL_WORD_COLORS.find(color => color.hex === hex.toUpperCase())?.name ?? `#${hex.toUpperCase()}` : null);
