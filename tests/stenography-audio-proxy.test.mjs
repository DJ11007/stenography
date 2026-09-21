import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseRange } from "../lib/stenography-audio-range.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const ROUTE_PATH = "app/typing/stenography-audio/[...path]/route.ts";

test("parseRange handles the three real Range forms an <audio> element sends, and rejects the rest", () => {
  assert.equal(parseRange(null, 1000), null);
  assert.equal(parseRange("bytes=", 1000), null);
  assert.equal(parseRange("not-a-range", 1000), null);
  // bytes=start-end
  assert.deepEqual(parseRange("bytes=0-99", 1000), { start: 0, end: 99 });
  // bytes=start- (open-ended, to the end of the file)
  assert.deepEqual(parseRange("bytes=500-", 1000), { start: 500, end: 999 });
  // bytes=-suffixLength (last N bytes)
  assert.deepEqual(parseRange("bytes=-100", 1000), { start: 900, end: 999 });
  // an end past the actual size is clamped, not rejected
  assert.deepEqual(parseRange("bytes=0-99999", 1000), { start: 0, end: 999 });
  // a start at or past the size is unsatisfiable
  assert.equal(parseRange("bytes=1000-1001", 1000), null);
  assert.equal(parseRange("bytes=5000-", 1000), null);
  // start after end is invalid
  assert.equal(parseRange("bytes=500-100", 1000), null);
});

// Real reported bug: a student saw the dictation player take 3+ minutes to
// start, and separately one saw it freeze at 00:00 forever. Traced directly
// to Supabase Storage's own delivery for these ~5-6MB audio files being
// intermittently very slow or hanging outright with no error at all (see
// the supabase-storage-large-file-stalls memory) -- not fixable from here,
// but every student's browser negotiating that same flaky connection
// independently, especially under concurrent load (many students starting
// the same dictation together), compounded it. This route proxies the
// audio through our own server, caching the full file in memory per warm
// instance so a later request -- the same student re-seeking, or a
// hundred different students -- can be served straight out of memory.
test("the stenography audio route requires a signed-in user and serves a warm cache hit's Range requests straight from memory", async () => {
  const route = await read(ROUTE_PATH);
  assert.match(route, /await requireUser\(\)/);
  assert.match(route, /const audioCache = new Map/);
  assert.match(route, /createSignedUrl\(path, SIGNED_URL_TTL_SECONDS\)/);
  assert.match(route, /entry\.buffer\.slice\(range\.start, range\.end \+ 1\)/);
  assert.match(route, /status: 206/);
  assert.match(route, /"accept-ranges": "bytes"/);
});

// Real regression THIS route itself introduced, caught by a live report
// ("this used to play instantly, now it takes forever"): the first
// version called `await upstream.arrayBuffer()` before responding to ANY
// request, even a small initial Range probe -- so a cold path (in
// production, nearly every request, since a serverless instance is
// rarely warm from a DIFFERENT student's earlier play) waited for the
// ENTIRE file to download server-side before the player saw a single
// byte, confirmed live to take 15+ seconds to start playing -- reliably
// SLOWER than talking to Supabase directly, the opposite of the intended
// fix. Now the upstream response streams straight through via a tee()'d
// stream on a cache miss, and only the OTHER branch is opportunistically
// captured into the cache in the background, never delaying the response.
test("a cache miss streams the upstream response straight through instead of buffering the whole file before responding", async () => {
  const route = await read(ROUTE_PATH);
  assert.doesNotMatch(route, /const buffer = await upstream\.arrayBuffer\(\)/);
  assert.match(route, /const \[toClient, toCache\] = upstream\.body\.tee\(\);/);
  assert.match(route, /void bufferStream\(toCache\)/);
  assert.match(route, /return new NextResponse\(toClient, \{ status: upstream\.status, headers \}\);/);
  // the fallback (narrower/uncacheable Range) also streams straight
  // through, never buffers either.
  assert.match(route, /return new NextResponse\(upstream\.body, \{ status: upstream\.status, headers \}\);/);
});

test("only a whole-file response (plain 200, or a Range spanning byte 0 to the end) is cache-eligible -- a narrower Range is never mistaken for the full file", async () => {
  const route = await read(ROUTE_PATH);
  assert.match(route, /function isWholeFileResponse\(status: number, contentRange: string \| null\): boolean \{/);
  assert.match(route, /if \(status === 200\) return true;/);
  assert.match(route, /return start === "0" && Number\(end\) \+ 1 === Number\(total\);/);
});

test("both server-side callers build the audio URL from this proxy route instead of a raw Supabase signed URL", async () => {
  const [testPage, navigator] = await Promise.all([
    read("app/tests/[slug]/page.tsx"),
    read("app/typing/practice/_components/practice-navigator.tsx"),
  ]);
  for (const source of [testPage, navigator]) {
    assert.match(source, /preset\.audioUrl=?.*\/typing\/stenography-audio\//);
    assert.doesNotMatch(source, /stenography-audio"\)\.createSignedUrl/);
  }
});
