import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

// Login-only and account areas: crawlers would only be redirected to /login.
const PRIVATE_PATHS = [
  // "/typing/" with the slash: a bare "/typing" prefix would also block the
  // public /typing-test/* exam pages.
  "/admin", "/typing/", "/tests/", "/student", "/account", "/auth", "/classroom", "/dev-model-answer-harness",
  "/forgot-password", "/update-password", "/verify-recovery-otp", "/recover-account", "/signup/pending-approval",
];

// AI search and answer engines (GEO/AEO). Named explicitly so the site's
// intent to be cited is unambiguous; each gets the same rules as everyone.
const AI_CRAWLERS = [
  "GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-SearchBot", "Claude-User", "PerplexityBot", "Perplexity-User",
  "Google-Extended", "Applebot-Extended", "Bingbot", "meta-externalagent", "CCBot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: PRIVATE_PATHS },
      { userAgent: AI_CRAWLERS, allow: ["/", "/llms.txt"], disallow: PRIVATE_PATHS },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
