import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("student catalogues use exact modes and exclude live tests", async () => {
  const source = await read("lib/managed-test-catalogue-server.ts");
  assert.match(source, /\.eq\("mode", mode\)/);
  assert.match(source, /\.eq\("is_live", false\)/);
  assert.match(source, /\.eq\("status", "published"\)/);
  assert.match(source, /\.eq\("visibility", "public"\)/);
  for (const [page, mode] of [["app/typing/exams/page.tsx", "exam"], ["app/typing/stenography/page.tsx", "stenography"]]) {
    assert.match(await read(page), new RegExp(`getPublishedManagedTests\\(\\"${mode}\\"\\)`));
  }
  assert.match(await read("app/typing/practice/english/page.tsx"), /PracticeNavigator language="English"/);
  assert.match(await read("app/typing/practice/english-stenography/page.tsx"), /mode="stenography" language="English"/);
  assert.match(await read("app/typing/practice/_components/category-catalogue.tsx"), /language:"Hindi", inputSystemId:selected/);
  assert.match(await read("lib/learning-tests-server.ts"), /\.eq\("mode", "learn"\).*\.eq\("is_live", false\)/);
});

test("section RPC rejects cross-section and live saves", async () => {
  const migration = await read("supabase/migrations/202608230003_strict_test_sections_and_delete_test_1.sql");
  assert.match(migration, /existing_mode is distinct from p_mode/);
  assert.match(migration, /section mode mismatch/);
  assert.match(migration, /section tests cannot be configured as live tests/);
});
