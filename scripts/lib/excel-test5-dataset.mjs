// The exact 200-employee dataset used by EXCEL EFFICIENCY TEST 5 (scripts/build-excel-test5.mjs), extracted so
// TEST 5 version 2 (scripts/build-excel-test5-v2.mjs) and the new TEST 9 (scripts/build-excel-test9.mjs) can share
// the identical practice data byte-for-byte (same seed, same generation order) -- "practice test paper can same
// in both", the same convention used for TEST 4 / TEST 8. Do not change this file: both tests, and the original
// TEST 5 migration, depend on this exact output.
import { dateToSerial } from "../../lib/excel-formula.ts";

let seed = 20261109;
const rand = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const pick = (list) => list[Math.floor(rand() * list.length)];
const between = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));

const MEN = ["ramesh", "mahendra", "vikram", "deepak", "manish", "lokesh", "naresh", "kamlesh", "ankit", "sandeep", "mukesh", "ashok", "gopal", "harish", "dinesh", "yogesh", "rajendra", "vinod"];
const WOMEN = ["sunita", "kavita", "pooja", "rekha", "anjali", "seema", "priya", "neha", "mamta", "jyoti", "payal", "komal", "nisha", "suman", "ritu", "lalita", "aarti", "monika"];
const MIDDLE_MEN = ["", "", "", "kumar", "lal", "prasad", "singh"], MIDDLE_WOMEN = ["", "", "", "devi", "kumari", "kanwar"];
const SURNAMES = ["sharma", "meena", "choudhary", "saini", "jat", "gurjar", "bairwa", "rathore", "shekhawat", "agarwal", "kumawat", "yadav", "prajapat", "swami", "mali", "verma", "joshi", "soni", "bishnoi", "jangid", "regar", "parihar"];
const DEPARTMENTS = ["Revenue", "Revenue", "Education", "Education", "Education", "Health", "Health", "Police", "Finance", "Panchayati Raj"];
const POSTS = [["LDC", 20800, 26000], ["LDC", 20800, 26000], ["LDC", 20800, 26000], ["UDC", 26500, 33800], ["UDC", 26500, 33800], ["Junior Assistant", 24000, 30000], ["Senior Assistant", 33800, 42000], ["Accountant", 35400, 45000], ["Peon", 17700, 19900], ["Driver", 19900, 23500]];
const messy = (word) => [...word].map((ch) => (rand() < 0.35 ? ch.toUpperCase() : ch)).join("");

export const EMPLOYEES = 200;
export const employees = [];
for (let i = 0; i < EMPLOYEES; i++) {
  const woman = rand() < 0.45, middle = pick(woman ? MIDDLE_WOMEN : MIDDLE_MEN);
  const parts = [pick(woman ? WOMEN : MEN), ...(middle ? [middle] : []), pick(SURNAMES)].map(messy);
  const name = (rand() < 0.3 ? " " : "") + parts.join(rand() < 0.35 ? "  " : " ") + (rand() < 0.3 ? "  " : "");
  const [post, lo, hi] = pick(POSTS);
  const joined = Math.floor(dateToSerial(new Date(between(2005, 2025), between(0, 11), between(1, 28))));
  const mobile = rand() < 0.07 ? null : Number(`${pick(["6", "7", "8", "9"])}${String(between(0, 999999999)).padStart(9, "0")}`);
  employees.push([`RJ26${String(i + 1).padStart(3, "0")}`, name, pick(DEPARTMENTS), post, joined, Math.round(between(lo, hi) / 100) * 100, mobile]);
}
// worked example rows the solutions talk about (identical to TEST 5's own rows)
employees[0] = ["RJ26001", "  rAMESH  kumar SHARMA ", "Revenue", "LDC", Math.floor(dateToSerial(new Date(2018, 6, 16))), 24500, 9414012345];
employees[1] = ["RJ26002", "sunita devi meena", "Education", "Peon", Math.floor(dateToSerial(new Date(2012, 2, 1))), 18600, null];
employees[149] = ["RJ26150", "KAVITA  jangid", "Health", "UDC", Math.floor(dateToSerial(new Date(2016, 9, 3))), 31200, 9828098280];
employees[87] = ["RJ26088", " mahendra singh RATHORE", "Finance", "Accountant", Math.floor(dateToSerial(new Date(2006, 3, 12))), 47500, 9461100088];

export const ALLOWANCES = [["LDC", 2000], ["UDC", 2500], ["Junior Assistant", 3000], ["Senior Assistant", 3500], ["Accountant", 4000]];
export const LAST = EMPLOYEES + 1; // 201
export const col = (i) => String.fromCharCode(65 + i);
export const plain = (value, formula = null, extra = {}) => ({ value, formula, bold: false, italic: false, underline: false, fontColor: null, fillColor: null, border: null, numberFormat: "General", align: null, ...extra });
export const letters = (a, b) => Array.from({ length: b.charCodeAt(0) - a.charCodeAt(0) + 1 }, (_, i) => String.fromCharCode(a.charCodeAt(0) + i));
