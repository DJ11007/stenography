import { columnLetters } from "@/lib/excel-sheet";
import { toExcelDocumentV3, type ExcelDocument, type ExcelDocumentV2, type SheetCell } from "@/lib/excel-document";
import { CONDITIONAL_STYLES, borderCss, conditionalStyleAt, formatCellValue, mergeAt, previewHeaderText } from "@/lib/excel-sheet-model";

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
        <div><dt className="inline font-bold">Sheet name: </dt><dd className="inline">{settings.name || "Sheet1"}</dd></div>
        {settings.freeze && <div><dt className="inline font-bold">Freeze panes: </dt><dd className="inline">{settings.freeze === "A2" ? "Top row" : settings.freeze === "B1" ? "First column" : `at ${settings.freeze}`}</dd></div>}
        {settings.filter && <div><dt className="inline font-bold">Filter: </dt><dd className="inline">{settings.filter}{Object.entries(settings.filterHidden ?? {}).map(([col, values]) => ` (${col} hides ${values.join(", ")})`).join("")}</dd></div>}
        {settings.protected && <div><dt className="inline font-bold">Protected: </dt><dd className="inline">yes</dd></div>}
        {(settings.printTitleRows || settings.printTitleCols) && <div><dt className="inline font-bold">Print titles: </dt><dd className="inline">{[settings.printTitleRows, settings.printTitleCols].filter(Boolean).join(", ")}</dd></div>}
        {Boolean(settings.conditionalFormats?.length) && <div><dt className="inline font-bold">Conditional formatting: </dt><dd className="inline">{settings.conditionalFormats!.map((rule) => `${rule.range} ${rule.type}${rule.value !== undefined ? ` ${rule.value}` : ""}${rule.value2 !== undefined ? `–${rule.value2}` : ""} (${CONDITIONAL_STYLES[rule.style].label})`).join("; ")}</dd></div>}
        {Boolean(settings.charts?.length) && <div><dt className="inline font-bold">Charts: </dt><dd className="inline">{settings.charts!.map((chart) => `${chart.type} of ${chart.range}${chart.title ? ` "${chart.title}"` : ""}`).join("; ")}</dd></div>}
        {Boolean(settings.hiddenRows?.length || settings.hiddenCols?.length) && <div><dt className="inline font-bold">Hidden: </dt><dd className="inline">{[settings.hiddenRows?.length ? `rows ${settings.hiddenRows.join(", ")}` : "", settings.hiddenCols?.length ? `columns ${settings.hiddenCols.map((col) => columnLetters(col)).join(", ")}` : ""].filter(Boolean).join("; ")}</dd></div>}
        {Boolean(Object.keys(settings.colWidths ?? {}).length || Object.keys(settings.rowHeights ?? {}).length) && <div><dt className="inline font-bold">Sizes: </dt><dd className="inline">{[...Object.entries(settings.colWidths ?? {}).map(([col, width]) => `column ${col} ${width}`), ...Object.entries(settings.rowHeights ?? {}).map(([row, height]) => `row ${row} ${height} pt`)].join(", ")}</dd></div>}
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
                    const conditional = conditionalStyleAt(cells, settings.conditionalFormats, row, col);
                    return (
                      <td key={col} {...span} className="relative border p-1" title={[cell?.formula, cell?.comment ? `Comment: ${cell.comment}` : ""].filter(Boolean).join(" · ") || undefined}
                        style={{ fontWeight: cell?.bold ? 700 : 400, fontStyle: cell?.italic ? "italic" : "normal", textDecoration: cell?.underline ? "underline" : undefined,
                          color: conditional?.font ? `#${conditional.font}` : cell?.fontColor ? `#${cell.fontColor}` : undefined, backgroundColor: conditional?.fill ? `#${conditional.fill}` : cell?.fillColor ? `#${cell.fillColor}` : undefined,
                          fontSize: cell?.fontSize ? `${(cell.fontSize * 4) / 3 * 0.8}px` : undefined, fontFamily: cell?.fontFamily ?? undefined,
                          textAlign: cell?.align ?? (typeof cell?.value === "number" ? "right" : "left"), verticalAlign: cell?.vAlign === "middle" ? "middle" : cell?.vAlign === "top" ? "top" : "bottom",
                          whiteSpace: cell?.wrap ? "normal" : "nowrap", overflow: "hidden", ...borderCss(cell?.border) }}>
                        {cell ? formatCellValue(cell.value, cell.numberFormat, cell.decimals) : ""}
                        {cell?.comment && <span aria-label="Has a comment" className="absolute right-0 top-0 h-0 w-0 border-l-[6px] border-t-[6px] border-l-transparent border-t-red-700" />}
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
