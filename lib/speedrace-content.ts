// Speed Race: a passage-typing racing game (/typing/games/speed-race).
// Genuinely different from WordTris (which drills reaction speed on
// isolated falling words) -- this drills sustained speed on a flowing
// passage, visualized as cars advancing along a track, which is much
// closer to what a real exam's required-WPM figure actually measures.
// Reuses WordTris's own admin-editable word banks (lib/wordtris-server.ts)
// as vocabulary -- it's just word lists, not exclusive to one game -- so
// this file only holds Speed Race's own constants and pure helpers.

import type { WordtrisCategory, WordtrisLanguage } from "@/lib/wordtris-content";

export type { WordtrisCategory as SpeedRaceCategory, WordtrisLanguage as SpeedRaceLanguage };

// How many words make up one race's passage -- long enough for a real
// sustained-speed reading (not just one reaction-time word), short enough
// to finish in under a minute at a reasonable pace.
export const SPEEDRACE_WORDS_PER_RACE = 28;

// The "pace car" races at this speed by default -- a real WPM figure the
// student can raise or lower from the setup screen before starting.
export const SPEEDRACE_DEFAULT_PACE_WPM = 25;
export const SPEEDRACE_MIN_PACE_WPM = 10;
export const SPEEDRACE_MAX_PACE_WPM = 60;

// One boost per race -- instantly completes whatever word the student is
// currently stuck on (the same "spend a one-time resource to skip a hard
// word" idea real typing-race games use), not a repeatable crutch.
export const SPEEDRACE_BOOSTS_PER_RACE = 1;

function shuffled<T>(list: T[]): T[] {
  const pool = [...list];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
}

// Builds one race's passage by sampling words from the category's own
// pool, repeating the shuffle once the pool runs out (most categories
// have far fewer than SPEEDRACE_WORDS_PER_RACE words) so a race is never
// shorter than intended just because a small category ran out.
export function buildSpeedRacePassage(wordPool: string[], wordsPerRace: number = SPEEDRACE_WORDS_PER_RACE): string {
  if (!wordPool.length) return "";
  const words: string[] = [];
  while (words.length < wordsPerRace) words.push(...shuffled(wordPool));
  return words.slice(0, wordsPerRace).join(" ");
}

// How far along the track (0-1) a racer going at `wpm` is after
// `elapsedMs`, for a passage of `passageLength` characters -- the same
// standard WPM definition (1 word = 5 characters) used elsewhere
// (see lib/wordtris-content.ts's wordtrisFallMs).
export function speedRaceProgressAtElapsed(wpm: number, elapsedMs: number, passageLength: number): number {
  if (passageLength <= 0 || wpm <= 0) return 0;
  const totalMs = (passageLength / 5 / wpm) * 60000;
  return Math.min(1, elapsedMs / totalMs);
}

// Net WPM only counts characters that were actually typed correctly --
// mistakes cost speed instead of blocking the student outright, matching
// how real typing-race games measure a finished run.
export function speedRaceNetWpm(correctChars: number, elapsedMs: number): number {
  if (elapsedMs <= 0) return 0;
  return (correctChars / 5) / (elapsedMs / 60000);
}

export function speedRaceAccuracy(correctChars: number, typedChars: number): number {
  if (typedChars <= 0) return 100;
  return Math.round((correctChars / typedChars) * 100);
}
