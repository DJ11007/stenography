import { NextResponse } from "next/server";
import { absoluteUrl } from "@/lib/seo";
import { SCTYPING_LATEST } from "@/lib/sctyping-release";

// Read by the installed SCTyping app on startup to decide whether to show "Update now!".
// Cross-origin on purpose: the app's own page origin (tauri.localhost) is not sctyping.com.
export function GET() {
  return NextResponse.json(
    { version: SCTYPING_LATEST.version, notes: SCTYPING_LATEST.notes, downloadUrl: absoluteUrl("/offline-app/download") },
    { headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=300" } },
  );
}
