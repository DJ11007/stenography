import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { parseRange } from "@/lib/stenography-audio-range";

// Real reported bug: a student saw the dictation player take 3+ minutes
// to start, and another saw it freeze at 00:00 forever -- traced by
// requesting the audio file's own Supabase signed URL directly, bypassing
// this app's code entirely: the exact same request was intermittently
// very slow or hung outright, with no error at all (see the
// supabase-storage-large-file-stalls memory). That is Supabase Storage's
// own delivery, not fixable from here -- but every student's browser was
// independently negotiating that same flaky connection, and 100 students
// starting the same dictation together meant 100 separate slow/flaky
// downloads instead of one. This route proxies the audio through our own
// server instead: the first request for a given file pays whatever
// Supabase's delivery costs, caches the FULL file in memory for the rest
// of this warm server instance's life (bounded by SIGNED_URL_TTL_SECONDS
// below), and every other request -- from the same student re-seeking,
// or a hundred different students starting at once -- is served straight
// out of memory, correctly honoring byte-Range requests itself rather
// than re-fetching ranges from Supabase per request.
const SIGNED_URL_TTL_SECONDS = 3600;
// Comfortably under the signed URL's own expiry, so a cache entry is
// never served past the point its underlying URL would have stopped
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

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

async function cachedAudioBuffer(supabase: SupabaseServerClient, path: string): Promise<CacheEntry | null> {
  const cached = audioCache.get(path);
  if (cached && cached.expiresAt > Date.now()) return cached;
  // createSignedUrl itself is what enforces access control here (via the
  // storage.objects RLS policy for this bucket) -- the exact same trust
  // model app/tests/[slug]/page.tsx and practice-navigator.tsx already
  // rely on for this same bucket, not a new gate this route invents.
  const { data, error } = await supabase.storage.from("stenography-audio").createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) return null;
  const upstream = await fetch(data.signedUrl);
  if (!upstream.ok) return null;
  const buffer = await upstream.arrayBuffer();
  const entry: CacheEntry = { buffer, contentType: upstream.headers.get("content-type") ?? "audio/mpeg", expiresAt: Date.now() + CACHE_TTL_MS };
  audioCache.set(path, entry);
  return entry;
}

export async function GET(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  await requireUser();
  const { path: segments } = await params;
  const path = segments.map(decodeURIComponent).join("/");
  if (!path) return new NextResponse("Not found", { status: 404 });
  const supabase = await createClient();
  const cached = await cachedAudioBuffer(supabase, path);
  if (!cached) return new NextResponse("Audio unavailable", { status: 404 });

  const size = cached.buffer.byteLength;
  const range = parseRange(request.headers.get("range"), size);
  const headers = new Headers({
    "content-type": cached.contentType,
    "accept-ranges": "bytes",
    // private: this response depends on the requester's own auth cookie,
    // not something a shared/CDN cache should reuse across users -- the
    // real caching win here is the in-memory buffer above, shared across
    // every request this warm instance handles regardless of cache-control.
    "cache-control": "private, max-age=3600",
  });
  if (range) {
    headers.set("content-range", `bytes ${range.start}-${range.end}/${size}`);
    headers.set("content-length", String(range.end - range.start + 1));
    return new NextResponse(cached.buffer.slice(range.start, range.end + 1), { status: 206, headers });
  }
  headers.set("content-length", String(size));
  return new NextResponse(cached.buffer, { status: 200, headers });
}
