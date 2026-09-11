// QWERTY keyboard layout + a progressive English typing curriculum for the
// English learning simulator at /typing/learn/english-tutor. Unlike the
// Kruti Dev tutor, there is no font-encoding step here -- the key you press
// is the character shown, so lessons/words/paragraphs are typed exactly as
// authored.

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
  /** Character the unshifted key produces. */
  normal: string;
  /** Character Shift + key produces. */
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

// Every key that carries a printable character, flattened -- used to build
// the "which key do I press for this letter" reverse lookup and the
// key-explorer grid on the Instructions step.
export const GLYPH_KEYS: KeyCap[] = KEYBOARD_ROWS.flat().filter(
  (cap) => cap.key.length === 1 && cap.key !== " ",
);

export type KeyLesson = {
  id: string;
  title: string;
  /** Physical keys introduced in this lesson (for the heading + keyboard focus ring). */
  focusKeys: string[];
  /** Drill groups. */
  drills: string[];
};

// Progressive: home row first (strongest fingers), then reaches outward.
// Every drill line only uses letters from this lesson plus every earlier one.
export const KEY_LESSONS: KeyLesson[] = [
  {
    id: "l1",
    title: "Lesson 1 — Home Row (a s d f j k l ;)",
    focusKeys: ["a", "s", "d", "f", "j", "k", "l", ";"],
    drills: ["asdf jkl; asdf jkl;", "aa ss dd ff jj kk ll ;;", "a lass falls; ask dad; a sad fall"],
  },
  {
    id: "l2",
    title: "Lesson 2 — e i",
    focusKeys: ["e", "i"],
    drills: ["ei ie ei ie", "kid lake idea sail", "a sad idea; a silk desk; side lake"],
  },
  {
    id: "l3",
    title: "Lesson 3 — r u",
    focusKeys: ["r", "u"],
    drills: ["ur ru ur ru", "surf jury dark risk", "a dark jar; a full jug; a rude risk"],
  },
  {
    id: "l4",
    title: "Lesson 4 — t y",
    focusKeys: ["t", "y"],
    drills: ["ty yt ty yt", "tray style dusty", "a tidy list; try it; a rusty tray"],
  },
  {
    id: "l5",
    title: "Lesson 5 — g h",
    focusKeys: ["g", "h"],
    drills: ["gh hg gh hg", "high light flash", "a light gas; he has it; a huge flash"],
  },
  {
    id: "l6",
    title: "Lesson 6 — Shift & Capitals",
    focusKeys: ["Shift"],
    drills: ["Asdf Jkl; Lisa Dad", "Ali Sara Delhi Kids", "Sara said Hi to Dad; Ask Dad First"],
  },
  {
    id: "l7",
    title: "Lesson 7 — o w",
    focusKeys: ["o", "w"],
    drills: ["ow wo ow wo", "world tower slow", "a low tower; grow slow; a wide world"],
  },
  {
    id: "l8",
    title: "Lesson 8 — n ,",
    focusKeys: ["n", ","],
    drills: ["n, ,n n, ,n", "not, run, sun,", "I run, you walk, we win, they lose."],
  },
  {
    id: "l9",
    title: "Lesson 9 — q p",
    focusKeys: ["q", "p"],
    drills: ["qp pq qp pq", "quiet paper quick", "a quiet park; type quick; a proud queen"],
  },
  {
    id: "l10",
    title: "Lesson 10 — c v",
    focusKeys: ["c", "v"],
    drills: ["cv vc cv vc", "voice cave clever", "a clever voice; save it; a vivid view"],
  },
  {
    id: "l11",
    title: "Lesson 11 — m b",
    focusKeys: ["m", "b"],
    drills: ["mb bm mb bm", "number combat problem", "a big number; blame him; a brave member"],
  },
  {
    id: "l12",
    title: "Lesson 12 — z x",
    focusKeys: ["z", "x"],
    drills: ["zx xz zx xz", "size fix zebra exact", "fix the size; a lazy fox; an exact zone"],
  },
  {
    id: "l13",
    title: "Lesson 13 — Number Row (1 2 3 4 5 6 7 8 9 0)",
    focusKeys: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
    drills: ["12 34 56 78 90", "2024 100 75 500", "Room 12, Page 45, Item 908, Year 2026"],
  },
  {
    id: "l14",
    title: "Lesson 14 — Punctuation ( . , ' \" )",
    focusKeys: [".", ",", "'", "\""],
    drills: [". , ' \" . , ' \"", "It's fine, he said.", "\"Stop!\" she said. It's done, finally."],
  },
  {
    id: "l15",
    title: "Lesson 15 — Full-Alphabet Combos",
    focusKeys: ["a", "z"],
    drills: ["the quick brown fox", "jumps over the lazy dog", "pack my box with five dozen liquor jugs"],
  },
  {
    id: "l16",
    title: "Lesson 16 — Sentence Practice",
    focusKeys: ["a", "z", "0", "9"],
    drills: ["Practice makes a person perfect.", "Success depends on hard work and patience.", "Typing speed improves with daily, focused practice."],
  },
];

export type WordSet = { id: string; title: string; words: string[] };

