// Speed Booster (/typing/speed-booster): drills for a student stuck at 35-40 WPM who wants 50+.
// Everything here is plain data and pure functions so the page and the tests share one source.

export type BurstLevel = { id: number; title: string; goal: string; sentences: string[] };

// Short sentences typed as fast as possible for 15-20 seconds (burst training).
export const BURST_LEVELS: BurstLevel[] = [
  {
    id: 1,
    title: "Common words",
    goal: "Words that appear in almost every exam passage. Type them until they feel like one movement.",
    sentences: [
      "The people of the state should know their rights and duties.",
      "It is the duty of the government to help the poor and the weak.",
      "This is one of the most important parts of our daily life.",
      "There are many benefits of this scheme for the common man.",
      "We should work hard and keep our homes and streets clean.",
      "Thus, the nation saves a considerable amount of time and money.",
      "It also means that every citizen has a role to play in the work.",
      "The students must read the paper and write their answers on time.",
    ],
  },
  {
    id: 2,
    title: "Every letter of the alphabet",
    goal: "Each sentence uses all 26 letters, so every finger gets work.",
    sentences: [
      "The quick brown fox jumps over the lazy dog.",
      "Pack my box with five dozen liquor jugs.",
      "Jackdaws love my big sphinx of quartz.",
      "A wizard's job is to vex chumps quickly in fog.",
      "The five boxing wizards jump quickly over the fence.",
      "How vexingly quick daft zebras jump over the log.",
      "Sixty zippers were quickly picked from the woven jute bag.",
      "Grumpy wizards make a toxic brew for the evil queen and jack.",
    ],
  },
  {
    id: 3,
    title: "Weak keys (b, v, y, q, x, z, w)",
    goal: "The keys most students slow down on. Keep the same rhythm on them.",
    sentences: [
      "Every year, the young voters vote very wisely in the by-election.",
      "The busy bank branch gave a quick loan to a brave woman.",
      "Twelve heavy boxes of wax were moved by the van yesterday.",
      "Their quiet query was answered by the zonal officer at once.",
      "We must save water, grow trees and avoid waste every week.",
      "The lazy boy was vexed by the buzzing of seventy wasps.",
      "Your boss will review the yearly budget by the next week.",
      "Above the valley, a cozy wooden box was visible to everybody.",
    ],
  },
  {
    id: 4,
    title: "Long exam words",
    goal: "Long words are where speed drops. Type each one without stopping in the middle.",
    sentences: [
      "The government departments should improve their administrative efficiency.",
      "Transparency and accountability strengthen public trust in institutions.",
      "Environmental protection is the responsibility of every citizen.",
      "The Constitution guarantees fundamental rights to all individuals.",
      "Agricultural development requires irrigation, fertilisers and technology.",
      "Communication between departments prevents unnecessary misunderstanding.",
      "Infrastructure development creates employment opportunities in villages.",
      "Implementation of welfare programmes depends on honest administration.",
    ],
  },
  {
    id: 5,
    title: "Punctuation, capitals and numbers",
    goal: "Exam passages are full of commas, brackets, Shift and numbers. Train them on purpose.",
    sentences: [
      "However, the officer said, \"The file (No. 245) must reach Jaipur by Monday.\"",
      "About 40% of students read for less than one hour in a whole week.",
      "Rs. 1,00,000 was given to the self-help group under the new scheme.",
      "Is the well-known long-term plan useful for the nation's farmers?",
      "Perhaps the most simple/effective method is to practise every day.",
      "The meeting (held on 15 July) was attended by 120 members.",
      "Dr. Sharma's report, dated 2 October, was sent to the Collector.",
      "Ram, Shyam and Mohan scored 85%, 78% and 91% in the test.",
    ],
  },
];

// The most frequent words of exam passages (common English words plus the long words of government/office topics).
export const COMMON_EXAM_WORDS = [
  "the", "of", "and", "to", "in", "is", "that", "for", "it", "as", "with", "be", "on", "are", "this", "by", "an", "not",
  "which", "or", "from", "have", "their", "they", "has", "was", "all", "also", "can", "should", "more", "but", "will",
  "its", "one", "other", "these", "people", "public", "government", "state", "country", "nation", "work", "time",
  "important", "development", "every", "many", "most", "must", "only", "such", "into", "than", "them", "who", "when",
  "there", "been", "would", "about", "through", "because", "between", "however", "therefore", "thus", "hence", "while",
  "citizen", "citizens", "office", "officer", "service", "services", "scheme", "schemes", "village", "villages", "family",
  "health", "education", "water", "money", "students", "system", "society", "children", "women", "rural", "economic",
  "social", "national", "benefits", "example", "problem", "effort", "information", "responsibility", "considerable",
];

