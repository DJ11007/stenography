// The server's clock, for the typing-test timer (lib/exam-clock.ts). A PC whose own
// clock is wrong or jumps can then never end a test early. Public, tiny, never cached,
// and excluded from the session proxy so the reading is as quick as possible.
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ now: Date.now() }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
