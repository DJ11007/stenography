export type LiveTestSchedule = {
  isLive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  resultsPublishAt: string | null;
};

export type LiveTestState = "ordinary" | "upcoming" | "open" | "closed" | "results-published";

export function liveTestState(schedule: LiveTestSchedule, now = new Date()): LiveTestState {
  if (!schedule.isLive) return "ordinary";
  const starts = schedule.startsAt ? new Date(schedule.startsAt).getTime() : Number.NaN;
  const ends = schedule.endsAt ? new Date(schedule.endsAt).getTime() : Number.NaN;
  const results = schedule.resultsPublishAt ? new Date(schedule.resultsPublishAt).getTime() : Number.NaN;
  const current = now.getTime();
  if (Number.isFinite(results) && current >= results) return "results-published";
  if (Number.isFinite(starts) && current < starts) return "upcoming";
  if (Number.isFinite(ends) && current <= ends) return "open";
  return "closed";
}

export function validateLiveSchedule(schedule: LiveTestSchedule) {
  if (!schedule.isLive) return [];
  const starts = schedule.startsAt ? new Date(schedule.startsAt).getTime() : Number.NaN;
  const ends = schedule.endsAt ? new Date(schedule.endsAt).getTime() : Number.NaN;
  const results = schedule.resultsPublishAt ? new Date(schedule.resultsPublishAt).getTime() : Number.NaN;
  const errors: string[] = [];
  if (![starts, ends, results].every(Number.isFinite)) errors.push("Live tests require valid start, end and result-publication times.");
  if (Number.isFinite(starts) && Number.isFinite(ends) && ends <= starts) errors.push("The live-test end time must be after its start time.");
  if (Number.isFinite(ends) && Number.isFinite(results) && results < ends) errors.push("Results cannot be published before the live test ends.");
  return errors;
}

export function anonymizeStudentName(name: string | null | undefined) {
  const clean = (name ?? "Student").trim().replace(/\s+/g, " ");
  if (!clean) return "Student";
  const parts = clean.split(" ");
  return parts.length === 1 ? `${parts[0].slice(0, 1)}${"•".repeat(Math.min(3, Math.max(1, parts[0].length - 1)))}` : `${parts[0]} ${parts.at(-1)?.slice(0, 1) ?? ""}.`;
}
