// Speed Booster, Hindi side (owner's request, 24 Nov 2026): the same drills as English, built around what slows Hindi
// typists -- matras (especially the छोटी इ typed before the letter), half letters, joined letters, the forms of र, and
// the dots (ं ँ ः ़). All text is written in Unicode; for Kruti Dev it is converted with unicodeToKrutiDev() for display
// and the typed text is decoded back with krutiDevToUnicode() before checking (see app/typing/speed-booster).

import type { BurstLevel } from "./speed-booster.ts";

export const HINDI_BURST_LEVELS: BurstLevel[] = [
  {
    id: 1,
    title: "सामान्य शब्द (Common words)",
    goal: "ये शब्द लगभग हर परीक्षा गद्यांश में आते हैं। इन्हें तब तक टाइप करें जब तक उंगलियाँ बिना सोचे चलने लगें।",
    sentences: [
      "राज्य सरकार ने जनता के हित में नई योजना शुरू की है।",
      "सभी विभागों को अपना कार्य समय पर पूरा करना चाहिए।",
      "इस योजना का लाभ गाँव के हर परिवार तक पहुँचना चाहिए।",
      "यह हमारे देश के विकास के लिए बहुत आवश्यक है।",
      "हम सबको मिलकर अपने गाँव और शहर को साफ रखना है।",
      "सरकार के द्वारा गरीब लोगों को सहायता दी जाती है।",
      "इसके अनुसार सभी कर्मचारी समय पर कार्यालय आएँगे।",
      "जनता को अपने अधिकार और कर्तव्य दोनों पता होने चाहिए।",
    ],
  },
  {
    id: 2,
    title: "मात्राएँ (ि ी ु ू े ै ो ौ)",
    goal: "छोटी इ की मात्रा (ि) अक्षर से पहले टाइप होती है। शब्द पूरा पढ़कर ही टाइप शुरू करें।",
    sentences: [
      "किसान खेत में मेहनत करके देश के लिए अनाज उगाता है।",
      "विद्यार्थियों को नियमित रूप से पुस्तकें पढ़नी चाहिए।",
      "पूजा और त्योहार हमारे जीवन में खुशियाँ लाते हैं।",
      "दिन भर की थकान के बाद मीठी नींद बहुत जरूरी है।",
      "बूढ़े दादाजी रोज सुबह बगीचे में टहलने जाते हैं।",
      "सिपाही ने ईमानदारी से अपनी ड्यूटी पूरी की।",
      "गुरु की सीख से शिष्य के जीवन की दिशा बदल जाती है।",
      "मौसम बदलने पर लोगों को सेहत का ध्यान रखना चाहिए।",
    ],
  },
  {
    id: 3,
    title: "आधे और संयुक्त अक्षर",
    goal: "आधे अक्षर (्य, ्र, ्व, स्, त्) और क्ष, त्र, ज्ञ, श्र से पहले रुकें नहीं, लय बनाए रखें।",
    sentences: [
      "प्रत्येक व्यक्ति को स्वच्छता का ध्यान रखना चाहिए।",
      "शिक्षा और स्वास्थ्य राष्ट्र की प्रगति के मुख्य आधार हैं।",
      "क्षेत्रीय अधिकारी ने विद्यालय का निरीक्षण किया।",
      "श्रमिकों की सुरक्षा के लिए विशेष व्यवस्था की गई।",
      "ज्ञान और परिश्रम से हर लक्ष्य प्राप्त किया जा सकता है।",
      "स्वतंत्रता संग्राम में अनेक वीरों ने बलिदान दिया।",
      "प्रशासन ने त्योहार पर यातायात की व्यवस्था सुधारी।",
      "छात्रों ने विज्ञान प्रदर्शनी में अपने मॉडल दिखाए।",
    ],
  },
  {
    id: 4,
    title: "लंबे शब्द (Long words)",
    goal: "लंबे शब्दों पर गति गिरती है। हर शब्द को बीच में रुके बिना पूरा करें।",
    sentences: [
      "प्रशासनिक व्यवस्था में पारदर्शिता अत्यंत आवश्यक है।",
      "पर्यावरण संरक्षण प्रत्येक नागरिक का उत्तरदायित्व है।",
      "कृषि क्षेत्र के विकास के लिए आधुनिक तकनीक आवश्यक है।",
      "संविधान सभी नागरिकों को मौलिक अधिकार प्रदान करता है।",
      "जनप्रतिनिधियों को जनसमस्याओं का शीघ्र समाधान करना चाहिए।",
      "औद्योगिक विकास से रोजगार के नए अवसर उत्पन्न होते हैं।",
      "स्वास्थ्य सेवाओं की गुणवत्ता में निरंतर सुधार हो रहा है।",
      "प्रतियोगी परीक्षाओं की तैयारी के लिए अनुशासन आवश्यक है।",
    ],
  },
  {
    id: 5,
    title: "विराम चिह्न और अंक (Exam style)",
    goal: "परीक्षा गद्यांश में अल्पविराम, कोष्ठक, प्रश्नचिह्न और अंक आते हैं। इन्हें जानबूझकर अभ्यास करें।",
    sentences: [
      "सरकार ने 15 अगस्त, 2025 को (नई दिल्ली में) योजना की घोषणा की।",
      // "प्रतिशत", not "%": in Kruti Dev the % key types the visarga (ः).
      "लगभग 70 प्रतिशत किसानों को इस योजना का लाभ मिला है।",
      "क्या आपने आज का समाचार-पत्र पढ़ा? यह बहुत उपयोगी है।",
      "बैठक में 120 सदस्य उपस्थित थे, जबकि 30 सदस्य अनुपस्थित रहे।",
      "राम, श्याम और मोहन ने क्रमशः 85, 78 और 91 अंक प्राप्त किए।",
      "जिलाधिकारी (कलेक्टर) ने सभी विभागों की समीक्षा की।",
      "इस वर्ष 2,500 नए विद्यालय खोले जाएँगे, ऐसा मंत्री ने कहा।",
      "क्या हर गाँव में स्वास्थ्य केंद्र होना चाहिए? हाँ, अवश्य।",
    ],
  },
];

