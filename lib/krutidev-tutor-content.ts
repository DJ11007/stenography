// Kruti Dev 010 keyboard layout + a progressive Hindi typing curriculum
// for the Kruti Dev learning simulator at /typing/learn/krutidev.
//
// Kruti Dev 010 is a legacy "font encoding", not a keyboard driver: you
// press ordinary English keys and the Kruti Dev font draws the matching
// Devanagari glyph. `d` is the byte "d" and the font renders it as क; `g`
// renders as ह; Shift+D renders as क्, and so on. That is why the whole
// tutor works on a plain QWERTY keyboard with no Remington driver -- the
// student is learning which key paints which glyph.
//
// `normal` / `shift` below hold the LEGACY bytes each physical key emits.
// Most are plain ASCII; a few conjuncts need Latin-1 bytes (Alt codes),
// which the UI surfaces separately. Verified against the mapping tables in
// @anthro-ai/krutidev-unicode.

export type Finger =
  | "l-pinky"
  | "l-ring"
  | "l-middle"
  | "l-index"
  | "r-index"
  | "r-middle"
  | "r-ring"
  | "r-pinky"
  | "thumb";

export type KeyCap = {
  /** Physical key, lowercase / primary label. */
  key: string;
  /** Legacy byte(s) the unshifted key emits (rendered through the Kruti Dev font). */
  normal: string;
  /** Legacy byte(s) Shift + key emits. */
  shift: string;
  finger: Finger;
  /** One of the eight home-row resting keys. */
  home?: boolean;
  /** Relative width, 1 = a standard key. */
  width?: number;
};

export type FingerInfo = { id: Finger; hi: string; en: string; color: string };

// Left-to-right, matched to the diagram on the Instructions step.
export const FINGERS: FingerInfo[] = [
  { id: "l-pinky", hi: "बायीं कनिष्ठिका", en: "Left little", color: "#f472b6" },
  { id: "l-ring", hi: "बायीं अनामिका", en: "Left ring", color: "#c084fc" },
  { id: "l-middle", hi: "बायीं मध्यमा", en: "Left middle", color: "#4ade80" },
  { id: "l-index", hi: "बायीं तर्जनी", en: "Left index", color: "#fb923c" },
  { id: "r-index", hi: "दायीं तर्जनी", en: "Right index", color: "#facc15" },
  { id: "r-middle", hi: "दायीं मध्यमा", en: "Right middle", color: "#2dd4bf" },
  { id: "r-ring", hi: "दायीं अनामिका", en: "Right ring", color: "#38bdf8" },
  { id: "r-pinky", hi: "दायीं कनिष्ठिका", en: "Right little", color: "#f472b6" },
  { id: "thumb", hi: "अंगूठा", en: "Thumb", color: "#94a3b8" },
];

export const FINGER_COLORS: Record<Finger, string> = Object.fromEntries(
  FINGERS.map((f) => [f.id, f.color]),
) as Record<Finger, string>;

// Row 1 -- digits. Shift produces the punctuation / conjuncts Kruti Dev
// puts there; the ones that matter for Hindi are kept, the rest left as
// the plain shifted symbol.
const ROW_NUMBER: KeyCap[] = [
  { key: "`", normal: "`", shift: "~", finger: "l-pinky" },
  { key: "1", normal: "1", shift: "!", finger: "l-pinky" },
  { key: "2", normal: "2", shift: "@", finger: "l-ring" },
  { key: "3", normal: "3", shift: "#", finger: "l-middle" },
  { key: "4", normal: "4", shift: "$", finger: "l-index" },
  { key: "5", normal: "5", shift: "%", finger: "l-index" },
  { key: "6", normal: "6", shift: "^", finger: "r-index" },
  { key: "7", normal: "7", shift: "&", finger: "r-index" },
  { key: "8", normal: "8", shift: "*", finger: "r-middle" },
  { key: "9", normal: "9", shift: "(", finger: "r-ring" },
  { key: "0", normal: "0", shift: ")", finger: "r-pinky" },
  { key: "-", normal: "-", shift: "_", finger: "r-pinky" },
  { key: "=", normal: "=", shift: "+", finger: "r-pinky" },
  { key: "Backspace", normal: "", shift: "", finger: "r-pinky", width: 2 },
];

