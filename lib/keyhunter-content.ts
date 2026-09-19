// Key Hunter: an adaptive weak-key typing trainer (/typing/games/key-hunter).
// Researched Keybr's real approach before building this (the one idea from
// that research not already covered by Speed Race or Word Defender):
// track per-key speed/accuracy from what the student actually types, and
// drill the keys they're genuinely slow or wrong on more often than the
// ones they've already mastered, instead of a plain uniform shuffle (which
// is what WordTris's character mode already does). This is the most
// original of the three researched ideas since it's the only one that
// uses real per-student history rather than just a different game skin.

export type KeyHunterStats = { attempts: number; correct: number; totalMs: number };
export type KeyHunterStatsMap = Record<string, KeyHunterStats>;

export const KEYHUNTER_SESSION_LENGTH = 40;
// A never-attempted key is treated as this weak -- worse than almost any
// key the student has actually struggled with -- so genuinely new keys
// get introduced before the drill just keeps hammering already-weak ones.
export const KEYHUNTER_UNSEEN_WEIGHT = 5;
export const KEYHUNTER_MIN_WEIGHT = 0.1;
// A correct press taking this long (or longer) counts as "as slow as it
// gets" for weighting purposes -- caps one very slow outlier keystroke
// from dominating a key's whole weakness score.
const SLOW_PRESS_CEILING_MS = 2000;

// Higher = drilled more often. Error rate dominates (a key you keep
// getting wrong matters more than one you're merely slow on), with
// average correct-press time as a secondary factor.
export function keyHunterWeakness(stats: KeyHunterStats | undefined): number {
  if (!stats || stats.attempts === 0) return KEYHUNTER_UNSEEN_WEIGHT;
  const errorRate = 1 - stats.correct / stats.attempts;
  const avgMs = stats.correct > 0 ? stats.totalMs / stats.correct : SLOW_PRESS_CEILING_MS;
  const speedFactor = Math.min(1, avgMs / SLOW_PRESS_CEILING_MS);
  return Math.max(KEYHUNTER_MIN_WEIGHT, errorRate * 3 + speedFactor);
}

// Weighted random pick -- a key twice as weak is roughly twice as likely
// to come up next, never picking the same key that was just shown twice
// in a row (that would just be a slow-motion repeat, not real drilling).
export function keyHunterPickNext(pool: string[], stats: KeyHunterStatsMap, exclude?: string): string {
  const candidates = pool.filter((k) => k !== exclude);
  const usable = candidates.length ? candidates : pool;
  if (!usable.length) return "";
  const weights = usable.map((k) => keyHunterWeakness(stats[k]));
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < usable.length; i += 1) {
    roll -= weights[i];
    if (roll <= 0) return usable[i];
  }
  return usable[usable.length - 1];
}

export function keyHunterRecord(stats: KeyHunterStatsMap, key: string, correct: boolean, ms: number): KeyHunterStatsMap {
  const prev = stats[key] ?? { attempts: 0, correct: 0, totalMs: 0 };
  return {
    ...stats,
    [key]: {
      attempts: prev.attempts + 1,
      correct: prev.correct + (correct ? 1 : 0),
      totalMs: prev.totalMs + (correct ? ms : 0),
    },
  };
}
