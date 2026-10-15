import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { HOME_FAQS, SITE_URL, faqJsonLd, jsonLdHtml, organizationJsonLd } from "../lib/seo.ts";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("the SEO host is the real public domain, never an env value that could be localhost", () => {
  assert.equal(SITE_URL, "https://sctyping.com");
  assert.doesNotMatch(read("lib/seo.ts"), /SITE_URL = .*process\.env/);
});

test("structured data describes the Jaipur institute and matches the visible FAQ", () => {
  const graph = organizationJsonLd()["@graph"];
  const org = graph.find((node) => Array.isArray(node["@type"]));
  assert.deepEqual(org["@type"], ["EducationalOrganization", "LocalBusiness"]);
  assert.equal(org.address.postalCode, "302029");
  assert.equal(org.telephone, "+91-7014371324");
  const faq = faqJsonLd(HOME_FAQS);
  assert.equal(faq.mainEntity.length, HOME_FAQS.length);
  assert.match(read("app/page.tsx"), /HOME_FAQS\.map\(/, "FAQ answers must also be visible on the homepage");
  assert.doesNotMatch(jsonLdHtml({ text: "</script><b>" }).__html, /</);
});

test("robots and sitemap keep login-only pages out and point at the sitemap", () => {
  const robots = read("app/robots.ts");
  for (const path of ["/admin", "/typing", "/student", "/account"]) assert.ok(robots.includes(`"${path}"`), path);
  assert.match(robots, /sitemap: `\$\{SITE_URL\}\/sitemap\.xml`/);
  assert.doesNotMatch(read("app/sitemap.ts"), /path: "\/typing/);
  assert.match(read("app/typing/layout.tsx"), /robots: \{ index: false/);
});

test("the root layout never sets a canonical or share title every page would inherit", () => {
  const layout = read("app/layout.tsx");
  assert.doesNotMatch(layout, /alternates:/);
  assert.match(layout, /template: `%s \| \$\{SITE_NAME\}`/);
  assert.match(layout, /openGraph: BASE_OPEN_GRAPH,/);
});