const ROW_TOP: KeyCap[] = [
  { key: "Tab", normal: "", shift: "", finger: "l-pinky", width: 1.5 },
  { key: "q", normal: "q", shift: "Q", finger: "l-pinky" },
  { key: "w", normal: "w", shift: "W", finger: "l-ring" },
  { key: "e", normal: "e", shift: "E", finger: "l-middle" },
  { key: "r", normal: "r", shift: "R", finger: "l-index" },
  { key: "t", normal: "t", shift: "T", finger: "l-index" },
  { key: "y", normal: "y", shift: "Y", finger: "r-index" },
  { key: "u", normal: "u", shift: "U", finger: "r-index" },
  { key: "i", normal: "i", shift: "I", finger: "r-middle" },
  { key: "o", normal: "o", shift: "O", finger: "r-ring" },
  { key: "p", normal: "p", shift: "P", finger: "r-pinky" },
  { key: "[", normal: "[", shift: "{", finger: "r-pinky" },
  { key: "]", normal: "]", shift: "}", finger: "r-pinky" },
  { key: "\\", normal: "\\", shift: "|", finger: "r-pinky", width: 1.5 },
];

const ROW_HOME: KeyCap[] = [
  { key: "Caps", normal: "", shift: "", finger: "l-pinky", width: 1.75 },
  { key: "a", normal: "a", shift: "A", finger: "l-pinky", home: true },
  { key: "s", normal: "s", shift: "S", finger: "l-ring", home: true },
  { key: "d", normal: "d", shift: "D", finger: "l-middle", home: true },
  { key: "f", normal: "f", shift: "F", finger: "l-index", home: true },
  { key: "g", normal: "g", shift: "G", finger: "l-index" },
  { key: "h", normal: "h", shift: "H", finger: "r-index" },
  { key: "j", normal: "j", shift: "J", finger: "r-index", home: true },
  { key: "k", normal: "k", shift: "K", finger: "r-middle", home: true },
  { key: "l", normal: "l", shift: "L", finger: "r-ring", home: true },
  { key: ";", normal: ";", shift: ":", finger: "r-pinky", home: true },
  { key: "'", normal: "'", shift: '"', finger: "r-pinky" },
  { key: "Enter", normal: "", shift: "", finger: "r-pinky", width: 2.25 },
];

const ROW_BOTTOM: KeyCap[] = [
  { key: "Shift", normal: "", shift: "", finger: "l-pinky", width: 2.25 },
  { key: "z", normal: "z", shift: "Z", finger: "l-pinky" },
  { key: "x", normal: "x", shift: "X", finger: "l-ring" },
  { key: "c", normal: "c", shift: "C", finger: "l-middle" },
  { key: "v", normal: "v", shift: "V", finger: "l-index" },
  { key: "b", normal: "b", shift: "B", finger: "l-index" },
  { key: "n", normal: "n", shift: "N", finger: "r-index" },
  { key: "m", normal: "m", shift: "M", finger: "r-index" },
  { key: ",", normal: ",", shift: "<", finger: "r-middle" },
  { key: ".", normal: ".", shift: ">", finger: "r-ring" },
  { key: "/", normal: "/", shift: "?", finger: "r-pinky" },
  { key: "Shift ", normal: "", shift: "", finger: "r-pinky", width: 2.75 },
];

const ROW_SPACE: KeyCap[] = [
  { key: "Space", normal: " ", shift: " ", finger: "thumb", width: 11 },
];

export const KEYBOARD_ROWS: KeyCap[][] = [
  ROW_NUMBER,
  ROW_TOP,
  ROW_HOME,
  ROW_BOTTOM,
  ROW_SPACE,
];

// Every key that carries a Devanagari glyph, flattened -- used to build
// the "which key do I press for this glyph" reverse lookup and the
// key-explorer grid on the Instructions step.
export const GLYPH_KEYS: KeyCap[] = KEYBOARD_ROWS.flat().filter(
  (cap) => cap.key.length === 1 && cap.key !== " ",
);

export type KeyLesson = {
  id: string;
  title: string;
  /** Physical keys introduced in this lesson (for the heading + keyboard focus ring). */
  focusKeys: string[];
  /** Drill groups, authored in Unicode Hindi; converted to Kruti Dev bytes on the server. */
  drills: string[];
};