export const HINDI_COMMON_WORDS = [
  "का", "की", "के", "है", "हैं", "और", "में", "से", "को", "पर", "लिए", "किया", "गया", "होता", "करने", "तथा", "यह", "वह",
  "इस", "उस", "एक", "भी", "नहीं", "था", "थे", "हो", "कर", "जो", "कि", "अपने", "अपना", "सभी", "किसी", "कुछ", "बहुत",
  "सरकार", "राज्य", "विभाग", "अधिकारी", "कार्य", "व्यवस्था", "योजना", "जनता", "विकास", "शिक्षा", "स्वास्थ्य", "किसान",
  "देश", "समाज", "प्रकार", "द्वारा", "अनुसार", "आवश्यक", "महत्वपूर्ण", "लोगों", "समय", "गाँव", "शहर", "परिवार", "जीवन",
  "भारत", "राजस्थान", "नागरिक", "अधिकार", "कर्तव्य", "सुविधा", "सेवा", "सहायता", "प्रत्येक", "कार्यालय", "कर्मचारी",
  "प्रशासन", "नियम", "कानून", "सूचना", "जानकारी", "प्राप्त", "उपयोग", "सुरक्षा", "पानी", "बच्चों", "महिलाओं", "युवाओं",
  "प्रगति", "आधार", "क्षेत्र", "स्थिति", "समस्या", "समाधान", "लाभ", "रूप", "साथ", "बाद", "पहले", "अब", "यदि", "इसलिए",
  "क्योंकि", "लेकिन", "परंतु", "अतः",
];

/** What a Hindi word contains, for the Weak Areas tab (a word can be in several groups). */
export const HINDI_FEATURES: { id: string; label: string; pattern: RegExp }[] = [
  { id: "i-matra", label: "छोटी इ की मात्रा (ि)", pattern: /ि/u },
  { id: "long-matra", label: "बड़ी मात्राएँ (ी ू ै ौ)", pattern: /[ीूैौ]/u },
  { id: "half", label: "आधे अक्षर (्)", pattern: /्/u },
  { id: "conjunct", label: "संयुक्त अक्षर (क्ष त्र ज्ञ श्र द्ध द्व)", pattern: /क्ष|त्र|ज्ञ|श्र|द्ध|द्व|द्य/u },
  { id: "ra", label: "र के रूप (र्, ्र)", pattern: /र्|्र/u },
  { id: "dots", label: "बिंदु (ं ँ ः)", pattern: /[ंँः]/u },
  { id: "nukta", label: "नुक्ता (ड़ ढ़ ज़)", pattern: /[़ड़ढ़]/u },
  { id: "shift", label: "Shift वाले अक्षर (ख घ छ झ ठ ढ थ ध फ भ)", pattern: /[खघछझठढथधफभ]/u },
];

// Drill words for every group above (each group has at least 10).
export const HINDI_DRILL_WORDS = [
  "किसान", "विकास", "शिक्षा", "नियम", "स्थिति", "दिन", "किताब", "मिलकर", "विभाग", "सिपाही", "दिशा", "निर्णय", "परिवार", "विचार", "हिस्सा",
  "जीवन", "नीति", "पूजा", "मूल्य", "सैनिक", "मौसम", "दूध", "सीमा", "कौशल", "नींद", "भूमि", "ऊर्जा", "पैसा", "औषधि", "तैयारी",
  "व्यक्ति", "प्रदेश", "स्वच्छ", "स्थान", "त्योहार", "व्यवस्था", "स्वास्थ्य", "अध्यक्ष", "न्याय", "सम्मान", "उद्योग", "पुस्तक", "बच्चा", "अच्छा", "स्कूल",
  "क्षेत्र", "ज्ञान", "श्रमिक", "शुद्ध", "विद्यालय", "द्वार", "परीक्षा", "सुरक्षा", "पत्र", "मित्र", "श्रेष्ठ", "युद्ध", "विज्ञान", "यात्रा", "रक्षा",
  "कर्म", "धर्म", "पूर्ण", "प्रकार", "क्रम", "राष्ट्र", "सर्वोच्च", "प्रयास", "कार्य", "अर्थ", "प्रश्न", "निर्माण", "ग्राम", "प्रगति", "वर्ष",
  "संस्था", "पाँच", "अतः", "हिंदी", "गाँव", "संविधान", "आँख", "अंक", "मंत्री", "कहाँ", "संसद", "चाँद", "पहुँच", "अंतर", "दुःख",
  "सड़क", "पढ़ाई", "बढ़ना", "लड़का", "बड़ा", "पेड़", "गढ़", "चढ़ना", "ज़मीन", "थोड़ा", "जोड़", "मोड़", "ठंड", "भीड़", "घड़ी",
  "खेत", "घर", "छात्र", "झंडा", "ठीक", "ढोल", "थाना", "धन", "फल", "भवन", "खाना", "घटना", "छोटा", "धरती", "भारत", "फसल",
];

