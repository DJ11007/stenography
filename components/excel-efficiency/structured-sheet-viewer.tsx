import { columnLetters } from "@/lib/excel-sheet";
import { toExcelDocumentV3, type ExcelDocument, type ExcelDocumentV2, type SheetCell } from "@/lib/excel-document";
import { borderCss, formatCellValue, mergeAt, previewHeaderText } from "@/lib/excel-sheet-model";

// A read-only view of a saved Excel Efficiency sheet for the admin: values, fonts, colours, alignment, borders,
// merged cells, and the sheet's page settings (what the questions about gridlines, print area, header etc. check).
export function StructuredSheetViewer({ document, label }: { document: unknown; label: string }) {
  const sheet = readDocument(document);
  if (!sheet) return <section aria-label={label} className="rounded-2xl border bg-white p-5"><h3 className="font-black">{label}</h3><p className="p-5 text-slate-500">Sheet preview unavailable.</p></section>;
  const { rows, cols, cells, merges, sheet: settings } = sheet;
  const header = [settings.header.left, settings.header.center, settings.header.right].map((part) => previewHeaderText(part)).filter(Boolean).join(" | ");
  const footer = [settings.footer.left, settings.footer.center, settings.footer.right].map((part) => previewHeaderText(part)).filter(Boolean).join(" | ");
  return (
    <section aria-label={label} className="rounded-2xl border bg-white p-5">
      <h3 className="font-black">{label}</h3>
      <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
        <div><dt className="inline font-bold">Gridlines: </dt><dd className="inline">{settings.gridlines ? "shown" : "hidden"}</dd></div>
        <div><dt className="inline font-bold">Headings: </dt><dd className="inline">{settings.headings ? "shown" : "hidden"}</dd></div>
        <div><dt className="inline font-bold">Print area: </dt><dd className="inline">{settings.printArea ?? "—"}</dd></div>
        <div><dt className="inline font-bold">Page: </dt><dd className="inline">{settings.orientation === "landscape" ? "Landscape" : "Portrait"}, {settings.paperSize}, {settings.margins} margins</dd></div>
        <div><dt className="inline font-bold">Header: </dt><dd className="inline">{header || "—"}</dd></div>
        <div><dt className="inline font-bold">Footer: </dt><dd className="inline">{footer || "—"}</dd></div>
        <div><dt className="inline font-bold">Merged: </dt><dd className="inline">{merges.length ? merges.join(", ") : "—"}</dd></div>
      </dl>
      <div className="mt-4 max-h-[32rem] overflow-auto rounded-xl border">
        <table className="border-collapse text-xs" style={{ tableLayout: "fixed" }}>
          <thead><tr className="bg-slate-100"><th className="w-8 border p-1" />{Array.from({ length: cols }, (_, col) => <th key={col} className="w-20 border p-1 font-black">{columnLetters(col)}</th>)}</tr></thead>
          <tbody>
            {Array.from({ length: rows }, (_, index) => {
              const row = index + 1;
              return (
                <tr key={row}>
                  <th className="border bg-slate-50 p-1 font-black">{row}</th>
                  {Array.from({ length: cols }, (_, col) => {
                    const merged = mergeAt(merges, row, col);
                    if (merged && (merged.r1 !== row || merged.c1 !== col)) return null;
                    const cell: SheetCell | undefined = cells[`${columnLetters(col)}${row}`];
                    const span = merged ? { rowSpan: merged.r2 - merged.r1 + 1, colSpan: merged.c2 - merged.c1 + 1 } : {};
                    return (
                      <td key={col} {...span} className="border p-1" title={cell?.formula ?? undefined}
                        style={{ fontWeight: cell?.bold ? 700 : 400, fontStyle: cell?.italic ? "italic" : "normal", textDecoration: cell?.underline ? "underline" : undefined,
                          color: cell?.fontColor ? `#${cell.fontColor}` : undefined, backgroundColor: cell?.fillColor ? `#${cell.fillColor}` : undefined,
                          fontSize: cell?.fontSize ? `${(cell.fontSize * 4) / 3 * 0.8}px` : undefined, fontFamily: cell?.fontFamily ?? undefined,
                          textAlign: cell?.align ?? (typeof cell?.value === "number" ? "right" : "left"), verticalAlign: cell?.vAlign === "middle" ? "middle" : cell?.vAlign === "top" ? "top" : "bottom",
                          whiteSpace: cell?.wrap ? "normal" : "nowrap", overflow: "hidden", ...borderCss(cell?.border) }}>
                        {cell ? formatCellValue(cell.value, cell.numberFormat) : ""}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function sheetSummary(document: unknown) {
  const cells = readDocument(document)?.cells ?? {};
  const populated = Object.keys(cells).filter((ref) => cells[ref]?.value != null || cells[ref]?.formula != null);
  return { populatedCells: populated.length };
}

function readDocument(document: unknown): ExcelDocument | null {
  if (!document || typeof document !== "object") return null;
  const sheet = toExcelDocumentV3(document as ExcelDocument | ExcelDocumentV2);
  if (!sheet) return null;
  return { ...sheet, rows: Math.min(Math.max(sheet.rows, 1), 200), cols: Math.min(Math.max(sheet.cols, 1), 26), cells: sheet.cells && typeof sheet.cells === "object" ? sheet.cells : {} };
}
