import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { krutiDevToUnicode } from "../lib/hindi-font-converter.ts";

const migrationPath = new URL(
  "../supabase/migrations/202609101715_repair_rajasthan_ldc_hindi_chapter_typos.sql",
  import.meta.url,
);

const adminId = "00000000-0000-4000-8000-000000000009";

// Every chapter the migration touches, with the wrong-key typos that must be
// gone from the corrected passage once it decodes back to Unicode.
const CHAPTERS = [
  { slug: "izfrys-ku-1", gone: ["प्रेन्न", "इनाती", "अनुशोन", "पैंधा"] },
  {
    slug: "chapter-2",
    gone: ["निधान", "विरोधा", "प्रतिरोधा", "साधानों", "कंधें", "अबरह", "विवी पश्चात", "जाती हो।", "गए थें।"],
  },
  { slug: "chapter-3", gone: ["मॉडयुल", "मॉडयूल", "अचनी", "उचलब्धि", "भूंपीय", "माची", "धौर्य", "सतीश धावन", "प्रेिद्ध"] },
  { slug: "chapter-4", gone: ["गाँअ", "इग्लेंड", "होते थें।"] },
  { slug: "chapter-5", gone: ["साधान माना", "मुंेई", "संमाजिक", "धार्म अपनाया"] },
  { slug: "chapter", gone: ["सुविर्धाओं", "सुरक्षि संबंधी", "जानी भी"] },
  { slug: "chapter-9", gone: ["संसाधानों", "संमान्य", "प्रबंधान", "पैंधा", "पैंधों"] },
];

async function database() {
  const db = new PGlite();
  await db.exec(`
create schema auth;
create table auth.users(id uuid primary key);
create table public.tests(
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  current_version_id uuid,
  current_version_number integer,
  updated_at timestamptz not null default now()
);
create table public.test_versions(
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.tests(id) on delete restrict,
  version_number integer not null,
  title text, description text, language text, mode text,
  input_system_id text,
  duration_seconds integer,
  passage text not null,
  required_wpm integer, required_accuracy integer,
  backspace_mode text, word_method text, highlight_mode text,
  visibility text,
  passage_characters integer, passage_words integer,
  configuration jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
alter table public.tests add constraint tests_current_version_fk
  foreign key (current_version_id) references public.test_versions(id);
create table public.test_attempts(
  id uuid primary key default gen_random_uuid(),
  test_version_id uuid not null references public.test_versions(id) on delete restrict,
  score integer not null
);
create table public.admin_test_audit_log(
  id bigint generated always as identity primary key,
  actor_user_id uuid,
  test_id uuid,
  test_version_id uuid,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
insert into auth.users values ('${adminId}');
`);
  return db;
}

async function seedChapter(db, slug, { passage = `PLACEHOLDER PASSAGE for ${slug}`, inputSystem = "hindi-krutidev-010" } = {}) {
  const { rows: [test] } = await db.query(
    "insert into public.tests(slug) values ($1) returning id",
    [slug],
  );
  const { rows: [version] } = await db.query(
    `insert into public.test_versions(
       test_id, version_number, title, language, mode, input_system_id, duration_seconds,
       passage, backspace_mode, word_method, highlight_mode, visibility,
       passage_characters, passage_words, configuration, created_by
     ) values ($1, 1, $2, 'hi', 'exam', $3, 600, $4, 'word', 'spaces', 'none', 'public',
       char_length($4), 100, '{}'::jsonb, $5)
     returning id`,
    [test.id, `${slug} chapter`, inputSystem, passage, adminId],
  );
  await db.query(
    "update public.tests set current_version_id = $1, current_version_number = 1 where id = $2",
    [version.id, test.id],
  );
  // a frozen historical attempt — its score must never move
  await db.query(
    "insert into public.test_attempts(test_version_id, score) values ($1, 73)",
    [version.id],
  );
  return { testId: test.id, versionId: version.id };
}

test("the migration repairs every affected chapter into a new immutable version, preserving history", async () => {
  const db = await database();
  const seeded = {};
  for (const { slug } of CHAPTERS) seeded[slug] = await seedChapter(db, slug);
  // a decoy sharing chapter-2's typo text but not Kruti Dev — must be left alone
  const decoy = await seedChapter(db, "unicode-decoy", { passage: "साधानों", inputSystem: "hindi-unicode" });

  await db.exec(await readFile(migrationPath, "utf8"));

  for (const { slug, gone } of CHAPTERS) {
    const { rows: [test] } = await db.query(
      "select current_version_id, current_version_number from public.tests where slug = $1",
      [slug],
    );
    assert.equal(test.current_version_number, 2, `${slug} advanced to version 2`);
    assert.notEqual(test.current_version_id, seeded[slug].versionId, `${slug} repointed off the original version`);

    const { rows: [current] } = await db.query(
      "select passage, passage_characters, passage_words, configuration from public.test_versions where id = $1",
      [test.current_version_id],
    );
    assert.equal(current.passage_characters, current.passage.length);
    assert.ok(current.passage_words > 50, `${slug} recomputed a sane word count`);
    assert.equal(current.configuration.passage_encoding, "krutidev-legacy");

    const decoded = krutiDevToUnicode(current.passage);
    for (const typo of gone) {
      assert.ok(!decoded.includes(typo), `${slug}: corrected passage still decodes to the typo "${typo}"`);
    }

    // original version and its frozen attempt are untouched
    const { rows: [old] } = await db.query(
      "select passage from public.test_versions where id = $1",
      [seeded[slug].versionId],
    );
    assert.ok(old.passage.startsWith("PLACEHOLDER"), `${slug}: original version preserved verbatim`);
    const { rows: [attempt] } = await db.query(
      "select score from public.test_attempts where test_version_id = $1",
      [seeded[slug].versionId],
    );
    assert.equal(attempt.score, 73, `${slug}: historical attempt score frozen`);

    const { rows: [audit] } = await db.query(
      "select action, metadata from public.admin_test_audit_log where test_version_id = $1",
      [test.current_version_id],
    );
    assert.equal(audit.action, "test_version_created");
    assert.equal(audit.metadata.historical_version_preserved, true);
  }

  const { rows: [decoyTest] } = await db.query(
    "select current_version_id, current_version_number from public.tests where slug = 'unicode-decoy'",
  );
  assert.equal(decoyTest.current_version_number, 1, "non-Kruti-Dev decoy left untouched");
  assert.equal(decoyTest.current_version_id, decoy.versionId);

  await db.close();
});

test("re-running the migration is a no-op (idempotent)", async () => {
  const db = await database();
  for (const { slug } of CHAPTERS) await seedChapter(db, slug);

  await db.exec(await readFile(migrationPath, "utf8"));
  await db.exec(await readFile(migrationPath, "utf8"));

  const { rows: [{ count }] } = await db.query("select count(*)::int from public.test_versions");
  assert.equal(count, CHAPTERS.length * 2, "exactly one new version per chapter, not two");

  const { rows: [{ count: audits }] } = await db.query(
    "select count(*)::int from public.admin_test_audit_log",
  );
  assert.equal(audits, CHAPTERS.length, "audit log not double-written");

  await db.close();
});

test("a missing chapter slug is skipped without failing the deploy", async () => {
  const db = await database();
  // seed only one chapter; the rest are absent
  await seedChapter(db, "chapter-3");
  await assert.doesNotReject(db.exec(await readFile(migrationPath, "utf8")));
  const { rows: [{ count }] } = await db.query("select count(*)::int from public.tests");
  assert.equal(count, 1);
  await db.close();
});
