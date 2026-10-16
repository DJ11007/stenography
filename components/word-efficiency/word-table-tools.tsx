"use client";

import { useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { BORDER_WIDTHS, TABLE_STYLES, TABLE_STYLE_OPTION_KEYS, type BorderCommand, type Pen, type TableStyleOptionKey } from "@/lib/word-table-model";
import { useClampedFlyoutPosition, useDismiss } from "./word-flyout";
import { ALL_WORD_COLORS, STANDARD_COLORS, THEME_GRID } from "@/lib/word-colors";

// Word 2013's TABLE TOOLS contextual tabs, shown while the cursor is in a table:
// DESIGN (Table Style Options, Table Styles, Shading, Borders) and LAYOUT
// (Table, Draw, Rows & Columns, Merge, Cell Size, Alignment, Data). Laid out and
// drawn like Word 2013: large buttons with a 32px icon over a one- or two-line
// label, split buttons for Shading and Borders, the style gallery with its
// up/down/more strip, and dialog launchers on Borders, Rows & Columns and Cell
// Size. Every control calls `on(action, value)`; the editor does the work
// (lib/word-table-model.ts) and passes the current table's state back in `state`.

export type TableToolsState = {
  tableStyle: string | null;
  styleOptions: Record<TableStyleOptionKey, boolean>;
  pen: Pen;
  gridlines: boolean;
  mode: "off" | "draw" | "erase" | "paint" | "sample";
  repeatHeader: boolean;
  rowHeight: number | null;
  colWidth: number | null;
  canMerge: boolean;
  /** The current cell's alignment, "top:left" ... "bottom:right" (highlighted in the Alignment grid). */
  cellAlign?: string;
  /** Last colour used with Shading / last border applied with Borders (the split buttons' top halves). */
  lastShading?: string | null;
  lastBorder?: BorderCommand;
};
export type TableToolsAction =
  | "styleOption" | "tableStyle" | "shading" | "penStyle" | "penWidth" | "penColor" | "borderStyle" | "borders" | "bordersDialog" | "borderPainter" | "borderSampler"
  | "select" | "gridlines" | "properties" | "draw" | "erase" | "delete" | "deleteCellsDialog" | "insert" | "insertCellsDialog"
  | "merge" | "splitCellsDialog" | "splitTable" | "autofit" | "rowHeight" | "colWidth" | "distributeRows" | "distributeColumns"
  | "align" | "textDirection" | "cellMargins" | "sortDialog" | "repeatHeader" | "convertToText" | "formula";
type On = (action: TableToolsAction, value?: string) => void;

const OPTION_LABELS: Record<TableStyleOptionKey, string> = { headerRow: "Header Row", totalRow: "Total Row", bandedRows: "Banded Rows", firstColumn: "First Column", lastColumn: "Last Column", bandedColumns: "Banded Columns" };

/** Every named colour in the palette (also used by the Borders and Shading dialog). */
export const TABLE_COLORS = ALL_WORD_COLORS;

export function WordPalette({ onPick, close, noneLabel, noneSwatch }: { onPick: (hex: string | null) => void; close: () => void; noneLabel: string; noneSwatch?: string }) {
  const pick = (hex: string | null) => { onPick(hex); close(); };
  const swatch = (color: { name: string; hex: string }) => <button key={color.name} type="button" role="menuitem" className="wr-swatch" aria-label={`${color.name} (#${color.hex})`} title={color.name} style={{ background: `#${color.hex}` }} onMouseDown={event => event.preventDefault()} onClick={() => pick(color.hex)} />;
  return <div className="wr-palette">
    <div className="wr-palette-heading">Theme Colors</div>
    <div className="wr-palette-grid wr-palette-theme">{THEME_GRID[0].map(swatch)}</div>
    <div className="wr-palette-grid wr-palette-tints">{THEME_GRID.slice(1).flat().map(swatch)}</div>
    <div className="wr-palette-heading">Standard Colors</div>
    <div className="wr-palette-grid">{STANDARD_COLORS.map(swatch)}</div>
    <div className="wi-sep" />
    <button type="button" role="menuitem" className="wi-item" onMouseDown={event => event.preventDefault()} onClick={() => pick(null)}><span className="wi-icon" aria-hidden><span className="wr-none-swatch" style={noneSwatch ? { background: noneSwatch } : undefined} /></span><span>{noneLabel}</span></button>
    <label className="wi-item wr-more-colors"><span className="wi-icon" aria-hidden><Icon16 name="colors" /></span><span>More Colors…</span><input type="color" aria-label="More Colors" onChange={event => pick(event.target.value.slice(1).toUpperCase())} /></label>
  </div>;
}

// ---------- building blocks ----------

export function Group({ id, name, children, launcher, onLauncher }: { id: string; name: string; children: ReactNode; launcher?: string; onLauncher?: () => void }) {
  return <section className="word-ribbon-group wt-group" data-ribbon-group={id}>
    <div className="wt-group-body">{children}</div>
    <span className="word-ribbon-group-name">{name}</span>
    {launcher && <button type="button" className="word-ribbon-group-launcher" aria-label={launcher} title={launcher} onMouseDown={event => event.preventDefault()} onClick={onLauncher}><svg viewBox="0 0 11 11" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><path d="M1.5 1.5v3M1.5 1.5h3" /><path d="M9.5 3.5v6h-6" /><path d="M4.5 4.5l5 5" /></svg></button>}
  </section>;
}

// Word's large-button label: up to two lines; a drop-down's caret goes on the last line.
export function BigLabel({ label, caret }: { label: string; caret?: boolean }) {
  const [first, second] = label.split("\n");
  return <span className="wr-big-label"><span>{first}</span>{(second !== undefined || caret) && <span>{second}{caret && <i aria-hidden className="wr-caret">▾</i>}</span>}</span>;
}

export function Big({ label, icon, onClick, pressed, disabled, title }: { label: string; icon: ReactNode; onClick?: () => void; pressed?: boolean; disabled?: boolean; title?: string }) {
  const name = label.replace("\n", " ");
  return <button type="button" className="wr-big" aria-pressed={pressed === undefined ? undefined : pressed} disabled={disabled} title={title ?? name} aria-label={name}
    onMouseDown={event => event.preventDefault()} onClick={onClick}>
    <span className="wr-big-icon" aria-hidden>{icon}</span><BigLabel label={label} />
  </button>;
}

export function Small({ label, icon, onClick, pressed, title, disabled }: { label: string; icon: ReactNode; onClick?: () => void; pressed?: boolean; title?: string; disabled?: boolean }) {
  return <button type="button" className="wr-small" disabled={disabled} aria-pressed={pressed === undefined ? undefined : pressed} title={title ?? label} aria-label={label} onMouseDown={event => event.preventDefault()} onClick={onClick}>
    <span className="wr-small-icon" aria-hidden>{icon}</span><span>{label}</span>
  </button>;
}

export function useFlyout() {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const { position, flyoutRef } = useClampedFlyoutPosition(open, anchorRef);
  useDismiss(open, () => setOpen(false), [anchorRef, flyoutRef]);
  return { open, setOpen, anchorRef, position, flyoutRef };
}
export function Flyout({ flyout, label, width, children }: { flyout: ReturnType<typeof useFlyout>; label: string; width: number; children: (close: () => void) => ReactNode }) {
  if (!flyout.open || typeof document === "undefined") return null;
  return createPortal(<div ref={flyout.flyoutRef} role="menu" aria-label={label} className="wi-menu wr-menu" style={{ ...flyout.position, width }}>{children(() => flyout.setOpen(false))}</div>, document.body);
}

// Large drop-down button (Select, Delete, AutoFit, Border Styles).
export function BigDrop({ label, icon, width = 220, title, children }: { label: string; icon: ReactNode; width?: number; title?: string; children: (close: () => void) => ReactNode }) {
  const flyout = useFlyout();
  const name = label.replace("\n", " ");
  return <>
    <button ref={flyout.anchorRef} type="button" className="wr-big" aria-haspopup="menu" aria-expanded={flyout.open} title={title ?? name} aria-label={name}
      onMouseDown={event => event.preventDefault()} onClick={() => flyout.setOpen(value => !value)}>
      <span className="wr-big-icon" aria-hidden>{icon}</span><BigLabel label={label} caret />
    </button>
    <Flyout flyout={flyout} label={name} width={width}>{children}</Flyout>
  </>;
}

// Large split button (Shading, Borders): the icon half repeats the last choice, the label half opens the menu.
export function BigSplit({ label, icon, onMain, mainTitle, width = 240, children }: { label: string; icon: ReactNode; onMain: () => void; mainTitle: string; width?: number; children: (close: () => void) => ReactNode }) {
  const flyout = useFlyout();
  const name = label.replace("\n", " ");
  return <span className="wr-split" data-open={flyout.open || undefined}>
    <button type="button" className="wr-split-main" title={mainTitle} aria-label={mainTitle} onMouseDown={event => event.preventDefault()} onClick={onMain}><span className="wr-big-icon" aria-hidden>{icon}</span></button>
    <button ref={flyout.anchorRef} type="button" className="wr-split-arrow" aria-haspopup="menu" aria-expanded={flyout.open} title={name} aria-label={name} onMouseDown={event => event.preventDefault()} onClick={() => flyout.setOpen(value => !value)}><BigLabel label={label} caret /></button>
    <Flyout flyout={flyout} label={name} width={width}>{children}</Flyout>
  </span>;
}

// Small drop-down box (Line Style, Line Weight, Pen Color).
export function BoxDrop({ label, face, width = 180, menuWidth, children, className = "" }: { label: string; face: ReactNode; width?: number; menuWidth?: number; children: (close: () => void) => ReactNode; className?: string }) {
  const flyout = useFlyout();
  return <>
    <button ref={flyout.anchorRef} type="button" className={`wr-box ${className}`} style={{ width }} aria-haspopup="menu" aria-expanded={flyout.open} title={label} aria-label={label}
      onMouseDown={event => event.preventDefault()} onClick={() => flyout.setOpen(value => !value)}>
      <span className="wr-box-face">{face}</span><i aria-hidden className="wr-caret">▾</i>
    </button>
    <Flyout flyout={flyout} label={label} width={menuWidth ?? width}>{children}</Flyout>
  </>;
}

export function MenuItem({ children, onClick, icon, pressed, disabled }: { children: ReactNode; onClick: () => void; icon?: ReactNode; pressed?: boolean; disabled?: boolean }) {
  return <button role="menuitem" type="button" className="wi-item" aria-pressed={pressed} disabled={disabled} onMouseDown={event => event.preventDefault()} onClick={onClick}><span className="wi-icon" aria-hidden>{icon}</span><span>{children}</span></button>;
}

export function TableStylePreview({ styleId }: { styleId: string }) {
  return <table className="wt-style-preview" data-table-style={styleId} data-header-row="true" data-banded-rows="true" data-first-column="true" aria-hidden>
    <tbody>{Array.from({ length: 5 }, (_, r) => <tr key={r}>{Array.from({ length: 5 }, (_, c) => <td key={c} />)}</tr>)}</tbody>
  </table>;
}

const LINE_STYLES: { id: Pen["style"]; label: string }[] = [
  { id: "solid", label: "Single solid line" }, { id: "dotted", label: "Dotted line" }, { id: "dashed", label: "Dashed line" }, { id: "double", label: "Double line" }, { id: "none", label: "No Border" },
];
const WIDTH_LABELS: Record<number, string> = { 0.25: "¼ pt", 0.5: "½ pt", 0.75: "¾ pt", 1: "1 pt", 1.5: "1 ½ pt", 2.25: "2 ¼ pt", 3: "3 pt", 4.5: "4 ½ pt", 6: "6 pt" };
const lineCss = (style: Pen["style"], width: number, color = "000000") => (style === "none" ? "none" : `${style === "double" ? Math.max(3, Math.round(width * 4 / 3)) : Math.max(1, Math.round(width * 4 / 3))}px ${style} #${color}`);
function LineSample({ style, width = 0.5, color }: { style: Pen["style"]; width?: number; color?: string }) {
  return style === "none" ? <span className="wr-line-none">No Border</span> : <span className="wr-line" style={{ borderTop: lineCss(style, width, color) }} />;
}
export const penKey = (pen: Pen) => `${pen.style === "solid" ? "single" : pen.style}-${pen.width}-${pen.color.toUpperCase()}`;
const BORDER_STYLE_PRESETS: { id: string; label: string; pen: Pen }[] = [
  { id: "single-0.5-000000", label: "Single solid line, 1/2 pt", pen: { style: "solid", width: 0.5, color: "000000" } },
  { id: "single-1.5-000000", label: "Single solid line, 1 1/2 pt", pen: { style: "solid", width: 1.5, color: "000000" } },
  { id: "single-2.25-000000", label: "Single solid line, 2 1/4 pt", pen: { style: "solid", width: 2.25, color: "000000" } },
  { id: "double-0.5-000000", label: "Double solid lines, 1/2 pt", pen: { style: "double", width: 0.5, color: "000000" } },
  { id: "single-0.5-5B9BD5", label: "Single solid line, 1/2 pt, Accent 1", pen: { style: "solid", width: 0.5, color: "5B9BD5" } },
  { id: "single-1.5-5B9BD5", label: "Single solid line, 1 1/2 pt, Accent 1", pen: { style: "solid", width: 1.5, color: "5B9BD5" } },
  { id: "single-2.25-5B9BD5", label: "Single solid line, 2 1/4 pt, Accent 1", pen: { style: "solid", width: 2.25, color: "5B9BD5" } },
  { id: "double-0.5-5B9BD5", label: "Double solid lines, 1/2 pt, Accent 1", pen: { style: "double", width: 0.5, color: "5B9BD5" } },
  { id: "single-0.5-ED7D31", label: "Single solid line, 1/2 pt, Accent 2", pen: { style: "solid", width: 0.5, color: "ED7D31" } },
  { id: "single-1.5-ED7D31", label: "Single solid line, 1 1/2 pt, Accent 2", pen: { style: "solid", width: 1.5, color: "ED7D31" } },
  { id: "single-2.25-ED7D31", label: "Single solid line, 2 1/4 pt, Accent 2", pen: { style: "solid", width: 2.25, color: "ED7D31" } },
  { id: "double-0.5-ED7D31", label: "Double solid lines, 1/2 pt, Accent 2", pen: { style: "double", width: 0.5, color: "ED7D31" } },
  { id: "dotted-0.5-000000", label: "Dotted line, 1/2 pt", pen: { style: "dotted", width: 0.5, color: "000000" } },
  { id: "dashed-0.5-000000", label: "Dashed line, 1/2 pt", pen: { style: "dashed", width: 0.5, color: "000000" } },
  { id: "dotted-0.5-5B9BD5", label: "Dotted line, 1/2 pt, Accent 1", pen: { style: "dotted", width: 0.5, color: "5B9BD5" } },
  { id: "dashed-0.5-5B9BD5", label: "Dashed line, 1/2 pt, Accent 1", pen: { style: "dashed", width: 0.5, color: "5B9BD5" } },
];
const BORDER_COMMANDS: { id: BorderCommand; label: string }[] = [
  { id: "bottom", label: "Bottom Border" }, { id: "top", label: "Top Border" }, { id: "left", label: "Left Border" }, { id: "right", label: "Right Border" },
  { id: "none", label: "No Border" }, { id: "all", label: "All Borders" }, { id: "outside", label: "Outside Borders" }, { id: "inside", label: "Inside Borders" },
  { id: "insideH", label: "Inside Horizontal Border" }, { id: "insideV", label: "Inside Vertical Border" }, { id: "diagonalDown", label: "Diagonal Down Border" }, { id: "diagonalUp", label: "Diagonal Up Border" },
];
const BORDER_LABEL = Object.fromEntries(BORDER_COMMANDS.map(command => [command.id, command.label])) as Record<BorderCommand, string>;

// ---------- DESIGN ----------

export function TableDesignGroups({ state, on }: { state: TableToolsState; on: On }) {
  const [page, setPage] = useState(0);
  const perPage = 7, pages = Math.ceil(TABLE_STYLES.length / perPage);
  const lastBorder = state.lastBorder ?? "all";
  const lastShading = state.lastShading ?? null;
  return <>
    <Group id="tableStyleOptions" name="Table Style Options">
      <div className="wt-checks">
        {TABLE_STYLE_OPTION_KEYS.map(key => <label key={key} className="wt-check"><input type="checkbox" checked={state.styleOptions[key]} onChange={event => on("styleOption", `${key}:${event.target.checked}`)} /><span>{OPTION_LABELS[key]}</span></label>)}
      </div>
    </Group>
    <Group id="tableStyles" name="Table Styles">
      <div className="wr-gallery">
        <div className="wr-gallery-items">
          {TABLE_STYLES.slice(page * perPage, page * perPage + perPage).map(style => <button key={style.id} type="button" className="wt-style" aria-pressed={state.tableStyle === style.id} title={style.name} aria-label={style.name} onMouseDown={event => event.preventDefault()} onClick={() => on("tableStyle", style.id)}><TableStylePreview styleId={style.id} /></button>)}
        </div>
        <div className="wr-gallery-strip">
          <button type="button" aria-label="Previous row of table styles" title="Row up" disabled={page === 0} onMouseDown={event => event.preventDefault()} onClick={() => setPage(value => Math.max(0, value - 1))}><svg viewBox="0 0 9 6" aria-hidden><path d="M1 5 4.5 1.5 8 5" fill="currentColor" /></svg></button>
          <button type="button" aria-label="Next row of table styles" title="Row down" disabled={page >= pages - 1} onMouseDown={event => event.preventDefault()} onClick={() => setPage(value => Math.min(pages - 1, value + 1))}><svg viewBox="0 0 9 6" aria-hidden><path d="M1 1 4.5 4.5 8 1" fill="currentColor" /></svg></button>
          <MoreStyles state={state} on={on} />
        </div>
      </div>
    </Group>
    <Group id="tableShading" name=" ">
      <BigSplit label={"Shading"} mainTitle={lastShading ? `Shading (#${lastShading})` : "Shading: No Color"} onMain={() => on("shading", lastShading ?? "")}
        icon={<Icon32 name="shading" color={lastShading ?? undefined} />} width={232}>
        {close => <WordPalette noneLabel="No Color" close={close} onPick={hex => on("shading", hex ?? "")} />}
      </BigSplit>
    </Group>
    <Group id="tableBorders" name="Borders" launcher="Borders and Shading" onLauncher={() => on("bordersDialog")}>
      <div className="wt-borders">
        <BigDrop label={"Border\nStyles"} width={300} icon={<Icon32 name="borderStyles" pen={state.pen} />}>
          {close => <>
            <div className="wi-heading">Theme Borders</div>
            <div className="wr-border-styles">{BORDER_STYLE_PRESETS.map(preset => <button key={preset.id} type="button" role="menuitem" className="wr-border-style" aria-pressed={penKey(state.pen) === preset.id} title={preset.label} aria-label={preset.label} onMouseDown={event => event.preventDefault()} onClick={() => { on("borderStyle", preset.id); close(); }}><LineSample style={preset.pen.style} width={preset.pen.width} color={preset.pen.color} /></button>)}</div>
            <div className="wi-sep" />
            <MenuItem pressed={state.mode === "sample"} icon={<Icon16 name="sampler" />} onClick={() => { on("borderSampler"); close(); }}>Border Sampler</MenuItem>
          </>}
        </BigDrop>
        <div className="wt-pen">
          <BoxDrop label="Line Style" width={118} menuWidth={150} face={<LineSample style={state.pen.style} width={0.5} />}>
            {close => LINE_STYLES.map(item => <button key={item.id} type="button" role="menuitem" className="wr-line-item" aria-pressed={state.pen.style === item.id} title={item.label} aria-label={item.label} onMouseDown={event => event.preventDefault()} onClick={() => { on("penStyle", item.id); close(); }}><LineSample style={item.id} /></button>)}
          </BoxDrop>
          <BoxDrop label="Line Weight" width={118} menuWidth={150} face={<span className="wr-weight"><span>{WIDTH_LABELS[state.pen.width] ?? `${state.pen.width} pt`}</span><LineSample style={state.pen.style === "none" ? "solid" : state.pen.style} width={state.pen.width} /></span>}>
            {close => BORDER_WIDTHS.map(width => <button key={width} type="button" role="menuitem" className="wr-line-item" aria-pressed={state.pen.width === width} aria-label={WIDTH_LABELS[width]} onMouseDown={event => event.preventDefault()} onClick={() => { on("penWidth", String(width)); close(); }}><span className="wr-weight"><span>{WIDTH_LABELS[width]}</span><LineSample style={state.pen.style === "none" ? "solid" : state.pen.style} width={width} /></span></button>)}
          </BoxDrop>
          <BoxDrop label="Pen Color" className="wr-pen-color" width={100} menuWidth={232} face={<span className="wr-pen-face"><Icon16 name="pen" color={state.pen.color} /><span>Pen Color</span></span>}>
            {close => <WordPalette noneLabel="Automatic" noneSwatch="#000" close={close} onPick={hex => on("penColor", hex ?? "000000")} />}
          </BoxDrop>
        </div>
        <BigSplit label={"Borders"} mainTitle={BORDER_LABEL[lastBorder]} onMain={() => on("borders", lastBorder)} icon={<Icon32 name="borders" border={lastBorder} />} width={250}>
          {close => <>
            {BORDER_COMMANDS.map(command => <MenuItem key={command.id} onClick={() => { on("borders", command.id); close(); }} icon={<BorderIcon id={command.id} />}>{command.label}</MenuItem>)}
            <div className="wi-sep" />
            <MenuItem onClick={() => { on("gridlines"); close(); }} pressed={state.gridlines} icon={<Icon16 name="gridlines" />}>View Gridlines</MenuItem>
            <MenuItem onClick={() => { on("bordersDialog"); close(); }} icon={<Icon16 name="bordersDialog" />}>Borders and Shading…</MenuItem>
          </>}
        </BigSplit>
        <Big label={"Border\nPainter"} pressed={state.mode === "paint"} onClick={() => on("borderPainter")} icon={<Icon32 name="borderPainter" />} title="Border Painter: click the edges of cells to apply the current border style" />
      </div>
    </Group>
  </>;
}

function MoreStyles({ state, on }: { state: TableToolsState; on: On }) {
  const flyout = useFlyout();
  return <>
    <button ref={flyout.anchorRef} type="button" aria-label="More table styles" title="More" aria-haspopup="menu" aria-expanded={flyout.open} onMouseDown={event => event.preventDefault()} onClick={() => flyout.setOpen(value => !value)}><svg viewBox="0 0 9 8" aria-hidden><path d="M1 1h7" stroke="currentColor" /><path d="M1 3 4.5 6.5 8 3" fill="currentColor" /></svg></button>
    <Flyout flyout={flyout} label="More table styles" width={380}>
      {close => <>
        <div className="wi-heading">Plain Tables</div>
        <div className="wt-style-grid">{TABLE_STYLES.filter(style => !/^(grid|list)/.test(style.id)).map(style => <StyleChoice key={style.id} styleId={style.id} name={style.name} selected={state.tableStyle === style.id} onPick={() => { on("tableStyle", style.id); close(); }} />)}</div>
        <div className="wi-heading">Grid Tables</div>
        <div className="wt-style-grid">{TABLE_STYLES.filter(style => style.id.startsWith("grid")).map(style => <StyleChoice key={style.id} styleId={style.id} name={style.name} selected={state.tableStyle === style.id} onPick={() => { on("tableStyle", style.id); close(); }} />)}</div>
        <div className="wi-heading">List Tables</div>
        <div className="wt-style-grid">{TABLE_STYLES.filter(style => style.id.startsWith("list")).map(style => <StyleChoice key={style.id} styleId={style.id} name={style.name} selected={state.tableStyle === style.id} onPick={() => { on("tableStyle", style.id); close(); }} />)}</div>
        <div className="wi-sep" />
        <MenuItem icon={<Icon16 name="clear" />} onClick={() => { on("tableStyle", ""); close(); }}>Clear</MenuItem>
      </>}
    </Flyout>
  </>;
}
const StyleChoice = ({ styleId, name, selected, onPick }: { styleId: string; name: string; selected: boolean; onPick: () => void }) =>
  <button type="button" role="menuitem" className="wt-style" aria-pressed={selected} title={name} aria-label={name} onMouseDown={event => event.preventDefault()} onClick={onPick}><TableStylePreview styleId={styleId} /></button>;

function BorderIcon({ id }: { id: BorderCommand }) {
  const box = <rect x="2.5" y="2.5" width="11" height="11" stroke="#9a9a9a" strokeDasharray="1 1" />;
  const inner = <path d="M8 2.5v11M2.5 8h11" stroke="#9a9a9a" strokeDasharray="1 1" />;
  const line = (d: string) => <path d={d} stroke="#1e1e1e" strokeWidth="1.4" />;
  const paths: Record<BorderCommand, ReactNode> = {
    bottom: line("M2 13.5h12"), top: line("M2 2.5h12"), left: line("M2.5 2v12"), right: line("M13.5 2v12"), none: null,
    all: <>{line("M2.5 2.5h11v11h-11z")}{line("M8 2.5v11M2.5 8h11")}</>, outside: line("M2.5 2.5h11v11h-11z"), inside: line("M8 2.5v11M2.5 8h11"),
    insideH: line("M2.5 8h11"), insideV: line("M8 2.5v11"), diagonalDown: line("M2.5 2.5l11 11"), diagonalUp: line("M2.5 13.5l11-11"),
  };
  return <svg viewBox="0 0 16 16" width="16" height="16" fill="none">{box}{inner}{paths[id]}</svg>;
}

// ---------- LAYOUT ----------

const ALIGN_NAMES: Record<string, string> = {
  "top:left": "Align Top Left", "top:center": "Align Top Center", "top:right": "Align Top Right",
  "middle:left": "Align Center Left", "middle:center": "Align Center", "middle:right": "Align Center Right",
  "bottom:left": "Align Bottom Left", "bottom:center": "Align Bottom Center", "bottom:right": "Align Bottom Right",
};

export function TableLayoutGroups({ state, on }: { state: TableToolsState; on: On }) {
  return <>
    <Group id="tableTable" name="Table">
      <div className="wt-row">
        <BigDrop label={"Select"} icon={<Icon32 name="select" />}>
          {close => <>
            <MenuItem icon={<Icon16 name="selectCell" />} onClick={() => { on("select", "cell"); close(); }}>Select C<u>e</u>ll</MenuItem>
            <MenuItem icon={<Icon16 name="selectColumn" />} onClick={() => { on("select", "column"); close(); }}>Select <u>C</u>olumn</MenuItem>
            <MenuItem icon={<Icon16 name="selectRow" />} onClick={() => { on("select", "row"); close(); }}>Select <u>R</u>ow</MenuItem>
            <MenuItem icon={<Icon16 name="selectTable" />} onClick={() => { on("select", "table"); close(); }}>Select <u>T</u>able</MenuItem>
          </>}
        </BigDrop>
        <Big label={"View\nGridlines"} pressed={state.gridlines} onClick={() => on("gridlines")} icon={<Icon32 name="gridlines" />} />
        <Big label={"Properties"} onClick={() => on("properties")} icon={<Icon32 name="properties" />} />
      </div>
    </Group>
    <Group id="tableDraw" name="Draw">
      <div className="wt-row">
        <Big label={"Draw\nTable"} pressed={state.mode === "draw"} onClick={() => on("draw")} icon={<Icon32 name="draw" />} title="Draw Table: drag inside a cell to split it (across = new row, down = new column); drag on the page for a new table" />
        <Big label={"Eraser"} pressed={state.mode === "erase"} onClick={() => on("erase")} icon={<Icon32 name="eraser" />} title="Eraser: click a line between two cells to remove it (merges the cells)" />
      </div>
    </Group>
    <Group id="tableRowsColumns" name="Rows & Columns" launcher="Insert Cells" onLauncher={() => on("insertCellsDialog")}>
      <div className="wt-row">
        <BigDrop label={"Delete"} icon={<Icon32 name="delete" />}>
          {close => <>
            <MenuItem icon={<Icon16 name="deleteCells" />} onClick={() => { on("deleteCellsDialog"); close(); }}>Delete C<u>e</u>lls…</MenuItem>
            <MenuItem icon={<Icon16 name="deleteColumns" />} onClick={() => { on("delete", "column"); close(); }}>Delete <u>C</u>olumns</MenuItem>
            <MenuItem icon={<Icon16 name="deleteRows" />} onClick={() => { on("delete", "row"); close(); }}>Delete <u>R</u>ows</MenuItem>
            <MenuItem icon={<Icon16 name="deleteTable" />} onClick={() => { on("delete", "table"); close(); }}>Delete <u>T</u>able</MenuItem>
          </>}
        </BigDrop>
        <Big label={"Insert\nAbove"} onClick={() => on("insert", "above")} icon={<Icon32 name="insertAbove" />} />
        <Big label={"Insert\nBelow"} onClick={() => on("insert", "below")} icon={<Icon32 name="insertBelow" />} />
        <Big label={"Insert\nLeft"} onClick={() => on("insert", "left")} icon={<Icon32 name="insertLeft" />} />
        <Big label={"Insert\nRight"} onClick={() => on("insert", "right")} icon={<Icon32 name="insertRight" />} />
      </div>
    </Group>
    <Group id="tableMerge" name="Merge">
      <div className="wt-row">
        <Big label={"Merge\nCells"} disabled={!state.canMerge} title={state.canMerge ? "Merge Cells" : "Select two or more cells (drag across them, or use Select) to merge them"} onClick={() => on("merge")} icon={<Icon32 name="merge" />} />
        <Big label={"Split\nCells"} onClick={() => on("splitCellsDialog")} icon={<Icon32 name="splitCells" />} />
        <Big label={"Split\nTable"} onClick={() => on("splitTable")} icon={<Icon32 name="splitTable" />} />
      </div>
    </Group>
    <Group id="tableCellSize" name="Cell Size" launcher="Table Properties" onLauncher={() => on("properties", "cellSize")}>
      <div className="wt-row">
        <BigDrop label={"AutoFit"} icon={<Icon32 name="autofit" />}>
          {close => <>
            <MenuItem icon={<Icon16 name="autofitContents" />} onClick={() => { on("autofit", "auto"); close(); }}>AutoFit <u>C</u>ontents</MenuItem>
            <MenuItem icon={<Icon16 name="autofitWindow" />} onClick={() => { on("autofit", "window"); close(); }}>AutoFit <u>W</u>indow</MenuItem>
            <MenuItem icon={<Icon16 name="fixedWidth" />} onClick={() => { on("autofit", "fixed"); close(); }}><u>F</u>ixed Column Width</MenuItem>
          </>}
        </BigDrop>
        <div className="wt-size">
          <label><span className="wr-small-icon" aria-hidden><Icon16 name="rowHeight" /></span><span>Height:</span><SizeInput label="Row height" value={state.rowHeight} onCommit={value => on("rowHeight", value)} /></label>
          <label><span className="wr-small-icon" aria-hidden><Icon16 name="colWidth" /></span><span>Width:</span><SizeInput label="Column width" value={state.colWidth} onCommit={value => on("colWidth", value)} /></label>
        </div>
        <div className="wt-stack">
          <Small label="Distribute Rows" onClick={() => on("distributeRows")} icon={<Icon16 name="distributeRows" />} />
          <Small label="Distribute Columns" onClick={() => on("distributeColumns")} icon={<Icon16 name="distributeColumns" />} />
        </div>
      </div>
    </Group>
    <Group id="tableAlignment" name="Alignment">
      <div className="wt-row">
        <div role="group" aria-label="Cell alignment" className="wt-align">
          {(["top", "middle", "bottom"] as const).flatMap(vertical => (["left", "center", "right"] as const).map(horizontal => {
            const key = `${vertical}:${horizontal}`;
            return <button key={key} type="button" title={ALIGN_NAMES[key]} aria-label={ALIGN_NAMES[key]} aria-pressed={state.cellAlign === key} onMouseDown={event => event.preventDefault()} onClick={() => on("align", key)}><AlignIcon vertical={vertical} horizontal={horizontal} /></button>;
          }))}
        </div>
        <Big label={"Text\nDirection"} onClick={() => on("textDirection")} icon={<Icon32 name="textDirection" />} />
        <Big label={"Cell\nMargins"} onClick={() => on("cellMargins")} icon={<Icon32 name="cellMargins" />} />
      </div>
    </Group>
    <Group id="tableData" name="Data">
      <div className="wt-row">
        <Big label={"Sort"} onClick={() => on("sortDialog")} icon={<Icon32 name="sort" />} />
        <Big label={"Repeat\nHeader Rows"} pressed={state.repeatHeader} onClick={() => on("repeatHeader")} icon={<Icon32 name="repeatHeader" />} />
        <Big label={"Convert\nto Text"} onClick={() => on("convertToText")} icon={<Icon32 name="convertToText" />} />
        <Big label={"Formula"} onClick={() => on("formula")} icon={<Icon32 name="formula" />} />
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

function AlignIcon({ vertical, horizontal }: { vertical: "top" | "middle" | "bottom"; horizontal: "left" | "center" | "right" }) {
  const y = vertical === "top" ? 2 : vertical === "middle" ? 6 : 10;
  const x = (width: number) => (horizontal === "left" ? 2 : horizontal === "center" ? (16 - width) / 2 : 14 - width);
  return <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden><rect x="0.5" y="0.5" width="15" height="15" fill="#fff" stroke="#c6c6c6" />
    {[[12, 0], [8, 2], [12, 4]].map(([width, dy]) => <rect key={dy} x={x(width)} y={y + dy} width={width} height="1.2" fill="#2b579a" />)}</svg>;
}

// ---------- icons (Word 2013's flat style: grey frames, blue accents) ----------

const T = { frame: "#7a7a7a", line: "#a6a6a6", blue: "#2b579a", accent: "#4f81bd", fill: "#c5d9f1", light: "#deebf7", red: "#d13438", pink: "#e8829b", gold: "#f2c811" };
function TableFrame({ x = 4, y = 6, w = 24, h = 20, rows = 3, cols = 3, stroke = T.frame, inner = T.line, dash }: { x?: number; y?: number; w?: number; h?: number; rows?: number; cols?: number; stroke?: string; inner?: string; dash?: string }) {
  const lines: string[] = [];
  for (let r = 1; r < rows; r++) lines.push(`M${x} ${y + (h * r) / rows}h${w}`);
  for (let c = 1; c < cols; c++) lines.push(`M${x + (w * c) / cols} ${y}v${h}`);
  return <><rect x={x + 0.5} y={y + 0.5} width={w - 1} height={h - 1} fill="#fff" stroke={stroke} strokeDasharray={dash} /><path d={lines.join("")} stroke={inner} strokeDasharray={dash} /></>;
}

function Icon32({ name, color, pen, border }: { name: string; color?: string; pen?: Pen; border?: BorderCommand }) {
  const svg = (children: ReactNode) => <svg viewBox="0 0 32 32" width="32" height="32" fill="none" strokeWidth="1">{children}</svg>;
  switch (name) {
    case "shading": return svg(<><path d="M9 6l11 11-7 7-9-9z" fill="#fff" stroke={T.frame} /><path d="M4 15h17" stroke={T.frame} /><path d="M20 17c1.5 2 3 3.6 3 5a3 3 0 0 1-6 0c0-1.4 1.5-3 3-5z" fill={T.accent} /><rect x="3" y="26" width="26" height="4" fill={color ? `#${color}` : "#fff"} stroke={color ? "none" : T.line} /></>);
    case "borderStyles": return svg(<><rect x="4" y="4" width="24" height="18" fill="#fff" stroke={T.line} strokeDasharray="2 1" /><path d="M4 26h24" style={{ borderTop: "none" }} stroke={pen ? `#${pen.color}` : "#000"} strokeWidth={pen ? Math.max(1, pen.width * 1.4) : 1.5} strokeDasharray={pen?.style === "dotted" ? "1 2" : pen?.style === "dashed" ? "4 2" : undefined} /><path d="M18 8l6 6-8 8-4 1 1-4z" fill={T.light} stroke={T.blue} /></>);
    case "borders": return svg(<><TableFrame x={5} y={5} w={22} h={22} rows={2} cols={2} stroke={T.line} inner={T.line} dash="1.5 1.5" /><BorderOverlay border={border ?? "all"} /></>);
    case "borderPainter": return svg(<><TableFrame x={3} y={13} w={16} h={16} rows={2} cols={2} stroke={T.line} dash="1.5 1.5" /><path d="M3.5 28.5h15.5" stroke="#000" strokeWidth="2" /><path d="M20 3l8 8-5 5-8-8z" fill={T.gold} stroke="#9c7a00" /><path d="M15 8l-6 6 3 3 6-6" fill="#fff" stroke={T.frame} /></>);
    case "select": return svg(<><TableFrame x={3} y={5} w={22} h={18} /><path d="M17 14l9 7-4.2.6 2.4 4.6-2 1-2.4-4.6L17 25z" fill="#fff" stroke="#1e1e1e" strokeLinejoin="round" /></>);
    case "gridlines": return svg(<><rect x="4.5" y="6.5" width="23" height="19" fill={T.light} stroke={T.accent} strokeDasharray="2 1.5" /><path d="M4 12.8h24M4 19.2h24M12 6v20M20 6v20" stroke={T.accent} strokeDasharray="2 1.5" /></>);
    case "properties": return svg(<><TableFrame x={3} y={5} w={22} h={18} /><rect x="15" y="15" width="14" height="14" fill="#fff" stroke={T.frame} /><path d="M18 19h8M18 22h8M18 25h5" stroke={T.blue} /></>);
    case "draw": return svg(<><TableFrame x={3} y={4} w={20} h={18} rows={3} cols={2} /><path d="M27 12l3 3-12 12-4 1 1-4z" fill={T.gold} stroke="#9c7a00" /><path d="M14 28l1-4 3 3z" fill="#555" /></>);
    case "eraser": return svg(<><path d="M5 21l11-11 9 9-7 7h-7z" fill="#fff" stroke={T.frame} /><path d="M16 10l7-7 9 9-7 7z" transform="translate(-2 2)" fill={T.pink} stroke="#b0506a" /><path d="M11 26h17" stroke={T.frame} /></>);
    case "delete": return svg(<><TableFrame x={3} y={5} w={22} h={20} /><circle cx="23" cy="22" r="7" fill={T.red} /><path d="M20 19l6 6M26 19l-6 6" stroke="#fff" strokeWidth="1.8" /></>);
    case "insertAbove": return svg(<><TableFrame x={4} y={12} w={24} h={16} rows={3} cols={3} /><rect x="4.5" y="12.5" width="23" height="5" fill={T.fill} stroke={T.accent} /><path d="M16 10V2M12.5 5.5 16 2l3.5 3.5" stroke={T.blue} strokeWidth="1.6" /></>);
    case "insertBelow": return svg(<><TableFrame x={4} y={4} w={24} h={16} rows={3} cols={3} /><rect x="4.5" y="14.5" width="23" height="5" fill={T.fill} stroke={T.accent} /><path d="M16 22v8M12.5 26.5 16 30l3.5-3.5" stroke={T.blue} strokeWidth="1.6" /></>);
    case "insertLeft": return svg(<><TableFrame x={12} y={4} w={16} h={24} rows={3} cols={3} /><rect x="12.5" y="4.5" width="5" height="23" fill={T.fill} stroke={T.accent} /><path d="M10 16H2M5.5 12.5 2 16l3.5 3.5" stroke={T.blue} strokeWidth="1.6" /></>);
    case "insertRight": return svg(<><TableFrame x={4} y={4} w={16} h={24} rows={3} cols={3} /><rect x="14.5" y="4.5" width="5" height="23" fill={T.fill} stroke={T.accent} /><path d="M22 16h8M26.5 12.5 30 16l-3.5 3.5" stroke={T.blue} strokeWidth="1.6" /></>);
    case "merge": return svg(<><rect x="3.5" y="8.5" width="25" height="15" fill={T.fill} stroke={T.accent} /><path d="M16 8v4M16 20v4" stroke={T.accent} /><path d="M6 16h7M10.5 13.5 13 16l-2.5 2.5M26 16h-7M21.5 13.5 19 16l2.5 2.5" stroke={T.blue} strokeWidth="1.4" /></>);
    case "splitCells": return svg(<><rect x="3.5" y="8.5" width="25" height="15" fill="#fff" stroke={T.frame} /><path d="M16 8v16" stroke={T.accent} strokeWidth="1.6" /><path d="M13 16H6M8.5 13.5 6 16l2.5 2.5M19 16h7M23.5 13.5 26 16l-2.5 2.5" stroke={T.blue} strokeWidth="1.4" /></>);
    case "splitTable": return svg(<><TableFrame x={4} y={3} w={24} h={11} rows={2} cols={3} /><TableFrame x={4} y={18} w={24} h={11} rows={2} cols={3} /><path d="M2 16h28" stroke={T.blue} strokeDasharray="2 1.5" /></>);
    case "autofit": return svg(<><TableFrame x={3} y={7} w={26} h={18} rows={3} cols={3} /><path d="M7 16h18M10 13l-3 3 3 3M22 13l3 3-3 3" stroke={T.blue} strokeWidth="1.5" /></>);
    case "textDirection": return svg(<><path d="M6 5h12" stroke={T.frame} /><text x="7" y="17" fontSize="11" fontFamily="Segoe UI, Arial" fontWeight="700" fill={T.blue}>A</text><path d="M24 6v18M20.5 20.5 24 24l3.5-3.5" stroke={T.blue} strokeWidth="1.6" /><path d="M6 21h10M6 25h10" stroke={T.line} /></>);
    case "cellMargins": return svg(<><rect x="4.5" y="4.5" width="23" height="23" fill="#fff" stroke={T.frame} /><rect x="9.5" y="9.5" width="13" height="13" fill={T.light} stroke={T.accent} strokeDasharray="2 1" /><path d="M16 5v4M16 23v4M5 16h4M23 16h4" stroke={T.blue} /></>);
    case "sort": return svg(<><text x="3" y="13" fontSize="11" fontFamily="Segoe UI, Arial" fontWeight="700" fill={T.blue}>A</text><text x="3" y="27" fontSize="11" fontFamily="Segoe UI, Arial" fontWeight="700" fill={T.red}>Z</text><path d="M22 4v23M18 23l4 4 4-4" stroke={T.frame} strokeWidth="1.6" /></>);
    case "repeatHeader": return svg(<><TableFrame x={4} y={3} w={22} h={12} rows={2} cols={3} /><rect x="4.5" y="3.5" width="21" height="5.5" fill={T.fill} stroke={T.accent} /><TableFrame x={4} y={18} w={22} h={12} rows={2} cols={3} /><rect x="4.5" y="18.5" width="21" height="5.5" fill={T.fill} stroke={T.accent} /><path d="M29 6v15M27 19l2 2 2-2" stroke={T.blue} /></>);
    case "convertToText": return svg(<><TableFrame x={2} y={4} w={13} h={12} rows={2} cols={2} /><path d="M17 10h6M20.5 7.5 23 10l-2.5 2.5" stroke={T.blue} strokeWidth="1.4" /><path d="M4 21h24M4 25h24M4 29h16" stroke={T.frame} /></>);
    case "formula": return svg(<text x="6" y="23" fontSize="18" fontStyle="italic" fontFamily="Cambria, Georgia, serif" fill="#1e1e1e">fx</text>);
    default: return svg(<TableFrame />);
  }
}

function BorderOverlay({ border }: { border: BorderCommand }) {
  const line = (d: string) => <path d={d} stroke="#000" strokeWidth="1.6" />;
  const map: Record<BorderCommand, ReactNode> = {
    bottom: line("M5 26.5h22"), top: line("M5 5.5h22"), left: line("M5.5 5v22"), right: line("M26.5 5v22"), none: null,
    all: <>{line("M5.5 5.5h21v21h-21z")}{line("M16 5v22M5 16h22")}</>, outside: line("M5.5 5.5h21v21h-21z"), inside: line("M16 5v22M5 16h22"),
    insideH: line("M5 16h22"), insideV: line("M16 5v22"), diagonalDown: line("M5.5 5.5l21 21"), diagonalUp: line("M5.5 26.5l21-21"),
  };
  return <>{map[border]}</>;
}

export function Icon16({ name, color }: { name: string; color?: string }) {
  const svg = (children: ReactNode) => <svg viewBox="0 0 16 16" width="16" height="16" fill="none" strokeWidth="1">{children}</svg>;
  const mini = (extra: ReactNode) => svg(<><rect x="1.5" y="2.5" width="13" height="11" fill="#fff" stroke={T.frame} /><path d="M1.5 6.2h13M1.5 9.8h13M5.8 2.5v11M10.2 2.5v11" stroke={T.line} />{extra}</>);
  switch (name) {
    case "pen": return svg(<><path d="M10.5 1.5l3 3-7 7-3.5 1 1-3.5z" fill="#fff" stroke={T.frame} /><rect x="1" y="13.5" width="14" height="2.5" fill={color ? `#${color}` : "#000"} /></>);
    case "sampler": return svg(<><path d="M11 1.5l3.5 3.5-2 2-3.5-3.5z" fill={T.frame} /><path d="M9 4.5l2.5 2.5-6 6H3v-2.5z" fill="#fff" stroke={T.frame} /></>);
    case "gridlines": return svg(<><rect x="1.5" y="2.5" width="13" height="11" stroke={T.accent} strokeDasharray="1.5 1" /><path d="M1.5 8h13M8 2.5v11" stroke={T.accent} strokeDasharray="1.5 1" /></>);
    case "bordersDialog": return mini(<path d="M1.5 13.5h13" stroke="#000" strokeWidth="1.5" />);
    case "clear": return svg(<><rect x="1.5" y="2.5" width="13" height="11" fill="#fff" stroke={T.frame} /><path d="M5 6l6 6M11 6l-6 6" stroke={T.red} strokeWidth="1.4" /></>);
    case "colors": return svg(<><circle cx="5" cy="6" r="3.5" fill="#f06" /><circle cx="11" cy="6" r="3.5" fill="#fc0" /><circle cx="8" cy="11" r="3.5" fill="#09f" /></>);
    case "selectCell": return mini(<rect x="6" y="6.5" width="4" height="3" fill={T.fill} stroke={T.blue} />);
    case "selectColumn": return mini(<rect x="6" y="2.5" width="4" height="11" fill={T.fill} stroke={T.blue} />);
    case "selectRow": return mini(<rect x="1.5" y="6.2" width="13" height="3.6" fill={T.fill} stroke={T.blue} />);
    case "selectTable": return svg(<><rect x="1.5" y="2.5" width="13" height="11" fill={T.fill} stroke={T.blue} /><path d="M1.5 6.2h13M1.5 9.8h13M5.8 2.5v11M10.2 2.5v11" stroke={T.accent} /></>);
    case "deleteCells": return mini(<path d="M7 6.5l3 3M10 6.5l-3 3" stroke={T.red} strokeWidth="1.3" />);
    case "deleteColumns": return mini(<><rect x="6" y="2.5" width="4" height="11" fill="#fde7e9" stroke={T.red} /></>);
    case "deleteRows": return mini(<rect x="1.5" y="6.2" width="13" height="3.6" fill="#fde7e9" stroke={T.red} />);
    case "deleteTable": return svg(<><rect x="1.5" y="2.5" width="13" height="11" fill="#fde7e9" stroke={T.red} /><path d="M5 5.5l6 5M11 5.5l-6 5" stroke={T.red} strokeWidth="1.3" /></>);
    case "autofitContents": return mini(<path d="M4 8h8M6 6l-2 2 2 2M10 6l2 2-2 2" stroke={T.blue} />);
    case "autofitWindow": return svg(<><rect x="0.5" y="2.5" width="15" height="11" fill="#fff" stroke={T.frame} /><path d="M1 8h14M3 6 1 8l2 2M13 6l2 2-2 2" stroke={T.blue} /></>);
    case "fixedWidth": return mini(<path d="M3 15h10M3 14v2M13 14v2" stroke={T.blue} />);
    case "rowHeight": return svg(<><path d="M1.5 3.5h9M1.5 12.5h9" stroke={T.frame} /><path d="M13 3v10M11.5 4.5 13 3l1.5 1.5M11.5 11.5 13 13l1.5-1.5" stroke={T.blue} /></>);
    case "colWidth": return svg(<><path d="M3.5 1.5v9M12.5 1.5v9" stroke={T.frame} /><path d="M3 13h10M4.5 11.5 3 13l1.5 1.5M11.5 11.5 13 13l-1.5 1.5" stroke={T.blue} /></>);
    case "distributeRows": return svg(<><rect x="1.5" y="1.5" width="10" height="13" fill="#fff" stroke={T.frame} /><path d="M1.5 5.8h10M1.5 10.2h10" stroke={T.line} /><path d="M14 2v12M12.8 3.2 14 2l1.2 1.2M12.8 12.8 14 14l1.2-1.2" stroke={T.blue} /></>);
    case "distributeColumns": return svg(<><rect x="1.5" y="1.5" width="13" height="10" fill="#fff" stroke={T.frame} /><path d="M5.8 1.5v10M10.2 1.5v10" stroke={T.line} /><path d="M2 14h12M3.2 12.8 2 14l1.2 1.2M12.8 12.8 14 14l-1.2 1.2" stroke={T.blue} /></>);
    default: return mini(null);
  }
}
