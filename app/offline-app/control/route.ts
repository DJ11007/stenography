import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Read by the installed SCTyping app (stenography-offline/src/lib/app-control.ts): which sections
// and tests are hidden / free / locked, plus the notice banner and trial limits. Cross-origin on
// purpose, same as /offline-app/latest. Short cache so an admin change reaches students within minutes.
export async function GET() {
  const headers = { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=60" };
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("public_app_control");
    if (error || !data) return NextResponse.json({ rules: {}, settings: {} }, { headers });
    return NextResponse.json(data, { headers });
  } catch {
    return NextResponse.json({ rules: {}, settings: {} }, { headers });
  }
}
