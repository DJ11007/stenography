import { readFile } from "node:fs/promises";
import path from "node:path";
import { notFound } from "next/navigation";
import { ExcelHarness } from "./harness";

// Development only: the Excel Efficiency workspace on EXCEL EFFICIENCY TEST 1's starting sheet, without an
// attempt or sign-in, to check the workspace and produce sheets for the marking checks. Not committed.
export default async function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  const doc = JSON.parse(await readFile(path.join(process.cwd(), "tests/fixtures/excel-test1-initial.json"), "utf8"));
  return <ExcelHarness original={doc} />;
}