export const WORD_SETS: WordSet[] = [
  {
    id: "w1",
    title: "Word Set 1 — Basic Words",
    words: "cat dog sun run walk talk book desk lamp door wall floor chair table window".split(" "),
  },
  {
    id: "w2",
    title: "Word Set 2 — Common Verbs",
    words: "read write speak listen learn teach help share care grow build create solve plan".split(" "),
  },
  {
    id: "w3",
    title: "Word Set 3 — Numbers & Time",
    words: "today tomorrow morning evening night week month year hour minute second soon later now".split(" "),
  },
  {
    id: "w4",
    title: "Word Set 4 — Office Vocabulary",
    words: "letter file report meeting agenda memo email schedule deadline manager office document signature".split(" "),
  },
  {
    id: "w5",
    title: "Word Set 5 — Education",
    words: "student teacher school college exam result subject syllabus lecture library classroom homework project grade".split(" "),
  },
  {
    id: "w6",
    title: "Word Set 6 — Nature",
    words: "river mountain ocean forest desert valley island cloud storm breeze sunrise sunset season climate".split(" "),
  },
  {
    id: "w7",
    title: "Word Set 7 — Society & Nation",
    words: "nation citizen society culture tradition freedom justice equality unity government constitution democracy duty right".split(" "),
  },
  {
    id: "w8",
    title: "Word Set 8 — Emotions & Qualities",
    words: "honesty courage patience kindness confidence discipline respect gratitude humility wisdom strength hope trust care".split(" "),
  },
  {
    id: "w9",
    title: "Word Set 9 — Technology",
    words: "computer internet software keyboard mouse monitor printer network password website server database application system update".split(" "),
  },
  {
    id: "w10",
    title: "Word Set 10 — Business",
    words: "company market product customer service quality price profit budget strategy growth investment brand target".split(" "),
  },
  {
    id: "w11",
    title: "Word Set 11 — Health",
    words: "exercise nutrition sleep hydration wellness fitness balance hygiene checkup vaccine therapy recovery immunity strength".split(" "),
  },
  {
    id: "w12",
    title: "Word Set 12 — Mixed Advanced Words",
    words: "responsibility achievement opportunity knowledge experience communication organization environment development technology infrastructure innovation efficiency productivity".split(" "),
  },
];

export type Paragraph = { id: string; title: string; text: string };

export const PARAGRAPHS: Paragraph[] = [
  {
    id: "p1",
    title: "Paragraph 1 — Introduction",
    text: "English typing is one of the most useful skills for any student or working professional today. Almost every job, from government offices to private companies, expects basic computer and typing knowledge. Anyone who practises regularly can reach a good typing speed within a few weeks. The first rule of fast typing is always pressing the correct key with the correct finger.",
  },
  {
    id: "p2",
    title: "Paragraph 2 — The Importance of Practice",
    text: "Learning any skill requires patience and consistent practice, and typing is no exception. In the beginning, speed stays low and mistakes happen often, but there is no need to worry. Practising for even thirty minutes every day helps the fingers slowly memorise the position of each key. Over time, typing without looking at the keyboard becomes completely natural.",
  },
  {
    id: "p3",
    title: "Paragraph 3 — Accuracy Comes First",
    text: "While learning to type, accuracy should always matter more than raw speed. If you build the habit of pressing the right key from the very start, speed automatically improves on its own. A mistake repeated again and again slowly turns into a habit that becomes hard to correct later. So type every single word carefully and correctly, right from the first lesson.",
  },
  {
    id: "p4",
    title: "Paragraph 4 — A Formal Office Letter",
    text: "To, The Branch Manager, Samradhi Classes. Subject: Request to start a typing training programme. Sir, I would like to bring to your notice that many employees in our department face difficulty typing quickly and accurately in English. I therefore request that a short training programme be organised so that every staff member can type with better speed and accuracy.",
  },
  {
    id: "p5",
    title: "Paragraph 5 — News Style",
    text: "The state government announced today that all government offices will gradually shift most of their routine work to computers over the coming year. Officials said that employees would receive special training and that the necessary equipment would be provided at every office. Authorities believe this step will make government services faster and more convenient for ordinary citizens.",
  },
  {
    id: "p6",
    title: "Paragraph 6 — Motivation",
    text: "Success always belongs to those who are not afraid of hard work and steady effort. Obstacles along the way are not meant to stop us; they exist to make us stronger and more capable. People who never give up and keep trying, no matter how many times they fail, eventually reach their goal. Stay confident in your own ability and keep moving forward every single day.",
  },
  {
    id: "p7",
    title: "Paragraph 7 — Technology and the Future",
    text: "We are living in the age of information and rapid technology. Countries that adopt new technology quickly tend to develop and grow much faster than others. It has become essential to build strong knowledge of science, mathematics and computers so that every student can understand new subjects with confidence. Typing is simply the first small step on that much larger journey.",
  },
  {
    id: "p8",
    title: "Paragraph 8 — Extended Practice",
    text: "Becoming a genuinely good typist requires correct posture, a straight back, and eyes that stay fixed on the screen rather than the keyboard. Looking down at the keys again and again slows down your overall speed considerably. It feels difficult in the beginning, but after a few days of regular, focused practice the fingers begin finding the right keys almost by themselves. Practising new words and new paragraphs every single day steadily builds vocabulary as well as genuine self-confidence. This same quiet consistency is exactly what turns an ordinary beginner into a genuinely skilled and dependable typist over time.",
  },
];