// Progressive: home row first (strongest keys), then reaches out. Every
// drill word only uses glyphs from this lesson plus every earlier one.
export const KEY_LESSONS: KeyLesson[] = [
  {
    id: "l1",
    title: "पाठ 1 — क  र  (d j)",
    focusKeys: ["d", "j"],
    drills: ["कर करक रकर कक रर", "कर रक कर रक कररक", "रकरक कररक रकर कर"],
  },
  {
    id: "l2",
    title: "पाठ 2 — ा  ी  (k h)",
    focusKeys: ["k", "h"],
    drills: ["का रा कार रार", "की री कारी रीका", "कारी रकार राका कीरा"],
  },
  {
    id: "l3",
    title: "पाठ 3 — ह  (g)",
    focusKeys: ["g"],
    drills: ["हर हार हारी हरी", "हा हा हाहा राही", "हीरा हरी हार कहार"],
  },
  {
    id: "l4",
    title: "पाठ 4 — स  (l)",
    focusKeys: ["l"],
    drills: ["सर सार सारी हरस", "रस रास सरहर सहसा", "सराहा हसरस सारस"],
  },
  {
    id: "l5",
    title: "पाठ 5 — े  (s)",
    focusKeys: ["s"],
    drills: ["के रे सेर हेर", "सेहरा केसर हेरा", "रेस सेरा हेरे केरे"],
  },
  {
    id: "l6",
    title: "पाठ 6 — ि  ं  य  (f a ;)",
    focusKeys: ["f", "a", ";"],
    drills: ["यह किस रिस हिस", "कहीं यहीं सहसा", "किसी यकीन हरियस"],
  },
  {
    id: "l7",
    title: "पाठ 7 — त  ज  (r t)",
    focusKeys: ["r", "t"],
    drills: ["तर तार जार जीत", "जाति रीति ताकत", "जरा तेरा जीरा तीर"],
  },
  {
    id: "l8",
    title: "पाठ 8 — म  न  (e u)",
    focusKeys: ["e", "u"],
    drills: ["मन नमन मान नाम", "मीना नाना मनन", "नमक मकान नियम"],
  },
  {
    id: "l9",
    title: "पाठ 9 — प  व  च  (i o p)",
    focusKeys: ["i", "o", "p"],
    drills: ["पर पार पवन चयन", "वचन विचार पावन", "चावल पानी वीर चीर"],
  },
  {
    id: "l10",
    title: "पाठ 10 — ल  ग  ब  (y x c)",
    focusKeys: ["y", "x", "c"],
    drills: ["लाल बाग बगल गला", "बालक कमल सबल", "गगन लगन बचत जंगल"],
  },
  {
    id: "l11",
    title: "पाठ 11 — द  अ  इ  उ  (n v b m)",
    focusKeys: ["n", "v", "b", "m"],
    drills: ["अब दर उदय इधर", "अनार अदब उबल", "दिन उधार अपना इनाम"],
  },
  {
    id: "l12",
    title: "पाठ 12 — ु  ू  ृ  (q w `)",
    focusKeys: ["q", "w", "`"],
    drills: ["गुण सुख दुख कृपा", "पूरा सूरज गुरु", "कृषि मृदु रुचि धुन"],
  },
  {
    id: "l13",
    title: "पाठ 13 — ो  ौ  (a+s)",
    focusKeys: ["a", "s"],
    drills: ["को सो रोज मोर", "बोल तोल कौन दौर", "सोना रोटी चोर औरत"],
  },
  {
    id: "l14",
    title: "पाठ 14 — आधे अक्षर  (Shift + D R T U L)",
    focusKeys: ["D", "R", "T", "U", "L"],
    drills: ["सत्य नित्य कर्म धर्म", "स्वर वस्तु सक्ति", "अस्त पुस्तक समस्या"],
  },
  {
    id: "l15",
    title: "पाठ 15 — संयुक्त अक्षर  (Z { J K)",
    focusKeys: ["Z", "{", "J", "K"],
    drills: ["ज्ञान क्षमा श्रम कर्ज", "राष्ट्र विज्ञान प्रश्न", "क्षेत्र श्रेणी अक्षर"],
  },
  {
    id: "l16",
    title: "पाठ 16 — अंक और चिह्न  (1 2 3 . ,)",
    focusKeys: ["1", "2", "3", ".", ","],
    drills: ["12 34 56 78 90", "राम, श्याम, मोहन।", "पृष्ठ 15, अध्याय 3।"],
  },
];

export type WordSet = { id: string; title: string; words: string[] };

