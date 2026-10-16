"use client";

import { useState, type ReactNode } from "react";
import { MARGIN_PRESETS, PAPER_SIZES, sameMargins, type MarginsCm } from "@/lib/word-page-setup";
import { Big, BigDrop, Flyout, Group, MenuItem, Small, useFlyout } from "./word-table-tools";

// Word 2013's PAGE LAYOUT tab: Page Setup (Margins, Orientation, Size, Columns,
// Breaks, Line Numbers, Hyphenation + Page Setup dialog launcher), Paragraph
// (Indent Left/Right, Spacing Before/After) and Arrange. Every control calls
// `on(action, value)`; the editor does the work and passes the current page and
// paragraph back in `state`.

export type PageLayoutState = {
  margins: MarginsCm | null;
  lastCustom: MarginsCm | null;
  orientation: "portrait" | "landscape";
  paper: string | null;
  columns: number;
  indentLeft: number; indentRight: number; spaceBefore: number; spaceAfter: number;
  enabled: { margins: boolean; orientation: boolean; pageSize: boolean; columns: boolean; breaks: boolean; lineNumbers: boolean; paragraph: boolean };
};
export type PageLayoutAction = "margins" | "marginsLast" | "pageSetup" | "orientation" | "pageSize" | "columns" | "breaks" | "lineNumbers" | "hyphenation"
  | "indentLeft" | "indentRight" | "spaceBefore" | "spaceAfter" | "paragraphDialog";
type On = (action: PageLayoutAction, value?: string) => void;

const C = { frame: "#7a7a7a", line: "#a6a6a6", blue: "#2b579a", accent: "#4f81bd", fill: "#c5d9f1", light: "#deebf7", gold: "#f2c811" };
const cm = (value: number) => `${Math.round(value * 100) / 100} cm`;

function PageIcon({ margins, size = 32, star, mirrored }: { margins: MarginsCm; size?: number; star?: boolean; mirrored?: boolean }) {
  // A page (21 x 29.7 proportions) with its margins drawn as blue guide lines.
  const w = 22, h = 28, x0 = (32 - w) / 2, y0 = 2, k = w / 21;
  const t = y0 + margins.top * k, b = y0 + h - margins.bottom * k, l = x0 + margins.left * k, r = x0 + w - margins.right * k;
  return <svg viewBox="0 0 32 32" width={size} height={size} fill="none" aria-hidden>
    <rect x={x0 + 0.5} y={y0 + 0.5} width={w - 1} height={h - 1} fill="#fff" stroke={C.frame} />
    <path d={`M${x0} ${t}h${w}M${x0} ${b}h${w}M${l} ${y0}v${h}M${r} ${y0}v${h}`} stroke={C.accent} strokeWidth=".9" />
    {mirrored && <path d={`M${x0 - 3} ${y0 + 1}v${h - 2}`} stroke={C.frame} strokeDasharray="1.5 1" />}
    {star && <path d="M16 11l1.6 3.4 3.7.4-2.8 2.5.8 3.6-3.3-1.9-3.3 1.9.8-3.6-2.8-2.5 3.7-.4z" fill={C.gold} stroke="#b78c00" strokeWidth=".6" />}
  </svg>;
}

function MarginRow({ name, margins, mirrored, star, selected, onPick }: { name: string; margins: MarginsCm; mirrored?: boolean; star?: boolean; selected: boolean; onPick: () => void }) {
  return <button type="button" role="menuitem" className="wp-margin-item" aria-pressed={selected} onMouseDown={event => event.preventDefault()} onClick={onPick}>
    <span className="wp-margin-icon"><PageIcon margins={margins} size={40} star={star} mirrored={mirrored} /></span>
    <span className="wp-margin-text">
      <b>{name}</b>
      <span className="wp-margin-grid">
        <span>Top:</span><span>{cm(margins.top)}</span><span>Bottom:</span><span>{cm(margins.bottom)}</span>
        <span>{mirrored ? "Inside:" : "Left:"}</span><span>{cm(margins.left)}</span><span>{mirrored ? "Outside:" : "Right:"}</span><span>{cm(margins.right)}</span>
      </span>
    </span>
  </button>;
}

