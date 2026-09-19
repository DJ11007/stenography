// Word Defender: a wave-based typing-shooter (/typing/games/word-defender).
// Researched real examples of this genre (ZType, Typing Attack, Spacebar
// Invaders) before building this -- their defining, shared trait versus
// WordTris (which deliberately dropped concurrent drops for a single
// sequential one, per a real reference recording) is several enemies
// falling at once with auto-target-lock, and a completed word destroying
// its enemy the instant the last correct letter lands -- no separate
// confirm keypress. Reuses WordTris's own WPM difficulty engine
// (lib/wordtris-content.ts) since "typing speed paced in real WPM" is
// shared infrastructure, not exclusive to one game.

import type { WordtrisCategory, WordtrisLanguage } from "@/lib/wordtris-content";

export type { WordtrisCategory as WordDefenderCategory, WordtrisLanguage as WordDefenderLanguage };

export const WORDDEFENDER_STARTING_HEALTH = 5;
// Up to this many enemies fall at once, each in its own lane.
export const WORDDEFENDER_LANES = 4;
// Every this many kills, the wave advances (see WORDDEFENDER_WAVE_WPM_STEP).
export const WORDDEFENDER_KILLS_PER_WAVE = 6;
// Each wave adds this many WPM to the fall-speed curve on top of the
// starting speed -- a plain linear ramp (not the milestone ladder
// WordTris uses) since a shooter's escalation is about wave number, not
// catch streaks that can ease back off.
export const WORDDEFENDER_WAVE_WPM_STEP = 3;
export const WORDDEFENDER_STARTING_WPM = 18;
export const WORDDEFENDER_READING_BUFFER_MS = 900;
export const WORDDEFENDER_MIN_FALL_MS = 1400;

export function worddefenderFallMs(text: string, wave: number): number {
  const wpm = WORDDEFENDER_STARTING_WPM + (wave - 1) * WORDDEFENDER_WAVE_WPM_STEP;
  const chars = [...text].length;
  const typingMs = (chars / 5 / wpm) * 60000;
  return Math.max(WORDDEFENDER_MIN_FALL_MS, WORDDEFENDER_READING_BUFFER_MS + typingMs);
}

// How long to wait before trying to spawn the next enemy, at the given
// wave -- shortens slightly each wave so the field gets busier over time,
// floored so it's never literally instant.
export function worddefenderSpawnMs(wave: number): number {
  return Math.max(500, 1400 - (wave - 1) * 80);
}
