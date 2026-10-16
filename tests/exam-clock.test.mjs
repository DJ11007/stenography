import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { ExamClock } from "../lib/exam-clock.ts";

// Real report: on some PCs a 10-minute typing exam submitted itself 30 s - 2 min early
// (live data: 600-second attempts lasting 458-573 real seconds). The countdown must
// never end early whatever the PC clock does.

function fakeClocks() {
  const t = { real: 0, perfRate: 1, wallJump: 0, serverOnline: true };
  return {
    t,
    sources: {
      perf: () => t.real * t.perfRate,
      wall: () => 1_800_000_000_000 + t.real + t.wallJump,
      server: async () => (t.serverOnline ? 1_800_000_000_000 + t.real : null),
    },
  };
}
const tick = () => new Promise(resolve => setImmediate(resolve));

test("a wall clock that jumps forward 30 s (Windows time correction) does not shorten the test", async () => {
  const { t, sources } = fakeClocks();
  const clock = new ExamClock(600_000, sources, 0);
  await tick();
  t.real = 300_000; t.wallJump = 30_000; // half way, the PC clock is corrected forward 30 s
  assert.equal(clock.remainingSeconds(), 300);
  t.real = 590_000;
  assert.equal(clock.remainingSeconds(), 10, "still 10 s left after 590 real seconds");
  t.real = 600_000;
  assert.equal(await clock.confirmEnded(), true);
});

test("a PC whose clocks all run fast is held to the server's time", async () => {
  const { t, sources } = fakeClocks();
  t.perfRate = 1.3; // the case in the live data: the PC counted 600 s in ~460 real seconds
  const clock = new ExamClock(600_000, sources, 0);
  await tick();
  t.real = 460_000;
  assert.equal(await clock.confirmEnded(), false, "not over: the server says 460 s have passed");
  assert.ok(clock.remainingSeconds() >= 139 && clock.remainingSeconds() <= 141, String(clock.remainingSeconds()));
  t.real = 600_000;
  assert.equal(await clock.confirmEnded(), true);
});

test("with the server unreachable the slower local clock still decides, and a far-back wall clock can't freeze it", async () => {
  const { t, sources } = fakeClocks();
  t.serverOnline = false;
  const clock = new ExamClock(600_000, sources, 0);
  await tick();
  t.real = 200_000; t.wallJump = -3_600_000; // wall clock set an hour back
  assert.equal(clock.remainingSeconds(), 400, "the hour-back wall clock is ignored");
  t.real = 600_000;
  assert.equal(await clock.confirmEnded(), true);
});

test("the typing exam uses the clock for the finish, Submit and pause; Real File uses the server's time left", async () => {
  const exam = await readFile(new URL("../app/typing/_components/configurable-typing-exam.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(exam, /const remainingSeconds = \(end: number\) => Math\.max\(0, Math\.ceil\(\(end - Date\.now\(\)\)/);
  assert.match(exam, /new ExamClock\(seconds \* 1000\)/);
  assert.match(exam, /running\.confirmEnded\(\)\.then\(done =>/);
  const realfile = await readFile(new URL("../app/typing/word-efficiency/[language]/[testId]/realfile/realfile-workspace.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(realfile, /Date\.now\(\) - startTime/);
  assert.match(realfile, /useExamCountdown\(remainingAtLoadSeconds, 0\)/);
});

test("the recorded start time comes from the server when the PC clock is off", async () => {
  const { trustedStartedAt } = await import("../lib/exam-clock.ts");
  const now = Date.parse("2026-10-16T10:25:00.000Z");
  assert.equal(trustedStartedAt("2026-10-16T10:15:00.500Z", 600, now), "2026-10-16T10:15:00.500Z", "a correct PC clock is kept");
  assert.equal(trustedStartedAt("2026-10-17T03:40:00.000Z", 600, now), "2026-10-16T10:15:00.000Z", "a PC clock 17 hours ahead is replaced");
  assert.equal(trustedStartedAt("not a date", 600, now), "2026-10-16T10:15:00.000Z");
  const exam = await readFile(new URL("../app/tests/actions.ts", import.meta.url), "utf8");
  assert.match(exam, /started_at: trustedStartedAt\(payload\.startedAt, payload\.elapsedSeconds\)/);
  const practice = await readFile(new URL("../app/typing/practice-attempt-actions.ts", import.meta.url), "utf8");
  assert.match(practice, /started_at: trustedStartedAt\(/);
});
