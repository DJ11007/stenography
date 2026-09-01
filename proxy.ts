import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { expireSupabaseAuthTokenCookies,refreshSupabaseSession } from "@/lib/supabase-refresh-session";

// /typing is deliberately NOT excluded from the matcher below (unlike the
// auth pages), even though it's the single most-visited section of the
// site. Reason: /typing pages still call supabase.auth.getUser() on the
// server themselves (to check access, load the profile, etc.), which
// silently refreshes an expiring access token using the refresh token --
// but Server Components cannot persist cookies (see lib/supabase/server.ts),
// so that refreshed token pair was never written back to the browser. With
// Supabase's default refresh-token rotation, the browser kept sending the
// now-already-used refresh token on every request. Nothing looked wrong
// while the student stayed on /typing, but the *next* page that WAS
// covered by proxy (e.g. clicking the logo back to "/") would try to
// refresh with that stale token, fail, and proxy would then wipe the
// session cookies -- a real, reported "I got logged out just from clicking
// the logo" bug. Running proxy on /typing too means the refreshed token
// pair actually gets persisted every time, so this can't happen there.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabasePublishableKey) {
    return response;
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabasePublishableKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  await refreshSupabaseSession(
    () => supabase.auth.getUser(),
    () => expireSupabaseAuthTokenCookies(request.cookies,response.cookies)
  );

  return response;
}

export const config = {
  matcher: [
    "/((?!login(?:/|$)|admin/login(?:/|$)|signup(?:/|$)|forgot-password(?:/|$)|recover-account(?:/|$)|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
