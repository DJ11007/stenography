"use client";

import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import type { RibbonOption } from "@/lib/word-editor-capabilities";
import { FOOTER_STYLES, HEADER_STYLES, PAGE_NUMBER_GALLERIES, QUICK_TABLES, loadCustomHeaderFooterStyles, recentSymbols, type PageNumberDesign } from "@/lib/word-insert-gallery";
import { DropCapIcon } from "./word-2013-dialogs";
import { useClampedFlyoutPosition, useDismiss } from "./word-flyout";

// Word 2013's Insert-tab drop-downs. Each opens directly under its own ribbon
// button (clamped so it never leaves the screen), and the Page Number /
// Quick Tables sub-galleries open beside the item they belong to -- to the
// right, or to the left when there is no room on the right -- exactly like
// Word. Every pick goes back to the editor as onValueCommand(id, value).

export const INSERT_MENU_IDS = new Set(["insertTable", "header", "footer", "pageNumber", "dropCap", "symbol"]);

type Pick = (id: string, value: string) => void;

// Place a sub-gallery beside its menu item: right of it when it fits, else left; never off-screen.
function useSidePosition(open: boolean, anchorRef: RefObject<HTMLElement | null>, panelRef: RefObject<HTMLElement | null>) {
  const [style, setStyle] = useState<CSSProperties>({ visibility: "hidden" });
  useLayoutEffect(() => {
    if (!open) { setStyle({ visibility: "hidden" }); return; }
    const anchor = anchorRef.current?.getBoundingClientRect(), panel = panelRef.current;
    if (!anchor || !panel) return;
    const width = panel.offsetWidth, height = Math.min(panel.scrollHeight, window.innerHeight - 8);
    const fitsRight = anchor.right + width <= window.innerWidth - 4;
    const left = fitsRight ? anchor.right - 1 : Math.max(4, anchor.left - width + 1);
    const top = Math.max(4, Math.min(anchor.top - 1, window.innerHeight - height - 4));
    setStyle({ position: "fixed", left, top, maxHeight: window.innerHeight - 8, visibility: "visible" });
  }, [open, anchorRef, panelRef]);
  return style;
}

function Item({ icon, children, onClick, disabled, title, submenu, expanded, itemRef, onHover }: { icon?: ReactNode; children: ReactNode; onClick?: () => void; disabled?: boolean; title?: string; submenu?: boolean; expanded?: boolean; itemRef?: RefObject<HTMLButtonElement | null>; onHover?: () => void }) {
  return <button ref={itemRef} role="menuitem" type="button" className="wi-item" disabled={disabled} title={title} aria-haspopup={submenu ? "menu" : undefined} aria-expanded={submenu ? Boolean(expanded) : undefined}
    onMouseDown={event => event.preventDefault()} onMouseEnter={onHover} onClick={onClick}>
    <span className="wi-icon" aria-hidden>{icon}</span><span>{children}</span>{submenu && <span className="wi-arrow" aria-hidden>▶</span>}
  </button>;
}

function TableMenu({ pick, close, sub, setSub, subRef }: MenuBody) {
  const [hover, setHover] = useState({ rows: 0, cols: 0 });
  const quickRef = useRef<HTMLButtonElement>(null);
  const side = useSidePosition(sub === "quick", quickRef, subRef);
  return <>
    <div className="wi-heading">{hover.rows ? `${hover.cols}x${hover.rows} Table` : "Insert Table"}</div>
    <div className="wi-table-grid" onMouseLeave={() => setHover({ rows: 0, cols: 0 })} onMouseEnter={() => setSub(null)}>
      {Array.from({ length: 8 }, (_, row) => Array.from({ length: 10 }, (_, col) => <button key={`${row}-${col}`} type="button" aria-label={`${col + 1}x${row + 1} Table`} data-on={row < hover.rows && col < hover.cols ? "" : undefined}
        onMouseDown={event => event.preventDefault()} onMouseEnter={() => setHover({ rows: row + 1, cols: col + 1 })} onClick={() => { pick("insertTable", `grid:${row + 1}x${col + 1}`); close(); }} />))}
    </div>
    <div className="wi-sep" />
    <Item icon="▦" onHover={() => setSub(null)} onClick={() => { pick("insertTable", "dialog"); close(); }}>Insert Table…</Item>
    <Item icon="✎" disabled title="Drawing a table freehand is not available in this exam editor; use the grid or Insert Table…">Draw Table</Item>
    <Item icon="⇄" disabled title="Select text separated by tabs or commas first">Convert Text to Table…</Item>
    <Item icon="▤" disabled title="Excel Spreadsheet is not available in this exam editor">Excel Spreadsheet</Item>
    <Item icon="▥" submenu expanded={sub === "quick"} itemRef={quickRef} onHover={() => setSub("quick")} onClick={() => setSub("quick")}>Quick Tables</Item>
    {sub === "quick" && createPortal(<div ref={subRef as RefObject<HTMLDivElement>} role="menu" aria-label="Quick Tables" className="wi-menu" style={{ ...side, width: 300 }}>
      <div className="wi-heading">Built-In</div>
      <div className="wi-gallery">{QUICK_TABLES.map(table => <button key={table.id} type="button" role="menuitem" className="wi-tile" onMouseDown={event => event.preventDefault()} onClick={() => { pick("insertTable", `quick:${table.id}`); close(); }}>
        <span className="wi-tile-name">{table.name}</span>
        <span className="wi-tile-page"><table style={{ borderCollapse: "collapse", width: "100%", fontSize: 8 }}><tbody>{table.rows.slice(0, 4).map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex} style={{ borderBottom: "1px solid #bbb", padding: "1px 3px", fontWeight: index === 0 ? 700 : 400 }}>{cell}</td>)}</tr>)}</tbody></table></span>
      </button>)}</div>
    </div>, document.body)}
  </>;
}

