"use server";
// TEMPORARY, local development only -- not committed. Writes a harness save to tests/fixtures.
import { writeFile } from "node:fs/promises";
import path from "node:path";

export async function writeHarnessFixture(name: string, document: unknown) {
  if (process.env.NODE_ENV !== "development" || !/^[a-z0-9-]+\.json$/.test(name)) return { ok: false };
  await writeFile(path.join(process.cwd(), "tests", "fixtures", name), `${JSON.stringify(document)}\n`, "utf8");
  return { ok: true };
}
