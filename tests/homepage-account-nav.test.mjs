import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("the site header fetches the current user and profile itself, so every page using it (home, courses, contact, about, legal) shows the right account state with no per-page wiring", () => {
  const header = read("app/_components/site-header.tsx");
  assert.match(header, /export async function SiteHeader\(\)/);
  assert.match(header, /const user = await getCurrentUser\(\);/);
  assert.match(header, /\.from\("profiles"\)\.select\("full_name, role"\)\.eq\("id", user\.id\)/);
  assert.match(header, /<AccessNavigation account=\{account\} \/>/);
});

test("logged-out visitors see one Student Portal button instead of separate Login and Sign Up links", () => {
  const nav = read("app/_components/access-navigation.tsx");
  assert.doesNotMatch(nav, /Student Login/);
  assert.doesNotMatch(nav, /"Sign Up"/);
  const portalLinks = nav.match(/href="\/login"/g) ?? [];
  assert.ok(portalLinks.length >= 2, "desktop and mobile menus should both link Student Portal to /login"); // desktop + mobile menu
  assert.match(nav, />\s*Student Portal\s*</);
});

test("the login page already offers new students a path to create an account, so Student Portal alone covers both login and signup", () => {
  const loginForm = read("app/login/login-form.tsx");
  assert.match(loginForm, /New student\?/);
  assert.match(loginForm, /href="\/signup">Create an account<\/Link>/);
});

test("logged-in visitors see a profile badge with their name instead of the Student Portal button, scoped to their role's dashboard, with a working sign-out", () => {
  const nav = read("app/_components/access-navigation.tsx");
  assert.match(nav, /if \(account\) \{/);
  assert.match(nav, /const dashboardHref = account\.role === "admin" \? "\/admin" : "\/student";/);
  assert.match(nav, /\{account\.fullName\}/);
  assert.match(nav, /form action=\{signOut\}/);
});

test("Student Portal and Call Now share the same rounded-full pill shape and sizing, so they don't look like mismatched buttons", () => {
  const nav = read("app/_components/access-navigation.tsx");
  assert.match(nav, /href="\/login" className=\{`whitespace-nowrap rounded-full border-2/);
  assert.match(nav, /rounded-full bg-emerald-600 px-3\.5 py-2 text-xs font-black/);
  // both use the same px-3.5/py-2 base size stepping up at sm:
  assert.match(nav, /px-3\.5 py-2 text-xs font-black[^"]*sm:px-4 sm:text-sm/);
});

test("Connect deliberately matches Buy Now's premium gradient/shimmer CTA treatment (icon, shimmer sweep, hover-lift shadow), but in its own distinct teal/cyan color so it isn't a literal clone", () => {
  const header = read("app/_components/site-header.tsx");
  const buyNow = read("app/_components/buy-now-button.tsx");
  assert.match(header, /href="\/connect" className="group relative inline-flex items-center gap-1\.5 overflow-hidden whitespace-nowrap rounded-full bg-gradient-to-r from-teal-500 via-cyan-500 to-sky-500/);
  assert.match(header, /<ConnectIcon className="h-4 w-4" \/>/);
  assert.match(header, /-translate-x-full bg-white\/25 transition-transform duration-700 group-hover:translate-x-full/);
  // same shimmer-sweep technique as Buy Now, not the same color
  assert.match(buyNow, /-translate-x-full bg-white\/25 transition-transform duration-700 group-hover:translate-x-full/);
  assert.doesNotMatch(header, /from-indigo-600 via-violet-600 to-fuchsia-600/); // not a literal clone of Buy Now's palette
});

test("proxy refreshes the session on /typing routes too, not just everywhere else -- this is the actual fix for the 'logged out after clicking the logo' bug", () => {
  const proxy = read("proxy.ts");
  // /typing must NOT appear in the matcher's exclusion list any more.
  assert.doesNotMatch(proxy, /typing\(\?:\/\|\$\)\|/);
  // The auth pages themselves still correctly skip proxy (no session to refresh there).
  assert.match(proxy, /login\(\?:\/\|\$\)/);
  assert.match(proxy, /signup\(\?:\/\|\$\)/);
});