function Icon({ name }: { name: string }) {
  const svg = (children: ReactNode, size = 32) => <svg viewBox="0 0 32 32" width={size} height={size} fill="none" strokeWidth="1">{children}</svg>;
  const page = (x = 7, y = 3, w = 18, h = 26) => <rect x={x + 0.5} y={y + 0.5} width={w - 1} height={h - 1} fill="#fff" stroke={C.frame} />;
  const lines = (x: number, y: number, w: number, n: number, gap = 3) => <path d={Array.from({ length: n }, (_, i) => `M${x} ${y + i * gap}h${w}`).join("")} stroke={C.line} />;
  switch (name) {
    case "margins": return svg(<>{page()}<path d="M7 8h18M7 24h18M11 3v26M21 3v26" stroke={C.accent} strokeWidth=".9" /></>);
    case "orientation": return svg(<>{page(4, 6, 15, 21)}<rect x="12.5" y="14.5" width="16" height="12" fill="#fff" stroke={C.frame} /><path d="M20 4c5 0 8 3 8 8M25.5 9.5 28 12l2.5-2.5" stroke={C.blue} strokeWidth="1.4" /></>);
    case "size": return svg(<>{page(6, 5, 18, 24)}<path d="M3 5v24M1.5 6.5 3 5l1.5 1.5M1.5 27.5 3 29l1.5-1.5M6 2h18M7.5.5 6 2l1.5 1.5M22.5.5 24 2l-1.5 1.5" stroke={C.blue} /></>);
    case "columns": return svg(<>{page(4, 3, 24, 26)}{lines(7, 8, 7, 6)}{lines(18, 8, 7, 6)}</>);
    case "portrait": return svg(<>{page(9, 3, 14, 26)}{lines(12, 8, 8, 6)}</>);
    case "landscape": return svg(<>{page(3, 9, 26, 14)}{lines(6, 13, 20, 3)}</>);
    case "col1": return svg(<>{page()}{lines(10, 8, 12, 7)}</>);
    case "col2": return svg(<>{page()}{lines(9, 8, 6, 7)}{lines(17, 8, 6, 7)}</>);
    case "col3": return svg(<>{page()}{lines(9, 8, 4, 7)}{lines(14, 8, 4, 7)}{lines(19, 8, 4, 7)}</>);
    case "colLeft": return svg(<>{page()}{lines(9, 8, 3, 7)}{lines(14, 8, 9, 7)}</>);
    case "colRight": return svg(<>{page()}{lines(9, 8, 9, 7)}{lines(20, 8, 3, 7)}</>);
    default: return svg(page());
  }
}

function Icon16({ name }: { name: string }) {
  const svg = (children: ReactNode) => <svg viewBox="0 0 16 16" width="16" height="16" fill="none" strokeWidth="1">{children}</svg>;
  switch (name) {
    case "breaks": return svg(<><path d="M2 3h12M2 6h8" stroke={C.line} /><path d="M1 9h14" stroke={C.blue} strokeDasharray="2 1" /><path d="M2 12h12" stroke={C.line} /></>);
    case "lineNumbers": return svg(<><text x="0" y="7" fontSize="6" fill={C.blue}>1</text><text x="0" y="14" fontSize="6" fill={C.blue}>2</text><path d="M5 5h10M5 12h10" stroke={C.line} /></>);
    case "hyphenation": return svg(<><text x="0" y="10" fontSize="9" fill={C.frame}>b</text><path d="M6 7h3" stroke={C.blue} strokeWidth="1.4" /><text x="10" y="10" fontSize="9" fill={C.frame}>c</text></>);
    case "indentLeft": return svg(<><path d="M6 3h9M6 6h9M6 9h9M6 12h9" stroke={C.line} /><path d="M1 5l3 2.5L1 10" stroke={C.blue} strokeWidth="1.3" /></>);
    case "indentRight": return svg(<><path d="M1 3h9M1 6h9M1 9h9M1 12h9" stroke={C.line} /><path d="M15 5l-3 2.5 3 2.5" stroke={C.blue} strokeWidth="1.3" /></>);
    case "spaceBefore": return svg(<><path d="M7 8h8M7 11h8M7 14h8" stroke={C.line} /><path d="M3 1v6M1 5l2 2 2-2" stroke={C.blue} /></>);
    case "spaceAfter": return svg(<><path d="M7 2h8M7 5h8M7 8h8" stroke={C.line} /><path d="M3 15V9M1 11l2-2 2 2" stroke={C.blue} /></>);
    case "page": return svg(<><rect x="3.5" y="1.5" width="9" height="13" fill="#fff" stroke={C.frame} /><path d="M3 8h10" stroke={C.blue} strokeDasharray="1.5 1" /></>);
    case "section": return svg(<><rect x="3.5" y="1.5" width="9" height="13" fill="#fff" stroke={C.frame} /><path d="M3 8h10" stroke={C.blue} strokeWidth="1.6" strokeDasharray="1 1" /></>);
    default: return svg(<rect x="2.5" y="2.5" width="11" height="11" stroke={C.frame} />);
  }
}

