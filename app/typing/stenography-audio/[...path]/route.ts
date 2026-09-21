import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { parseRange } from "@/lib/stenography-audio-range";

// Real reported bug, in two parts. First: a student saw the dictation
// player take 3+ minutes to start, and another saw it freeze at 00:00
// forever -- traced by requesting the audio file's own Supabase signed
// URL directly, bypassing this app's code entirely: the exact same
// request was intermittently very slow or hung outright, with no error
// at all (see the supabase-storage-large-file-stalls memory). That is
// Supabase Storage's own delivery, not fixable from here, but every
// student's browser was independently negotiating that same flaky
// connection.
//
// Second, a real regression THIS route itself introduced and a later
// report caught: the first version of this file called
// `await upstream.arrayBuffer()` before ever responding to ANY request,
// even a tiny initial Range probe -- meaning every single request that
// didn't land on an already-warm cache (in production, nearly every
// request, since a serverless instance is rarely warm from a DIFFERENT
// student's earlier play) waited for the ENTIRE ~5-6MB file to finish
// downloading server-side before the player saw a single byte. That
// turned a proxy meant to speed things up into something reliably
// SLOWER than talking to Supabase directly, confirmed live (15+ seconds
// to `playing`). Fixed by streaming the upstream response straight
// through to the client via a tee()'d stream, and only opportunistically
// capturing the OTHER branch into the in-memory cache in the
// background, never delaying the response itself. Only a request for
// the whole file (no Range, or a Range that happens to cover byte 0 to
// the end) is cache-eligible; a bounded/partial Range on a cold path is
// still streamed straight through, just not cached from.
const SIGNED_URL_TTL_SECONDS = 3600;
// Comfortably under the signed URL's own expiry, so neither cache is
// ever served past the point its underlying URL would have stopped
// working anyway.
const CACHE_TTL_MS = 50 * 60 * 1000;

type CacheEntry = { buffer: ArrayBuffer; contentType: string; expiresAt: number };
// Per-warm-instance only (serverless -- a cold start gets an empty cache
// and simply re-fetches once). Unbounded by entry count on purpose: the
// number of DISTINCT stenography audio files actively in rotation at once
// is small (a handful of managed tests), nowhere near large enough for
// this to be a real memory concern the way an unbounded per-request cache
// would be.
const audioCache = new Map<string, CacheEntry>();
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

async function cachedSignedUrl(supabase: SupabaseServerClient, path: string): Promise<string | null> {
  const cached = signedUrlCache.get(path);
  if (cached && cached.expiresAt > Date.now()) return cached.url;
  // createSignedUrl itself is what enforces access control here (via the
  // storage.objects RLS policy for this bucket) -- the exact same trust
  // model app/tests/[slug]/page.tsx and practice-navigator.tsx already
  // rely on for this same bucket, not a new gate this route invents.
  const { data, error } = await supabase.storage.from("stenography-audio").createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) return null;
  signedUrlCache.set(path, { url: data.signedUrl, expiresAt: Date.now() + CACHE_TTL_MS });
  return data.signedUrl;
}

// Only true for a request whose response body genuinely is the entire
// file -- a plain 200, or a 206 Range response that happens to span byte
// 0 through the last byte. Anything narrower must not overwrite the
// full-file cache with a partial slice of it.
function isWholeFileResponse(status: number, contentRange: string | null): boolean {
  if (status === 200) return true;
  const match = contentRange ? /^bytes (\d+)-(\d+)\/(\d+)$/.exec(contentRange) : null;
  if (!match) return false;
  const [, start, end, total] = match;
  return start === "0" && Number(end) + 1 === Number(total);
}

async function bufferStream(stream: ReadableStream<Uint8Array>): Promise<ArrayBuffer> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.byteLength;
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { out.set(chunk, offset); offset += chunk.byteLength; }
  return out.buffer;
}

function respondFromCache(entry: CacheEntry, rangeHeader: string | null): Response {
  const size = entry.buffer.byteLength;
  const range = parseRange(rangeHeader, size);
  const headers = new Headers({
    "content-type": entry.contentType,
    "accept-ranges": "bytes",
    // private: this response depends on the requester's own auth cookie,
    // not something a shared/CDN cache should reuse across users -- the
    // real caching win here is the in-memory buffer, shared across every
    // request this warm instance handles regardless of cache-control.
    "cache-control": "private, max-age=3600",
  });
  if (range) {
    headers.set("content-range", `bytes ${range.start}-${range.end}/${size}`);
    headers.set("content-length", String(range.end - range.start + 1));
    return new NextResponse(entry.buffer.slice(range.start, range.end + 1), { status: 206, headers });
  }
  headers.set("content-length", String(size));
  return new NextResponse(entry.buffer, { status: 200, headers });
}

export async function GET(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  await requireUser();
  const { path: segments } = await params;
  const path = segments.map(decodeURIComponent).join("/");
  if (!path) return new NextResponse("Not found", { status: 404 });

  const rangeHeader = request.headers.get("range");
  const cached = audioCache.get(path);
  if (cached && cached.expiresAt > Date.now()) return respondFromCache(cached, rangeHeader);

  const supabase = await createClient();
  const signedUrl = await cachedSignedUrl(supabase, path);
  if (!signedUrl) return new NextResponse("Audio unavailable", { status: 404 });

  const upstream = await fetch(signedUrl, { headers: rangeHeader ? { Range: rangeHeader } : {} });
  if (!upstream.ok && upstream.status !== 206) return new NextResponse("Audio unavailable", { status: 502 });

  const headers = new Headers();
  for (const key of ["content-type", "content-length", "content-range", "last-modified", "etag"]) {
    const value = upstream.headers.get(key);
    if (value) headers.set(key, value);
  }
  headers.set("accept-ranges", "bytes");
  headers.set("cache-control", "private, max-age=3600");

  if (upstream.body && isWholeFileResponse(upstream.status, upstream.headers.get("content-range"))) {
    const [toClient, toCache] = upstream.body.tee();
    const contentType = upstream.headers.get("content-type") ?? "audio/mpeg";
    void bufferStream(toCache)
      .then((buffer) => audioCache.set(path, { buffer, contentType, expiresAt: Date.now() + CACHE_TTL_MS }))
      .catch(() => { /* best-effort cache warm -- a failed background read just means no cache this time */ });
    return new NextResponse(toClient, { status: upstream.status, headers });
  }

  return new NextResponse(upstream.body, { status: upstream.status, headers });
}
