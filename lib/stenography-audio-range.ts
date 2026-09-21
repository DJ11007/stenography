// Standard single-range "bytes=start-end" / "bytes=start-" / "bytes=-suffixLength"
// forms -- the three an <audio> element actually sends. Multi-range
// requests ("bytes=0-99,200-299") are deliberately not supported: no
// browser media element issues one, so being conservative here would
// only ever confuse this route's own tests, never a real request.
// Kept in lib/ (not inline in the route.ts that uses it) specifically so
// it can be unit-tested directly -- a route.ts importing next/server
// cannot be imported by this project's plain node:test runner at all.
export function parseRange(header: string | null, size: number): { start: number; end: number } | null {
  const match = header ? /^bytes=(\d*)-(\d*)$/.exec(header.trim()) : null;
  if (!match) return null;
  const [, startText, endText] = match;
  if (!startText && !endText) return null;
  let start: number;
  let end: number;
  if (!startText) {
    const suffixLength = Number(endText);
    start = Math.max(0, size - suffixLength);
    end = size - 1;
  } else {
    start = Number(startText);
    end = endText ? Number(endText) : size - 1;
  }
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= size) return null;
  return { start, end: Math.min(end, size - 1) };
}