export const HINDI_RHYTHM_PASSAGES = [
  "टाइपिंग की गति उंगलियों को तेज चलाने से नहीं आती, बल्कि बिना रुके चलाने से आती है। अच्छा टाइपिस्ट घड़ी की टिक-टिक की तरह एक समान लय में टाइप करता है। वह आसान शब्दों पर जल्दबाजी नहीं करता और कठिन शब्दों पर रुकता नहीं है। उसकी आँखें हमेशा एक शब्द आगे रहती हैं।",
  "हर सरकारी कार्यालय का काम सही और साफ रिकॉर्ड पर निर्भर करता है। जो लिपिक तेज और शुद्ध टाइप करता है, वह पूरे विभाग का समय बचाता है। पत्रों के उत्तर समय पर जाते हैं, फाइलें बिना देरी के आगे बढ़ती हैं और जनता को अच्छी सेवा मिलती है।",
  "राजस्थान में पानी सबसे कीमती संसाधन है। यहाँ वर्षा बहुत कम होती है, इसलिए पानी की हर बूँद बचानी चाहिए। गाँव के लोग तालाब, बावड़ी और टांके बनाकर वर्षा का पानी जमा करते हैं। जब लोग पानी का सही उपयोग करते हैं, तब कुएँ भरे रहते हैं और खेत हरे रहते हैं।",
  "किसी भी कौशल में सफलता का रहस्य नियमित अभ्यास है। जो विद्यार्थी रोज तीस मिनट अभ्यास करता है, वह सप्ताह में एक बार तीन घंटे अभ्यास करने वाले से जल्दी आगे बढ़ता है। छोटे दैनिक प्रयास अच्छी आदतें बनाते हैं और अच्छी आदतें स्थायी परिणाम देती हैं।",
];

export type FeatureStats = Record<string, { hits: number; misses: number }>;

const splitWords = (text: string) => text.trim().split(/\s+/u).filter(Boolean);

/** For each typed word: every group its passage word belongs to counts a hit (typed right) or a miss (typed wrong). */
export function featureStatsFrom(targetUnicode: string, typedUnicode: string): FeatureStats {
  const stats: FeatureStats = {};
  const target = splitWords(targetUnicode);
  splitWords(typedUnicode).forEach((word, index) => {
    const expected = target[index];
    if (!expected) return;
    const right = word.normalize("NFC") === expected.normalize("NFC");
    for (const feature of HINDI_FEATURES) {
      if (!feature.pattern.test(expected)) continue;
      stats[feature.id] ??= { hits: 0, misses: 0 };
      stats[feature.id][right ? "hits" : "misses"] += 1;
    }
  });
  return stats;
}

export function weakestFeatures(stats: FeatureStats, count = 3, minimumSeen = 4): { id: string; label: string; missRate: number }[] {
  return HINDI_FEATURES
    .map((feature) => { const stat = stats[feature.id]; const seen = stat ? stat.hits + stat.misses : 0; return { ...feature, seen, missRate: seen ? stat!.misses / seen : 0 }; })
    .filter((entry) => entry.seen >= minimumSeen && entry.missRate > 0)
    .sort((a, b) => b.missRate - a.missRate || b.seen - a.seen)
    .slice(0, count)
    .map(({ id, label, missRate }) => ({ id, label, missRate }));
}

/** A drill line of Hindi words from the chosen groups (all words when none is chosen). */
export function hindiFeatureDrill(featureIds: string[], count = 20, random: () => number = Math.random): string {
  const features = HINDI_FEATURES.filter((feature) => featureIds.includes(feature.id));
  const pool = features.length ? HINDI_DRILL_WORDS.filter((word) => features.some((feature) => feature.pattern.test(word))) : HINDI_DRILL_WORDS;
  const source = pool.length ? pool : HINDI_DRILL_WORDS;
  return Array.from({ length: count }, () => source[Math.floor(random() * source.length)]).join(" ");
}

export function hindiCommonWordsDrill(count = 25, random: () => number = Math.random): string {
  return Array.from({ length: count }, () => HINDI_COMMON_WORDS[Math.floor(random() * HINDI_COMMON_WORDS.length)]).join(" ");
}
