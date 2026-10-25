export type LiveTestSchedule = {
  isLive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  resultsPublishAt: string | null;
  // Real reported request: some live tests should be attemptable "any day,
  // any time" (no fixed start/end window) with each STUDENT's own result
  // unlocking a fixed delay after THEIR OWN submission, instead of one
  // shared reveal time for everyone. Non-null here switches the whole
  // schedule to that "anytime" mode; startsAt/endsAt/resultsPublishAt are
  // meaningless (and left null) in that mode. Kept as a sibling field
  // rather than a separate "mode" enum so a schedule object still fully
  // describes itself without extra plumbing.
  resultsDelayMinutes: number | null;
};

export type LiveTestState = "ordinary" | "upcoming" | "open" | "closed" | "results-published" | "anytime";

export function liveTestState(schedule: LiveTestSchedule, now = new Date()): LiveTestState {
  if (!schedule.isLive) return "ordinary";
  const starts = schedule.startsAt ? new Date(schedule.startsAt).getTime() : Number.NaN;
  const ends = schedule.endsAt ? new Date(schedule.endsAt).getTime() : Number.NaN;
  // A results delay alone is "anytime"; with a start/end window ("One day") the window decides,
  // and each student's result unlocks the delay after their own submission (never one shared time).
  if (schedule.resultsDelayMinutes != null) {
    if (!Number.isFinite(starts) && !Number.isFinite(ends)) return "anytime";
    if (Number.isFinite(starts) && now.getTime() < starts) return "upcoming";
    return Number.isFinite(ends) && now.getTime() > ends ? "closed" : "open";
  }
  const results = schedule.resultsPublishAt ? new Date(schedule.resultsPublishAt).getTime() : Number.NaN;
  const current = now.getTime();
  if (Number.isFinite(results) && current >= results) return "results-published";
  if (Number.isFinite(starts) && current < starts) return "upcoming";
  if (Number.isFinite(ends) && current <= ends) return "open";
  return "closed";
}

export function validateLiveSchedule(schedule: LiveTestSchedule) {
  if (!schedule.isLive) return [];
  if (schedule.resultsDelayMinutes != null) {
    const errors = Number.isInteger(schedule.resultsDelayMinutes) && schedule.resultsDelayMinutes > 0 && schedule.resultsDelayMinutes <= 1440
      ? [] : ["The results delay must be a whole number of minutes, from 1 to 1440 (24 hours)."];
    if (schedule.startsAt || schedule.endsAt) {
      const opens = schedule.startsAt ? new Date(schedule.startsAt).getTime() : Number.NaN;
      const closes = schedule.endsAt ? new Date(schedule.endsAt).getTime() : Number.NaN;
      if (!Number.isFinite(opens) || !Number.isFinite(closes)) errors.push("A one-day live test needs valid start and end times.");
      else if (closes <= opens) errors.push("The live-test end time must be after its start time.");
    }
    return errors;
  }
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
