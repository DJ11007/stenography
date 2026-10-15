"use client";

import { useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { BORDER_WIDTHS, TABLE_STYLES, TABLE_STYLE_OPTION_KEYS, type BorderCommand, type Pen, type TableStyleOptionKey } from "@/lib/word-table-model";
import { useClampedFlyoutPosition, useDismiss } from "./word-flyout";

// Word 2013's TABLE TOOLS contextual tabs, shown while the cursor is in a table:
// DESIGN (Table Style Options, Table Styles, Shading, Borders) and LAYOUT
// (Table, Draw, Rows & Columns, Merge, Cell Size, Alignment, Data). Every control
// calls `on(action, value)`; the editor does the work (lib/word-table-model.ts)
// and passes the current table's state back in `state`.

export type TableToolsState = {
  tableStyle: string | null;
  styleOptions: Record<TableStyleOptionKey, boolean>;
  pen: Pen;
  gridlines: boolean;
  mode: "off" | "draw" | "erase" | "paint";
  repeatHeader: boolean;
  rowHeight: number | null;
  colWidth: number | null;
  canMerge: boolean;
};
export type TableToolsAction =
  | "styleOption" | "tableStyle" | "shading" | "penStyle" | "penWidth" | "penColor" | "borderStyle" | "borders" | "bordersDialog" | "borderPainter"
  | "select" | "gridlines" | "properties" | "draw" | "erase" | "delete" | "deleteCellsDialog" | "insert"
  | "merge" | "splitCellsDialog" | "splitTable" | "autofit" | "rowHeight" | "colWidth" | "distributeRows" | "distributeColumns"
  | "align" | "textDirection" | "cellMargins" | "sortDialog" | "repeatHeader" | "convertToText" | "formula";
type On = (action: TableToolsAction, value?: string) => void;

const OPTION_LABELS: Record<TableStyleOptionKey, string> = { headerRow: "Header Row", totalRow: "Total Row", bandedRows: "Banded Rows", firstColumn: "First Column", lastColumn: "Last Column", bandedColumns: "Banded Columns" };
export const TABLE_COLORS: { name: string; hex: string }[] = [
  { name: "White", hex: "FFFFFF" }, { name: "Black", hex: "000000" }, { name: "Light Gray", hex: "D9D9D9" }, { name: "Gray", hex: "808080" }, { name: "Dark Red", hex: "C00000" },
  { name: "Red", hex: "FF0000" }, { name: "Orange", hex: "FFC000" }, { name: "Yellow", hex: "FFFF00" }, { name: "Light Green", hex: "92D050" }, { name: "Green", hex: "00B050" },
  { name: "Light Blue", hex: "00B0F0" }, { name: "Blue", hex: "0070C0" }, { name: "Dark Blue", hex: "002060" }, { name: "Purple", hex: "7030A0" }, { name: "Blue, Accent 1", hex: "5B9BD5" },
  { name: "Orange, Accent 2", hex: "ED7D31" }, { name: "Blue, Accent 1, Lighter 80%", hex: "DEEAF6" }, { name: "Orange, Accent 2, Lighter 80%", hex: "FBE4D5" }, { name: "Gold, Accent 4", hex: "FFC000" }, { name: "Green, Accent 6", hex: "70AD47" },
];
const BORDER_COMMANDS: { id: BorderCommand; label: string }[] = [
  { id: "bottom", label: "Bottom Border" }, { id: "top", label: "Top Border" }, { id: "left", label: "Left Border" }, { id: "right", label: "Right Border" },
  { id: "none", label: "No Border" }, { id: "all", label: "All Borders" }, { id: "outside", label: "Outside Borders" }, { id: "inside", label: "Inside Borders" },
  { id: "insideH", label: "Inside Horizontal Border" }, { id: "insideV", label: "Inside Vertical Border" }, { id: "diagonalDown", label: "Diagonal Down Border" }, { id: "diagonalUp", label: "Diagonal Up Border" },
];
const BORDER_STYLE_PRESETS: { id: string; label: string; pen: Pen }[] = [
  { id: "single-0.5-000000", label: "Single solid line, 1/2 pt", pen: { style: "solid", width: 0.5, color: "000000" } },
  { id: "single-1.5-000000", label: "Single solid line, 1 1/2 pt", pen: { style: "solid", width: 1.5, color: "000000" } },
  { id: "double-0.5-000000", label: "Double solid lines, 1/2 pt", pen: { style: "double", width: 0.5, color: "000000" } },
  { id: "dotted-0.5-000000", label: "Dotted line, 1/2 pt", pen: { style: "dotted", width: 0.5, color: "000000" } },
  { id: "dashed-0.5-000000", label: "Dashed line, 1/2 pt", pen: { style: "dashed", width: 0.5, color: "000000" } },
  { id: "single-0.5-5B9BD5", label: "Single solid line, 1/2 pt, Accent 1", pen: { style: "solid", width: 0.5, color: "5B9BD5" } },
  { id: "single-2.25-5B9BD5", label: "Single solid line, 2 1/4 pt, Accent 1", pen: { style: "solid", width: 2.25, color: "5B9BD5" } },
  { id: "double-1.5-C00000", label: "Double solid lines, 1 1/2 pt, Dark Red", pen: { style: "double", width: 1.5, color: "C00000" } },
];
const WIDTH_LABELS: Record<number, string> = { 0.25: "¼ pt", 0.5: "½ pt", 0.75: "¾ pt", 1: "1 pt", 1.5: "1 ½ pt", 2.25: "2 ¼ pt", 3: "3 pt", 4.5: "4 ½ pt", 6: "6 pt" };
export const penKey = (pen: Pen) => `${pen.style === "solid" ? "single" : pen.style}-${pen.width}-${pen.color.toUpperCase()}`;

// ---------- small building blocks ----------

function Group({ id, name, children }: { id: string; name: string; children: ReactNode }) {
  return <section className="word-ribbon-group wt-group" data-ribbon-group={id}><div className="wt-group-body">{children}</div><span className="word-ribbon-group-name">{name}</span></section>;
}

function Tool({ label, icon, onClick, pressed, disabled, title, big, caret }: { label: string; icon?: ReactNode; onClick?: () => void; pressed?: boolean; disabled?: boolean; title?: string; big?: boolean; caret?: boolean }) {
  return <button type="button" className={`wt-tool${big ? " wt-tool-big" : ""}`} aria-pressed={pressed === undefined ? undefined : pressed} disabled={disabled} title={title ?? label} aria-label={label}
    onMouseDown={event => event.preventDefault()} onClick={onClick}>
    {icon && <span className="wt-icon" aria-hidden>{icon}</span>}<span className="wt-label">{label}{caret && <i aria-hidden> ▾</i>}</span>
  </button>;
}

// A button with a drop-down (opens under the button, never off-screen).
function Drop({ label, icon, big, title, children, width = 220 }: { label: string; icon?: ReactNode; big?: boolean; title?: string; children: (close: () => void) => ReactNode; width?: number }) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const { position, flyoutRef } = useClampedFlyoutPosition(open, buttonRef);
  useDismiss(open, () => setOpen(false), [buttonRef, flyoutRef]);
  return <>
    <button ref={buttonRef} type="button" className={`wt-tool${big ? " wt-tool-big" : ""}`} aria-haspopup="menu" aria-expanded={open} title={title ?? label} aria-label={label}
      onMouseDown={event => event.preventDefault()} onClick={() => setOpen(value => !value)}>
      {icon && <span className="wt-icon" aria-hidden>{icon}</span>}<span className="wt-label">{label}<i aria-hidden> ▾</i></span>
    </button>
    {open && typeof document !== "undefined" && createPortal(<div ref={flyoutRef} role="menu" aria-label={label} className="wi-menu" style={{ ...position, width }}>{children(() => setOpen(false))}</div>, document.body)}
  </>;
}

