import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const officialLinks = readFileSync(new URL("../app/_components/official-links.tsx", import.meta.url), "utf8");
const siteHeader = readFileSync(new URL("../app/_components/site-header.tsx", import.meta.url), "utf8");
const siteFooter = readFileSync(new URL("../app/_components/site-footer.tsx", import.meta.url), "utf8");

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

test("header Connect menu and footer links share safe accessible external-link markup", () => {
  assert.match(siteHeader, /<summary[^>]+>\s*Connect/);
  assert.match(siteHeader, /aria-label="Samradhi Classes social and official links"/);
  assert.match(siteFooter, /<nav aria-label="Official links">/);
  const combined = siteHeader + siteFooter;
  assert.equal(combined.match(/target="_blank"/g)?.length, 2);
  assert.equal(combined.match(/rel="noopener noreferrer"/g)?.length, 2);
  assert.equal(combined.match(/aria-label=\{link\.ariaLabel\}/g)?.length, 2);
});

test("official links use responsive wrapping and accessible header navigation", () => {
  assert.match(siteFooter, /flex flex-wrap justify-center gap-2/);
  assert.match(siteHeader, /hidden[^"]*md:block/);
});

test("every official link has a recognizable decorative SVG icon and visible label", () => {
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
  const combined = siteHeader + siteFooter;
  assert.equal(
    combined.match(
      /<OfficialLinkIcon\s+name=\{link\.icon\}\s+className=\{link\.iconColor\}\s*\/>\s*<span>\{link\.label\}<\/span>/g
    )?.length,
    2
  );
});
