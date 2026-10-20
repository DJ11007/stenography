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
//
// Follow-up report (2026-10-20): on slow or hanging PCs some students got EXTRA time -- their
// 10-minute test, started with everyone else, did not end. Two causes here:
//   - Believing the slowest clock also believed a PC clock that runs SLOW, by however much it was
//     slow, even though the server knew the real time. Now, while recent server samples exist,
//     the server's time decides (it can be neither fast nor slow); the slowest local clock is only
//     the fallback when the server can't be reached.
//   - The end-of-test server check had no time limit: on a slow PC or network the request could
//     hang, so the countdown sat at 0:00 and the test never submitted. Requests now give up after
//     a few seconds, and a slow answer (long round trip) is not trusted as a clock sample.

export type ClockSources = {
  perf: () => number;
  wall: () => number;
  /** Server time in ms, or null when the server can't be reached. */
  server: () => Promise<number | null>;
};

/** A server request that hasn't answered by then is abandoned (the test must still end). */
export const SERVER_TIMEOUT_MS = 4000;
/** An answer slower than this can't say exactly when the server read its clock: not used. */
export const MAX_TRUSTED_ROUND_TRIP_MS = 2500;
/** Server samples older than this (no answer since) stop deciding; the local clocks take over. */
export const SERVER_SAMPLE_FRESH_MS = 45000;

export const browserClockSources = (): ClockSources => ({
  perf: () => performance.now(),
  wall: () => Date.now(),
  server: async () => {
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timeout = controller ? setTimeout(() => controller.abort(), SERVER_TIMEOUT_MS) : null;
    try {
      const sent = performance.now();
      const response = await fetch("/server-time", { cache: "no-store", signal: controller?.signal });
      if (!response.ok) return null;
      const { now } = (await response.json()) as { now?: number };
      if (typeof now !== "number" || !Number.isFinite(now)) return null;
      const roundTrip = performance.now() - sent;
      if (roundTrip > MAX_TRUSTED_ROUND_TRIP_MS) return null;
      // The server read its clock about halfway through the round trip.
      return now + roundTrip / 2;
    } catch {
      return null;
    } finally {
      if (timeout) clearTimeout(timeout);
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

  /** Elapsed ms: the server's time while it is reachable, otherwise the slowest local clock. */
  elapsedMs(): number {
    const perfNow = this.sources.perf();
    if (this.serverStart && this.serverLatest && perfNow - this.serverLatest.perf <= SERVER_SAMPLE_FRESH_MS) {
      return Math.max(0, this.serverLatest.server - this.serverStart.server + Math.max(0, perfNow - this.serverLatest.perf));
    }
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
    // Never wait on the server longer than its timeout: the test has to end even when it hangs.
    await Promise.race([this.sync(false), new Promise(resolve => setTimeout(resolve, SERVER_TIMEOUT_MS + 500))]);
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