function MenuItem({ children, onClick, icon, pressed }: { children: ReactNode; onClick: () => void; icon?: ReactNode; pressed?: boolean }) {
  return <button role="menuitem" type="button" className="wi-item" aria-pressed={pressed} onMouseDown={event => event.preventDefault()} onClick={onClick}><span className="wi-icon" aria-hidden>{icon}</span><span>{children}</span></button>;
}

function Palette({ onPick, close, noneLabel }: { onPick: (hex: string | null) => void; close: () => void; noneLabel: string }) {
  return <>
    <div className="wt-palette">{TABLE_COLORS.map(color => <button key={color.name} type="button" role="menuitem" aria-label={`${color.name} (#${color.hex})`} title={color.name} style={{ background: `#${color.hex}` }} onMouseDown={event => event.preventDefault()} onClick={() => { onPick(color.hex); close(); }} />)}</div>
    <div className="wi-sep" />
    <MenuItem onClick={() => { onPick(null); close(); }}>{noneLabel}</MenuItem>
  </>;
}

const Svg = ({ children }: { children: ReactNode }) => <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">{children}</svg>;
const gridIcon = <Svg><rect x="3" y="4" width="18" height="16" /><path d="M3 9.3h18M3 14.6h18M9 4v16M15 4v16" /></Svg>;

