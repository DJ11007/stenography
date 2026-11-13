export type ProgressPeriod = "week" | "month";
export type ProgressPoint = { key: string; label: string; netWpm: number; accuracy: number; attempts: number };
type AttemptForProgress = { submitted_at: string; netWpm: number; accuracy: number };

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Server Components render in whatever timezone the host happens to use, so
// every other date-bucketing feature in this app (live-test date browser,
// migration 202609230000) pins IST explicitly rather than trusting the
// server's own clock -- this chart does the same. en-CA gives a clean
// sortable YYYY-MM-DD for that IST calendar day.
const istDateKey = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

function weekStartKey(dayKey: string): string {
  const date = new Date(`${dayKey}T00:00:00Z`);
  const mondayOffset = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - mondayOffset);
  return date.toISOString().slice(0, 10);
}
const monthOf = (dayKey: string) => dayKey.slice(0, 7);

function weekLabel(key: string): string {
  const date = new Date(`${key}T00:00:00Z`);
  return `${date.getUTCDate()} ${MONTH_NAMES[date.getUTCMonth()]}`;
}
function monthLabel(key: string): string {
  const [year, month] = key.split("-").map(Number);
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

/** Buckets a student's typing attempts into their best Net WPM and best
 * accuracy per IST calendar week or month, skipping periods with no
 * attempts entirely -- a continuous zero-filled axis would read as "scored
 * 0" on a week the student simply didn't practice, which is misleading.
 * Returns the most recent `maxPoints` non-empty periods, oldest first, so
 * a chart can plot them left to right as a trend. */
export function bucketAttemptsByPeriod(attempts: AttemptForProgress[], period: ProgressPeriod, maxPoints: number): ProgressPoint[] {
  const buckets = new Map<string, { netWpm: number; accuracy: number; attempts: number }>();
  for (const attempt of attempts) {
    if (!Number.isFinite(attempt.netWpm) || attempt.netWpm <= 0) continue;
    const dayKey = istDateKey(attempt.submitted_at);
    const key = period === "week" ? weekStartKey(dayKey) : monthOf(dayKey);
    const bucket = buckets.get(key) ?? { netWpm: 0, accuracy: 0, attempts: 0 };
    bucket.netWpm = Math.max(bucket.netWpm, attempt.netWpm);
    bucket.accuracy = Math.max(bucket.accuracy, attempt.accuracy || 0);
    bucket.attempts += 1;
    buckets.set(key, bucket);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-maxPoints)
    .map(([key, value]) => ({
      key,
      label: period === "week" ? weekLabel(key) : monthLabel(key),
      netWpm: Math.round(value.netWpm * 10) / 10,
      accuracy: Math.round(value.accuracy * 10) / 10,
      attempts: value.attempts,
    }));
}
