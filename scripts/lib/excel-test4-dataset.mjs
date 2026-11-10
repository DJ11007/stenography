// The exact 200-student dataset used by EXCEL EFFICIENCY TEST 4 (scripts/build-excel-test4.mjs), extracted so
// TEST 4 version 2 (scripts/build-excel-test4-v2.mjs) and the new TEST 8 (scripts/build-excel-test8.mjs) can share
// the identical practice data byte-for-byte (same seed, same generation order) -- "practice test paper can same
// in both". Do not change this file: both tests, and the original TEST 4 migration, depend on this exact output.
let seed = 20261108;
const rand = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const pick = (list) => list[Math.floor(rand() * list.length)];
const normal = () => { let s = 0; for (let i = 0; i < 6; i++) s += rand(); return (s - 3) / Math.sqrt(0.5); };

const BOYS = ["Aarav", "Rohit", "Mahendra", "Sunil", "Vikram", "Deepak", "Rakesh", "Manish", "Lokesh", "Hemant", "Naresh", "Kamlesh", "Ankit", "Sandeep", "Ramesh", "Jitendra", "Mukesh", "Pankaj", "Ashok", "Gopal", "Bhanu", "Harish", "Kuldeep", "Dinesh", "Yogesh", "Rajendra", "Shyam", "Vinod", "Tarun", "Pradeep"];
const GIRLS = ["Pooja", "Priya", "Sunita", "Kavita", "Neha", "Anjali", "Rekha", "Mamta", "Seema", "Kiran", "Sapna", "Monika", "Jyoti", "Payal", "Shalini", "Komal", "Manisha", "Pinki", "Suman", "Ritu", "Deepika", "Nisha", "Vandana", "Lalita", "Aarti"];
const SURNAMES = ["Sharma", "Meena", "Choudhary", "Saini", "Jat", "Gurjar", "Bairwa", "Rathore", "Shekhawat", "Agarwal", "Kumawat", "Yadav", "Prajapat", "Swami", "Mali", "Verma", "Joshi", "Soni", "Bishnoi", "Khandelwal", "Jangid", "Dadhich", "Regar", "Parihar"];
const DISTRICTS = ["Jaipur", "Jaipur", "Jaipur", "Jodhpur", "Jodhpur", "Ajmer", "Kota", "Kota", "Bikaner", "Udaipur", "Alwar", "Sikar", "Bharatpur", "Tonk"];
const CATEGORIES = ["GEN", "GEN", "OBC", "OBC", "OBC", "SC", "ST", "EWS", "MBC"];
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, Math.round(x)));

export const STUDENTS = 200;
export const students = [];
for (let i = 0; i < STUDENTS; i++) {
  const girl = rand() < 0.42;
  const name = `${pick(girl ? GIRLS : BOYS)} ${pick(SURNAMES)}`;
  const ability = 55 + 15 * normal();
  const subject = (bias) => clamp(ability + bias + 11 * normal(), 8, 99);
  const english = rand() < 0.045 ? "AB" : subject(-6);
  students.push([1001 + i, name, girl ? "F" : "M", pick(DISTRICTS), pick(CATEGORIES), subject(4), english, subject(2), subject(-2), clamp(28 + 8 * normal(), 12, 52)]);
}
// a few memorable rows near the top, so the paper's worked example is real (identical to TEST 4's own rows)
students[0] = [1001, "Rajnish Sharma", "M", "Jaipur", "GEN", 78, 64, 91, 70, 38];
students[1] = [1002, "Pooja Meena", "F", "Jodhpur", "ST", 92, "AB", 66, 58, 27];
students[2] = [1003, "Kamlesh Saini", "M", "Kota", "OBC", 31, 40, 35, 29, 22];

export const LAST = STUDENTS + 1; // 201
export const col = (i) => String.fromCharCode(65 + i);
export const plain = (value, formula = null, extra = {}) => ({ value, formula, bold: false, italic: false, underline: false, fontColor: null, fillColor: null, border: null, numberFormat: "General", align: null, ...extra });
export const letters = (a, b) => Array.from({ length: b.charCodeAt(0) - a.charCodeAt(0) + 1 }, (_, i) => String.fromCharCode(a.charCodeAt(0) + i));
