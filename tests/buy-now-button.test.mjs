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

test("the Buy Now button groups packages by category, offers a call and WhatsApp CTA per plan, and never claims to take payment on the page", async () => {
  const component = await read("app/_components/buy-now-button.tsx");
  assert.match(component, /Buy Now/);
  assert.match(component, /role="dialog" aria-modal="true"/);
  assert.match(component, /categories\.map/);
  assert.match(component, /Call to Buy/);
  assert.match(component, /WhatsApp/);
  assert.match(component, /no payment is collected on this page/i);
  assert.doesNotMatch(component, /razorpay|stripe|card number|cvv/i);
});

test("the site header renders Buy Now only when course packages are supplied, next to the sign-in links", async () => {
  const header = await read("app/_components/site-header.tsx");
  assert.match(header, /<BuyNowButton packages=\{coursePackages\}/);
  assert.match(header, /coursePackages && coursePackages\.length > 0/);
  assert.match(header, /<AccessNavigation \/>/);
});

test("the homepage passes its published course packages into the header and no longer renders the old flat 'Buy our complete course' section", async () => {
  const homepage = await read("app/page.tsx");
  assert.match(homepage, /<SiteHeader coursePackages=\{coursePackages\} \/>/);
  assert.doesNotMatch(homepage, /Buy our complete course/);
  assert.match(homepage, /<BuyNowButton packages=\{coursePackages\}/);
});

test("the admin course package form lets an admin choose or type a category, saved through the new migration's extra parameter", async () => {
  const manager = await read("app/admin/homepage/homepage-content-manager.tsx");
  assert.match(manager, /name="category" list="course-category-options"/);
  assert.match(manager, /COURSE_PACKAGE_CATEGORIES\.map/);
  const actions = await read("app/admin/homepage/actions.ts");
  assert.match(actions, /p_category: String\(formData\.get\("category"\)/);
  const migration = await read("supabase/migrations/202608270037_course_package_categories.sql");
  assert.match(migration, /alter table public\.course_packages add column if not exists category text/);
  assert.match(migration, /drop function if exists public\.admin_save_course_package\(uuid,text,text,text,text,text\[\],text,text,boolean,boolean,integer\)/);
});