export function TableStylePreview({ styleId }: { styleId: string }) {
  return <table className="wt-style-preview" data-table-style={styleId} data-header-row="true" data-banded-rows="true" data-first-column="true" aria-hidden>
    <tbody>{Array.from({ length: 4 }, (_, r) => <tr key={r}>{Array.from({ length: 4 }, (_, c) => <td key={c} />)}</tr>)}</tbody>
  </table>;
}

// ---------- DESIGN ----------

export function TableDesignGroups({ state, on }: { state: TableToolsState; on: On }) {
  return <>
    <Group id="tableStyleOptions" name="Table Style Options">
      <div className="wt-checks">
        {TABLE_STYLE_OPTION_KEYS.map(key => <label key={key} className="wt-check"><input type="checkbox" checked={state.styleOptions[key]} onChange={event => on("styleOption", `${key}:${event.target.checked}`)} /><span>{OPTION_LABELS[key]}</span></label>)}
      </div>
    </Group>
    <Group id="tableStyles" name="Table Styles">
      <div className="wt-styles">
        {TABLE_STYLES.slice(0, 7).map(style => <button key={style.id} type="button" className="wt-style" aria-pressed={state.tableStyle === style.id} title={style.name} aria-label={style.name} onMouseDown={event => event.preventDefault()} onClick={() => on("tableStyle", style.id)}><TableStylePreview styleId={style.id} /></button>)}
        <Drop label="More table styles" title="More" width={340} icon={<span className="wt-more">▾</span>}>
          {close => <>
            <div className="wi-heading">Built-In</div>
            <div className="wt-style-grid">{TABLE_STYLES.map(style => <button key={style.id} type="button" role="menuitem" className="wt-style" aria-pressed={state.tableStyle === style.id} title={style.name} aria-label={style.name} onMouseDown={event => event.preventDefault()} onClick={() => { on("tableStyle", style.id); close(); }}><TableStylePreview styleId={style.id} /><span>{style.name}</span></button>)}</div>
            <div className="wi-sep" />
            <MenuItem onClick={() => { on("tableStyle", ""); close(); }}>Clear</MenuItem>
          </>}
        </Drop>
      </div>
    </Group>
    <Group id="tableShading" name=" ">
      <Drop label="Shading" big icon={<Svg><path d="M5 15 13 7l4 4-8 8H5z" /><path d="M3 21h18" stroke="#FFC000" strokeWidth="3" /></Svg>}>
        {close => <Palette noneLabel="No Color" close={close} onPick={hex => on("shading", hex ?? "")} />}
      </Drop>
    </Group>
    <Group id="tableBorders" name="Borders">
      <div className="wt-borders">
        <Drop label="Border Styles" big width={260} icon={<Svg><path d="M4 12h16" strokeWidth={2.5} /></Svg>}>
          {close => <>
            <div className="wi-heading">Theme Borders</div>
            {BORDER_STYLE_PRESETS.map(preset => <MenuItem key={preset.id} pressed={penKey(state.pen) === preset.id} onClick={() => { on("borderStyle", preset.id); close(); }} icon={<span className="wt-pen-sample" style={{ borderTop: `${preset.pen.style === "double" ? 3 : Math.max(1, Math.round(preset.pen.width * 4 / 3))}px ${preset.pen.style} #${preset.pen.color}` }} />}>{preset.label}</MenuItem>)}
          </>}
        </Drop>
        <div className="wt-pen">
          <select aria-label="Line Style" title="Line Style" value={state.pen.style} onChange={event => on("penStyle", event.target.value)}>
            <option value="solid">────────</option><option value="double">════════</option><option value="dotted">·········</option><option value="dashed">- - - - - -</option><option value="none">No Border</option>
          </select>
          <select aria-label="Line Weight" title="Line Weight" value={String(state.pen.width)} onChange={event => on("penWidth", event.target.value)}>
            {BORDER_WIDTHS.map(width => <option key={width} value={width}>{WIDTH_LABELS[width]}</option>)}
          </select>
          <Drop label="Pen Color" icon={<span className="wt-pen-color" style={{ background: `#${state.pen.color}` }} />}>
            {close => <Palette noneLabel="Automatic" close={close} onPick={hex => on("penColor", hex ?? "000000")} />}
          </Drop>
        </div>
        <Drop label="Borders" big width={240} icon={gridIcon}>
          {close => <>
            {BORDER_COMMANDS.map(command => <MenuItem key={command.id} onClick={() => { on("borders", command.id); close(); }} icon={<BorderIcon id={command.id} />}>{command.label}</MenuItem>)}
            <div className="wi-sep" />
            <MenuItem onClick={() => { on("gridlines"); close(); }} pressed={state.gridlines}>View Gridlines</MenuItem>
            <MenuItem onClick={() => { on("bordersDialog"); close(); }}>Borders and Shading…</MenuItem>
          </>}
        </Drop>
        <Tool label="Border Painter" big pressed={state.mode === "paint"} onClick={() => on("borderPainter")} icon={<Svg><path d="M14 4l6 6-9 9H5v-6z" /><path d="M3 21h8" /></Svg>} title="Border Painter: click the edges of cells to apply the current border style" />
      </div>
    </Group>
  </>;
}