export const WORD_SETS: WordSet[] = [
  {
    id: "w1",
    title: "शब्द समूह 1 — सरल दो अक्षर",
    words: "कल जल फल थल हम तुम कब जब सब अब घर डर मन धन कण रण वन तन गया लिया दिया".split(" "),
  },
  {
    id: "w2",
    title: "शब्द समूह 2 — तीन अक्षर",
    words: "कमल कपड़ा नगर सड़क मकान समय जीवन दुनिया रचना कहानी परिवार विद्यालय पुस्तक अध्यापक विद्यार्थी".split(" "),
  },
  {
    id: "w3",
    title: "शब्द समूह 3 — मात्राओं का अभ्यास",
    words: "पानी नानी दादी चाची मामा काका रोटी मोती सोना रोना गाना खाना पीना सीना जीना हीरा".split(" "),
  },
  {
    id: "w4",
    title: "शब्द समूह 4 — संयुक्त अक्षर",
    words: "ज्ञान विज्ञान प्रयोग प्रश्न क्षेत्र क्षमता राष्ट्र स्वास्थ्य विश्वास श्रम श्रेय अध्ययन उद्योग विद्युत मुख्य".split(" "),
  },
  {
    id: "w5",
    title: "शब्द समूह 5 — रेफ और आधे अक्षर",
    words: "कर्म धर्म वर्ष सूर्य कार्य पूर्ण अर्थ स्पर्श गर्व दर्द मार्ग वर्ग सर्दी बर्फ चर्चा".split(" "),
  },
  {
    id: "w6",
    title: "शब्द समूह 6 — दैनिक जीवन",
    words: "सुबह शाम दोपहर रात दिन सप्ताह महीना वर्ष घंटा मिनट सेकंड आज कल परसों अभी".split(" "),
  },
  {
    id: "w7",
    title: "शब्द समूह 7 — प्रकृति",
    words: "नदी पर्वत सागर आकाश धरती सूरज चंद्रमा तारा बादल वर्षा हवा आग मिट्टी वृक्ष फूल".split(" "),
  },
  {
    id: "w8",
    title: "शब्द समूह 8 — कार्यालय",
    words: "पत्र फाइल आवेदन हस्ताक्षर अधिकारी कर्मचारी विभाग कार्यालय बैठक सूचना आदेश नियम प्रस्ताव रिपोर्ट परियोजना".split(" "),
  },
  {
    id: "w9",
    title: "शब्द समूह 9 — शिक्षा",
    words: "शिक्षक छात्र कक्षा परीक्षा प्रश्नपत्र उत्तर अंक परिणाम प्रमाणपत्र पाठ्यक्रम पुस्तकालय प्रयोगशाला शोध ज्ञान कौशल".split(" "),
  },
  {
    id: "w10",
    title: "शब्द समूह 10 — समाज और देश",
    words: "भारत राष्ट्र नागरिक समाज संस्कृति परंपरा स्वतंत्रता अधिकार कर्तव्य लोकतंत्र संविधान न्याय समानता एकता विकास".split(" "),
  },
  {
    id: "w11",
    title: "शब्द समूह 11 — भाव और गुण",
    words: "प्रेम स्नेह करुणा दया क्षमा साहस धैर्य विनम्रता सच्चाई ईमानदारी परिश्रम लगन उत्साह आत्मविश्वास सहनशीलता".split(" "),
  },
  {
    id: "w12",
    title: "शब्द समूह 12 — मिश्रित कठिन शब्द",
    words: "उत्तरदायित्व प्रतिनिधित्व अंतरराष्ट्रीय व्यावसायिक वैज्ञानिक तकनीकी संवैधानिक प्रशासनिक बुनियादी संरचना क्रियान्वयन मूल्यांकन प्रोत्साहन उपलब्धि सशक्तिकरण".split(" "),
  },
];

export type Paragraph = { id: string; title: string; text: string };

