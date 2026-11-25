// Builds new papers for Hindi Word EFFICIENCY TEST 8, TEST 9 and TEST 10 (25 Nov 2026). Like Test 7's new paper
// (build-hindi-word-tests-7-8.mts), every question asks for a Word 2013 tool or option that no other Word Efficiency
// paper uses (Hindi or English, Tests 1-7), and no question repeats across these three papers. The questions come from
// the tabs of the exam: HOME, INSERT, DESIGN, PAGE LAYOUT and TABLE TOOLS (DESIGN and LAYOUT). VIEW is not asked: the
// view, zoom, ruler and gridlines are not saved with the document, so they cannot be marked.
// Each paper has its own practice document (a Kruti Dev Hindi paragraph, English paragraphs set up for the questions,
// a 4-item list, two short lines and a table). Writes tests/fixtures/hindi-word-tests-8-10-v2.json, read by the
// migration builder (build-hindi-word-tests-8-10-v2-migration.mjs), the dev harness (?test=8v2 / 9v2 / 10v2) and
// tests/hindi-word-tests-8-10-v2-rules-runtime.test.mjs.
//   node scripts/build-hindi-word-tests-8-10-v2.mts
import { writeFileSync } from "node:fs";
import { unicodeToKrutiDev } from "../lib/hindi-font-converter.ts";

type Run = { text: string; bold: boolean; italic: boolean; underline: boolean; strike: boolean; color: string | null; highlight: string | null; fontSize: number; fontFamily: string };
const run = (text: string, extra: Partial<Run> = {}): Run => ({ text, bold: false, italic: false, underline: false, strike: false, color: null, highlight: null, fontSize: 12, fontFamily: "Segoe UI", ...extra });
let id = 0;
const paragraph = (runs: Run[], extra: Record<string, unknown> = {}) => ({ id: `matter-p-${++id}`, type: "paragraph", paragraphNumber: id, listGroup: null, runs, alignment: "left", leftIndent: 0, rightIndent: 0, lineSpacing: 1.15, spaceBefore: 0, spaceAfter: 8, ...extra });
const listItem = (text: string) => ({ ...paragraph([run(text)]), type: "list-item", listGroup: "list-1", numbered: false });
const table = (rows: string[][]) => ({ id: `matter-p-${++id}`, type: "table", rows, cellFonts: rows.map((row) => row.map(() => "Segoe UI")), cellSizes: rows.map((row) => row.map(() => 12)) });
type Para = Run[] | { runs: Run[]; extra: Record<string, unknown> };

function matter(hindi: string, english: Para[], list: string[], line1: Run[], line2: Run[], rows: string[][]) {
  id = 0;
  const paragraphs = [
    paragraph([run(unicodeToKrutiDev(hindi), { fontFamily: "Kruti Dev 010", fontSize: 14 })], { alignment: "justify" }),
    ...english.map((item) => (Array.isArray(item) ? paragraph(item) : paragraph(item.runs, item.extra))),
    ...list.map(listItem),
    paragraph(line1),
    paragraph(line2),
    table(rows),
    paragraph([run("")]),
  ];
  return {
    schemaVersion: "1", language: "Hindi", paragraphs, warnings: [],
    formattingSummary: { paragraphs: paragraphs.length, runs: paragraphs.length, italicParagraphs: 0, justifiedParagraphs: 1, listItems: list.length, tables: 1, fonts: ["Kruti Dev 010", "Segoe UI"] },
  };
}

// Body places (how the checks count): 0 Hindi, 1-3 English, 4-7 list, 8 line 1, 9 line 2, 10 table.
type Q = { instruction: string; group: string; criteria: unknown[]; solution: string };
const anyOf = (...criteria: unknown[]) => ({ rule: "anyOf", criteria });
const words = (place: number, props: Record<string, unknown>) => ({ rule: "words", kind: "body", place, props });
const text = (place: number, find: string, extra: Record<string, unknown> = {}) => ({ rule: "text", kind: "body", place, find, ...extra });
const value = (place: number, target: string, spec: unknown) => ({ rule: "value", kind: "body", place, target: `blocks.0.${target}`, spec });
const page = (key: string, spec: unknown) => ({ rule: "value", target: `pageLayout.${key}`, spec });
const tableRule = (extra: Record<string, unknown>) => ({ rule: "table", place: 0, ...extra });
const list = (style: string) => [4, 5, 6, 7].map((place) => value(place, "attrs.listStyle", [style]));

