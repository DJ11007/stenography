// Builds Hindi Word EFFICIENCY TEST 7 and TEST 8 (7 Nov 2026): the practice document (a Kruti Dev Hindi paragraph,
// three English paragraphs, a 4-item list, two short lines and a table at the end), 15 questions each over the groups
// the admin chose (HOME Font / Paragraph / Editing, INSERT Pages / Table / Header & Footer / Symbols, DESIGN Page
// Background, PAGE LAYOUT Page Setup), their hand-written marking checks and Hindi paper solutions.
// Test 7's questions were replaced on 24 Nov 2026 by a paper whose every question uses a tool no other Word paper asks
// for (migration built by build-hindi-word-test7-v2-migration.mjs); Test 8 is unchanged.
// Writes tests/fixtures/hindi-word-tests-7-8.json (read by the migration builders and the harness).
//   node scripts/build-hindi-word-tests-7-8.mts
import { writeFileSync } from "node:fs";
import { unicodeToKrutiDev } from "../lib/hindi-font-converter.ts";

type Run = { text: string; bold: boolean; italic: boolean; underline: boolean; strike: boolean; color: string | null; highlight: string | null; fontSize: number; fontFamily: string };
const run = (text: string, fontFamily = "Segoe UI", fontSize = 12): Run => ({ text, bold: false, italic: false, underline: false, strike: false, color: null, highlight: null, fontSize, fontFamily });
let id = 0;
const paragraph = (runs: Run[], extra: Record<string, unknown> = {}) => ({ id: `matter-p-${++id}`, type: "paragraph", paragraphNumber: id, listGroup: null, runs, alignment: "left", leftIndent: 0, rightIndent: 0, lineSpacing: 1.15, spaceBefore: 0, spaceAfter: 8, ...extra });
const listItem = (text: string, group: string, numbered: boolean) => ({ ...paragraph([run(text)]), type: "list-item", listGroup: group, numbered });
const table = (rows: string[][]) => ({ id: `matter-p-${++id}`, type: "table", rows, cellFonts: rows.map((row) => row.map(() => "Segoe UI")), cellSizes: rows.map((row) => row.map(() => 12)) });

