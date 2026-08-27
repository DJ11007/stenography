import { columnLetters } from "@/lib/excel-sheet";

type Cell = { value?: unknown; formula?: unknown; bold?: unknown; italic?: unknown; fillColor?: unknown; align?: unknown };
type Document = { rows?: unknown; cols?: unknown; cells?: unknown };

export function StructuredSheetViewer({ document, label }: { document: unknown; label: string }) {
  const { rows, cols, cells } = readDocument(document);
  const rowNumbers = Array.from({ length: rows }, (_, index) => index + 1);
  const colLetters = Array.from({ length: cols }, (_, index) => columnLetters(index));
  return (
    <section aria-label={label} className="rounded-2xl border bg-white p-5">
      <h3 className="font-black">{label}</h3>
      <div className="mt-4 max-h-[32rem] overflow-auto rounded-xl border">
        {rows && cols ? (
          <table className="min-w-full border-collapse text-xs">
            <thead><tr className="bg-slate-100"><th className="border p-1" />{colLetters.map((letter) => <th key={letter} className="border p-1 font-black">{letter}</th>)}</tr></thead>
            <tbody>
              {rowNumbers.map((row) => (
                <tr key={row}>
                  <th className="border bg-slate-50 p-1 font-black">{row}</th>
                  {colLetters.map((letter) => {
                    const cell = cells[`${letter}${row}`];
                    return <td key={letter} className="border p-1" style={{ fontWeight: cell?.bold ? 700 : 400, fontStyle: cell?.italic ? "italic" : "normal", backgroundColor: typeof cell?.fillColor === "string" ? `#${cell.fillColor}` : undefined, textAlign: cell?.align === "right" || cell?.align === "center" ? cell.align : "left" }}>{String(cell?.formula ?? cell?.value ?? "")}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="p-5 text-slate-500">Sheet preview unavailable.</p>
        )}
      </div>
    </section>
  );
}

export function sheetSummary(document: unknown) {
  const { cells } = readDocument(document);
  const populated = Object.keys(cells).filter((ref) => cells[ref]?.value != null || cells[ref]?.formula != null);
  return { populatedCells: populated.length };
}

function readDocument(document: unknown): { rows: number; cols: number; cells: Record<string, Cell> } {
  if (!document || typeof document !== "object") return { rows: 0, cols: 0, cells: {} };
  const value = document as Document;
  const rows = typeof value.rows === "number" ? Math.min(Math.max(value.rows, 0), 200) : 0;
  const cols = typeof value.cols === "number" ? Math.min(Math.max(value.cols, 0), 26) : 0;
  const cells = value.cells && typeof value.cells === "object" ? (value.cells as Record<string, Cell>) : {};
  return { rows, cols, cells };
}
