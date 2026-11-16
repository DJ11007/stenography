import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { SITE_URL } from "@/lib/seo";

export async function GET(request: Request) {
  const url = new URL(request.url);
  // Redirects use the public address: behind nginx, request.url's origin is the app's internal https://localhost:3000,
  // which sent students' confirmation and password-reset links to localhost (fixed 16 Nov 2026).
  const code = url.searchParams.get("code");
  const requestedNext = url.searchParams.get("next");
  const next = requestedNext === "/update-password" ? requestedNext : "/login?confirmed=1";
  const response = NextResponse.redirect(new URL(next, SITE_URL));

  if (!code) return response;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.redirect(new URL("/forgot-password?expired=1", SITE_URL));
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll: () => request.headers.get("cookie")?.split("; ").map((cookie) => {
          const [name, ...value] = cookie.split("=");
          return { name, value: value.join("=") };
        }) ?? [],
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL("/forgot-password?expired=1", SITE_URL));
  }
  return response;
}
