import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const homepage = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");

test("homepage exposes every official Samradhi Classes HTTPS destination", () => {
  for (const [label, href] of [
    ["YouTube", "https://youtube.com/@samradhiclasses"],
    ["Instagram", "https://www.instagram.com/samradhiclasses"],
    ["Mobile App", "https://inxcft.on-app.in/app/home/app/home?orgCode=inxcft"],
    ["Existing Website", "https://classplusapp.com/w/samradhiclasses"],
    ["Telegram", "https://t.me/Samradhiclasses"],
  ]) {
    assert.match(homepage, new RegExp(`label: "${label}"`));
    assert.ok(homepage.includes(`href: "${href}"`));
  }
});

test("header Connect menu and footer links share safe accessible external-link markup", () => {
  assert.match(homepage, /<summary[^>]+>Connect/);
  assert.match(homepage, /aria-label="Samradhi Classes social and official links"/);
  assert.match(homepage, /<nav aria-label="Official links">/);
  assert.equal(homepage.match(/target="_blank"/g)?.length, 2);
  assert.equal(homepage.match(/rel="noopener noreferrer"/g)?.length, 2);
  assert.equal(homepage.match(/aria-label=\{link\.ariaLabel\}/g)?.length, 2);
});

test("official links use responsive wrapping and desktop alignment", () => {
  assert.match(homepage, /flex flex-wrap justify-center gap-2 md:justify-end/);
  assert.match(homepage, /md:grid-cols-\[minmax\(0,1fr\)_minmax\(0,2fr\)\]/);
  assert.match(homepage, /hidden[^\"]*md:block/);
});

test("every official link has a recognizable decorative SVG icon and visible label", () => {
  for (const [label, icon, color] of [
    ["YouTube", "youtube", "text-red-600"],
    ["Instagram", "instagram", "text-fuchsia-600"],
    ["Mobile App", "mobile", "text-blue-500"],
    ["Existing Website", "website", "text-indigo-500"],
    ["Telegram", "telegram", "text-sky-500"],
  ]) {
    assert.match(homepage, new RegExp(`label: "${label}"[^\\n]+icon: "${icon}"[^\\n]+iconColor: "${color}"`));
  }
  assert.match(homepage, /function OfficialLinkIcon/);
  assert.match(homepage, /"aria-hidden": true/);
  assert.match(homepage, /focusable: false/);
  assert.match(homepage, /h-5 w-5 shrink-0/);
  assert.equal(homepage.match(/<OfficialLinkIcon name=\{link\.icon\} className=\{link\.iconColor\}\/><span>\{link\.label\}<\/span>/g)?.length, 2);
});
