import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const officialLinks = readFileSync(new URL("../app/_components/official-links.tsx", import.meta.url), "utf8");
const siteHeader = readFileSync(new URL("../app/_components/site-header.tsx", import.meta.url), "utf8");
const siteFooter = readFileSync(new URL("../app/_components/site-footer.tsx", import.meta.url), "utf8");
const connectPage = readFileSync(new URL("../app/connect/page.tsx", import.meta.url), "utf8");

test("official links module exposes every official Samradhi Classes HTTPS destination", () => {
  for (const [label, href] of [
    ["YouTube", "https://youtube.com/@samradhiclasses"],
    ["Instagram", "https://www.instagram.com/samradhiclasses"],
    ["Mobile App", "https://inxcft.on-app.in/app/home/app/home?orgCode=inxcft"],
    ["Existing Website", "https://classplusapp.com/w/samradhiclasses"],
    ["Telegram", "https://t.me/Samradhiclasses"],
  ]) {
    assert.match(officialLinks, new RegExp(`label: "${label}"`));
    assert.ok(officialLinks.includes(`href: "${href}"`));
  }
});

test("the header Connect button is a plain link to a dedicated /connect page, not an inline dropdown of every channel", () => {
  assert.match(siteHeader, /<Link href="\/connect"[^>]*>\s*Connect\s*<\/Link>/);
  assert.doesNotMatch(siteHeader, /OFFICIAL_LINKS/);
  assert.doesNotMatch(siteHeader, /<details className="group relative">/);
});

test("the /connect page lists every official channel plus phone support, with safe accessible external-link markup", () => {
  assert.match(connectPage, /OFFICIAL_LINKS\.map/);
  assert.match(connectPage, /target="_blank"/);
  assert.match(connectPage, /rel="noopener noreferrer"/);
  assert.match(connectPage, /aria-label=\{link\.ariaLabel\}/);
  assert.match(connectPage, /tel:\+91\$\{SUPPORT_NUMBER\}/);
  assert.match(connectPage, /<SiteHeader \/>/);
  assert.match(connectPage, /<SiteFooter \/>/);
});

test("footer official links use responsive wrapping and accessible navigation", () => {
  assert.match(siteFooter, /flex flex-wrap justify-center gap-2/);
  assert.match(siteFooter, /<nav aria-label="Official links">/);
});

test("every official link has a recognizable decorative SVG icon and visible label, in both the footer and the connect page", () => {
  for (const [label, icon, color] of [
    ["YouTube", "youtube", "text-red-600"],
    ["Instagram", "instagram", "text-fuchsia-600"],
    ["Mobile App", "mobile", "text-blue-500"],
    ["Existing Website", "website", "text-indigo-500"],
    ["Telegram", "telegram", "text-sky-500"],
  ]) {
    assert.match(officialLinks, new RegExp(`label: "${label}"[^\\n]+icon: "${icon}"[^\\n]+iconColor: "${color}"`));
  }
  assert.match(officialLinks, /function OfficialLinkIcon/);
  assert.match(officialLinks, /"aria-hidden": true/);
  assert.match(officialLinks, /focusable: false/);
  assert.match(officialLinks, /h-5 w-5 shrink-0/);
  assert.match(siteFooter, /<OfficialLinkIcon name=\{link\.icon\} className=\{link\.iconColor\}\s*\/>/);
  assert.match(connectPage, /<OfficialLinkIcon name=\{link\.icon\} className=\{`h-6 w-6 \$\{link\.iconColor\}`\}\s*\/>/);
});