function BorderIcon({ id }: { id: BorderCommand }) {
  const box = <rect x="4" y="4" width="16" height="16" stroke="#bbb" strokeDasharray="2 2" />;
  const line = (d: string) => <path d={d} stroke="currentColor" strokeWidth="2" />;
  const paths: Record<BorderCommand, ReactNode> = {
    bottom: line("M4 20h16"), top: line("M4 4h16"), left: line("M4 4v16"), right: line("M20 4v16"), none: null,
    all: <>{line("M4 4h16v16H4z")}{line("M12 4v16M4 12h16")}</>, outside: line("M4 4h16v16H4z"), inside: line("M12 4v16M4 12h16"),
    insideH: line("M4 12h16"), insideV: line("M12 4v16"), diagonalDown: line("M4 4l16 16"), diagonalUp: line("M4 20 20 4"),
  };
  return <svg viewBox="0 0 24 24" width="16" height="16" fill="none">{box}{paths[id]}</svg>;
}

// ---------- LAYOUT ----------

export function TableLayoutGroups({ state, on }: { state: TableToolsState; on: On }) {
  return <>
    <Group id="tableTable" name="Table">
      <div className="wt-row">
        <Drop label="Select" big icon={<Svg><path d="M6 3l12 9-6 1-3 6z" /></Svg>}>
          {close => <>
            <MenuItem onClick={() => { on("select", "cell"); close(); }}>Select Cell</MenuItem>
            <MenuItem onClick={() => { on("select", "column"); close(); }}>Select Column</MenuItem>
            <MenuItem onClick={() => { on("select", "row"); close(); }}>Select Row</MenuItem>
            <MenuItem onClick={() => { on("select", "table"); close(); }}>Select Table</MenuItem>
          </>}
        </Drop>
        <Tool label="View Gridlines" big pressed={state.gridlines} onClick={() => on("gridlines")} icon={gridIcon} />
        <Tool label="Properties" big onClick={() => on("properties")} icon={<Svg><rect x="3" y="4" width="18" height="16" /><path d="M3 9h18M8 13h10M8 16h7" /></Svg>} />
      </div>
    </Group>
    <Group id="tableDraw" name="Draw">
      <div className="wt-row">
        <Tool label="Draw Table" big pressed={state.mode === "draw"} onClick={() => on("draw")} icon={<Svg><rect x="3" y="4" width="13" height="12" /><path d="M14 20l7-7-2-2-7 7v2z" /></Svg>} title="Draw Table: drag inside a cell to split it (across = new row, down = new column); drag on the page for a new table" />
        <Tool label="Eraser" big pressed={state.mode === "erase"} onClick={() => on("erase")} icon={<Svg><path d="M4 15l9-9 6 6-7 7H8z" /><path d="M10 9l6 6" /></Svg>} title="Eraser: click near a line between two cells to remove it (merges the cells)" />
      </div>
    </Group>
    <Group id="tableRowsColumns" name="Rows & Columns">
      <div className="wt-row">
        <Drop label="Delete" big icon={<Svg><rect x="3" y="4" width="18" height="16" /><path d="M9 9l6 6M15 9l-6 6" stroke="#C00000" /></Svg>}>
          {close => <>
            <MenuItem onClick={() => { on("deleteCellsDialog"); close(); }}>Delete Cells…</MenuItem>
            <MenuItem onClick={() => { on("delete", "column"); close(); }}>Delete Columns</MenuItem>
            <MenuItem onClick={() => { on("delete", "row"); close(); }}>Delete Rows</MenuItem>
            <MenuItem onClick={() => { on("delete", "table"); close(); }}>Delete Table</MenuItem>
          </>}
        </Drop>
        <Tool label="Insert Above" big onClick={() => on("insert", "above")} icon={<Svg><rect x="3" y="11" width="18" height="9" /><path d="M12 9V3M9 6l3-3 3 3" /></Svg>} />
        <Tool label="Insert Below" big onClick={() => on("insert", "below")} icon={<Svg><rect x="3" y="4" width="18" height="9" /><path d="M12 15v6M9 18l3 3 3-3" /></Svg>} />
        <Tool label="Insert Left" big onClick={() => on("insert", "left")} icon={<Svg><rect x="11" y="3" width="9" height="18" /><path d="M9 12H3M6 9l-3 3 3 3" /></Svg>} />
        <Tool label="Insert Right" big onClick={() => on("insert", "right")} icon={<Svg><rect x="4" y="3" width="9" height="18" /><path d="M15 12h6M18 9l3 3-3 3" /></Svg>} />
      </div>
    </Group>
    <Group id="tableMerge" name="Merge">
      <div className="wt-row">
        <Tool label="Merge Cells" big disabled={!state.canMerge} title={state.canMerge ? "Merge Cells" : "Select two or more cells (drag across them, or use Select) to merge them"} onClick={() => on("merge")} icon={<Svg><rect x="3" y="5" width="18" height="14" /><path d="M7 12h10M14 9l3 3-3 3M10 9l-3 3 3 3" /></Svg>} />
        <Tool label="Split Cells" big onClick={() => on("splitCellsDialog")} icon={<Svg><rect x="3" y="5" width="18" height="14" /><path d="M12 5v14" /></Svg>} />
        <Tool label="Split Table" big onClick={() => on("splitTable")} icon={<Svg><rect x="3" y="3" width="18" height="7" /><rect x="3" y="14" width="18" height="7" /></Svg>} />
      </div>
    </Group>
    <Group id="tableCellSize" name="Cell Size">
      <div className="wt-row">
        <Drop label="AutoFit" big icon={<Svg><rect x="3" y="5" width="18" height="14" /><path d="M7 12h10M7 12l2-2M7 12l2 2M17 12l-2-2M17 12l-2 2" /></Svg>}>
          {close => <>
            <MenuItem onClick={() => { on("autofit", "auto"); close(); }}>AutoFit Contents</MenuItem>
            <MenuItem onClick={() => { on("autofit", "window"); close(); }}>AutoFit Window</MenuItem>
            <MenuItem onClick={() => { on("autofit", "fixed"); close(); }}>Fixed Column Width</MenuItem>
          </>}
        </Drop>
        <div className="wt-size">
          <label><span>Height:</span><SizeInput label="Row height" value={state.rowHeight} onCommit={value => on("rowHeight", value)} /></label>
          <label><span>Width:</span><SizeInput label="Column width" value={state.colWidth} onCommit={value => on("colWidth", value)} /></label>
        </div>
        <div className="wt-stack">
          <Tool label="Distribute Rows" onClick={() => on("distributeRows")} icon={<Svg><path d="M4 5h16M4 12h16M4 19h16" /></Svg>} />
          <Tool label="Distribute Columns" onClick={() => on("distributeColumns")} icon={<Svg><path d="M5 4v16M12 4v16M19 4v16" /></Svg>} />
        </div>
      </div>
    </Group>
    <Group id="tableAlignment" name="Alignment">
      <div className="wt-row">
        <div role="group" aria-label="Cell alignment" className="wt-align">
          {(["top", "middle", "bottom"] as const).flatMap(vertical => (["left", "center", "right"] as const).map(horizontal => {
            const name = `Align ${vertical === "middle" ? "Center" : vertical[0].toUpperCase() + vertical.slice(1)} ${horizontal === "center" ? "Center" : horizontal[0].toUpperCase() + horizontal.slice(1)}`.replace("Center Center", "Center");
            return <button key={vertical + horizontal} type="button" title={name} aria-label={name} onMouseDown={event => event.preventDefault()} onClick={() => on("align", `${vertical}:${horizontal}`)} style={{ alignItems: vertical === "top" ? "flex-start" : vertical === "middle" ? "center" : "flex-end", justifyContent: horizontal === "left" ? "flex-start" : horizontal === "center" ? "center" : "flex-end" }}><span aria-hidden /></button>;
          }))}
        </div>
        <Tool label="Text Direction" big onClick={() => on("textDirection")} icon={<Svg><path d="M8 4v16M5 17l3 3 3-3" /><text x="13" y="16" fontSize="10" fill="currentColor" stroke="none">A</text></Svg>} />
        <Tool label="Cell Margins" big onClick={() => on("cellMargins")} icon={<Svg><rect x="3" y="4" width="18" height="16" /><rect x="7" y="8" width="10" height="8" strokeDasharray="2 2" /></Svg>} />
      </div>
    </Group>
    <Group id="tableData" name="Data">
      <div className="wt-row">
        <Tool label="Sort" big onClick={() => on("sortDialog")} icon={<Svg><text x="2" y="10" fontSize="8" fill="currentColor" stroke="none">A</text><text x="2" y="20" fontSize="8" fill="currentColor" stroke="none">Z</text><path d="M15 5v14M12 16l3 3 3-3" /></Svg>} />
        <Tool label="Repeat Header Rows" big pressed={state.repeatHeader} onClick={() => on("repeatHeader")} icon={<Svg><rect x="3" y="4" width="18" height="5" fill="#DEEAF6" /><rect x="3" y="12" width="18" height="8" /></Svg>} />
        <Tool label="Convert to Text" big onClick={() => on("convertToText")} icon={<Svg><rect x="3" y="4" width="8" height="8" /><path d="M14 6h7M14 10h7M3 16h18M3 20h12" /></Svg>} />
        <Tool label="Formula" big onClick={() => on("formula")} icon={<Svg><text x="5" y="17" fontSize="14" fontStyle="italic" fill="currentColor" stroke="none">fx</text></Svg>} />
      </div>
    </Group>
  </>;
}