const test8 = {
  title: "EFFICIENCY TEST 8",
  matter: matter(
    "डिजिटल साक्षरता आज हर नागरिक के लिए आवश्यक है। ऑनलाइन फॉर्म भरना, बिल जमा करना और सरकारी योजनाओं की जानकारी लेना अब मोबाइल और कम्प्यूटर से ही होता है। जो विद्यार्थी कम्प्यूटर का नियमित अभ्यास करते हैं, वे परीक्षा में समय पर सभी प्रश्न हल कर लेते हैं।",
    [
      [run("A word processor saves time because a document can be corrected and printed again without typing it from the beginning. Spelling, fonts and spacing can be changed with a single click.")],
      [run("Keyboard shortcuts make the work faster. Ctrl+B makes text bold, Ctrl+I makes it italic and Ctrl+S saves the document on the computer.")],
      [run("PRACTICE DAILY FOR BETTER SPEED. CHECK EVERY ANSWER BEFORE YOU SUBMIT THE PAPER.")],
    ],
    ["Clipboard", "Font", "Paragraph", "Editing"],
    [run("SAMRADHI CLASSES, JAIPUR", { bold: true, color: "0070C0", fontSize: 16 })],
    [run("Computer Efficiency Test 2026")],
    [["S.No.", "Name", "Subject", "Marks"], ["1", "Ramesh", "Hindi", "72"], ["2", "Kiran", "English", "65"], ["3", "Suresh", "Computer", "88"], ["4", "Neha", "Maths", "79"]],
  ),
  questions: [
    { group: "HOME › Clipboard", instruction: "Format Painter से \"SAMRADHI CLASSES, JAIPUR\" लाइन की फॉर्मेटिंग \"Computer Efficiency Test 2026\" लाइन पर लगाइए।",
      criteria: [words(9, { bold: [true], color: ["0070C0"], fontSize: [16] })],
      solution: "1. \"SAMRADHI CLASSES, JAIPUR\" लाइन को सेलेक्ट करें।\n2. HOME → **Format Painter** (ब्रश) पर क्लिक करें।\n3. \"Computer Efficiency Test 2026\" लाइन पर माउस से ड्रैग करके उसे सेलेक्ट करें।\n\nजाँच: दूसरी लाइन भी बोल्ड, नीली, साइज 16।" },
    { group: "HOME › Font", instruction: "चतुर्थ पैराग्राफ (PRACTICE DAILY…) को Change Case से Sentence case कीजिए।",
      criteria: [text(3, "Practice daily for better speed.", { caseSensitive: true }), text(3, "Check every answer before you submit the paper.", { caseSensitive: true })],
      solution: "1. चौथा पैराग्राफ सेलेक्ट करें।\n2. HOME → **Change Case (Aa ▾)** → **Sentence case.**\n\nजाँच: हर वाक्य का पहला अक्षर बड़ा, बाकी छोटे।" },
    { group: "HOME › Font", instruction: "तृतीय पैराग्राफ (Keyboard shortcuts…) को Dotted अंडरलाइन दीजिए।",
      criteria: [words(2, { underline: [true], underlineStyle: ["dotted"] })],
      solution: "1. तीसरा पैराग्राफ सेलेक्ट करें।\n2. HOME → **Underline ▾** → **डॉटेड लाइन (·····)**।\n\nजाँच: पूरे पैराग्राफ के नीचे बिंदुओं वाली लाइन।" },
    { group: "HOME › Paragraph", instruction: "दी गई सूची (Clipboard, Font…) की बुलेट्स को Filled square (■) बुलेट में बदलिए।",
      criteria: list("bullet-square"),
      solution: "1. सूची के चारों आइटम सेलेक्ट करें।\n2. HOME → **Bullets ▾** → **■ Filled square bullets**।\n\nजाँच: चारों आइटम के आगे ■।" },
    { group: "HOME › Paragraph", instruction: "द्वितीय पैराग्राफ (A word processor…) पर केवल Top Border (ऊपर की बॉर्डर) लगाइए।",
      criteria: [value(1, "attrs.border", { regex: "(^|sides:)top$" })],
      solution: "1. दूसरे पैराग्राफ में क्लिक करें।\n2. HOME → **Borders ▾** → **Top Border**।\n\nजाँच: पैराग्राफ के केवल ऊपर एक लाइन।" },
    { group: "INSERT › Header & Footer", instruction: "Page Number → Top of Page → Plain Number 3 (दाईं ओर) लगाइए और Format Page Numbers से फॉर्मेट i, ii, iii कीजिए।",
      criteria: [{ rule: "run", kind: "header", props: { field: { regex: "^page-number\\|top\\|right" }, text: { regex: "^\\s*i\\s*$" } } }],
      solution: "1. INSERT → **Page Number ▾** → **Top of Page** → **Plain Number 3**।\n2. INSERT → **Page Number ▾** → **Format Page Numbers…** → Number format **i, ii, iii, …** → **OK**।\n3. **Close Header and Footer**।\n\nजाँच: हेडर में दाईं ओर पेज नंबर i।" },
    { group: "TABLE TOOLS › LAYOUT", instruction: "टेबल की पहली रो के ऊपर एक नई रो इन्सर्ट (Insert Above) कीजिए, उसके सभी सेल Merge करके उसमें \"RESULT SHEET\" लिखिए।",
      criteria: [tableRule({ rowCount: 6, headerAt: { 0: "RESULT SHEET" }, onlyRow: 0, cellProps: { colspan: [4] } })],
      solution: "1. टेबल की पहली रो (S.No.…) में क्लिक करें।\n2. TABLE TOOLS → **LAYOUT** → **Insert Above**।\n3. नई रो सेलेक्ट करें → LAYOUT → **Merge Cells**।\n4. उसमें **RESULT SHEET** टाइप करें।\n\nजाँच: टेबल के ऊपर एक चौड़ी रो में RESULT SHEET।" },
    { group: "TABLE TOOLS › LAYOUT", instruction: "टेबल को AutoFit → AutoFit Window कीजिए।",
      criteria: [tableRule({ attrs: { tableLayout: ["window"] } })],
      solution: "1. टेबल में क्लिक करें।\n2. TABLE TOOLS → **LAYOUT** → **AutoFit ▾** → **AutoFit Window**।\n\nजाँच: टेबल पूरे पेज की चौड़ाई में।" },
    { group: "TABLE TOOLS › DESIGN", instruction: "टेबल पर Table Style \"Grid Table 6 Colorful - Accent 1\" लगाइए।",
      criteria: [tableRule({ attrs: { tableStyle: ["grid-6-colorful-accent-1"] } })],
      solution: "1. टेबल में क्लिक करें।\n2. TABLE TOOLS → **DESIGN** → Table Styles ▾ → Grid Tables में **Grid Table 6 Colorful - Accent 1**।\n\nजाँच: नीली लाइनों और नीले अक्षरों वाली टेबल।" },
    { group: "TABLE TOOLS › DESIGN", instruction: "Table Style Options में Total Row चालू (✔) कीजिए।",
      criteria: [tableRule({ attrs: { totalRow: [true] } })],
      solution: "1. टेबल में क्लिक करें।\n2. TABLE TOOLS → **DESIGN** → Table Style Options में **Total Row** ✔।\n\nजाँच: टेबल की अंतिम रो अलग (बोल्ड) दिखे।" },
    { group: "DESIGN › Page Background", instruction: "पेज पर Box पेज बॉर्डर दीजिए जो केवल पहले पेज पर हो (Apply to: This section - First page only)।",
      criteria: [page("border", { regex: "apply:s1-first" })],
      solution: "1. DESIGN → **Page Borders**।\n2. Setting **Box** → Apply to **This section - First page only** → **OK**।\n\nजाँच: बॉर्डर केवल पहले पेज पर।" },
    { group: "PAGE LAYOUT › Page Setup", instruction: "पेज का Size Letter कीजिए।",
      criteria: [page("aspectRatio", { regex: "^21\\.59 ?/ ?27\\.94$" })],
      solution: "1. PAGE LAYOUT → **Size ▾** → **Letter** (21.59 cm × 27.94 cm)।\n\nजाँच: पेज Letter साइज़ का।" },
    { group: "PAGE LAYOUT › Page Setup", instruction: "पेज के Margins Mirrored कीजिए।",
      criteria: [page("padding", { regex: "^25\\.4mm 25\\.4mm 25\\.4mm 31\\.8mm$" })],
      solution: "1. PAGE LAYOUT → **Margins ▾** → **Mirrored** (Inside 3.18 cm, Outside 2.54 cm)।\n\nजाँच: अंदर की ओर का मार्जिन थोड़ा चौड़ा।" },
    { group: "INSERT › Pages", instruction: "डॉक्यूमेंट के अंत में (टेबल के बाद) एक Blank Page इन्सर्ट कीजिए।",
      criteria: [anyOf(value(11, "attrs.kind", ["blank-page"]), value(12, "attrs.kind", ["blank-page"]))],
      solution: "1. टेबल के नीचे, डॉक्यूमेंट के अंत में क्लिक करें।\n2. INSERT → **Blank Page**।\n\nजाँच: अंत में एक खाली पेज।" },
    { group: "HOME › Font", instruction: "प्रथम पैराग्राफ (हिंदी) का फॉन्ट कलर Theme Colors से \"Green, Accent 6, Darker 50%\" कीजिए।",
      criteria: [words(0, { color: ["385724"], fontFamily: { regex: "^kruti dev" } })],
      solution: "1. पहला (हिंदी) पैराग्राफ सेलेक्ट करें।\n2. HOME → **Font Color ▾** → Theme Colors में हरे कॉलम का सबसे नीचे वाला रंग **Green, Accent 6, Darker 50%**।\n\nजाँच: पैराग्राफ गहरे हरे रंग में, फॉन्ट Kruti Dev 010 ही रहे।" },
  ] as Q[],
};

