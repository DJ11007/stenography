import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { absoluteUrl } from "@/lib/seo";
import { SCTYPING_WIN7 } from "@/lib/sctyping-release";

const INSTALLER_PATH = "/downloads/sctyping-setup.exe";

// Counts one SCTyping download for the homepage stat, then hands over the installer. Linked with a
// plain <a> (never next/link), since a prefetch would count a download nobody asked for. Counting is
// best-effort: a database hiccup must never block the download itself.
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    await supabase.rpc("record_offline_app_download");
  } catch {
    // Download still proceeds below.
  }
  // Always the public address: behind nginx, request.url is the app's own internal address
  // (https://localhost:3000/...), which sent students' downloads to localhost (fixed 16 Nov 2026).
  // ?edition=win7: the Windows 7 / 8 installer (hosted as a GitHub release asset, see lib/sctyping-release.ts).
  const win7 = new URL(request.url).searchParams.get("edition") === "win7";
  return NextResponse.redirect(win7 ? SCTYPING_WIN7.url : absoluteUrl(INSTALLER_PATH), 302);
}
