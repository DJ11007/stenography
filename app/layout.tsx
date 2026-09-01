import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { TypingPlatformProvider } from "./typing/_components/typing-platform-provider";
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
  title: "Samradhi Classes",
  description: "Typing, stenography and competitive-exam preparation from Samradhi Classes.",
  // Favicon comes from app/icon.png (Next.js's file-convention icon, a
  // properly sized 512x512 render of the logo) -- Next detects it
  // automatically and injects the right <link rel="icon"> tag, so it does
  // not need to be declared here too.
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body suppressHydrationWarning className="min-h-full flex flex-col">
        <TypingPlatformProvider>{children}</TypingPlatformProvider>
      </body>
    </html>
  );
}