// Words grouped for drills of chosen letters. Every letter of the alphabet is covered several times.
export const WEAK_KEY_WORD_BANK = [
  "above", "absent", "able", "about", "backbone", "bank", "basic", "begin", "below", "benefit", "best", "between", "big", "board",
  "body", "book", "border", "both", "brave", "break", "bridge", "bring", "brown", "budget", "build", "busy", "buy", "cabinet",
  "cozy", "crazy", "daily", "dozen", "every", "evening", "even", "event", "evidence", "evil", "exact", "exam", "example",
  "excel", "except", "exchange", "excuse", "exercise", "exist", "expect", "expert", "explain", "export", "extra", "fix",
  "flex", "fox", "frozen", "fuzzy", "give", "glove", "gravy", "groove", "have", "heavy", "hazard", "jack", "jam", "jar",
  "jeep", "jewel", "job", "join", "joint", "joke", "journal", "journey", "joy", "judge", "jug", "juice", "jump", "junior",
  "just", "justice", "keep", "key", "kind", "king", "kit", "knee", "knife", "knock", "know", "knowledge", "lazy", "level",
  "liquid", "lively", "love", "maximum", "mixed", "move", "never", "next", "novel", "obey", "observe", "oxygen", "pack",
  "pizza", "prize", "proxy", "quality", "quantity", "quarter", "queen", "query", "question", "queue", "quick", "quickly",
  "quiet", "quit", "quite", "quiz", "quota", "quote", "relax", "remove", "require", "review", "save", "seventy", "silver",
  "size", "sixty", "solve", "squeeze", "subject", "survey", "tax", "taxi", "text", "very", "vexed", "view", "village",
  "virtue", "visit", "visible", "vital", "voice", "vote", "voter", "wax", "way", "weak", "wealth", "week", "weekly", "well",
  "wide", "wise", "wizard", "woman", "work", "world", "worry", "yard", "year", "yearly", "yellow", "yes", "yesterday", "yet",
  "young", "your", "youth", "zeal", "zebra", "zero", "zigzag", "zinc", "zip", "zone", "zonal", "zoo", "zoom",
];

// Paragraphs for the rhythm / read-ahead drill (original text in the RSMSSB/NTPC passage style).
export const RHYTHM_PASSAGES = [
  "Typing speed does not come from moving the fingers faster. It comes from moving them without stopping. A good typist keeps a steady beat, like the ticking of a clock, and does not rush the easy words or freeze on the hard ones. The eyes stay one word ahead of the hands, so the next word is already known before the fingers reach it.",
  "Every government office depends on clear and accurate records. A clerk who types quickly and correctly saves time for the whole department. Letters are replied to on time, files move without delay and the public receives better service. This is why typing tests are an important part of many recruitment examinations.",
  "Water is one of the most precious resources of Rajasthan. The state receives very little rain, and every drop must be saved. Villages build ponds, check dams and tankas to store rainwater for the dry months. When people use water wisely, the wells stay full and the fields stay green.",
  "Regular practice is the secret of success in any skill. A student who practises for thirty minutes every day improves faster than one who practises for three hours once a week. Small daily efforts build strong habits, and strong habits bring lasting results.",
];

export type TypingResult = {
  elapsedMs: number;
  grossWpm: number;
  netWpm: number;
  accuracy: number;
  mistakes: number;
  totalWords: number;
};

const words = (text: string) => text.trim().split(/\s+/u).filter(Boolean);

/** Word-by-word check (exam style): a word typed differently from the passage word in the same place is one mistake. */
export function scoreTyping(target: string, typed: string, elapsedMs: number): TypingResult {
  const targetWords = words(target);
  const typedWords = words(typed);
  const minutes = Math.max(elapsedMs, 1000) / 60000;
  let mistakes = 0;
  let correctChars = 0;
  typedWords.forEach((word, index) => {
    if (word === targetWords[index]) correctChars += word.length + 1;
    else mistakes += 1;
  });
  const typedChars = typedWords.reduce((sum, word) => sum + word.length + 1, 0);
  const grossWpm = Math.round(typedChars / 5 / minutes);
  const netWpm = Math.round(correctChars / 5 / minutes);
  const accuracy = typedWords.length ? Math.round(((typedWords.length - mistakes) / typedWords.length) * 1000) / 10 : 0;
  return { elapsedMs, grossWpm, netWpm, accuracy, mistakes, totalWords: typedWords.length };
}

export type KeyStats = Record<string, { hits: number; misses: number }>;

/** Which letters were typed correctly and which were missed (the first wrong letter of each wrong word). */
export function keyStatsFrom(target: string, typed: string): KeyStats {
  const stats: KeyStats = {};
  const add = (ch: string, field: "hits" | "misses") => {
    const key = ch.toLowerCase();
    if (!/^[a-z]$/u.test(key)) return;
    stats[key] ??= { hits: 0, misses: 0 };
    stats[key][field] += 1;
  };
  const targetWords = words(target);
  words(typed).forEach((word, index) => {
    const expected = targetWords[index];
    if (!expected) return;
    if (word === expected) { [...expected].forEach((ch) => add(ch, "hits")); return; }
    const at = [...expected].findIndex((ch, i) => word[i] !== ch);
    [...expected].forEach((ch, i) => add(ch, i === at ? "misses" : "hits"));
  });
  return stats;
}