const test9 = {
  title: "EFFICIENCY TEST 9",
  matter: matter(
    "राजस्थान कर्मचारी चयन बोर्ड हर वर्ष लिपिक और सहायक पदों के लिए परीक्षा आयोजित करता है। इस परीक्षा में टाइपिंग की गति के साथ कम्प्यूटर दक्षता की भी जाँच होती है। अभ्यर्थी को निर्धारित समय में डॉक्यूमेंट को सही फॉर्मेट में तैयार करना होता है।",
    [
      [run("Microsoft Excel is used for calculations, while Microsoft Word is used for letters, reports and notices. Both programs share the same ribbon, so a student who learns one finds the other easy.")],
      { runs: [run("This paragraph was indented by mistake. A good document keeps the left edge of every paragraph in a straight line unless an indent is really needed.")], extra: { leftIndent: 0.5 } },
      [run("ALWAYS SAVE YOUR WORK BEFORE CLOSING THE PROGRAM.")],
    ],
    ["Excel", "Word", "Access", "PowerPoint"],
    [run("Samradhi Classes"), run(" is a registered training centre")],
    [run("Prepared for RSSB LDC 2026")],
    [["S.No.", "Name", "Marks"], ["1", "Mohan", "45"], ["2", "Seema", "38"], ["3", "Arjun", "42"], ["", "Total", ""]],
  ),
  questions: [
    { group: "HOME › Font", instruction: "चतुर्थ पैराग्राफ (ALWAYS SAVE YOUR WORK…) को Change Case से lowercase कीजिए।",
      criteria: [text(3, "always save your work before closing the program.", { caseSensitive: true })],
      solution: "1. चौथा पैराग्राफ सेलेक्ट करें।\n2. HOME → **Change Case (Aa ▾)** → **lowercase**।\n\nजाँच: सभी अक्षर छोटे।" },
    { group: "HOME › Font", instruction: "\"Samradhi Classes\" शब्दों को Font डायलॉग (Advanced) से Position: Raised, By: 3 pt कीजिए।",
      criteria: [text(8, "Samradhi Classes", { props: { charPosition: [3] } })],
      solution: "1. \"Samradhi Classes\" सेलेक्ट करें।\n2. HOME → Font ग्रुप **↘** (Ctrl+D) → **Advanced** → Position **Raised**, By **3 pt** → **OK**।\n\nजाँच: दोनों शब्द लाइन से थोड़े ऊपर।" },
    { group: "HOME › Font", instruction: "द्वितीय पैराग्राफ (Microsoft Excel is used…) को Dashed अंडरलाइन दीजिए।",
      criteria: [words(1, { underline: [true], underlineStyle: ["dashed"] })],
      solution: "1. दूसरा पैराग्राफ सेलेक्ट करें।\n2. HOME → **Underline ▾** → **डैश लाइन (- - -)**।\n\nजाँच: पैराग्राफ के नीचे डैश वाली लाइन।" },
    { group: "HOME › Paragraph", instruction: "तृतीय पैराग्राफ (This paragraph was indented…) का इंडेंट Decrease Indent से हटाइए।",
      criteria: [value(2, "attrs.marginLeft", { regex: "^(0|0pt|0in|0px|0cm|0mm)$" })],
      solution: "1. तीसरे पैराग्राफ में क्लिक करें।\n2. HOME → **Decrease Indent** (जब तक पैराग्राफ बाएँ किनारे पर न आ जाए)।\n\nजाँच: तीसरा पैराग्राफ बाकी पैराग्राफ की सीध में।" },
    { group: "HOME › Paragraph", instruction: "दी गई सूची (Excel, Word…) की बुलेट्स को Diamond (◆) बुलेट में बदलिए।",
      criteria: list("bullet-diamond"),
      solution: "1. सूची के चारों आइटम सेलेक्ट करें।\n2. HOME → **Bullets ▾** → **◆ Diamond bullets**।\n\nजाँच: चारों आइटम के आगे ◆।" },
    { group: "HOME › Paragraph", instruction: "सूची के आइटम को Sort से Z से A (Descending) क्रम में लगाइए।",
      criteria: [text(4, "Word"), text(5, "PowerPoint"), text(6, "Excel"), text(7, "Access")],
      solution: "1. सूची के चारों आइटम सेलेक्ट करें।\n2. HOME → **Sort (A↓Z)** → **Descending** → **Apply** (MS Word में: Sort by **Paragraphs**, Type **Text**, **Descending** → **OK**)।\n\nजाँच: क्रम Word, PowerPoint, Excel, Access।" },
    { group: "INSERT › Header & Footer", instruction: "Page Number → Bottom of Page → \"Page X of Y\" (फूटर के बीच में \"Page 1 of 1\") लगाइए।",
      criteria: [{ rule: "run", kind: "footer", props: { field: { regex: "^page-number\\|bottom\\|center" }, text: { regex: "page\\s*\\d+\\s*of\\s*\\d+" } } }],
      solution: "1. INSERT → **Page Number ▾** → **Bottom of Page** → **Page X of Y**।\n2. **Close Header and Footer**।\n\nजाँच: फूटर के बीच में \"Page 1 of 1\"।" },
    { group: "TABLE TOOLS › LAYOUT", instruction: "टेबल की हेडिंग रो (S.No., Name, Marks) का Text Direction बदलकर टेक्स्ट को ऊपर से नीचे (Rotate 90°) कीजिए।",
      criteria: [tableRule({ onlyRow: 0, cellProps: { textDirection: { regex: "^(down|up)$" } } })],
      solution: "1. टेबल की पहली रो सेलेक्ट करें।\n2. TABLE TOOLS → **LAYOUT** → **Text Direction** (एक बार)।\n\nजाँच: हेडिंग के शब्द खड़े (ऊपर से नीचे)।" },
    { group: "TABLE TOOLS › LAYOUT", instruction: "टेबल की Total रो के Marks सेल में Formula =SUM(ABOVE) लगाइए।",
      criteria: [value(10, "attrs.rows.4.2", { regex: "^\\s*125(\\.0+)?\\s*$" })],
      solution: "1. Total रो के Marks वाले खाली सेल में क्लिक करें।\n2. TABLE TOOLS → **LAYOUT** → **Formula (fx)** → **=SUM(ABOVE)** → **OK**।\n\nजाँच: सेल में 125।" },
    { group: "TABLE TOOLS › LAYOUT", instruction: "टेबल के Cell Margins (Default cell margins) में Left एवं Right 0.5 cm कीजिए।",
      criteria: [tableRule({ attrs: { cellMarginLeft: [0.5], cellMarginRight: [0.5] } })],
      solution: "1. टेबल में क्लिक करें।\n2. TABLE TOOLS → **LAYOUT** → **Cell Margins** → Left **0.5 cm**, Right **0.5 cm** → **OK**।\n\nजाँच: सेल के अंदर टेक्स्ट किनारे से ज़्यादा दूर।" },
    { group: "TABLE TOOLS › DESIGN", instruction: "टेबल पर Table Style \"List Table 3 - Accent 1\" लगाइए।",
      criteria: [tableRule({ attrs: { tableStyle: ["list-3-accent-1"] } })],
      solution: "1. टेबल में क्लिक करें।\n2. TABLE TOOLS → **DESIGN** → Table Styles ▾ → List Tables में **List Table 3 - Accent 1**।\n\nजाँच: नीली हेडिंग रो और नीली बाहरी लाइन।" },
    { group: "DESIGN › Page Background", instruction: "Custom Watermark में Text \"SCTyping\" लिखकर Layout Horizontal कीजिए।",
      criteria: [page("watermark", { regex: "^\\s*sctyping\\s*$" }), page("watermarkLayout", ["horizontal"])],
      solution: "1. DESIGN → **Watermark ▾** → **Custom Watermark…**।\n2. **Text watermark** → Text **SCTyping** → Layout **Horizontal** → **OK**।\n\nजाँच: पेज के बीच में सीधा (आड़ा नहीं) वाटरमार्क।" },
    { group: "PAGE LAYOUT › Page Setup", instruction: "पूरे डॉक्यूमेंट को Three कॉलम (Columns) में कीजिए।",
      criteria: [page("columnCount", ["3", 3])],
      solution: "1. PAGE LAYOUT → **Columns ▾** → **Three**।\n\nजाँच: टेक्स्ट तीन कॉलम में।" },
    { group: "PAGE LAYOUT › Page Setup", instruction: "पेज के Margins \"Office 2003 Default\" कीजिए।",
      criteria: [page("padding", { regex: "^25\\.4mm 31\\.8mm 25\\.4mm 31\\.8mm$" })],
      solution: "1. PAGE LAYOUT → **Margins ▾** → **Office 2003 Default** (Left/Right 3.18 cm)।\n\nजाँच: बाएँ-दाएँ मार्जिन 3.18 cm।" },
    { group: "PAGE LAYOUT › Page Setup", instruction: "पेज का Size B5 (JIS) कीजिए।",
      criteria: [page("aspectRatio", { regex: "^18\\.2 ?/ ?25\\.7$" })],
      solution: "1. PAGE LAYOUT → **Size ▾** → **B5 (JIS)** (18.2 cm × 25.7 cm)।\n\nजाँच: पेज छोटा B5 साइज़ का।" },
  ] as Q[],
};