function HeaderFooterMenu({ which, pick, close, setSub }: MenuBody & { which: "header" | "footer" }) {
  const label = which === "header" ? "Header" : "Footer";
  const styles = which === "header" ? HEADER_STYLES : FOOTER_STYLES;
  const custom = loadCustomHeaderFooterStyles(which);
  return <>
    <div className="wi-heading">Built-in</div>
    <div className="wi-gallery" style={{ maxHeight: "min(380px, calc(100vh - 290px))" }} onMouseEnter={() => setSub(null)}>
      {styles.map((style, index) => <button key={style.name} type="button" role="menuitem" className="wi-tile" onMouseDown={event => event.preventDefault()} onClick={() => { pick(which, `style:${index}`); close(); }}>
        <span className="wi-tile-name">{style.name}</span>
        <span className="wi-tile-page" style={{ borderStyle: which === "header" ? "none none solid" : "solid none none", borderColor: "#d6d6d6", borderWidth: 1 }} dangerouslySetInnerHTML={{ __html: style.html }} />
      </button>)}
      {custom.length > 0 && <div className="wi-heading">Custom</div>}
      {custom.map((style, index) => <button key={style.name} type="button" role="menuitem" className="wi-tile" onMouseDown={event => event.preventDefault()} onClick={() => { pick(which, `custom:${index}`); close(); }}>
        <span className="wi-tile-name">{style.name}</span><span className="wi-tile-page">{style.preview || "(no preview)"}</span>
      </button>)}
    </div>
    <div className="wi-sep" />
    <Item icon="🌐" disabled title="Office.com is not available in this exam editor" submenu>More {label}s from Office.com</Item>
    <Item icon="✎" onClick={() => { pick(which, "edit"); close(); }}>Edit {label}</Item>
    <Item icon="✕" onClick={() => { pick(which, "remove"); close(); }}>Remove {label}</Item>
    <Item icon="⎘" onClick={() => { pick(which, "save"); close(); }}>Save Selection to {label} Gallery…</Item>
  </>;
}

function PageNumberTile({ design, where }: { design: PageNumberDesign; where: string }) {
  const sample = design.style === "pageX" ? "Page 1" : design.style === "accentBar" ? "1 | Page" : design.style === "pageOfX" ? "Page 1 of 1" : "1";
  const vertical = where === "margins";
  return <span className="wi-tile-page" style={{ position: "relative", height: vertical ? 70 : 40, padding: 0 }}>
    {Array.from({ length: vertical ? 6 : 2 }, (_, index) => <span key={index} style={{ position: "absolute", left: 22, right: 22, top: (where === "bottom" ? 6 : 16) + index * 9, borderTop: "1px solid #ddd" }} />)}
    <span style={{ position: "absolute", left: vertical ? (design.alignment === "left" ? 2 : undefined) : 6, right: vertical ? (design.alignment === "right" ? 2 : undefined) : 6, top: where === "bottom" ? undefined : vertical ? 26 : 3, bottom: where === "bottom" ? 3 : undefined, textAlign: design.alignment, color: "#2b579a", fontWeight: 700, borderLeft: design.style === "accentBar" ? "3px solid #5b9bd5" : undefined, paddingLeft: design.style === "accentBar" ? 3 : 0, writingMode: vertical && design.style === "pageX" ? "vertical-rl" : undefined }}>{sample}</span>
  </span>;
}