// Arrange group icons (Word shows them greyed until a picture or shape is selected).
function ArrangeIcon({ name }: { name: string }) {
  const svg = (children: ReactNode) => <svg viewBox="0 0 32 32" width="32" height="32" fill="none" strokeWidth="1">{children}</svg>;
  switch (name) {
    case "position": return svg(<><rect x="5.5" y="3.5" width="21" height="25" fill="#fff" stroke={C.frame} /><rect x="9" y="8" width="8" height="7" fill={C.fill} stroke={C.accent} /><path d="M19 9h5M19 12h5M9 19h15M9 22h15" stroke={C.line} /></>);
    case "wrap": return svg(<><path d="M5 6h22M5 10h6M21 10h6M5 14h6M21 14h6M5 18h22" stroke={C.line} /><path d="M13 8c6-2 8 2 4 4s-2 6 3 4" stroke={C.accent} /></>);
    case "forward": return svg(<><rect x="4.5" y="12.5" width="14" height="14" fill="#d9d9d9" stroke={C.frame} /><rect x="12.5" y="5.5" width="14" height="14" fill={C.fill} stroke={C.accent} /></>);
    case "backward": return svg(<><rect x="12.5" y="5.5" width="14" height="14" fill="#d9d9d9" stroke={C.frame} /><rect x="4.5" y="12.5" width="14" height="14" fill={C.fill} stroke={C.accent} /></>);
    case "selection": return svg(<><rect x="4.5" y="4.5" width="18" height="22" fill="#fff" stroke={C.frame} /><path d="M8 10h11M8 14h11M8 18h11" stroke={C.line} /><path d="M20 16l8 6-4 .5 2 4-2 1-2-4-2 3z" fill="#fff" stroke="#1e1e1e" /><rect x="17" y="2" width="11" height="7" fill={C.gold} stroke="#b78c00" /></>);
    default: return svg(null);
  }
}

