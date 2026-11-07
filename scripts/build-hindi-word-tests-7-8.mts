// Builds Hindi Word EFFICIENCY TEST 7 and TEST 8 (7 Nov 2026): the practice document (a Kruti Dev Hindi paragraph,
// three English paragraphs, a 4-item list, two short lines and a table at the end), 15 questions each over the groups
// the admin chose (HOME Font / Paragraph / Editing, INSERT Pages / Table / Header & Footer / Symbols, DESIGN Page
// Background, PAGE LAYOUT Page Setup), their hand-written marking checks and Hindi paper solutions.
// Writes tests/fixtures/hindi-word-tests-7-8.json (read by the migration builder and the harness).
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
  questions: [
    { group: "HOME › Font", instruction: "प्रथम पैराग्राफ (हिंदी) को फॉन्ट साइज 16, बोल्ड एवं फॉन्ट कलर Dark Red दीजिए।",
      criteria: [words(0, { fontSize: [16], bold: [true], color: ["C00000"] })],
      solution: "1. पहला (हिंदी) पैराग्राफ सेलेक्ट करें।\n2. HOME → Font Size **16**, **Bold** (Ctrl+B)।\n3. **Font Color ▾** → Standard Colors में **Dark Red**।\n\nजाँच: पहला पैराग्राफ साइज 16, बोल्ड और गहरा लाल।" },
    { group: "HOME › Font", instruction: "द्वितीय पैराग्राफ को फॉन्ट Arial, इटैलिक एवं डबल अंडरलाइन दीजिए।",
      criteria: [words(1, { fontFamily: ["Arial"], italic: [true], underline: [true], underlineStyle: ["double"] })],
      solution: "1. दूसरा पैराग्राफ (\"Microsoft Word is…\") सेलेक्ट करें।\n2. HOME → Font **Arial**, **Italic** (Ctrl+I)।\n3. **Underline ▾** → **Double underline** (या Font डायलॉग Ctrl+D → Underline style **Double**)।\n\nजाँच: दूसरा पैराग्राफ Arial, इटैलिक, डबल अंडरलाइन।" },
    { group: "HOME › Font", instruction: "चतुर्थ पैराग्राफ को Change Case से UPPERCASE कीजिए।",
      criteria: [{ rule: "text", kind: "body", place: 3, find: "THE HOME TAB CONTAINS THE MOST USED COMMANDS OF WORD", caseSensitive: true }],
      solution: "1. चौथा पैराग्राफ (\"The Home tab contains…\") सेलेक्ट करें।\n2. HOME → **Change Case (Aa ▾)** → **UPPERCASE**।\n\nजाँच: चौथे पैराग्राफ के सभी अक्षर बड़े।" },
    { group: "HOME › Font", instruction: "\"E = mc2\" में 2 को सुपरस्क्रिप्ट (Superscript) कीजिए।",
      criteria: [{ rule: "text", kind: "body", place: 8, find: "2", props: { superscript: [true] } }],
      solution: "1. \"E = mc2\" में केवल **2** सेलेक्ट करें।\n2. HOME → **Superscript (x²)** (Ctrl+Shift+=)।\n\nजाँच: E = mc²।" },
    { group: "HOME › Paragraph", instruction: "द्वितीय पैराग्राफ को Justify अलाइनमेंट एवं लाइन स्पेसिंग 1.5 दीजिए।",
      criteria: [value(1, "alignment", ["justify"]), value(1, "attrs.lineHeight", ["1.5"])],
      solution: "दूसरे पैराग्राफ में क्लिक करें:\n1. HOME → **Justify** (Ctrl+J)।\n2. HOME → **Line and Paragraph Spacing ▾** → **1.5**।\n\nजाँच: जस्टिफाई और लाइन स्पेसिंग 1.5।" },
    { group: "HOME › Paragraph", instruction: "दी गई सूची (Home Tab, Insert Tab…) की बुलेट्स को नंबरिंग 1. 2. 3. में बदलिए।",
      criteria: [4, 5, 6, 7].map((place) => value(place, "attrs.listStyle", ["decimal"])),
      solution: "1. सूची के चारों आइटम सेलेक्ट करें।\n2. HOME → **Numbering ▾** → **1. 2. 3.**।\n\nजाँच: सूची 1. से 4. तक नंबर वाली।" },
    { group: "HOME › Paragraph", instruction: "तृतीय पैराग्राफ पर Box बॉर्डर एवं Light Green शेडिंग दीजिए।",
      criteria: [value(2, "attrs.border", { regex: "^(?!.*sides:)\\S+ (solid|double|dotted|dashed)" }), value(2, "attrs.backgroundColor", { regex: "92D050|rgb\\(146, ?208, ?80\\)" })],
      solution: "तीसरे पैराग्राफ में क्लिक करें:\n1. HOME → **Borders ▾** → **Borders and Shading…** → Borders: Setting **Box** → Apply to **Paragraph**।\n2. **Shading** टैब → Fill **Light Green** → Apply to **Paragraph** → **OK**।\n\nजाँच: तीसरे पैराग्राफ के चारों ओर बॉर्डर और हल्की हरी शेडिंग।" },
    { group: "HOME › Paragraph", instruction: "टेबल को \"Marks\" कॉलम के अनुसार आरोही क्रम (Ascending) में सॉर्ट कीजिए।",
      criteria: [{ rule: "table", place: 0, headerAt: { 3: "Marks" }, sortedColumn: 3 }],
      solution: "1. टेबल में क्लिक करें।\n2. HOME → **Sort (A↓Z)** → Sort by **Marks**, Type **Number**, **Ascending**, My list has **Header row** → **OK**।\n\nजाँच: Marks 55, 68, 74, 82, 91 के क्रम में।" },
    { group: "HOME › Editing", instruction: "पूरे डॉक्यूमेंट में \"document\" शब्द को \"file\" शब्द से Replace All कीजिए।",
      criteria: [{ rule: "text", kind: "body", find: "document", minCount: 0, maxCount: 0 }, { rule: "text", kind: "body", find: "file", wholeWord: true, minCount: 4 }],
      solution: "1. HOME → **Replace** (Ctrl+H)।\n2. Find what **document**, Replace with **file** → **Replace All**।\n\nजाँच: डॉक्यूमेंट में कहीं भी \"document\" नहीं, चार जगह \"file\"।" },
    { group: "INSERT › Pages", instruction: "टेबल से ठीक पहले Page Break लगाइए, ताकि टेबल नए पेज पर आ जाए।",
      criteria: [pageBreakBeforeTable],
      solution: "1. \"Samradhi Classes, Jaipur\" लाइन के अंत में क्लिक करें (टेबल से ठीक पहले)।\n2. INSERT → **Page Break** (Ctrl+Enter)।\n\nजाँच: टेबल अगले पेज पर।" },
    { group: "INSERT › Table", instruction: "डॉक्यूमेंट के अंत में (टेबल के बाद) 3 कॉलम एवं 4 रो की एक नई टेबल इन्सर्ट कीजिए।",
      criteria: [{ rule: "table", place: 1, columns: 3, rowCount: 4 }],
      solution: "1. दी गई टेबल के नीचे, डॉक्यूमेंट के अंत में क्लिक करें।\n2. INSERT → **Table ▾** → **Insert Table…** → Number of columns **3**, Number of rows **4** → **OK** (या ग्रिड में 3x4)।\n\nजाँच: अंत में 3 कॉलम × 4 रो की नई टेबल।" },
    { group: "INSERT › Symbols", instruction: "\"Samradhi Classes, Jaipur\" से पहले कॉपीराइट चिह्न © लगाइए।",
      criteria: [anyOf({ rule: "text", kind: "body", place: 9, find: "© Samradhi" }, { rule: "text", kind: "body", place: 9, find: "©Samradhi" })],
      solution: "1. \"Samradhi Classes, Jaipur\" के आरंभ में क्लिक करें।\n2. INSERT → **Symbol ▾** → **©** (या More Symbols… → Special Characters → **Copyright**) → Insert।\n\nजाँच: © Samradhi Classes, Jaipur।" },
    { group: "INSERT › Header & Footer", instruction: "हेडर में \"RSSB LDC EXAM - 2026\" लिखिए एवं फूटर में दाईं ओर पेज नंबर लगाइए।",
      criteria: [{ rule: "text", kind: "header", find: "RSSB LDC EXAM - 2026" }, { rule: "run", kind: "footer", props: { field: { regex: "^page-number\\|.*\\|right$" } } }],
      solution: "1. INSERT → **Header ▾** → **Edit Header** → टाइप करें **RSSB LDC EXAM - 2026**।\n2. INSERT → **Page Number ▾** → **Bottom of Page** → **Plain Number 3** (दाईं ओर)।\n3. **Close Header and Footer**।\n\nजाँच: हेडर में टेक्स्ट, फूटर में दाईं ओर पेज नंबर।" },
    { group: "DESIGN › Page Background", instruction: "पेज पर Box पेज बॉर्डर दीजिए, जिसकी लाइन Double एवं कलर Blue हो।",
      criteria: [page("border", { regex: "^(?!.*sides:)\\S+ double (#0070C0|rgb\\(0, ?112, ?192\\))" })],
      solution: "1. DESIGN → **Page Borders**।\n2. Setting **Box**, Style **डबल लाइन (═)**, Color **Blue** → Apply to **Whole document** → **OK**।\n\nजाँच: पूरे पेज के चारों ओर नीली डबल लाइन।" },
    { group: "PAGE LAYOUT › Page Setup", instruction: "पेज का Orientation Landscape एवं Margins Narrow कीजिए।",
      // Landscape on the starting A4 page is saved as "1.414 / 1"; after choosing a size, as "29.7 / 21".
      criteria: [page("aspectRatio", { regex: "^(29\\.7 ?/ ?21|1\\.414 ?/ ?1)$" }), page("padding", ["12.7mm 12.7mm 12.7mm 12.7mm"])],
      solution: "1. PAGE LAYOUT → **Orientation ▾** → **Landscape**।\n2. PAGE LAYOUT → **Margins ▾** → **Narrow**।\n\nजाँच: पेज लैंडस्केप, चारों मार्जिन 0.5\"।" },
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
