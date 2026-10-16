// A typing-test countdown that a wrong or jumping PC clock cannot cut short.
//
// Real reported problem: on some students' PCs a 10-minute exam submitted itself
// 30 seconds to over 2 minutes early. The old timer was `end = Date.now() + 10 min`,
// so anything that moved the PC's wall clock forward -- Windows correcting a drifting
// clock mid-test, a fast-running clock -- ate test time. Confirmed in the live data:
// one student's 600-second attempts lasted 458-573 real seconds by the server's clock.
//
// This clock measures elapsed time three ways and always believes the SLOWEST:
//   1. performance.now()  -- the browser's monotonic clock (immune to clock changes)
//   2. Date.now()         -- the wall clock
//   3. the server's clock -- sampled at the start and every 15 s from /server-time
//      (the network delay is halved out), interpolated between samples
// Taking the minimum means the test can only ever run a little LONG, never short.
// When the local count reaches zero, the end is confirmed with the server before the
// test is submitted; if the server says time is left, the countdown keeps going.

export type ClockSources = {
  perf: () => number;
  wall: () => number;
  /** Server time in ms, or null when the server can't be reached. */
  server: () => Promise<number | null>;
};

export const browserClockSources = (): ClockSources => ({
  perf: () => performance.now(),
  wall: () => Date.now(),
  server: async () => {
    try {
      const sent = performance.now();
      const response = await fetch("/server-time", { cache: "no-store" });
      if (!response.ok) return null;
      const { now } = (await response.json()) as { now?: number };
      if (typeof now !== "number" || !Number.isFinite(now)) return null;
      // The server read its clock about halfway through the round trip.
      return now + (performance.now() - sent) / 2;
    } catch {
      return null;
    }
  },
});

type Sample = { server: number; perf: number };

export class ExamClock {
  private readonly startPerf: number;
  private readonly startWall: number;
  private serverStart: Sample | null = null;
  private serverLatest: Sample | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;

  private readonly durationMs: number;
  private readonly sources: ClockSources;

  constructor(durationMs: number, sources: ClockSources = browserClockSources(), syncEveryMs = 15000) {
    this.durationMs = durationMs;
    this.sources = sources;
    this.startPerf = sources.perf();
    this.startWall = sources.wall();
    void this.sync(true);
    if (syncEveryMs > 0 && typeof setInterval !== "undefined") this.timer = setInterval(() => void this.sync(false), syncEveryMs);
  }

  private async sync(first: boolean) {
    const server = await this.sources.server();
    if (server === null) return;
    const sample = { server, perf: this.sources.perf() };
    // The first sample anchors the start: the server's time when the test began.
    if (first || !this.serverStart) this.serverStart = { server: server - (sample.perf - this.startPerf), perf: this.startPerf };
    this.serverLatest = sample;
  }

  /** Elapsed ms by the slowest of the clocks we have. */
  elapsedMs(): number {
    const perfNow = this.sources.perf();
    const perfElapsed = perfNow - this.startPerf;
    const wallElapsed = this.sources.wall() - this.startWall;
    const candidates = [perfElapsed];
    // A wall clock set far BACK (more than a minute behind the monotonic clock) is
    // ignored, so it can't hold the test open indefinitely; a little behind still counts.
    if (Number.isFinite(wallElapsed) && wallElapsed >= 0 && wallElapsed > perfElapsed - 60000) candidates.push(wallElapsed);
    if (this.serverStart && this.serverLatest) candidates.push(this.serverLatest.server - this.serverStart.server + Math.max(0, perfNow - this.serverLatest.perf));
    return Math.max(0, Math.min(...candidates));
  }

  remainingMs(): number {
    return Math.max(0, this.durationMs - this.elapsedMs());
  }

  remainingSeconds(): number {
    return Math.ceil(this.remainingMs() / 1000);
  }

  /** Called when the countdown reaches 0: true only when the server agrees the time
   *  is really up (or the server can't be reached, so the local count is all we have). */
  async confirmEnded(): Promise<boolean> {
    await this.sync(false);
    return this.remainingMs() <= 0;
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}

/** The start time to RECORD for an attempt (server side). The browser sends its own
 *  clock's start time, which on PCs with a wrong clock was off by minutes or hours in
 *  the saved records; when it disagrees by more than 2 minutes with "now minus the
 *  test's elapsed time" (the server's own clock), the server's figure is used. */
export function trustedStartedAt(clientIso: string, elapsedSeconds: number, nowMs = Date.now()): string {
  const fromServer = nowMs - Math.max(0, Number.isFinite(elapsedSeconds) ? elapsedSeconds : 0) * 1000;
  const client = new Date(clientIso).getTime();
  return new Date(Number.isFinite(client) && Math.abs(client - fromServer) <= 120000 ? client : fromServer).toISOString();
}