// Indent / Spacing spin box (cm or pt), committed on Enter, blur or the arrows.
function Spin({ label, value, unit, step, min, max, onCommit, disabled }: { label: string; value: number; unit: "cm" | "pt"; step: number; min: number; max: number; onCommit: (value: number) => void; disabled?: boolean }) {
  const [text, setText] = useState<string | null>(null);
  const shown = text ?? `${Math.round(value * 100) / 100} ${unit}`;
  const clamp = (number: number) => Math.min(max, Math.max(min, Math.round(number * 100) / 100));
  const commit = (raw: string) => {
    setText(null);
    const match = /^\s*(-?\d*\.?\d+)\s*(cm|mm|in|"|pt)?\s*$/i.exec(raw.replace(",", "."));
    if (!match) return;
    const amount = Number(match[1]), given = (match[2] ?? unit).toLowerCase();
    const inUnit = unit === "cm" ? (given === "mm" ? amount / 10 : given === "in" || given === '"' ? amount * 2.54 : given === "pt" ? amount * 2.54 / 72 : amount) : (given === "cm" ? amount * 72 / 2.54 : given === "in" || given === '"' ? amount * 72 : given === "mm" ? amount * 72 / 25.4 : amount);
    onCommit(clamp(inUnit));
  };
  return <span className="wt-spin wp-spin">
    <input aria-label={label} value={shown} disabled={disabled} onChange={event => setText(event.target.value)} onBlur={() => text !== null && commit(text)} onKeyDown={event => { if (event.key === "Enter") commit((event.target as HTMLInputElement).value); if (event.key === "ArrowUp") { event.preventDefault(); onCommit(clamp(value + step)); } if (event.key === "ArrowDown") { event.preventDefault(); onCommit(clamp(value - step)); } }} />
    <span className="wt-spin-buttons"><button type="button" tabIndex={-1} disabled={disabled} aria-label={`Increase ${label}`} onMouseDown={event => event.preventDefault()} onClick={() => onCommit(clamp(value + step))}>▲</button><button type="button" tabIndex={-1} disabled={disabled} aria-label={`Decrease ${label}`} onMouseDown={event => event.preventDefault()} onClick={() => onCommit(clamp(value - step))}>▼</button></span>
  </span>;
}

export function PageLayoutGroups({ state, on }: { state: PageLayoutState; on: On }) {
  const e = state.enabled;
  return <>
    <Group id="pageLayoutSetup" name="Page Setup" launcher="Page Setup" onLauncher={() => on("pageSetup", "margins")}>
      <div className="wt-row">
        {e.margins && <BigDrop label={"Margins"} width={292} icon={<Icon name="margins" />}>
          {close => <div className="wp-margins">
            {state.lastCustom && <MarginRow name="Last Custom Setting" margins={state.lastCustom} star selected={sameMargins(state.margins, state.lastCustom) && !MARGIN_PRESETS.some(preset => sameMargins(state.margins, preset.margins))} onPick={() => { on("marginsLast"); close(); }} />}
            {MARGIN_PRESETS.map(preset => <MarginRow key={preset.id} name={preset.name} margins={preset.margins} mirrored={preset.mirrored} selected={sameMargins(state.margins, preset.margins)} onPick={() => { on("margins", preset.id); close(); }} />)}
            <div className="wi-sep" />
            <button type="button" role="menuitem" className="wp-menu-command" onMouseDown={event => event.preventDefault()} onClick={() => { on("pageSetup", "margins"); close(); }}>Custom M<u>a</u>rgins…</button>
          </div>}
        </BigDrop>}
        {e.orientation && <BigDrop label={"Orientation"} width={150} icon={<Icon name="orientation" />}>
          {close => <>
            <button type="button" role="menuitem" className="wp-big-item" aria-pressed={state.orientation === "portrait"} onMouseDown={event => event.preventDefault()} onClick={() => { on("orientation", "portrait"); close(); }}><Icon name="portrait" /><span>Portrait</span></button>
            <button type="button" role="menuitem" className="wp-big-item" aria-pressed={state.orientation === "landscape"} onMouseDown={event => event.preventDefault()} onClick={() => { on("orientation", "landscape"); close(); }}><Icon name="landscape" /><span>Landscape</span></button>
          </>}
        </BigDrop>}
        {e.pageSize && <BigDrop label={"Size"} width={236} icon={<Icon name="size" />}>
          {close => <div className="wp-sizes">
            <div className="wp-size-list">{PAPER_SIZES.map(size => <button key={size.id} type="button" role="menuitem" className="wp-size-item" aria-pressed={state.paper === size.id} onMouseDown={event => event.preventDefault()} onClick={() => { on("pageSize", size.id); close(); }}>
              <span className="wp-size-icon">{size.icon && <svg viewBox="0 0 24 32" width="24" height="32" aria-hidden><rect x={12 - (24 * size.width / size.height) / 2 + 0.5} y="1.5" width={24 * size.width / size.height - 1} height="29" fill="#fff" stroke="#3c3c3c" /></svg>}</span>
              <span><b>{size.name}</b><span className="wp-size-dim">{size.width} cm x {size.height} cm</span></span>
            </button>)}</div>
            <div className="wi-sep" />
            <button type="button" role="menuitem" className="wp-menu-command" onMouseDown={event => event.preventDefault()} onClick={() => { on("pageSetup", "paper"); close(); }}>More P<u>a</u>per Sizes…</button>
          </div>}
        </BigDrop>}
        {e.columns && <BigDrop label={"Columns"} width={150} icon={<Icon name="columns" />}>
          {close => <>
            {([["1", "One", "col1"], ["2", "Two", "col2"], ["3", "Three", "col3"]] as const).map(([value, label, icon]) => <button key={value} type="button" role="menuitem" className="wp-big-item" aria-pressed={state.columns === Number(value)} onMouseDown={event => event.preventDefault()} onClick={() => { on("columns", value); close(); }}><Icon name={icon} /><span>{label}</span></button>)}
            <button type="button" role="menuitem" className="wp-big-item" disabled title="Unequal column widths are not available in this exam editor"><Icon name="colLeft" /><span>Left</span></button>
            <button type="button" role="menuitem" className="wp-big-item" disabled title="Unequal column widths are not available in this exam editor"><Icon name="colRight" /><span>Right</span></button>
            <div className="wi-sep" />
            <button type="button" role="menuitem" className="wp-menu-command" onMouseDown={event => event.preventDefault()} onClick={() => { on("columns", "more"); close(); }}>More <u>C</u>olumns…</button>
          </>}
        </BigDrop>}
        <div className="wt-stack wp-setup-small">
          {e.breaks && <SmallDrop label="Breaks" icon={<Icon16 name="breaks" />} width={300}>
            {close => <>
              <div className="wi-heading">Page Breaks</div>
              <BreakItem title="Page" detail="Mark the point at which one page ends and the next page begins." icon="page" onClick={() => { on("breaks", "page"); close(); }} />
              <BreakItem title="Column" detail="Indicate that the text following the column break will begin in the next column." icon="page" disabled />
              <BreakItem title="Text Wrapping" detail="Separate text around objects on web pages, such as caption text from body text." icon="page" onClick={() => { on("breaks", "textWrapping"); close(); }} />
              <div className="wi-heading">Section Breaks</div>
              <BreakItem title="Next Page" detail="Insert a section break and start the new section on the next page." icon="section" onClick={() => { on("breaks", "nextPage"); close(); }} />
              <BreakItem title="Continuous" detail="Insert a section break and start the new section on the same page." icon="section" disabled />
              <BreakItem title="Even Page" detail="Insert a section break and start the new section on the next even-numbered page." icon="section" disabled />
              <BreakItem title="Odd Page" detail="Insert a section break and start the new section on the next odd-numbered page." icon="section" disabled />
            </>}
          </SmallDrop>}
          {e.lineNumbers && <SmallDrop label="Line Numbers" icon={<Icon16 name="lineNumbers" />} width={250}>
            {close => <>
              <MenuItem onClick={() => { on("lineNumbers", "none"); close(); }}>None</MenuItem>
              <MenuItem onClick={() => { on("lineNumbers", "continuous"); close(); }}>Continuous</MenuItem>
              <MenuItem disabled onClick={() => undefined}>Restart Each Page</MenuItem>
              <MenuItem disabled onClick={() => undefined}>Restart Each Section</MenuItem>
              <MenuItem onClick={() => { on("lineNumbers", "suppress"); close(); }}>Suppress for Current Paragraph</MenuItem>
              <div className="wi-sep" />
              <MenuItem onClick={() => { on("pageSetup", "layout"); close(); }}>Line Numbering Options…</MenuItem>
            </>}
          </SmallDrop>}
          {e.lineNumbers && <SmallDrop label="Hyphenation" icon={<Icon16 name="hyphenation" />} width={200}>
            {close => <>
              <MenuItem onClick={() => { on("hyphenation", "none"); close(); }}>None</MenuItem>
              <MenuItem onClick={() => { on("hyphenation", "auto"); close(); }}>Automatic</MenuItem>
              <MenuItem disabled onClick={() => undefined}>Manual</MenuItem>
              <div className="wi-sep" />
              <MenuItem disabled onClick={() => undefined}>Hyphenation Options…</MenuItem>
            </>}
          </SmallDrop>}
        </div>
      </div>
    </Group>
    {e.paragraph && <Group id="pageParagraph" name="Paragraph" launcher="Paragraph Settings" onLauncher={() => on("paragraphDialog")}>
      <div className="wp-para">
        <div className="wp-para-col">
          <span className="wp-para-head">Indent</span>
          <label><Icon16 name="indentLeft" /><span>Left:</span><Spin label="Indent left" unit="cm" value={state.indentLeft} step={0.1} min={-55} max={55} onCommit={value => on("indentLeft", String(value))} /></label>
          <label><Icon16 name="indentRight" /><span>Right:</span><Spin label="Indent right" unit="cm" value={state.indentRight} step={0.1} min={-55} max={55} onCommit={value => on("indentRight", String(value))} /></label>
        </div>
        <div className="wp-para-col">
          <span className="wp-para-head">Spacing</span>
          <label><Icon16 name="spaceBefore" /><span>Before:</span><Spin label="Spacing before" unit="pt" value={state.spaceBefore} step={6} min={0} max={1584} onCommit={value => on("spaceBefore", String(value))} /></label>
          <label><Icon16 name="spaceAfter" /><span>After:</span><Spin label="Spacing after" unit="pt" value={state.spaceAfter} step={6} min={0} max={1584} onCommit={value => on("spaceAfter", String(value))} /></label>
        </div>
      </div>
    </Group>}
    <Group id="arrange" name="Arrange">
      <div className="wt-row">
        {/* Word greys these out until a picture or shape is selected; this exam editor has no movable objects. */}
        <Big label={"Position"} disabled title="Select a picture or shape first" icon={<ArrangeIcon name="position" />} />
        <Big label={"Wrap\nText"} disabled title="Select a picture or shape first" icon={<ArrangeIcon name="wrap" />} />
        <Big label={"Bring\nForward"} disabled title="Select a picture or shape first" icon={<ArrangeIcon name="forward" />} />
        <Big label={"Send\nBackward"} disabled title="Select a picture or shape first" icon={<ArrangeIcon name="backward" />} />
        <Big label={"Selection\nPane"} disabled title="Select a picture or shape first" icon={<ArrangeIcon name="selection" />} />
        <div className="wt-stack">
          <Small label="Align" icon={<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden><path d="M2 2v12" stroke={C.blue} /><rect x="3.5" y="3.5" width="8" height="3" fill={C.fill} stroke={C.accent} /><rect x="3.5" y="9.5" width="11" height="3" fill={C.fill} stroke={C.accent} /></svg>} title="Select a picture or shape first" disabled />
          <Small label="Group" icon={<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden><rect x="1.5" y="1.5" width="8" height="8" fill="#fff" stroke={C.frame} /><rect x="6.5" y="6.5" width="8" height="8" fill="#fff" stroke={C.frame} /></svg>} title="Select a picture or shape first" disabled />
          <Small label="Rotate" icon={<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden><rect x="4.5" y="6.5" width="9" height="7" fill="#fff" stroke={C.frame} /><path d="M3 9a6 6 0 0 1 9-6M10 1.5 12 3l-1.5 2" stroke={C.blue} /></svg>} title="Select a picture or shape first" disabled />
        </div>
      </div>
    </Group>
  </>;
}

function BreakItem({ title, detail, icon, onClick, disabled }: { title: string; detail: string; icon: string; onClick?: () => void; disabled?: boolean }) {
  return <button type="button" role="menuitem" className="wp-break-item" disabled={disabled} title={disabled ? "Not available in this exam editor" : undefined} onMouseDown={event => event.preventDefault()} onClick={onClick}>
    <span className="wp-break-icon"><Icon16 name={icon} /></span><span><b>{title}</b><span>{detail}</span></span>
  </button>;
}

// Small drop-down button (Breaks, Line Numbers, Hyphenation).
function SmallDrop({ label, icon, width, children }: { label: string; icon: ReactNode; width: number; children: (close: () => void) => ReactNode }) {
  const flyout = useFlyout();
  return <>
    <button ref={flyout.anchorRef} type="button" className="wr-small" aria-haspopup="menu" aria-expanded={flyout.open} title={label} aria-label={label} onMouseDown={event => event.preventDefault()} onClick={() => flyout.setOpen(value => !value)}>
      <span className="wr-small-icon" aria-hidden>{icon}</span><span>{label}</span><i aria-hidden className="wr-caret">▾</i>
    </button>
    <Flyout flyout={flyout} label={label} width={width}>{children}</Flyout>
  </>;
}
