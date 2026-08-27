import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { COURSE_PACKAGE_CATEGORIES } from "../lib/homepage-content.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("course package categories cover the platform's main offerings", () => {
  assert.ok(COURSE_PACKAGE_CATEGORIES.includes("Typing"));
  assert.ok(COURSE_PACKAGE_CATEGORIES.includes("Efficiency"));
  assert.ok(COURSE_PACKAGE_CATEGORIES.includes("Stenography"));
});

test("the header Buy Now button links straight to the /courses page with a distinct indigo/violet/fuchsia style, not the site's usual blue", async () => {
  const component = await read("app/_components/buy-now-button.tsx");
  assert.match(component, /href="\/courses"/);
  assert.match(component, /from-indigo-600 via-violet-600 to-fuchsia-600/);
  assert.doesNotMatch(component, /from-amber-500 via-orange-500 to-rose-500/);
  assert.doesNotMatch(component, /role="dialog"/);
  assert.doesNotMatch(component, /useState/);
});

test("the site header always renders Buy Now next to the sign-in links, on every page that uses it", async () => {
  const header = await read("app/_components/site-header.tsx");
  assert.match(header, /<BuyNowButton \/>/);
  assert.match(header, /<AccessNavigation \/>/);
  assert.doesNotMatch(header, /coursePackages/);
});

test("the homepage no longer threads course packages into the header, and the old flat 'Buy our complete course' section is gone", async () => {
  const homepage = await read("app/page.tsx");
  assert.match(homepage, /<SiteHeader \/>/);
  assert.doesNotMatch(homepage, /Buy our complete course/);
  assert.doesNotMatch(homepage, /coursePackages/);
  assert.match(homepage, /<BuyNowButton \/>/);
});

test("the /courses page groups published packages by category with a distinct color theme, jump links, per-plan call and WhatsApp CTAs, and a graceful empty state", async () => {
  const page = await read("app/courses/page.tsx");
  assert.match(page, /getPublishedCoursePackages/);
  assert.match(page, /groupByCategory/);
  assert.match(page, /Typing:.*from-blue-600 to-cyan-500/s);
  assert.match(page, /Efficiency:.*from-emerald-600 to-teal-500/s);
  assert.match(page, /Stenography:.*from-violet-600 to-fuchsia-500/s);
  assert.match(page, /Jump to a course category/);
  assert.match(page, /Enroll Now/);
  assert.match(page, /WhatsAppIcon/);
  assert.match(page, /Courses are being set up/);
  assert.doesNotMatch(page, /razorpay|stripe|card number|cvv/i);
});

test("the admin course package form lets an admin choose or type a category, saved through the migration's extra parameter", async () => {
  const manager = await read("app/admin/homepage/homepage-content-manager.tsx");
  assert.match(manager, /name="category" list="course-category-options"/);
  assert.match(manager, /COURSE_PACKAGE_CATEGORIES\.map/);
  const actions = await read("app/admin/homepage/actions.ts");
  assert.match(actions, /p_category: String\(formData\.get\("category"\)/);
  const migration = await read("supabase/migrations/202608270037_course_package_categories.sql");
  assert.match(migration, /alter table public\.course_packages add column if not exists category text/);
  assert.match(migration, /drop function if exists public\.admin_save_course_package\(uuid,text,text,text,text,text\[\],text,text,boolean,boolean,integer\)/);
});
