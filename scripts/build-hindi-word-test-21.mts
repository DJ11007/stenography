// Builds Hindi Word EFFICIENCY TEST 21 (28 Nov 2026): a previous-year exam paper sent by the owner as an image, kept
// question for question (Q.1 अ ब स ... Q.5 अ ब स -> questions 1 to 15). Its practice document is a Hindi (Mangal)
// passage about the national flag, set up for the questions: paragraph 1 has background shading and the word "झंडे",
// paragraph 5 has double strikethrough, and the table's first column is underlined -- so the "remove" questions have
// something to remove (practice documents keep these since migration 202611271000).
// Writes tests/fixtures/hindi-word-test-21.json, read by the dev harness (?test=21), the migration builder
// (build-hindi-word-test-21-migration.mjs) and tests/hindi-word-test-21-rules-runtime.test.mjs.
//   node scripts/build-hindi-word-test-21.mts
import { writeFileSync } from "node:fs";

type Run = { text: string; bold: boolean; italic: boolean; underline: boolean; strike: boolean; color: string | null; highlight: string | null; fontSize: number; fontFamily: string; doubleStrike?: boolean };
const run = (text: string, extra: Partial<Run> = {}): Run => ({ text, bold: false, italic: false, underline: false, strike: false, color: null, highlight: null, fontSize: 14, fontFamily: "Mangal", ...extra });
let id = 0;
const paragraph = (runs: Run[], extra: Record<string, unknown> = {}) => ({ id: `matter-p-${++id}`, type: "paragraph", paragraphNumber: id, listGroup: null, runs, alignment: "justify", leftIndent: 0, rightIndent: 0, lineSpacing: 1.15, spaceBefore: 0, spaceAfter: 8, ...extra });

const rows = [
  ["क्र.सं.", "दिवस", "तिथि"],
  ["1", "गणतंत्र दिवस", "26 जनवरी"],
  ["2", "स्वतंत्रता दिवस", "15 अगस्त"],
  ["3", "गांधी जयंती", "2 अक्टूबर"],
  ["4", "राष्ट्रीय एकता दिवस", "31 अक्टूबर"],
];
const paragraphs = [
  // Q4: remove this shading. Q7: "झंडे" -> subscript.
  paragraph([run("राष्ट्रीय ध्वज किसी भी देश की पहचान और गौरव का प्रतीक होता है। भारत का राष्ट्रीय ध्वज तिरंगा है, जिसमें केसरिया, सफेद और हरे रंग की तीन बराबर पट्टियाँ हैं। स्वतंत्रता दिवस और गणतंत्र दिवस पर देश भर में झंडे फहराए जाते हैं और लोग उन्हें सम्मान के साथ सलामी देते हैं।")], { shading: "FFE699" }),
  paragraph([run("तिरंगे के बीच में नीले रंग का अशोक चक्र है, जिसमें चौबीस तीलियाँ होती हैं। यह चक्र प्रगति और निरंतर आगे बढ़ते रहने का संदेश देता है। ध्वज की लंबाई और चौड़ाई का अनुपात तीन और दो का होता है।")]),
  paragraph([run("भारतीय ध्वज संहिता में ध्वज को फहराने और उसके सम्मान से जुड़े नियम दिए गए हैं। ध्वज को कभी भी जमीन या पानी को छूने नहीं देना चाहिए और फटा या मैला ध्वज नहीं फहराना चाहिए।")]),
  paragraph([run("विद्यालयों, सरकारी कार्यालयों और घरों पर ध्वज फहराते समय राष्ट्रगान गाया जाता है। हर नागरिक का कर्तव्य है कि वह राष्ट्रीय प्रतीकों का आदर करे और उनकी गरिमा बनाए रखे।")]),
  // Q10: remove this double strikethrough.
  paragraph([run("हर घर तिरंगा अभियान ने लोगों में देशभक्ति की भावना को और मजबूत किया है। इस अभियान में करोड़ों परिवारों ने अपने घरों पर तिरंगा फहराया और राष्ट्रीय ध्वज के प्रति सम्मान प्रकट किया।", { doubleStrike: true })]),
  {
    id: `matter-p-${++id}`, type: "table", rows,
    cellFonts: rows.map((row) => row.map(() => "Mangal")), cellSizes: rows.map((row) => row.map(() => 12)),
    // Q13: remove this underline from the first column.
    cellFormats: rows.map((row) => row.map((_, column) => (column === 0 ? { underline: true } : null))),
  },
  paragraph([run("", { fontFamily: "Segoe UI", fontSize: 12 })], { alignment: "left" }),
];
const matter = {
  schemaVersion: "1", language: "Hindi", paragraphs, warnings: [],
  formattingSummary: { paragraphs: paragraphs.length, runs: paragraphs.length, italicParagraphs: 0, justifiedParagraphs: 5, listItems: 0, tables: 1, fonts: ["Mangal", "Segoe UI"] },
};

