import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { TypingPlatformProvider } from "./typing/_components/typing-platform-provider";
import { JsonLd } from "./_components/json-ld";
import { BASE_OPEN_GRAPH, BUSINESS, SEO_KEYWORDS, SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, SITE_TITLE_BRAND, SITE_URL, organizationJsonLd } from "@/lib/seo";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${SITE_TITLE_BRAND} – ${SITE_TAGLINE}`, template: `%s | ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  keywords: SEO_KEYWORDS,
  applicationName: SITE_NAME,
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  category: "education",
  // Only fields true of every page here: a title/url set at the root would be
  // inherited as the share title of every page. Pages that set their own
  // openGraph spread BASE_OPEN_GRAPH (a page openGraph replaces this one).
  openGraph: BASE_OPEN_GRAPH,
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } },
  // Search Console / Bing Webmaster ownership tokens, set on the server when available.
  verification: { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || undefined, other: process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION ? { "msvalidate.01": process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION } : undefined },
  other: { "geo.region": BUSINESS.regionCode, "geo.placename": `${BUSINESS.locality}, ${BUSINESS.region}` },
  // Favicon comes from app/icon.png (Next.js's file-convention icon, a
  // properly sized 512x512 render of the logo) -- Next detects it
  // automatically and injects the right <link rel="icon"> tag, so it does
  // not need to be declared here too. Canonical URLs are set per public page
  // (never here: a layout canonical would be inherited by every page).
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en-IN"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body suppressHydrationWarning className="min-h-full flex flex-col">
        <JsonLd data={organizationJsonLd()} />
        <TypingPlatformProvider>{children}</TypingPlatformProvider>
      </body>
    </html>
  );
}
