import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const schemaPath = new URL("../supabase/migrations/202608260032_official_websites.sql", import.meta.url);
const seedPath = new URL("../supabase/migrations/202608280038_seed_official_websites.sql", import.meta.url);

async function schemaOnlyDatabase() {
  const db = new PGlite();
  await db.exec(`
create role anon;create role authenticated;
create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$select null::uuid$$;
create function public.is_aal2_admin() returns boolean language sql stable as $$select false$$;
`);
  await db.exec(await readFile(schemaPath, "utf8"));
  return db;
}
async function database() {
  const db = await schemaOnlyDatabase();
  await db.exec(await readFile(seedPath, "utf8"));
  return db;
}

test("the seed migration inserts exactly the six expected official websites, all published, with valid http(s) URLs", async () => {
  const db = await database();
  const { rows } = await db.query("select name,url,description,is_published,display_order from public.official_websites order by display_order");
  assert.equal(rows.length, 6);
  const names = rows.map((row) => row.name);
  for (const expected of ["SSO Rajasthan", "RSSB", "RPSC", "SSC", "Indian Railways (RRB)", "RVVUNL"]) assert.ok(names.includes(expected), `missing ${expected}`);
  for (const row of rows) {
    assert.match(row.url, /^https:\/\//);
    assert.ok(row.description.length > 10);
    assert.equal(row.is_published, true);
  }
  const rvvunl = rows.find((row) => row.name === "RVVUNL");
  assert.equal(rvvunl.url, "https://energy.rajasthan.gov.in/home");
  await db.close();
});

test("re-running the seed migration does not create duplicate rows", async () => {
  const db = await database();
  await db.exec(await readFile(seedPath, "utf8"));
  const { rows } = await db.query("select count(*)::int as count from public.official_websites");
  assert.equal(rows[0].count, 6);
  await db.close();
});

test("the seed migration does not overwrite a website an admin already added at the same URL", async () => {
  const db = await schemaOnlyDatabase();
  await db.query("insert into public.official_websites(name,url,description,is_published,display_order) values('Custom RSSB label','https://rssb.rajasthan.gov.in','Admin-written description',true,99)");
  await db.exec(await readFile(seedPath, "utf8"));
  const { rows } = await db.query("select name,description from public.official_websites where url='https://rssb.rajasthan.gov.in'");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, "Custom RSSB label");
  await db.close();
});
