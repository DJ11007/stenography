// The "=rand()" shortcut for the admin document designer, like Word's own:
//   =rand()      then Enter fills the document with 5 paragraphs of 4 lines each
//   =rand(6,3)   gives 6 paragraphs of 3 lines each
// Each "line" is one sentence of about a line's worth of words, so the paragraphs come out
// roughly the requested length without anyone having to type a whole document.

export type RandCommand = { paragraphs: number; lines: number };
export const DEFAULT_RAND: RandCommand = { paragraphs: 5, lines: 4 };
export const MAX_RAND_PARAGRAPHS = 50, MAX_RAND_LINES = 20;

// null when the text is not a =rand command at all (so Enter behaves normally).
export function parseRandCommand(text: string): RandCommand | null {
  const match = /^=rand\(\s*(?:(\d{1,4})\s*(?:,\s*(\d{1,4})\s*)?)?\)$/i.exec(text.trim());
  if (!match) return null;
  const paragraphs = match[1] === undefined ? DEFAULT_RAND.paragraphs : Number(match[1]);
  const lines = match[2] === undefined ? DEFAULT_RAND.lines : Number(match[2]);
  if (paragraphs < 1 || lines < 1) return null;
  return { paragraphs: Math.min(paragraphs, MAX_RAND_PARAGRAPHS), lines: Math.min(lines, MAX_RAND_LINES) };
}

const SUBJECTS = [
  "The students", "Every teacher", "A careful reader", "The committee", "Our local library", "The new report", "An experienced writer", "The city council",
  "Most families", "The young engineers", "A friendly neighbour", "The village school", "Several visitors", "The head of the department", "A group of volunteers", "The morning newspaper",
  "Our research team", "The railway staff", "An honest shopkeeper", "The final examination", "Many farmers", "The public hospital", "A quiet traveller", "The sports club",
];
const ACTIONS = [
  "prepared a detailed summary of", "carefully reviewed", "openly discussed several ideas about", "finally approved", "quickly collected information on", "gladly shared stories about",
  "patiently explained the details of", "published a short note on", "thoroughly checked", "calmly planned", "regularly recorded notes about", "happily organised",
  "clearly described", "proudly presented", "slowly considered", "successfully completed",
];
const OBJECTS = [
  "the annual budget", "the old market road", "the main reading room", "the monthly programme", "the new water supply", "the school garden", "the evening timetable", "the district fair",
  "the local history project", "the shared office space", "the community notice board", "the winter exhibition", "the city bus service", "the village health camp", "the quarterly accounts", "the central park",
];
const ENDINGS = [
  "before the meeting began on Monday.", "so that everyone could understand the plan.", "while the rain continued outside the hall.", "after a long and useful discussion.",
  "for the benefit of all the people nearby.", "because the deadline was drawing close.", "during the first week of the new term.", "with great care and a little humour.",
  "although the schedule was quite busy.", "in time for the festival at the end of the month.", "to make the work simple for newcomers.", "once the final papers had arrived.",
  "as the afternoon light slowly faded away.", "without any trouble from the staff.", "so the results could be shared on Friday.", "while the children watched with interest.",
];
const HINDI_SENTENCES = [
  "विद्यार्थी हर सुबह समय पर विद्यालय पहुँचकर अपनी कक्षा में ध्यान से पढ़ाई करते हैं।",
  "गाँव के लोग मिलकर तालाब की सफ़ाई करते हैं और सबको स्वच्छ पानी उपलब्ध कराते हैं।",
  "शिक्षक ने बच्चों को समझाया कि मेहनत और ईमानदारी से ही जीवन में सफलता मिलती है।",
  "नगर परिषद ने नई सड़क बनाने की योजना तैयार की और काम जल्दी शुरू करने का निर्णय लिया।",
  "किसान सुबह खेत पर जाकर फ़सल की देखभाल करते हैं और शाम को घर लौट आते हैं।",
  "पुस्तकालय में बैठकर पढ़ना एक अच्छी आदत है जिससे ज्ञान के साथ शांति भी मिलती है।",
  "अस्पताल के कर्मचारियों ने रोगियों की सेवा में दिन-रात लगकर सराहनीय कार्य किया।",
  "त्योहार के अवसर पर पूरे मोहल्ले में सजावट की गई और सभी ने मिलकर मिठाइयाँ बाँटीं।",
  "समाचार पत्र में छपी रिपोर्ट को पढ़कर नागरिकों ने अपने सुझाव प्रशासन तक पहुँचाए।",
  "रेलवे स्टेशन पर यात्रियों की भीड़ थी, फिर भी सारे काम व्यवस्थित ढंग से चल रहे थे।",
  "खेल के मैदान में बच्चों ने उत्साह के साथ भाग लिया और टीम भावना का परिचय दिया।",
  "समिति की बैठक में वार्षिक खर्च पर विस्तार से चर्चा हुई और सबकी सहमति से प्रस्ताव पारित हुआ।",
];

export function generateRandomParagraphs(paragraphs: number, lines: number, language: "English" | "Hindi" = "English", random: () => number = Math.random): string[] {
  const pick = (list: string[]) => list[Math.floor(random() * list.length) % list.length];
  const result: string[] = [];
  for (let p = 0; p < paragraphs; p++) {
    const used = new Set<string>();
    const sentences: string[] = [];
    for (let l = 0; l < lines; l++) {
      let sentence = "", guard = 0;
      do {
        sentence = language === "Hindi" ? pick(HINDI_SENTENCES) : `${pick(SUBJECTS)} ${pick(ACTIONS)} ${pick(OBJECTS)} ${pick(ENDINGS)}`;
      } while (used.has(sentence) && ++guard < 20);
      used.add(sentence);
      sentences.push(sentence);
    }
    result.push(sentences.join(" "));
  }
  return result;
}