export const PARAGRAPHS: Paragraph[] = [
  {
    id: "p1",
    title: "अनुच्छेद 1 — परिचय",
    text: "हिन्दी हमारी राजभाषा है और यह करोड़ों लोगों के मन की भाषा है। कंप्यूटर पर हिन्दी टाइप करना अब पहले से कहीं आसान हो गया है। जो व्यक्ति नियमित अभ्यास करता है वह कुछ ही सप्ताह में अच्छी गति प्राप्त कर लेता है। सही अंगुली से सही कुंजी दबाना ही तेज़ टाइपिंग का पहला नियम है।",
  },
  {
    id: "p2",
    title: "अनुच्छेद 2 — अभ्यास का महत्व",
    text: "किसी भी कौशल को सीखने के लिए धैर्य और निरंतर अभ्यास सबसे ज़रूरी है। आरंभ में गति धीमी रहती है और गलतियाँ भी होती हैं, परंतु घबराना नहीं चाहिए। प्रतिदिन आधा घंटा अभ्यास करने से हाथ कुंजियों की स्थिति याद कर लेते हैं। धीरे धीरे बिना कीबोर्ड देखे टाइप करना संभव हो जाता है।",
  },
  {
    id: "p3",
    title: "अनुच्छेद 3 — शुद्धता पहले",
    text: "टाइपिंग सीखते समय गति से अधिक शुद्धता पर ध्यान देना चाहिए। यदि आप शुरू से ही सही कुंजी दबाने की आदत डालेंगे तो गति अपने आप बढ़ जाएगी। बार बार की गई गलती एक आदत बन जाती है जिसे बाद में सुधारना कठिन होता है। इसलिए हर शब्द को ध्यान से और सही ढंग से टाइप करें।",
  },
  {
    id: "p4",
    title: "अनुच्छेद 4 — कार्यालयी पत्र",
    text: "सेवा में, श्रीमान कार्यालय अध्यक्ष महोदय। विषय, कार्यालय में हिन्दी टाइपिंग प्रशिक्षण आरंभ करने के संबंध में। महोदय, निवेदन है कि विभाग के कर्मचारियों को हिन्दी में कार्य करने में कठिनाई होती है। अतः अनुरोध है कि एक प्रशिक्षण कार्यक्रम आयोजित किया जाए ताकि सभी कर्मचारी शुद्ध और तेज़ हिन्दी टाइप कर सकें।",
  },
  {
    id: "p5",
    title: "अनुच्छेद 5 — समाचार शैली",
    text: "राज्य सरकार ने कहा है कि आगामी वर्ष से सभी सरकारी कार्यालयों में कामकाज मुख्य रूप से हिन्दी में किया जाएगा। इसके लिए कर्मचारियों को विशेष प्रशिक्षण दिया जाएगा और आवश्यक सुविधाएँ उपलब्ध कराई जाएँगी। अधिकारियों का मानना है कि इस कदम से आम नागरिकों को अपनी बात रखने में सुविधा होगी।",
  },
  {
    id: "p6",
    title: "अनुच्छेद 6 — प्रेरणा",
    text: "सफलता उन्हीं को मिलती है जो कठिन परिश्रम से नहीं घबराते। रास्ते में आने वाली बाधाएँ हमें रोकने के लिए नहीं, बल्कि हमें मज़बूत बनाने के लिए होती हैं। जो लोग हार नहीं मानते और लगातार प्रयास करते रहते हैं, समय आने पर वे अवश्य अपने लक्ष्य तक पहुँचते हैं। आत्मविश्वास बनाए रखें और आगे बढ़ते रहें।",
  },
  {
    id: "p7",
    title: "अनुच्छेद 7 — तकनीक और भविष्य",
    text: "आज का युग सूचना और तकनीक का युग है। जो देश नई तकनीक को जल्दी अपनाते हैं वे तेज़ी से विकास करते हैं। हमें अपनी भाषा में विज्ञान, गणित और तकनीक का ज्ञान बढ़ाना होगा ताकि हर विद्यार्थी बिना किसी झिझक के नए विषयों को समझ सके। भाषा केवल बोलचाल का साधन नहीं, बल्कि सोचने और सीखने का आधार है।",
  },
  {
    id: "p8",
    title: "अनुच्छेद 8 — दीर्घ अभ्यास",
    text: "एक अच्छा टंकक बनने के लिए यह आवश्यक है कि हाथों की मुद्रा सही हो, कमर सीधी हो और आँखें स्क्रीन पर टिकी रहें। कुंजीपटल को बार बार देखने की आदत गति को कम करती है। आरंभ में यह कठिन लगता है, परंतु कुछ दिनों के नियमित अभ्यास के बाद अंगुलियाँ स्वयं सही कुंजी तक पहुँचने लगती हैं। प्रतिदिन नए शब्दों और अनुच्छेदों का अभ्यास करने से शब्द भंडार भी बढ़ता है और आत्मविश्वास भी। यही निरंतरता एक साधारण विद्यार्थी को कुशल टंकक बना देती है।",
  },
];