// Body places (how the checks count): 0-4 the five paragraphs, 5 the table.
const value = (place: number, target: string, spec: unknown) => ({ rule: "value", kind: "body", place, target: `blocks.0.${target}`, spec });
const words = (place: number, props: Record<string, unknown>) => ({ rule: "words", kind: "body", place, props });
const page = (key: string, spec: unknown) => ({ rule: "value", target: `pageLayout.${key}`, spec });
const tableRule = (extra: Record<string, unknown>) => ({ rule: "table", place: 0, ...extra });

const questions = [
  { instruction: "पृष्ठ का ओरिएंटेशन लैंडस्केप (Landscape) सेट करें।",
    criteria: [page("aspectRatio", { regex: "^29\\.7 ?/ ?21$" })],
    solution: "1. PAGE LAYOUT → **Orientation ▾** → **Landscape**।\n\nजाँच: पेज चौड़ाई में (आड़ा)।" },
  { instruction: "द्वितीय व तृतीय पैराग्राफ की राइट इंडेंटेशन (Right Indentation) को 1.1\" सेट करें।",
    criteria: [1, 2].map((place) => value(place, "attrs.marginRight", { regex: "^79\\.2(0*)pt$" })),
    solution: "1. दूसरा और तीसरा पैराग्राफ सेलेक्ट करें।\n2. HOME → Paragraph ग्रुप **↘** (Paragraph डायलॉग) → Indentation में **Right: 1.1\"** → **OK**।\n\nजाँच: दोनों पैराग्राफ दाईं ओर से अंदर।" },
  { instruction: "द्वितीय व तृतीय पैराग्राफ में 1.5 लाइन स्पेसिंग (Line Spacing) सेट करें।",
    criteria: [1, 2].map((place) => value(place, "attrs.lineHeight", { regex: "^1\\.5(0*)$" })),
    solution: "1. दूसरा और तीसरा पैराग्राफ सेलेक्ट करें।\n2. HOME → **Line and Paragraph Spacing ▾** → **1.5**।\n\nजाँच: लाइनों के बीच डेढ़ गुना जगह।" },
  { instruction: "प्रथम पैराग्राफ की बैकग्राउंड कलर / शेडिंग (Background Color/Shading) इफेक्ट को दूर (REMOVE) करें।",
    criteria: [value(0, "attrs.backgroundColor", { regex: "^(|transparent|none|rgba\\(0, ?0, ?0, ?0\\))$" })],
    solution: "1. पहले पैराग्राफ में क्लिक करें।\n2. HOME → **Shading ▾** → **No Color**।\n\nजाँच: पहले पैराग्राफ के पीछे का रंग हट जाए।" },
  { instruction: "तृतीय पैराग्राफ के फॉन्ट कलर (Font Color) को ग्रीन (Green) व चतुर्थ पैराग्राफ के फॉन्ट कलर (Font Color) को डार्क रेड (Dark Red) सेट करें।",
    criteria: [words(2, { color: ["00B050"] }), words(3, { color: ["C00000"] })],
    solution: "1. तीसरा पैराग्राफ सेलेक्ट करें → HOME → **Font Color ▾** → Standard Colors में **Green**।\n2. चौथा पैराग्राफ सेलेक्ट करें → **Font Color ▾** → **Dark Red**।\n\nजाँच: तीसरा हरा, चौथा गहरा लाल।" },
  { instruction: "पृष्ठ (Page) के हेडर (Header) में पेज नम्बर डालें एवं पेज नम्बर 3 से स्टार्ट करें।",
    criteria: [{ rule: "run", kind: "header", props: { field: { regex: "^page-number\\|top\\|" }, text: { regex: "^\\s*3\\s*$" } } }],
    solution: "1. INSERT → **Page Number ▾** → **Top of Page** → **Plain Number 1** (कोई भी)।\n2. INSERT → **Page Number ▾** → **Format Page Numbers…** → **Start at: 3** → **OK**।\n3. **Close Header and Footer**।\n\nजाँच: हेडर में पेज नंबर 3।" },
  { instruction: "पहले पैराग्राफ के शब्द \"झंडे\" को सबस्क्रिप्ट इफेक्ट (Subscript effect) दें।",
    criteria: [{ rule: "text", kind: "body", place: 0, find: "झंडे", props: { subscript: [true] } }],
    solution: "1. पहले पैराग्राफ में \"झंडे\" शब्द सेलेक्ट करें।\n2. HOME → **Subscript (x₂)** (या Ctrl+=)।\n\nजाँच: \"झंडे\" लाइन से नीचे छोटा दिखे।" },
  { instruction: "द्वितीय व तृतीय पैराग्राफ का फॉन्ट साइज 15pt सेट करें।",
    criteria: [words(1, { fontSize: [15] }), words(2, { fontSize: [15] })],
    solution: "1. दूसरा और तीसरा पैराग्राफ सेलेक्ट करें।\n2. HOME → **Font Size** बॉक्स में **15** टाइप करके Enter।\n\nजाँच: दोनों पैराग्राफ का साइज 15।" },
  { instruction: "पृष्ठ में \"DO NOT COPY\" वॉटर मार्क अंकित करें।",
    criteria: [page("watermark", { regex: "^\\s*do not copy\\s*$" })],
    solution: "1. DESIGN → **Watermark ▾** → **DO NOT COPY** (Disclaimers में)।\n\nजाँच: पेज पर तिरछा \"DO NOT COPY\"।" },
  { instruction: "पाँचवें पैराग्राफ की डबल स्ट्राइकथ्रू इफेक्ट (Double Strikethrough effect) दूर करें।",
    criteria: [words(4, { doubleStrike: [false, null] })],
    solution: "1. पाँचवाँ पैराग्राफ सेलेक्ट करें।\n2. HOME → Font ग्रुप **↘** (Ctrl+D) → Effects में **Double strikethrough** का ✔ हटाएँ → **OK**।\n\nजाँच: पाँचवें पैराग्राफ से दोहरी कटी लाइन हट जाए।" },
  { instruction: "चतुर्थ व पाँचवें पैराग्राफ को ब्लू कलर (Blue Color) टेक्स्ट हाईलाइट (Text Highlight) करें।",
    criteria: [words(3, { highlight: ["0000FF"] }), words(4, { highlight: ["0000FF"] })],
    solution: "1. चौथा और पाँचवाँ पैराग्राफ सेलेक्ट करें।\n2. HOME → **Text Highlight Color ▾** → **Blue**।\n\nजाँच: दोनों पैराग्राफ के पीछे नीला रंग।" },
  { instruction: "पृष्ठ की गटर (Gutter) वैल्यू 0.5\" व गटर पोजीशन (Gutter Position) टॉप (Top) सेट करें।",
    criteria: [page("gutter", { regex: "^(12\\.7|1\\.27|0\\.5)(0*)(mm|cm|in)?$" }), page("gutterPosition", ["top"])],
    solution: "1. PAGE LAYOUT → Page Setup ग्रुप **↘** (Page Setup डायलॉग) → **Margins**।\n2. **Gutter: 0.5\"** और **Gutter position: Top** → **OK**।\n\nजाँच: पेज के ऊपर का मार्जिन बढ़ जाए।" },
  { instruction: "टेबल के प्रथम स्तंभ (Column) के टेक्स्ट की अंडरलाइन इफेक्ट (Underline effect) दूर करें।",
    criteria: [tableRule({ onlyColumn: 0, cellProps: { underline: [false, null] } })],
    solution: "1. टेबल का पहला कॉलम (क्र.सं.) सेलेक्ट करें।\n2. HOME → **Underline (U)** (Ctrl+U) दबाकर अंडरलाइन हटाएँ।\n\nजाँच: पहले कॉलम के अंकों के नीचे लाइन न रहे।" },
  { instruction: "टेबल के तृतीय स्तंभ (Column) के टेक्स्ट को बोल्ड (Bold) और फॉन्ट कलर (Font Color) लाल (Red Color) सेट करें।",
    criteria: [tableRule({ onlyColumn: 2, cellProps: { bold: [true], color: ["FF0000"] } })],
    solution: "1. टेबल का तीसरा कॉलम (तिथि) सेलेक्ट करें।\n2. HOME → **Bold** (Ctrl+B) → **Font Color ▾** → **Red**।\n\nजाँच: तीसरा कॉलम बोल्ड और लाल।" },
  { instruction: "टेबल की प्रथम व तृतीय पंक्ति (Row) को जस्टिफाई अलाइनमेंट (Justify Align) सेट करें।",
    criteria: [0, 2].map((row) => tableRule({ onlyRow: row, cellProps: { align: ["justify"] } })),
    solution: "1. टेबल की पहली पंक्ति सेलेक्ट करें → HOME → **Justify** (Ctrl+J)।\n2. तीसरी पंक्ति सेलेक्ट करें → **Justify**।\n\nजाँच: दोनों पंक्तियों का टेक्स्ट जस्टिफाई।" },
];
if (questions.length !== 15) throw new Error(`${questions.length} questions`);
writeFileSync("tests/fixtures/hindi-word-test-21.json", JSON.stringify({ title: "EFFICIENCY TEST 21", matter, questions }, null, 1));
console.log("questions", questions.length);