export function mergeKeyStats(base: KeyStats, extra: KeyStats): KeyStats {
  const merged: KeyStats = { ...base };
  for (const [key, value] of Object.entries(extra)) {
    const current = merged[key] ?? { hits: 0, misses: 0 };
    merged[key] = { hits: current.hits + value.hits, misses: current.misses + value.misses };
  }
  return merged;
}

/** Letters with the highest miss rate (at least `minimumSeen` presses so one slip does not count). */
export function weakestKeys(stats: KeyStats, count = 5, minimumSeen = 5): { key: string; missRate: number }[] {
  return Object.entries(stats)
    .map(([key, { hits, misses }]) => ({ key, seen: hits + misses, missRate: hits + misses ? misses / (hits + misses) : 0 }))
    .filter((entry) => entry.seen >= minimumSeen && entry.missRate > 0)
    .sort((a, b) => b.missRate - a.missRate || b.seen - a.seen)
    .slice(0, count)
    .map(({ key, missRate }) => ({ key, missRate }));
}

/** A drill line of `count` words that contain the chosen letters (random order; `random` is injectable for tests). */
export function weakKeyDrill(letters: string[], count = 24, random: () => number = Math.random): string {
  const chosen = letters.map((letter) => letter.toLowerCase()).filter((letter) => /^[a-z]$/u.test(letter));
  const pool = chosen.length ? WEAK_KEY_WORD_BANK.filter((word) => chosen.some((letter) => word.includes(letter))) : WEAK_KEY_WORD_BANK;
  const source = pool.length ? pool : WEAK_KEY_WORD_BANK;
  return Array.from({ length: count }, () => source[Math.floor(random() * source.length)]).join(" ");
}

/** A line of `count` common exam words in random order. */
export function commonWordsDrill(count = 30, random: () => number = Math.random): string {
  return Array.from({ length: count }, () => COMMON_EXAM_WORDS[Math.floor(random() * COMMON_EXAM_WORDS.length)]).join(" ");
}

/** Each word repeated `times` times (for the words a student got wrong or typed slowly). */
export function repeatWordsDrill(list: string[], times = 4): string {
  return list.flatMap((word) => Array(times).fill(word)).join(" ");
}

/** Rhythm score 0-100: how even the time between words was (100 = a perfectly steady beat). */
export function rhythmScore(wordTimesMs: number[]): number {
  const times = wordTimesMs.filter((ms) => ms > 0);
  if (times.length < 3) return 0;
  const mean = times.reduce((sum, ms) => sum + ms, 0) / times.length;
  const deviation = Math.sqrt(times.reduce((sum, ms) => sum + (ms - mean) ** 2, 0) / times.length);
  return Math.max(0, Math.min(100, Math.round(100 - (deviation / mean) * 100)));
}

export type SessionLog = { date: string; kind: "burst" | "words" | "keys" | "rhythm"; wpm: number; accuracy: number };

/** Average and best net WPM per week (weeks start on Monday), newest first, for the progress table. */
export function weeklyProgress(sessions: SessionLog[], weeks = 6): { weekStart: string; sessions: number; averageWpm: number; bestWpm: number }[] {
  const byWeek = new Map<string, SessionLog[]>();
  for (const session of sessions) {
    const day = new Date(`${session.date}T00:00:00Z`);
    if (Number.isNaN(day.getTime())) continue;
    const offset = (day.getUTCDay() + 6) % 7;
    day.setUTCDate(day.getUTCDate() - offset);
    const key = day.toISOString().slice(0, 10);
    byWeek.set(key, [...(byWeek.get(key) ?? []), session]);
  }
  return [...byWeek.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .slice(0, weeks)
    .map(([weekStart, list]) => ({
      weekStart,
      sessions: list.length,
      averageWpm: Math.round(list.reduce((sum, entry) => sum + entry.wpm, 0) / list.length),
      bestWpm: Math.max(...list.map((entry) => entry.wpm)),
    }));
}

/** Consecutive days (ending today or yesterday) with at least one session. */
export function practiceStreak(sessions: SessionLog[], today: string): number {
  const days = new Set(sessions.map((session) => session.date));
  const cursor = new Date(`${today}T00:00:00Z`);
  if (!days.has(today)) cursor.setUTCDate(cursor.getUTCDate() - 1);
  let streak = 0;
  while (days.has(cursor.toISOString().slice(0, 10))) { streak += 1; cursor.setUTCDate(cursor.getUTCDate() - 1); }
  return streak;
}

/** A level is passed when every sentence has been typed at `targetWpm`+ net WPM with no mistakes. */
export const BURST_PASS_WPM = 55;
export function levelPassed(level: BurstLevel, bestClean: Record<string, number>, targetWpm = BURST_PASS_WPM): boolean {
  return level.sentences.every((sentence) => (bestClean[sentence] ?? 0) >= targetWpm);
}