const test10 = {
  title: "EFFICIENCY TEST 10",
  matter: matter(
    "पर्यावरण की रक्षा करना हम सभी का कर्तव्य है। पेड़ लगाने, पानी बचाने और प्लास्टिक का कम उपयोग करने से हम आने वाली पीढ़ियों को स्वच्छ हवा और साफ पानी दे सकते हैं। विद्यालयों में भी बच्चों को प्रकृति से प्रेम करना सिखाया जाता है।",
    [
      [run("Every year on 5 June we celebrate "), run("World Environment Day", { highlight: "FFFF00" }), run(" to remind people that clean air and water are not free gifts.")],
      [run("Trees give us oxygen, fruit and shade. A single tree can absorb a large amount of carbon dioxide during its life, so planting trees is one of the easiest ways to fight pollution.")],
      [run("Students can help by switching off fans and lights when they leave a room, by carrying a cloth bag to the market and by using both sides of a sheet of paper.")],
    ],
    ["Plant trees", "Save water", "Reduce plastic", "Recycle paper"],
    [run("Green Earth, Clean Earth")],
    [run("save energy, save money")],
    [["Name", "City", "Trees"], ["Aman", "Jaipur", "12"], ["Rita", "Kota", "9"], ["Vikas", "Ajmer", "15"]],
  ),
  questions: [
    { group: "HOME › Font", instruction: "\"Green Earth, Clean Earth\" लाइन को Font डायलॉग (Advanced) से Character Scale 150% कीजिए।",
      criteria: [words(8, { charScale: [150] })],
      solution: "1. \"Green Earth, Clean Earth\" लाइन सेलेक्ट करें।\n2. HOME → Font ग्रुप **↘** (Ctrl+D) → **Advanced** → Scale **150%** → **OK**।\n\nजाँच: अक्षर चौड़े दिखें।" },
    { group: "HOME › Font", instruction: "द्वितीय पैराग्राफ में \"World Environment Day\" से पीला हाइलाइट हटाइए (Text Highlight Color → No Color)।",
      criteria: [text(1, "World Environment Day", { props: { highlight: [null, "", "transparent"] } })],
      solution: "1. \"World Environment Day\" सेलेक्ट करें।\n2. HOME → **Text Highlight Color ▾** → **No Color**।\n\nजाँच: शब्दों के पीछे पीला रंग नहीं रहे।" },
    { group: "HOME › Font", instruction: "\"save energy, save money\" लाइन को Font डायलॉग से All caps इफेक्ट दीजिए।",
      criteria: [words(9, { allCaps: [true] })],
      solution: "1. \"save energy, save money\" लाइन सेलेक्ट करें।\n2. HOME → Font ग्रुप **↘** (Ctrl+D) → Effects में **All caps** ✔ → **OK**।\n\nजाँच: लाइन बड़े अक्षरों में दिखे।" },
    { group: "HOME › Paragraph", instruction: "दी गई सूची (Plant trees…) को नंबरिंग i. ii. iii. में बदलिए।",
      criteria: list("lower-roman"),
      solution: "1. सूची के चारों आइटम सेलेक्ट करें।\n2. HOME → **Numbering ▾** → **i. ii. iii.**।\n\nजाँच: सूची i. से iv. तक।" },
    { group: "HOME › Paragraph", instruction: "चतुर्थ पैराग्राफ (Students can help…) की लाइन स्पेसिंग 3.0 कीजिए।",
      criteria: [value(3, "attrs.lineHeight", { regex: "^3(\\.0+)?$" })],
      solution: "1. चौथे पैराग्राफ में क्लिक करें।\n2. HOME → **Line and Paragraph Spacing ▾** → **3.0**।\n\nजाँच: लाइनों के बीच तीन गुना जगह।" },
    { group: "INSERT › Header & Footer", instruction: "Footer → Blank (Three Columns) लगाकर तीनों जगह क्रम से \"Samradhi\", \"Jaipur\" एवं \"2026\" लिखिए।",
      criteria: [{ rule: "text", kind: "footer", find: "Samradhi" }, { rule: "text", kind: "footer", find: "Jaipur" }, { rule: "text", kind: "footer", find: "2026" }],
      solution: "1. INSERT → **Footer ▾** → **Blank (Three Columns)**।\n2. तीनों [Type here] में क्रम से **Samradhi**, **Jaipur**, **2026** टाइप करें।\n3. **Close Header and Footer**।\n\nजाँच: फूटर में बाएँ, बीच और दाएँ तीनों शब्द।" },
    { group: "TABLE TOOLS › LAYOUT", instruction: "टेबल के पहले कॉलम (Name) के बाईं ओर Insert Left से नया कॉलम लगाकर उसकी हेडिंग \"Sr.\" लिखिए।",
      criteria: [tableRule({ columns: 4, headerAt: { 0: "Sr.", 1: "Name" } })],
      solution: "1. \"Name\" कॉलम में क्लिक करें।\n2. TABLE TOOLS → **LAYOUT** → **Insert Left**।\n3. नए कॉलम की पहली सेल में **Sr.** टाइप करें।\n\nजाँच: टेबल में Sr., Name, City, Trees।" },
    { group: "TABLE TOOLS › LAYOUT", instruction: "टेबल की पहली रो (हेडिंग) की Height 1 cm कीजिए।",
      criteria: [value(10, "attrs.rowHeights.0", { regex: "^1(\\.0+)?$" })],
      solution: "1. टेबल की पहली रो में क्लिक करें।\n2. TABLE TOOLS → **LAYOUT** → Cell Size में **Height: 1 cm** टाइप करके Enter।\n\nजाँच: हेडिंग रो बाकी रो से ऊँची।" },
    { group: "TABLE TOOLS › LAYOUT", instruction: "टेबल के सभी कॉलम Distribute Columns से बराबर चौड़ाई के कीजिए।",
      // Distribute Columns writes the same width for every column (its value depends on the page size and margins).
      criteria: [0, 1, 2].map((column) => value(10, `attrs.colWidths.${column}`, { regex: "^[0-9.]+$" })),
      solution: "1. टेबल में क्लिक करें।\n2. TABLE TOOLS → **LAYOUT** → **Distribute Columns**।\n\nजाँच: सभी कॉलम बराबर चौड़े।" },
    { group: "TABLE TOOLS › DESIGN", instruction: "टेबल पर Table Style \"Plain Table 4\" लगाइए।",
      criteria: [tableRule({ attrs: { tableStyle: ["plain-4"] } })],
      solution: "1. टेबल में क्लिक करें।\n2. TABLE TOOLS → **DESIGN** → Table Styles ▾ → Plain Tables में **Plain Table 4**।\n\nजाँच: बिना लाइनों वाली, धारीदार रो वाली टेबल।" },
    { group: "TABLE TOOLS › DESIGN", instruction: "Table Style Options में Banded Columns चालू (✔) कीजिए।",
      criteria: [tableRule({ attrs: { bandedColumns: [true] } })],
      solution: "1. टेबल में क्लिक करें।\n2. TABLE TOOLS → **DESIGN** → Table Style Options में **Banded Columns** ✔।\n\nजाँच: कॉलम एक के बाद एक हल्के रंग में।" },
    { group: "TABLE TOOLS › DESIGN", instruction: "टेबल के सभी सेल पर Pen Color Red से All Borders लगाइए।",
      criteria: [tableRule({ cellProps: { borderTop: { regex: "FF0000" }, borderBottom: { regex: "FF0000" }, borderLeft: { regex: "FF0000" }, borderRight: { regex: "FF0000" } } })],
      solution: "1. पूरी टेबल सेलेक्ट करें।\n2. TABLE TOOLS → **DESIGN** → **Pen Color ▾** → **Red**।\n3. **Borders ▾** → **All Borders**।\n\nजाँच: टेबल की सभी लाइनें लाल।" },
    { group: "DESIGN › Page Background", instruction: "पेज का Page Color Theme Colors से \"Blue, Accent 1, Lighter 80%\" कीजिए।",
      criteria: [page("backgroundColor", { regex: "(DEEBF7|rgb\\(222, ?235, ?247\\))" })],
      solution: "1. DESIGN → **Page Color ▾** → Theme Colors में नीले कॉलम का पहला हल्का रंग **Blue, Accent 1, Lighter 80%**।\n\nजाँच: पेज हल्के नीले रंग का।" },
    { group: "PAGE LAYOUT › Page Setup", instruction: "पेज का Size Statement कीजिए।",
      criteria: [page("aspectRatio", { regex: "^13\\.97 ?/ ?21\\.59$" })],
      solution: "1. PAGE LAYOUT → **Size ▾** → **Statement** (13.97 cm × 21.59 cm)।\n\nजाँच: पेज छोटा Statement साइज़ का।" },
    { group: "PAGE LAYOUT › Paragraph", instruction: "PAGE LAYOUT टैब के Paragraph ग्रुप से तृतीय पैराग्राफ (Trees give us…) में Spacing After 18 pt दीजिए।",
      criteria: [value(2, "attrs.marginBottom", { regex: "^18(\\.0+)?(pt)?$" })],
      solution: "1. तीसरे पैराग्राफ में क्लिक करें।\n2. PAGE LAYOUT → Paragraph ग्रुप → Spacing **After: 18 pt**।\n\nजाँच: तीसरे पैराग्राफ के नीचे ज़्यादा जगह।" },
  ] as Q[],
};

for (const test of [test8, test9, test10]) if (test.questions.length !== 15) throw new Error(`${test.title}: ${test.questions.length} questions`);
writeFileSync("tests/fixtures/hindi-word-tests-8-10-v2.json", JSON.stringify({ tests: [test8, test9, test10] }, null, 1));
console.log([test8, test9, test10].map((t) => t.questions.length).join(" "));