// Height/Width box (cm) with up/down arrows, committed on Enter, blur or arrow click.
function SizeInput({ label, value, onCommit }: { label: string; value: number | null; onCommit: (value: string) => void }) {
  const [text, setText] = useState<string | null>(null);
  const shown = text ?? (value === null ? "" : `${value} cm`);
  const commit = (raw: string) => { setText(null); const number = Number.parseFloat(raw.replace(",", ".")); if (Number.isFinite(number)) onCommit(String(Math.max(0.1, Math.round(number * 100) / 100))); };
  const step = (delta: number) => { const base = value ?? 0.5; onCommit(String(Math.max(0.1, Math.round((base + delta) * 100) / 100))); };
  return <span className="wt-spin">
    <input aria-label={label} value={shown} onChange={event => setText(event.target.value)} onBlur={() => text !== null && commit(text)} onKeyDown={event => { if (event.key === "Enter") commit((event.target as HTMLInputElement).value); if (event.key === "ArrowUp") { event.preventDefault(); step(0.1); } if (event.key === "ArrowDown") { event.preventDefault(); step(-0.1); } }} />
    <span className="wt-spin-buttons"><button type="button" tabIndex={-1} aria-label={`Increase ${label}`} onMouseDown={event => event.preventDefault()} onClick={() => step(0.1)}>▲</button><button type="button" tabIndex={-1} aria-label={`Decrease ${label}`} onMouseDown={event => event.preventDefault()} onClick={() => step(-0.1)}>▼</button></span>
  </span>;
}