const PAGE_NUMBER_ITEMS: { id: "top" | "bottom" | "margins" | "current"; label: string; icon: string }[] = [
  { id: "top", label: "Top of Page", icon: "▔" }, { id: "bottom", label: "Bottom of Page", icon: "▁" }, { id: "margins", label: "Page Margins", icon: "▕" }, { id: "current", label: "Current Position", icon: "#" },
];
function PageNumberMenu({ pick, close, sub, setSub, subRef }: MenuBody) {
  const refs = { top: useRef<HTMLButtonElement>(null), bottom: useRef<HTMLButtonElement>(null), margins: useRef<HTMLButtonElement>(null), current: useRef<HTMLButtonElement>(null) };
  const where = (PAGE_NUMBER_ITEMS.find(item => item.id === sub)?.id ?? null);
  const side = useSidePosition(where !== null, where ? refs[where] : refs.top, subRef);
  const designs = where ? PAGE_NUMBER_GALLERIES[where] : [];
  const groups = [...new Set(designs.map(design => design.group))];
  return <>
    {PAGE_NUMBER_ITEMS.map(item => <Item key={item.id} icon={item.icon} submenu expanded={sub === item.id} itemRef={refs[item.id]} onHover={() => setSub(item.id)} onClick={() => setSub(item.id)}>{item.label}</Item>)}
    <div className="wi-sep" />
    <Item icon="⚙" onHover={() => setSub(null)} onClick={() => { pick("pageNumber", "format"); close(); }}>Format Page Numbers…</Item>
    <Item icon="✕" onHover={() => setSub(null)} onClick={() => { pick("pageNumber", "remove"); close(); }}>Remove Page Numbers</Item>
    {where && createPortal(<div key={where} ref={subRef as RefObject<HTMLDivElement>} role="menu" aria-label={PAGE_NUMBER_ITEMS.find(item => item.id === where)?.label} className="wi-menu" style={{ ...side, width: 260 }}>
      <div className="wi-gallery">{groups.map(group => <div key={group}>
        <div className="wi-heading">{group}</div>
        {designs.filter(design => design.group === group).map(design => <button key={design.id} type="button" role="menuitem" className="wi-tile" onMouseDown={event => event.preventDefault()} onClick={() => { pick("pageNumber", `${where}:${design.id}`); close(); }}>
          <span className="wi-tile-name">{design.name}</span><PageNumberTile design={design} where={where} />
        </button>)}
      </div>)}</div>
      <div className="wi-sep" />
      <Item icon="🌐" disabled title="Office.com is not available in this exam editor" submenu>More Page Numbers from Office.com</Item>
    </div>, document.body)}
  </>;
}

function DropCapMenu({ pick, close }: MenuBody) {
  return <>
    {([["none", "None"], ["dropped", "Dropped"], ["margin", "In margin"]] as const).map(([id, label]) => <button key={id} role="menuitem" type="button" className="wi-item" style={{ padding: "4px 12px 4px 6px" }} onMouseDown={event => event.preventDefault()} onClick={() => { pick("dropCap", id); close(); }}><DropCapIcon mode={id} size={40} /><span>{label}</span></button>)}
    <div className="wi-sep" />
    <Item icon="A" onClick={() => { pick("dropCapAction", "options"); close(); }}>Drop Cap Options…</Item>
  </>;
}

function SymbolMenu({ pick, close }: MenuBody) {
  const symbols = recentSymbols();
  return <>
    <div className="wi-symbol-grid">{symbols.map(char => <button key={char} type="button" role="menuitem" aria-label={char} title={`Insert ${char}`} onMouseDown={event => event.preventDefault()} onClick={() => { pick("symbol", `char:${char}`); close(); }}>{char}</button>)}</div>
    <div className="wi-sep" />
    <Item icon="Ω" onClick={() => { pick("symbol", "more"); close(); }}>More Symbols…</Item>
  </>;
}

type MenuBody = { pick: Pick; close: () => void; sub: string | null; setSub: (id: string | null) => void; subRef: RefObject<HTMLDivElement | null> };

const MENU_WIDTH: Record<string, number | undefined> = { header: 300, footer: 300 };

export function InsertMenu({ option, preview, icon, onValueCommand }: { option: RibbonOption; preview: boolean; icon: ReactNode; onValueCommand?: Pick }) {
  const [open, setOpen] = useState(false);
  const [sub, setSub] = useState<string | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null), subRef = useRef<HTMLDivElement>(null);
  const { position, flyoutRef } = useClampedFlyoutPosition(open, buttonRef);
  const close = () => { setOpen(false); setSub(null); };
  useDismiss(open, close, [buttonRef, flyoutRef, subRef]);
  const pick: Pick = (id, value) => onValueCommand?.(id, value);
  const body: MenuBody = { pick, close, sub, setSub, subRef };
  const disabled = preview || Boolean(option.unsupported);
  const menu = open && typeof document !== "undefined" ? createPortal(
    <div ref={flyoutRef} role="menu" aria-label={option.label} data-insert-menu={option.id} className="wi-menu" style={{ ...position, width: MENU_WIDTH[option.id] }}>
      {option.id === "insertTable" && <TableMenu {...body} />}
      {(option.id === "header" || option.id === "footer") && <HeaderFooterMenu {...body} which={option.id} />}
      {option.id === "pageNumber" && <PageNumberMenu {...body} />}
      {option.id === "dropCap" && <DropCapMenu {...body} />}
      {option.id === "symbol" && <SymbolMenu {...body} />}
    </div>, document.body) : null;
  return <div data-ribbon-option={option.id}>
    <button ref={buttonRef} type="button" className="word-ribbon-tool word-gallery-trigger" aria-label={option.label} aria-haspopup="menu" aria-expanded={open} disabled={disabled} title={option.unsupported ?? option.label}
      onMouseDown={event => event.preventDefault()} onClick={() => { setSub(null); setOpen(value => !value); }}>{icon}<span>{option.label}<i aria-hidden>▾</i></span></button>
    {menu}
  </div>;
}