function matter(hindi: string, english: string[], list: string[], numbered: boolean, line1: string, line2: string, rows: string[][]) {
  id = 0;
  const paragraphs = [
    paragraph([run(unicodeToKrutiDev(hindi), "Kruti Dev 010", 14)], { alignment: "justify" }),
    ...english.map((text) => paragraph([run(text)])),
    ...list.map((text) => listItem(text, "list-1", numbered)),
    paragraph([run(line1)]),
    paragraph([run(line2)]),
    table(rows),
    // As in Word, an empty paragraph after the table: somewhere to click to insert after it (not counted by the checks).
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
const value = (place: number, target: string, spec: unknown) => ({ rule: "value", kind: "body", place, target: `blocks.0.${target}`, spec });
const page = (key: string, spec: unknown) => ({ rule: "value", target: `pageLayout.${key}`, spec });
const pageBreakBeforeTable = { rule: "value", kind: "body", place: 10, target: "blocks.0.type", spec: ["page-break"] };

const test7 = {
  title: "EFFICIENCY TEST 7",
  matter: matter(
    "कम्प्यूटर आज हमारे जीवन का एक महत्वपूर्ण अंग बन गया है। बैंक, रेलवे, अस्पताल और सरकारी कार्यालयों में अधिकतर काम कम्प्यूटर की सहायता से तेज़ी से किए जाते हैं। राजस्थान कर्मचारी चयन बोर्ड की परीक्षाओं में भी कम्प्यूटर का ज्ञान आवश्यक है। जो अभ्यर्थी नियमित अभ्यास करते हैं, वे टाइपिंग और दक्षता परीक्षा में अच्छे अंक प्राप्त करते हैं।",
    [
      "Microsoft Word is a word processing program that helps you create a professional document in a short time. You can type text, format it, insert pictures and tables, and save your document on the computer or in the cloud. A well formatted document is easy to read and looks attractive.",
      "Typing speed and accuracy are both important in an efficiency test. Read every question carefully, select the correct text and use the right option from the ribbon. Do not press Enter at the end of every line, because Word moves the text to the next line by itself.",
      "The Home tab contains the most used commands of Word, such as the Font, Paragraph and Editing groups. The Insert tab is used to add pages, tables, headers, footers and symbols to a document.",
    ],
    ["Home Tab", "Insert Tab", "Design Tab", "Page Layout Tab"], false,
    "Einstein's famous formula is E = mc2",
    "Samradhi Classes, Jaipur",
    [["S.No.", "Name", "City", "Marks"], ["1", "Rakesh", "Jaipur", "68"], ["2", "Sunita", "Ajmer", "82"], ["3", "Mahesh", "Kota", "55"], ["4", "Pooja", "Bikaner", "91"], ["5", "Anil", "Udaipur", "74"]],
  ),
  // New paper (24 Nov 2026): every question uses a Word 2013 tool that no other Word Efficiency paper (Hindi or
  // English, Tests 1-8) asks for. Body places shift after Q15's section break, so the table checks use the table rule.
  questions: [
    { group: "HOME › Font", instruction: "प्रथम पैराग्राफ (हिंदी) का फॉन्ट साइज Grow Font (A↑) बटन से दो बार बढ़ाइए (14 से 18)।",
      criteria: [words(0, { fontSize: [18], fontFamily: { regex: "^kruti dev" } })],
      solution: "1. पहला (हिंदी) पैराग्राफ सेलेक्ट करें।\n2. HOME → **Grow Font (A↑)** दो बार दबाएँ (Ctrl+Shift+>)। साइज 14 → 16 → **18**।\n\nजाँच: पहला पैराग्राफ साइज 18, फॉन्ट Kruti Dev 010 ही रहे।" },
    { group: "HOME › Font", instruction: "चतुर्थ पैराग्राफ (The Home tab contains…) को Font डायलॉग से Small caps इफेक्ट दीजिए।",
      criteria: [words(3, { smallCaps: [true] })],
      solution: "1. चौथा पैराग्राफ (\"The Home tab contains…\") सेलेक्ट करें।\n2. HOME → Font ग्रुप **↘** (Ctrl+D) → Effects में **Small caps** ✔ → **OK**।\n\nजाँच: छोटे अक्षर छोटे कैपिटल अक्षरों में दिखें।" },
    { group: "HOME › Font", instruction: "\"Einstein's famous formula is E = mc2\" लाइन को Font डायलॉग से Hidden (छिपा हुआ) कीजिए।",
      criteria: [words(8, { hidden: [true] })],
      solution: "1. \"Einstein's famous formula is E = mc2\" लाइन सेलेक्ट करें।\n2. HOME → Font ग्रुप **↘** (Ctrl+D) → Effects में **Hidden** ✔ → **OK**।\n\nजाँच: लाइन पेज पर दिखनी बंद हो जाए (¶ Show/Hide चालू करने पर डॉटेड अंडरलाइन के साथ दिखेगी)।" },
    { group: "HOME › Paragraph", instruction: "द्वितीय पैराग्राफ (Microsoft Word is…) के ऊपर Spacing Before 24 pt दीजिए।",
      criteria: [value(1, "attrs.marginTop", { regex: "^24(\\.0+)?(pt)?$" })],
      solution: "1. दूसरे पैराग्राफ में क्लिक करें।\n2. HOME → Paragraph ग्रुप **↘** → Spacing **Before: 24 pt** → **OK** (या PAGE LAYOUT → Spacing Before **24 pt**)।\n\nजाँच: दूसरे पैराग्राफ के ऊपर ज़्यादा जगह।" },
    { group: "HOME › Paragraph", instruction: "दी गई सूची (Home Tab, Insert Tab…) की बुलेट्स को Bullet Library के Checkmark (✓) बुलेट में बदलिए।",
      criteria: [4, 5, 6, 7].map((place) => value(place, "attrs.listStyle", ["bullet-check"])),
      solution: "1. सूची के चारों आइटम सेलेक्ट करें।\n2. HOME → **Bullets ▾** → Bullet Library में **✓ (Checkmark)**।\n\nजाँच: चारों आइटम के आगे ✓।" },
    { group: "INSERT › Table", instruction: "टेबल पर Table Style \"Grid Table 4 - Accent 1\" लगाइए।",
      criteria: [{ rule: "table", place: 0, attrs: { tableStyle: ["grid-4-accent-1"] } }],
      solution: "1. टेबल में क्लिक करें।\n2. TABLE TOOLS → **DESIGN** → Table Styles ▾ → Grid Tables में **Grid Table 4 - Accent 1** (नीली हेडिंग वाली)।\n\nजाँच: टेबल की पहली रो नीली, बाकी रो धारीदार।" },
    { group: "INSERT › Table", instruction: "टेबल को Table Properties से पेज के बीच में (Alignment: Center) कीजिए।",
      criteria: [{ rule: "table", place: 0, attrs: { tableAlign: ["center"] } }],
      solution: "1. टेबल में क्लिक करें।\n2. TABLE TOOLS → **LAYOUT** → **Properties** → **Table** टैब → Alignment **Center** → **OK**।\n\nजाँच: पूरी टेबल पेज के बीच में।" },
    { group: "INSERT › Table", instruction: "टेबल का \"City\" कॉलम डिलीट कीजिए।",
      criteria: [{ rule: "table", place: 0, columns: 3, headerAt: { 0: "S.No.", 1: "Name", 2: "Marks" } }],
      solution: "1. टेबल के \"City\" कॉलम के किसी सेल में क्लिक करें।\n2. TABLE TOOLS → **LAYOUT** → **Delete ▾** → **Delete Columns**।\n\nजाँच: टेबल में S.No., Name, Marks — तीन कॉलम।" },
    { group: "INSERT › Table", instruction: "टेबल की पहली रो को Repeat Header Rows कीजिए, ताकि वह हर पेज पर दोहराई जाए।",
      criteria: [{ rule: "table", place: 0, attrs: { repeatHeader: [true] } }],
      solution: "1. टेबल की पहली रो (S.No., Name…) में क्लिक करें।\n2. TABLE TOOLS → **LAYOUT** → Data ग्रुप में **Repeat Header Rows**।\n\nजाँच: Repeat Header Rows बटन चालू दिखे।" },
    { group: "DESIGN › Page Background", instruction: "पेज पर Box पेज बॉर्डर (Dotted लाइन, कलर Green) दीजिए और Options में Measure from: Text कीजिए।",
      criteria: [page("border", { regex: "^(?!.*sides:)\\S+ dotted (#00B050|rgb\\(0, ?176, ?80\\)).* measure:text" })],
      solution: "1. DESIGN → **Page Borders**।\n2. Setting **Box**, Style **डॉटेड लाइन (·····)**, Color **Green**।\n3. **Options…** → Measure from **Text** → **OK** → **OK**।\n\nजाँच: हरी डॉटेड बॉर्डर टेक्स्ट के पास (पेज के किनारे से नहीं)।" },
    { group: "PAGE LAYOUT › Page Setup", instruction: "पूरे डॉक्यूमेंट को Two कॉलम (Columns) में कीजिए।",
      criteria: [page("columnCount", ["2", 2])],
      solution: "1. PAGE LAYOUT → **Columns ▾** → **Two**।\n\nजाँच: टेक्स्ट दो कॉलम में।" },
    { group: "PAGE LAYOUT › Page Setup", instruction: "डॉक्यूमेंट में Line Numbers (Continuous) लगाइए।",
      criteria: [0, 1, 2, 3].map((place) => value(place, "attrs.lineNumbers", [true])),
      solution: "1. PAGE LAYOUT → **Line Numbers ▾** → **Continuous**।\n\nजाँच: हर लाइन के बाईं ओर 1, 2, 3… नंबर।" },
    { group: "PAGE LAYOUT › Page Setup", instruction: "डॉक्यूमेंट में Hyphenation Automatic कीजिए।",
      criteria: [0, 1, 2, 3].map((place) => value(place, "attrs.hyphens", ["auto"])),
      solution: "1. PAGE LAYOUT → **Hyphenation ▾** → **Automatic**।\n\nजाँच: लाइन के अंत के लंबे शब्द ज़रूरत पर हाइफ़न (-) से टूटें।" },
    { group: "PAGE LAYOUT › Page Setup", instruction: "Page Setup से बाईं ओर 1\" का Gutter दीजिए।",
      criteria: [page("gutter", { regex: "^(25\\.4|2\\.54|1)(0*)?(mm|cm|in)?$" })],
      solution: "1. PAGE LAYOUT → **Margins ▾** → **Custom Margins…**।\n2. Gutter **1\"**, Gutter position **Left** → **OK**।\n\nजाँच: बायाँ मार्जिन 1\" ज़्यादा चौड़ा।" },
    { group: "PAGE LAYOUT › Page Setup", instruction: "टेबल से ठीक पहले Section Break (Next Page) लगाइए।",
      criteria: [value(10, "type", ["section-break"])],
      solution: "1. \"Samradhi Classes, Jaipur\" लाइन के अंत में क्लिक करें (टेबल से ठीक पहले)।\n2. PAGE LAYOUT → **Breaks ▾** → Section Breaks में **Next Page**।\n\nजाँच: टेबल नए सेक्शन के नए पेज पर।" },
  ] as Q[],
};

const test8 = {
  title: "EFFICIENCY TEST 8",
  matter: matter(
    "राजस्थान अपनी समृद्ध संस्कृति, ऐतिहासिक किलों और रंग-बिरंगे त्योहारों के लिए पूरे विश्व में प्रसिद्ध है। जयपुर, जोधपुर, उदयपुर और जैसलमेर जैसे शहर हर वर्ष लाखों पर्यटकों को आकर्षित करते हैं। यहाँ के लोग अतिथि का सम्मान करते हैं और अपनी परंपराओं को आज भी सँभालकर रखते हैं।",
    [
      "Practice is the key to success in any computer examination. A student who practises daily learns the shortcut keys, understands the ribbon and completes the paper well before the time is over. Regular practice also reduces mistakes and builds confidence.",
      "Samradhi Classes prepares students for typing, stenography and computer efficiency tests. Samradhi Classes provides practice papers that are similar to the real examination, so that every student knows exactly what to expect.",
      "Formatting changes the look of a page without changing its words. Good formatting uses a clear font, proper spacing and correct alignment, and it helps the reader to understand the main points quickly.",
    ],
    ["Read the question", "Select the text", "Apply the formatting", "Check your work"], false,
    "The chemical formula of sulphuric acid is H2SO4",
    "Samradhi Classes is a registered name",
    [["Course", "Duration", "Fee"], ["Typing", "3 Months", "3000"], ["Stenography", "6 Months", "6000"], ["Computer", "2 Months", "2500"], ["Tally", "3 Months", "4000"]],
  ),
  questions: [
    { group: "HOME › Font", instruction: "प्रथम पैराग्राफ (हिंदी) को फॉन्ट साइज 15, इटैलिक एवं फॉन्ट कलर Blue दीजिए।",
      criteria: [words(0, { fontSize: [15], italic: [true], color: ["0070C0"] })],
      solution: "1. पहला (हिंदी) पैराग्राफ सेलेक्ट करें।\n2. HOME → Font Size **15**, **Italic** (Ctrl+I)।\n3. **Font Color ▾** → Standard Colors में **Blue**।\n\nजाँच: पहला पैराग्राफ साइज 15, इटैलिक, नीला।" },
    { group: "HOME › Font", instruction: "द्वितीय पैराग्राफ को फॉन्ट Times New Roman एवं फॉन्ट साइज 13 दीजिए।",
      criteria: [words(1, { fontFamily: ["Times New Roman"], fontSize: [13] })],
      solution: "1. दूसरा पैराग्राफ (\"Practice is the key…\") सेलेक्ट करें।\n2. HOME → Font **Times New Roman**, Font Size बॉक्स में **13** टाइप करके Enter।\n\nजाँच: दूसरा पैराग्राफ Times New Roman, 13।" },
    { group: "HOME › Font", instruction: "\"H2SO4\" में सभी अंकों (2 एवं 4) को सबस्क्रिप्ट (Subscript) कीजिए।",
      criteria: [{ rule: "text", kind: "body", place: 8, find: "2", props: { subscript: [true] } }, { rule: "text", kind: "body", place: 8, find: "4", props: { subscript: [true] } }],
      solution: "1. \"H2SO4\" में **2** सेलेक्ट करें → HOME → **Subscript (x₂)** (Ctrl+=)।\n2. इसी तरह **4** को भी सबस्क्रिप्ट करें।\n\nजाँच: H₂SO₄।" },
    { group: "HOME › Font", instruction: "तृतीय पैराग्राफ में दोनों \"Samradhi Classes\" को बोल्ड एवं पीले (Yellow) रंग से हाइलाइट कीजिए।",
      criteria: [{ rule: "text", kind: "body", place: 2, find: "Samradhi Classes", minCount: 2, props: { bold: [true], highlight: ["FFFF00"] } }],
      solution: "1. तीसरे पैराग्राफ में पहला \"Samradhi Classes\" सेलेक्ट करें → HOME → **Bold** और **Text Highlight Color ▾** → **Yellow**।\n2. दूसरे \"Samradhi Classes\" पर भी यही करें।\n\nजाँच: तीसरे पैराग्राफ के दोनों \"Samradhi Classes\" बोल्ड और पीले हाइलाइट में।" },
    { group: "HOME › Font", instruction: "चतुर्थ पैराग्राफ को Character Spacing Expanded 2 pt दीजिए।",
      criteria: [words(3, { charSpacing: [2] })],
      solution: "1. चौथा पैराग्राफ (\"Formatting changes…\") सेलेक्ट करें।\n2. HOME → Font ग्रुप **↘** (Ctrl+D) → **Advanced** → Spacing **Expanded**, By **2 pt** → **OK**।\n\nजाँच: चौथे पैराग्राफ के अक्षरों में 2 pt का फैलाव।" },
    { group: "HOME › Paragraph", instruction: "द्वितीय पैराग्राफ को Center अलाइनमेंट एवं लाइन स्पेसिंग 2.0 दीजिए।",
      criteria: [value(1, "alignment", ["center"]), value(1, "attrs.lineHeight", { regex: "^2(\\.0+)?$" })],
      solution: "दूसरे पैराग्राफ में क्लिक करें:\n1. HOME → **Center** (Ctrl+E)।\n2. HOME → **Line and Paragraph Spacing ▾** → **2.0**।\n\nजाँच: दूसरा पैराग्राफ बीच में, लाइन स्पेसिंग 2.0।" },
    { group: "HOME › Paragraph", instruction: "तृतीय पैराग्राफ में First Line इंडेंट 0.5\" दीजिए।",
      criteria: [value(2, "attrs.specialIndentMode", ["firstLine"]), value(2, "attrs.specialIndentAmount", { regex: "^(0\\.5in|36pt|0\\.5\")$" })],
      solution: "1. तीसरे पैराग्राफ में क्लिक करें।\n2. HOME → Paragraph ग्रुप **↘** → Indentation Special **First line**, By **0.5\"** → **OK**।\n\nजाँच: तीसरे पैराग्राफ की पहली लाइन 0.5\" अंदर।" },
    { group: "HOME › Paragraph", instruction: "दी गई सूची (Read the question…) की बुलेट्स को रोमन नंबरिंग I. II. III. में बदलिए।",
      criteria: [4, 5, 6, 7].map((place) => value(place, "attrs.listStyle", ["upper-roman"])),
      solution: "1. सूची के चारों आइटम सेलेक्ट करें।\n2. HOME → **Numbering ▾** → Numbering Library में **I. II. III.**।\n\nजाँच: सूची के आगे I. से IV. तक रोमन अंक।" },
    { group: "HOME › Paragraph", instruction: "टेबल को \"Course\" कॉलम के अनुसार A से Z (Ascending) क्रम में सॉर्ट कीजिए।",
      criteria: [{ rule: "table", place: 0, headerAt: { 0: "Course" }, sortedColumn: 0 }],
      solution: "1. टेबल में क्लिक करें।\n2. HOME → **Sort (A↓Z)** → Sort by **Course**, Type **Text**, **Ascending**, My list has **Header row** → **OK**।\n\nजाँच: Computer, Stenography, Tally, Typing के क्रम में।" },
    { group: "HOME › Editing", instruction: "पूरे डॉक्यूमेंट में \"practice\" शब्द को \"exercise\" शब्द से Replace All कीजिए।",
      criteria: [{ rule: "text", kind: "body", find: "practice", wholeWord: true, minCount: 0, maxCount: 0 }, { rule: "text", kind: "body", find: "exercise", wholeWord: true, minCount: 3 }],
      solution: "1. HOME → **Replace** (Ctrl+H)।\n2. Find what **practice**, Replace with **exercise** → **More >>** → **Find whole words only** ✔ → **Replace All**।\n\nजाँच: \"practice\" की जगह तीन जगह \"exercise\" (\"practises\" नहीं बदलता)।" },
    { group: "INSERT › Pages", instruction: "टेबल से ठीक पहले Page Break लगाइए, ताकि टेबल नए पेज पर आ जाए।",
      criteria: [pageBreakBeforeTable],
      solution: "1. \"Samradhi Classes is a registered name\" लाइन के अंत में क्लिक करें (टेबल से ठीक पहले)।\n2. INSERT → **Page Break** (Ctrl+Enter)।\n\nजाँच: टेबल अगले पेज पर।" },
    { group: "INSERT › Table", instruction: "डॉक्यूमेंट के अंत में (टेबल के बाद) 2 कॉलम एवं 5 रो की एक नई टेबल इन्सर्ट कीजिए।",
      criteria: [{ rule: "table", place: 1, columns: 2, rowCount: 5 }],
      solution: "1. दी गई टेबल के नीचे, डॉक्यूमेंट के अंत में क्लिक करें।\n2. INSERT → **Table ▾** → **Insert Table…** → Number of columns **2**, Number of rows **5** → **OK**।\n\nजाँच: अंत में 2 कॉलम × 5 रो की नई टेबल।" },
    { group: "INSERT › Symbols", instruction: "\"Samradhi Classes is a registered name\" में \"Classes\" के ठीक बाद Registered चिह्न ® लगाइए।",
      criteria: [anyOf({ rule: "text", kind: "body", place: 9, find: "Classes®" }, { rule: "text", kind: "body", place: 9, find: "Classes ®" })],
      solution: "1. \"Samradhi Classes is a registered name\" में \"Classes\" के ठीक बाद क्लिक करें।\n2. INSERT → **Symbol ▾** → **®** (या More Symbols… → Special Characters → **Registered**) → Insert।\n\nजाँच: Samradhi Classes® is a registered name।" },
    { group: "INSERT › Header & Footer", instruction: "फूटर में बाईं ओर \"Samradhi Classes\" लिखिए एवं हेडर में बीच में (Center) पेज नंबर लगाइए।",
      criteria: [{ rule: "text", kind: "footer", find: "Samradhi Classes" }, { rule: "run", kind: "header", props: { field: { regex: "^page-number\\|.*\\|center$" } } }],
      solution: "1. INSERT → **Footer ▾** → **Edit Footer** → बाईं ओर टाइप करें **Samradhi Classes**।\n2. INSERT → **Page Number ▾** → **Top of Page** → **Plain Number 2** (बीच में)।\n3. **Close Header and Footer**।\n\nजाँच: फूटर में बाईं ओर टेक्स्ट, हेडर के बीच में पेज नंबर।" },
    { group: "DESIGN › Page Background", instruction: "पेज पर \"SAMRADHI\" वाटरमार्क (Custom Watermark) लगाइए।",
      criteria: [page("watermark", { regex: "^\\s*samradhi\\s*$" })],
      solution: "1. DESIGN → **Watermark ▾** → **Custom Watermark…**।\n2. **Text watermark** → Text में **SAMRADHI** टाइप करें → **OK**।\n\nजाँच: पेज के बीच में हल्के अक्षरों में SAMRADHI।" },
    { group: "PAGE LAYOUT › Page Setup", instruction: "पेज का Size Legal एवं Margins Wide कीजिए।",
      criteria: [page("aspectRatio", { regex: "^21\\.59 ?/ ?35\\.56$" }), page("padding", ["25.4mm 50.8mm 25.4mm 50.8mm"])],
      solution: "1. PAGE LAYOUT → **Size ▾** → **Legal**।\n2. PAGE LAYOUT → **Margins ▾** → **Wide**।\n\nजाँच: पेज Legal (8.5\" × 14\"), बाएँ-दाएँ मार्जिन 2\"।" },
  ] as Q[],
};

for (const test of [test7, test8]) if (test.questions.length < 15) throw new Error(`${test.title}: only ${test.questions.length} questions`);
writeFileSync("tests/fixtures/hindi-word-tests-7-8.json", JSON.stringify({ tests: [test7, test8] }, null, 1));
console.log(test7.questions.length, test8.questions.length);
