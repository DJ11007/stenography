import { THEME_GRID } from "@/lib/word-colors";

// Excel 2013's theme colours in Office 2013's order (Blue, Accent 1 = 5B9BD5 ... Blue, Accent 5 = 4472C4), each
// with its name as Excel and the Word workspace show it ("Blue, Accent 1, Lighter 80%"). The colour values are
// Excel's own, kept as they were so saved sheets and marking rules still match.
const THEME_HEX = [
  ["FFFFFF", "000000", "E7E6E6", "44546A", "5B9BD5", "ED7D31", "A5A5A5", "FFC000", "4472C4", "70AD47"],
  ["F2F2F2", "7F7F7F", "D0CECE", "D6DCE4", "DEEBF6", "FBE5D5", "EDEDED", "FFF2CC", "D9E2F3", "E2EFD9"],
  ["D8D8D8", "595959", "AEABAB", "ADB9CA", "BDD7EE", "F7CBAC", "DBDBDB", "FFE599", "B4C6E7", "C5E0B3"],
  ["BFBFBF", "3F3F3F", "757070", "8496B0", "9CC3E5", "F4B183", "C9C9C9", "FFD965", "8EAADB", "A8D08D"],
  ["A5A5A5", "262626", "3A3838", "323F4F", "2E75B5", "C55A11", "7B7B7B", "BF9000", "2F5496", "538135"],
  ["7F7F7F", "0C0C0C", "171616", "222A35", "1E4E79", "833C0B", "525252", "7F6000", "1F3864", "375623"],
];
// One more column the admin asked for, after Blue, Accent 1: Red, Accent 2 (Excel's red accent, C0504D) with its
// tints and shades. The ten columns above are unchanged, so saved sheets and marking rules still match.
const RED_ACCENT: { hex: string; name: string }[] = [
  { hex: "C0504D", name: "Red, Accent 2" }, { hex: "F2DCDB", name: "Red, Accent 2, Lighter 80%" }, { hex: "E6B9B8", name: "Red, Accent 2, Lighter 60%" },
  { hex: "D99694", name: "Red, Accent 2, Lighter 40%" }, { hex: "953735", name: "Red, Accent 2, Darker 25%" }, { hex: "632523", name: "Red, Accent 2, Darker 50%" },
];
export const THEME_COLORS: { hex: string; name: string }[][] = THEME_HEX.map((row, r) => {
  const named = row.map((hex, c) => ({ hex, name: THEME_GRID[r][c].name }));
  return [...named.slice(0, 5), RED_ACCENT[r], ...named.slice(5)];
});
export const STANDARD_COLORS: [string, string][] = [["C00000", "Dark Red"], ["FF0000", "Red"], ["FFC000", "Orange"], ["FFFF00", "Yellow"], ["92D050", "Light Green"], ["00B050", "Green"], ["00B0F0", "Light Blue"], ["0070C0", "Blue"], ["002060", "Dark Blue"], ["7030A0", "Purple"]];
