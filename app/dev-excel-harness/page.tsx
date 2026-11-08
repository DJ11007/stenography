import { readFile } from "node:fs/promises";
import path from "node:path";
import { notFound } from "next/navigation";
import { ExcelHarness } from "./harness";

// Development only: the Excel Efficiency workspace on EXCEL EFFICIENCY TEST 1's starting sheet, without an
// attempt or sign-in, to check the workspace and produce sheets for the marking checks. Not committed.
// ?big=1 adds rows 32-65 full of numbers (a sheet the size of EXCEL TEST 3) for speed checks.
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const params = await searchParams;
  const paper = params.test && /^[45]$/.test(params.test) ? params.test : null;
  if (paper) {
    // ?test=4 / ?test=5: that paper's working matter as an attempt starts it (excel_efficiency_initial_editor_document).
    const matter = JSON.parse(await readFile(path.join(process.cwd(), `tests/fixtures/excel-test${paper}-initial.json`), "utf8"));
    const rules = JSON.parse(await readFile(path.join(process.cwd(), `tests/fixtures/excel-test${paper}-rules.json`), "utf8")) as { n: number; marks: number; text: string }[];
    const start = JSON.parse(JSON.stringify({ schemaVersion: "3", rows: matter.rows, cols: matter.cols, cells: matter.cells, merges: [], sheet: {}, operations: [], savedAt: "1970-01-01T00:00:00.000Z" }));
    return <ExcelHarness original={start} title={`EFFICIENCY TEST ${paper}`} questions={rules.map((q) => ({ id: `q${q.n}`, number: q.n, display_order: q.n, instruction: q.text, marks: q.marks, section: null, is_visible: true }))} />;
  }
  const doc = JSON.parse(await readFile(path.join(process.cwd(), "tests/fixtures/excel-test1-initial.json"), "utf8"));
  if (params.big) {
    for (let row = 32; row <= 65; row++) for (let col = 0; col < 12; col++) {
      const ref = String.fromCharCode(65 + col) + row;
      doc.cells[ref] = { value: col === 0 ? `Name ${row}` : row * 100 + col, formula: null, bold: false, italic: false, underline: false, fontColor: null, fillColor: null, border: null, numberFormat: "General", align: "center", vAlign: "middle" };
    }
    doc.rows = 65;
  }
  return <ExcelHarness original={doc} />;
}
