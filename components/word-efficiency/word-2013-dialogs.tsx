"use client";
import { createPortal } from "react-dom";
import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { APPROVED_WORD_FONTS, WORD_THEME_FONTS } from "@/lib/word-editor-capabilities";
import { WORD_FONT_SIZE_LIST, wordFontSize } from "@/lib/word-font-sizes";
import { DEFAULT_ENGINE_OPTIONS, describeFormat, findWhatError, type FindEngineOptions, type FindFormat } from "@/lib/word-find-engine";
import { colorName, mixColors } from "@/lib/word-colors";
import { PAPER_SIZES, type PageSetupValues } from "@/lib/word-page-setup";
import { TABLE_COLORS, WordPalette } from "./word-table-tools";

// Word 2013-style dialogs: Find and Replace (with Special / Format / search options),
// Font (Font + Advanced tabs) and Paragraph (Indents and Spacing + Line and Page Breaks).
// They are presentational: every value comes from, and goes back to, the editor through props.

type Chrome = { onClose: () => void; startDrag: (event: ReactMouseEvent<HTMLDivElement>) => void };
export const Word13Chrome = createContext<Chrome | null>(null);

function Window13({ title, width, children }: { title: string; width: number; children: ReactNode }) {
  const chrome = useContext(Word13Chrome);
  return (
    <div className="w13" role="document" style={{ width, maxWidth: "calc(100vw - 16px)" }} onKeyDown={event => {
      // As in Word: Enter in a box presses OK, Esc presses Cancel (after the box has committed its value).
      const target = event.target as HTMLElement;
      if (event.key !== "Enter" && event.key !== "Escape") return;
      event.stopPropagation();
      if (event.key === "Enter" && (target.closest("textarea, select, button, [role=listbox]") || event.defaultPrevented)) return;
      const window13 = event.currentTarget;
      const pick = (label: string) => [...window13.querySelectorAll<HTMLButtonElement>(".w13-buttons button, button")].find(button => button.textContent?.trim() === label && !button.disabled);
      event.preventDefault();
      setTimeout(() => { (event.key === "Enter" ? pick("OK") : pick("Cancel") ?? null)?.click(); if (event.key === "Escape" && !pick("Cancel")) chrome?.onClose?.(); }, 0);
    }}>
      <div className="w13-title" onMouseDown={chrome?.startDrag}>
        <span>{title}</span>
        <span className="w13-title-buttons" onMouseDown={event => event.stopPropagation()}>
          <span aria-hidden title="Help">?</span>
          <button type="button" aria-label="Close" onClick={chrome?.onClose}>✕</button>
        </span>
      </div>
      <div className="w13-body">{children}</div>
    </div>
  );
}

function Tabs13({ tabs, value, onChange }: { tabs: { id: string; label: ReactNode }[]; value: string; onChange: (id: string) => void }) {
  return (
    <div role="tablist" className="w13-tabs">
      {tabs.map(tab => <button key={tab.id} type="button" role="tab" className="w13-tab" aria-selected={tab.id === value} onMouseDown={event => event.preventDefault()} onClick={() => onChange(tab.id)}>{tab.label}</button>)}
    </div>
  );
}

function Group13({ children }: { children: ReactNode }) { return <div className="w13-group">{children}</div>; }
function Check13({ checked, onChange, disabled, children, title }: { checked: boolean; onChange?: (value: boolean) => void; disabled?: boolean; children: ReactNode; title?: string }) {
  return <label className="w13-check" title={title} aria-disabled={disabled}><input type="checkbox" checked={checked} disabled={disabled} onChange={event => onChange?.(event.target.checked)} /><span>{children}</span></label>;
}
function Button13({ children, onClick, disabled, isDefault, title }: { children: ReactNode; onClick?: () => void; disabled?: boolean; isDefault?: boolean; title?: string }) {
  return <button type="button" className="w13-btn" data-default={isDefault || undefined} disabled={disabled} title={title} onMouseDown={event => event.preventDefault()} onClick={onClick}>{children}</button>;
}

// ---- Number field: typed text is taken as it is typed (digits, decimals, units); the
// up/down arrows and the ArrowUp/ArrowDown keys step it. ----
// "inches": the value is kept in cm, but shown and typed in inches, as in Word set up for English (US):
// a plain 0.8 means 0.8" (the exam papers give every margin and indent in inches).
type Dimension = "length" | "inches" | "points" | "plain";
const TO_CM: Record<string, number> = { cm: 1, mm: 0.1, in: 2.54, '"': 2.54, pt: 2.54 / 72, pc: 2.54 / 6 };
const TO_PT: Record<string, number> = { pt: 1, in: 72, '"': 72, cm: 72 / 2.54, mm: 72 / 25.4, pc: 12 };
function parseMeasure(text: string, dimension: Dimension): number | null {
  const match = /^\s*(-?\d*\.?\d+)\s*(cm|mm|in|"|pt|pc)?\s*$/i.exec(text.replace(",", "."));
  if (!match) return null;
  const amount = Number(match[1]);
  const unit = (match[2] ?? "").toLowerCase();
  if (dimension === "inches") return amount * (unit ? TO_CM[unit] : 2.54);
  if (!unit || dimension === "plain") return amount;
  return amount * (dimension === "length" ? TO_CM[unit] : TO_PT[unit]);
}
const formatNumber = (value: number, decimals: number) => String(Number(value.toFixed(decimals)));

function Number13({ value, onChange, unit = "", dimension = "plain", step = 1, min = 0, max = 1000, decimals = 2, disabled, label, width = 78, blankWhenEmpty }: {
  value: number | null; onChange: (value: number | null) => void; unit?: string; dimension?: Dimension; step?: number; min?: number; max?: number; decimals?: number; disabled?: boolean; label: string; width?: number; blankWhenEmpty?: boolean;
}) {
  const inches = dimension === "inches";
  const show = (current: number | null) => (current === null ? "" : inches ? `${formatNumber(current / 2.54, decimals)}"` : `${formatNumber(current, decimals)}${unit ? ` ${unit}` : ""}`);
  const [text, setText] = useState(() => show(value));
  const [editing, setEditing] = useState(false);
  useEffect(() => { if (!editing) setText(show(value)); }, [value, editing]); // eslint-disable-line react-hooks/exhaustive-deps
  const clamp = (number: number) => Math.min(max, Math.max(min, number));
  // with inches the step is in inches (0.1" a click, as in Word)
  const spin = (direction: 1 | -1) => { const next = clamp((value ?? 0) + direction * step * (inches ? 2.54 : 1)); onChange(Number(next.toFixed(decimals + 2))); setText(show(next)); };
  return (
    <span className="w13-spin" style={{ width }}>
      <input aria-label={label} inputMode="decimal" disabled={disabled} value={blankWhenEmpty && value === null ? "" : text} placeholder=""
        onFocus={() => setEditing(true)}
        onChange={event => { setText(event.target.value); const parsed = parseMeasure(event.target.value, dimension); if (parsed !== null) onChange(clamp(parsed)); }}
        onBlur={() => { setEditing(false); const parsed = parseMeasure(text, dimension); if (parsed === null) { setText(show(value)); return; } const next = clamp(parsed); onChange(next); setText(show(next)); }}
        onKeyDown={event => { if (event.key === "ArrowUp") { event.preventDefault(); spin(1); } else if (event.key === "ArrowDown") { event.preventDefault(); spin(-1); } else if (event.key === "Enter") { (event.target as HTMLInputElement).blur(); } }} />
      <span className="w13-spin-buttons">
        <button type="button" tabIndex={-1} aria-label={`Increase ${label}`} disabled={disabled} onMouseDown={event => event.preventDefault()} onClick={() => spin(1)}>▲</button>
        <button type="button" tabIndex={-1} aria-label={`Decrease ${label}`} disabled={disabled} onMouseDown={event => event.preventDefault()} onClick={() => spin(-1)}>▼</button>
      </span>
    </span>
  );
}

// ---- Fixed-position pop-up menu (opens above or below its button, clamped to the screen) ----
function useMenu() {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLElement | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<CSSProperties>({ visibility: "hidden" });
  useLayoutEffect(() => {
    if (!open) { setStyle({ visibility: "hidden" }); return; }
    const button = buttonRef.current?.getBoundingClientRect(), menu = menuRef.current;
    if (!button || !menu) return;
    // scrollHeight leaves out the border, and max-height (border-box) includes it: without it every menu got a needless scrollbar
    const height = Math.min(menu.scrollHeight + menu.offsetHeight - menu.clientHeight, window.innerHeight - 16), width = menu.offsetWidth;
    const below = window.innerHeight - button.bottom - 8, above = button.top - 8;
    const openUp = height > below && above > below;
    const top = openUp ? Math.max(8, button.top - height - 1) : Math.min(button.bottom + 1, window.innerHeight - height - 8);
    // A menu moved up to fit is limited by the room from where it now starts, not the room below the button.
    setStyle({ left: Math.max(8, Math.min(button.left, window.innerWidth - width - 8)), top, maxHeight: openUp ? Math.min(height, above) : Math.min(height, window.innerHeight - top - 8), visibility: "visible" });
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const down = (event: MouseEvent) => { const target = event.target as Node; if (menuRef.current?.contains(target) || buttonRef.current?.contains(target)) return; setOpen(false); };
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") { event.stopPropagation(); setOpen(false); } };
    document.addEventListener("mousedown", down, true);
    document.addEventListener("keydown", key, true);
    return () => { document.removeEventListener("mousedown", down, true); document.removeEventListener("keydown", key, true); };
  }, [open]);
  return { open, setOpen, buttonRef, menuRef, style };
}

function MenuButton13({ label, items, onPick, caret = true, disabled }: { label: ReactNode; items: { id: string; label: ReactNode; disabled?: boolean; title?: string }[]; onPick: (id: string) => void; caret?: boolean; disabled?: boolean }) {
  const menu = useMenu();
  return (
    <>
      <button ref={element => { menu.buttonRef.current = element; }} type="button" className="w13-btn" disabled={disabled} aria-haspopup="menu" aria-expanded={menu.open} onMouseDown={event => event.preventDefault()} onClick={() => menu.setOpen(value => !value)}>{label}{caret ? " ▾" : ""}</button>
      {menu.open && createPortal(<div ref={menu.menuRef} role="menu" className="w13-menu" style={menu.style}>
        {items.map(item => <button key={item.id} type="button" role="menuitem" disabled={item.disabled} title={item.title} onMouseDown={event => event.preventDefault()} onClick={() => { menu.setOpen(false); onPick(item.id); }}>{item.label}</button>)}
      </div>, document.body)}
    </>
  );
}

// ---- Colour drop-down: a palette, like Word 2013 ----
// Reported: the Font dialog's colour drop-downs were a long list of names.
// Word shows a palette of swatches (Automatic, then Standard Colors), each
// swatch naming its colour only in a tooltip, and the closed drop-down shows
// a bar of the chosen colour.
const COLOR_CHOICES = [
  { name: "Dark Red", value: "#c00000" }, { name: "Red", value: "#ff0000" }, { name: "Orange", value: "#ffc000" }, { name: "Yellow", value: "#ffff00" },
  { name: "Light Green", value: "#92d050" }, { name: "Green", value: "#00b050" }, { name: "Light Blue", value: "#00b0f0" }, { name: "Blue", value: "#0070c0" },
  { name: "Dark Blue", value: "#002060" }, { name: "Purple", value: "#7030a0" }, { name: "Pink", value: "#ff00ff" },
];
function ColorSelect13({ value, onChange, autoLabel = "Automatic", width = 112, disabled, label }: { value: string; onChange: (value: string) => void; autoLabel?: string; width?: number; disabled?: boolean; label: string }) {
  const menu = useMenu();
  const current = COLOR_CHOICES.find(item => item.value.toLowerCase() === value.toLowerCase());
  const pick = (next: string) => { menu.setOpen(false); onChange(next); };
  return (
    <>
      <button ref={element => { menu.buttonRef.current = element; }} type="button" aria-label={label} aria-haspopup="menu" disabled={disabled} className="w13-select" title={value ? current?.name ?? value : autoLabel} style={{ width, textAlign: "left", cursor: "default" }}
        onMouseDown={event => event.preventDefault()} onClick={() => menu.setOpen(open => !open)}>{value ? <span aria-hidden style={{ display: "inline-block", width: width - 34, height: 12, border: "1px solid #666", verticalAlign: "-2px", background: value }} /> : autoLabel}</button>
      {menu.open && createPortal(<div ref={menu.menuRef} role="menu" aria-label={`${label} palette`} className="w13-menu" style={{ ...menu.style, padding: 4, width: 198, overflowX: "hidden" }}>
        <button type="button" role="menuitem" onMouseDown={event => event.preventDefault()} onClick={() => pick("")} style={{ padding: "3px 6px", width: "100%" }}>
          <span aria-hidden style={{ display: "inline-block", width: 14, height: 14, marginRight: 8, border: "1px solid #666", background: "#000", verticalAlign: "-3px" }} />{autoLabel}</button>
        <div className="w13-note" style={{ margin: "6px 4px 4px", fontWeight: 600, color: "#333" }}>Standard Colors</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(10, 16px)", gap: 2, padding: "0 4px 2px" }}>
          {COLOR_CHOICES.map(item => <button key={item.value} type="button" role="menuitemradio" title={item.name} aria-label={item.name} aria-checked={item.value.toLowerCase() === value.toLowerCase()}
            onMouseDown={event => event.preventDefault()} onClick={() => pick(item.value)}
            style={{ width: 16, height: 16, padding: 0, background: item.value, border: item.value.toLowerCase() === value.toLowerCase() ? "2px solid #e37300" : "1px solid #a0a0a0" }} />)}
        </div>
      </div>, document.body)}
    </>
  );
}

const UNDERLINE_CHOICES: [string, string][] = [["none", "(none)"], ["single", "Single"], ["words-only", "Words only"], ["double", "Double"], ["thick", "Thick"], ["dotted", "Dotted"], ["dashed", "Dashed"], ["dot-dash", "Dot-dash"], ["dot-dot-dash", "Dot-dot-dash"], ["wavy", "Wavy"]];

// Word 2013's Underline style drop-down draws each line rather than naming it
// ("(none)" and "Words only" are the only text entries). Names stay as tooltips
// and accessible labels.
function UnderlineSample13({ id }: { id: string }) {
  if (id === "none" || id === "words-only") return <span>{UNDERLINE_CHOICES.find(([key]) => key === id)?.[1]}</span>;
  const line = (y: number, extra: Record<string, string | number> = {}) => <line x1="2" x2="88" y1={y} y2={y} stroke="#000" strokeWidth={1} {...extra} />;
  return (
    <svg aria-hidden width="90" height="10" viewBox="0 0 90 10" style={{ display: "block" }}>
      {id === "single" && line(5)}
      {id === "double" && <>{line(3.5)}{line(6.5)}</>}
      {id === "thick" && line(5, { strokeWidth: 2.5 })}
      {id === "dotted" && line(5, { strokeDasharray: "1 2" })}
      {id === "dashed" && line(5, { strokeDasharray: "5 3" })}
      {id === "dot-dash" && line(5, { strokeDasharray: "1 2 6 2" })}
      {id === "dot-dot-dash" && line(5, { strokeDasharray: "1 2 1 2 6 2" })}
      {id === "wavy" && <path d="M2 5 q2 -3 4 0 t4 0 t4 0 t4 0 t4 0 t4 0 t4 0 t4 0 t4 0 t4 0 t4 0 t4 0 t4 0 t4 0 t4 0 t4 0 t4 0 t4 0 t4 0 t4 0 t4 0" fill="none" stroke="#000" strokeWidth={1} />}
    </svg>
  );
}
function UnderlineSelect13({ value, onChange, width = 125 }: { value: string; onChange: (value: string) => void; width?: number }) {
  const menu = useMenu();
  const name = UNDERLINE_CHOICES.find(([key]) => key === value)?.[1] ?? "(none)";
  return (
    <>
      <button ref={element => { menu.buttonRef.current = element; }} type="button" aria-label="Underline style" aria-haspopup="listbox" title={name} className="w13-select" style={{ width, textAlign: "left", cursor: "default", display: "flex", alignItems: "center", overflow: "hidden" }}
        onMouseDown={event => event.preventDefault()} onClick={() => menu.setOpen(open => !open)}><UnderlineSample13 id={value} /></button>
      {menu.open && createPortal(<div ref={menu.menuRef} role="listbox" aria-label="Underline styles" className="w13-menu" style={{ ...menu.style, width: width + 10 }}>
        {UNDERLINE_CHOICES.map(([id, label]) => <button key={id} type="button" role="option" aria-label={label} title={label} aria-selected={id === value}
          onMouseDown={event => event.preventDefault()} onClick={() => { menu.setOpen(false); onChange(id); }}
          style={{ padding: "4px 8px", display: "flex", alignItems: "center", minHeight: 20, background: id === value ? "#c9dcf0" : undefined }}><UnderlineSample13 id={id} /></button>)}
      </div>, document.body)}
    </>
  );
}

// =====================================================================
// Paragraph
// =====================================================================
export type ParagraphValues = { alignment: string; marginLeft: string; marginRight: string; specialIndentMode: string; specialIndentAmount: string; spaceBefore: string; spaceAfter: string; lineSpacing: string; hyphens: boolean; lineNumbers: boolean };
const IN_TO_CM = 2.54;

export function ParagraphDialog2013({ values: initial, onSubmit }: { values: ParagraphValues; onSubmit: (values: ParagraphValues) => void }) {
  const chrome = useContext(Word13Chrome);
  const [values, setValues] = useState(initial);
  const [tab, setTab] = useState("indents");
  const set = <K extends keyof ParagraphValues>(key: K, value: ParagraphValues[K]) => setValues(current => ({ ...current, [key]: value }));
  const cm = (inches: string) => (Number(inches) || 0) * IN_TO_CM;
  const asInches = (centimetres: number | null) => String(Number((((centimetres ?? 0) / IN_TO_CM)).toFixed(4)));
  const spacing = Number(values.lineSpacing) || 1;
  const lineMode = spacing === 1 ? "single" : spacing === 1.5 ? "onehalf" : spacing === 2 ? "double" : "multiple";
  const [multipleChosen, setMultipleChosen] = useState(lineMode === "multiple");
  const effectiveMode = multipleChosen ? "multiple" : lineMode;
  const alignment = (["left", "center", "right", "justify"] as const).includes(values.alignment as "left") ? (values.alignment as "left" | "center" | "right" | "justify") : "left";
  const leftCm = cm(values.marginLeft), rightCm = cm(values.marginRight), byCm = cm(values.specialIndentAmount);
  const special = values.specialIndentMode === "none" ? 0 : values.specialIndentMode === "hanging" ? -byCm : byCm;
  const sampleStyle: CSSProperties = { textAlign: alignment, marginLeft: Math.max(0, leftCm) * 6, marginRight: Math.max(0, rightCm) * 6, textIndent: special * 6, lineHeight: spacing, marginTop: Math.min(30, (Number(values.spaceBefore) || 0) * 0.6), marginBottom: Math.min(30, (Number(values.spaceAfter) || 0) * 0.6) };
  const sample = "Sample Text Sample Text Sample Text Sample Text Sample Text Sample Text Sample Text Sample Text Sample Text Sample Text Sample Text Sample Text Sample Text";
  return (
    <Window13 title="Paragraph" width={440}>
      <Tabs13 tabs={[{ id: "indents", label: "Indents and Spacing" }, { id: "breaks", label: "Line and Page Breaks" }]} value={tab} onChange={setTab} />
      <div className="w13-panel" style={{ minHeight: 400 }}>
        {tab === "indents" && <>
          <Group13>General</Group13>
          <div className="w13-row" style={{ marginLeft: 12 }}><span className="w13-label" style={{ width: 80 }}>Alignment:</span>
            <select className="w13-select" aria-label="Alignment" style={{ width: 118 }} value={values.alignment} onChange={event => set("alignment", event.target.value)}><option value="left">Left</option><option value="center">Centered</option><option value="right">Right</option><option value="justify">Justified</option></select></div>
          <div className="w13-row" style={{ marginLeft: 12 }}><span className="w13-label" style={{ width: 80 }}>Outline level:</span>
            <select className="w13-select" aria-label="Outline level" style={{ width: 118 }} disabled title="Outline levels are not used in this exam editor."><option>Body Text</option></select>
            <Check13 checked={false} disabled>Collapsed by default</Check13></div>
          <Group13>Indentation</Group13>
          <div style={{ display: "grid", gridTemplateColumns: "56px 100px 1fr", gap: "6px 8px", alignItems: "center", marginLeft: 12 }}>
            <span>Left:</span><Number13 label="Left indent" value={leftCm} dimension="inches" step={0.1} min={0} max={25} onChange={n => set("marginLeft", asInches(n))} />
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 52 }}>Special:</span><span style={{ flex: 1 }} /><span>By:</span></div>
            <span>Right:</span><Number13 label="Right indent" value={rightCm} dimension="inches" step={0.1} min={0} max={25} onChange={n => set("marginRight", asInches(n))} />
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <select className="w13-select" aria-label="Special indent" style={{ width: 118 }} value={values.specialIndentMode} onChange={event => { const mode = event.target.value; setValues(current => ({ ...current, specialIndentMode: mode, specialIndentAmount: mode === "none" ? "0" : Number(current.specialIndentAmount) > 0 ? current.specialIndentAmount : "0.5" })); }}><option value="none">(none)</option><option value="firstLine">First line</option><option value="hanging">Hanging</option></select>
              <Number13 label="Special indent by" value={values.specialIndentMode === "none" ? null : byCm} blankWhenEmpty dimension="inches" step={0.1} min={0} max={25} disabled={values.specialIndentMode === "none"} width={70} onChange={n => set("specialIndentAmount", asInches(n))} />
            </div>
            <span />
            <div style={{ gridColumn: "2 / span 2" }}><Check13 checked={false} disabled title="Mirror indents are not used in this exam editor.">Mirror indents</Check13></div>
          </div>
          <Group13>Spacing</Group13>
          <div style={{ display: "grid", gridTemplateColumns: "56px 78px 140px 1fr", gap: "6px 8px", alignItems: "center", marginLeft: 12 }}>
            <span>Before:</span><Number13 label="Space before" value={Number(values.spaceBefore) || 0} unit="pt" dimension="points" step={6} min={0} max={500} decimals={1} onChange={n => set("spaceBefore", String(n ?? 0))} />
            <span style={{ paddingLeft: 12 }}>Line spacing:</span><span style={{ paddingLeft: 12 }}>At:</span>
            <span>After:</span><Number13 label="Space after" value={Number(values.spaceAfter) || 0} unit="pt" dimension="points" step={6} min={0} max={500} decimals={1} onChange={n => set("spaceAfter", String(n ?? 0))} />
            <select className="w13-select" aria-label="Line spacing" style={{ width: 118, marginLeft: 12 }} value={effectiveMode} onChange={event => { const mode = event.target.value; setMultipleChosen(mode === "multiple"); if (mode === "single") set("lineSpacing", "1"); else if (mode === "onehalf") set("lineSpacing", "1.5"); else if (mode === "double") set("lineSpacing", "2"); else if (spacing === 1 || spacing === 1.5 || spacing === 2) set("lineSpacing", "1.08"); }}>
              <option value="single">Single</option><option value="onehalf">1.5 lines</option><option value="double">Double</option><option value="multiple">Multiple</option></select>
            <div style={{ paddingLeft: 12 }}><Number13 label="Line spacing at" value={effectiveMode === "multiple" ? spacing : null} blankWhenEmpty step={0.1} min={0.5} max={10} decimals={2} width={70} disabled={effectiveMode !== "multiple"} onChange={n => set("lineSpacing", String(n ?? 1))} /></div>
          </div>
          <div style={{ margin: "8px 0 0 12px" }}><Check13 checked={false} disabled title="Paragraph styles are not used in this exam editor.">Don&apos;t add space between paragraphs of the same style</Check13></div>
          <Group13>Preview</Group13>
          <div className="w13-preview" style={{ height: 88, overflow: "hidden", padding: "6px 8px", fontSize: 8, color: "#999" }}>
            <div>Previous Paragraph Previous Paragraph Previous Paragraph Previous Paragraph Previous Paragraph Previous Paragraph</div>
            <div style={{ ...sampleStyle, color: "#222" }}>{sample}</div>
            <div>Following Paragraph Following Paragraph Following Paragraph Following Paragraph Following Paragraph Following Paragraph</div>
          </div>
        </>}
        {tab === "breaks" && <>
          <Group13>Pagination</Group13>
          <div style={{ marginLeft: 12, display: "grid", gap: 5 }}>
            <Check13 checked disabled title="Pagination is not used in this exam editor.">Widow/Orphan control</Check13>
            <Check13 checked={false} disabled>Keep with next</Check13><Check13 checked={false} disabled>Keep lines together</Check13><Check13 checked={false} disabled>Page break before</Check13>
          </div>
          <Group13>Formatting exceptions</Group13>
          <div style={{ marginLeft: 12, display: "grid", gap: 5 }}>
            <Check13 checked={!values.lineNumbers} onChange={checked => set("lineNumbers", !checked)}>Suppress line numbers</Check13>
            <Check13 checked={!values.hyphens} onChange={checked => set("hyphens", !checked)}>Don&apos;t hyphenate</Check13>
          </div>
        </>}
      </div>
      <div className="w13-footer">
        <Button13 disabled title="Tab stops are not used in this exam editor.">Tabs…</Button13>
        <span style={{ flex: 1 }}><Button13 disabled title="Not available in this exam editor.">Set As Default</Button13></span>
        <div className="w13-footer-right"><Button13 isDefault onClick={() => onSubmit(values)}>OK</Button13><Button13 onClick={chrome?.onClose}>Cancel</Button13></div>
      </div>
    </Window13>
  );
}

// =====================================================================
// Font
// =====================================================================
export type FontValues = {
  bold: boolean; italic: boolean; fontFamily: string; fontSize: string; color: string; underlineStyle: string; underlineColor: string;
  strike: boolean; doubleStrike: boolean; superscript: boolean; subscript: boolean; smallCaps: boolean; allCaps: boolean; hidden: boolean;
  outline: boolean; emboss: boolean; charScale: string; charSpacing: string; charPosition: string; kerningEnabled: boolean; kerningMin: string;
};
const FONT_SIZES = WORD_FONT_SIZE_LIST;
const themeLabel = (font: string) => (font === "Calibri Light (Headings)" ? "+Headings" : font === "Calibri (Body)" ? "+Body" : font);

function ListBox13({ items, value, onPick, label }: { items: { id: string; label: string }[]; value: string; onPick: (id: string) => void; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" }); }, [value]);
  return (
    <div ref={ref} className="w13-list" role="listbox" aria-label={label} tabIndex={0} onKeyDown={event => {
      const index = items.findIndex(item => item.id === value);
      if (event.key === "ArrowDown" && index < items.length - 1) { event.preventDefault(); onPick(items[index + 1].id); }
      if (event.key === "ArrowUp" && index > 0) { event.preventDefault(); onPick(items[index - 1].id); }
    }}>
      {items.map(item => <button key={item.id} type="button" role="option" tabIndex={-1} aria-selected={item.id === value} onMouseDown={event => event.preventDefault()} onClick={() => onPick(item.id)}>{item.label}</button>)}
    </div>
  );
}

export function FontDialog2013({ values: initial, onSubmit, title = "Font" }: { values: FontValues; onSubmit: (values: FontValues) => void; title?: string }) {
  const chrome = useContext(Word13Chrome);
  const [values, setValues] = useState(initial);
  const [tab, setTab] = useState("font");
  const [effectsOpen, setEffectsOpen] = useState(false);
  const set = <K extends keyof FontValues>(key: K, value: FontValues[K]) => setValues(current => ({ ...current, [key]: value }));
  const fonts = [...WORD_THEME_FONTS.map(font => font as string), ...APPROVED_WORD_FONTS.filter(font => !(WORD_THEME_FONTS as readonly string[]).includes(font))];
  const fontItems = fonts.map(font => ({ id: font, label: themeLabel(font) }));
  const [fontText, setFontText] = useState(values.fontFamily ? themeLabel(values.fontFamily) : "");
  const [sizeText, setSizeText] = useState(values.fontSize);
  const style = values.bold && values.italic ? "Bold Italic" : values.bold ? "Bold" : values.italic ? "Italic" : "Regular";
  const [styleText, setStyleText] = useState(style);
  const pickStyle = (name: string) => { setStyleText(name); setValues(current => ({ ...current, bold: name === "Bold" || name === "Bold Italic", italic: name === "Italic" || name === "Bold Italic" })); };
  const pickFont = (font: string) => { setFontText(themeLabel(font)); set("fontFamily", font); };
  const typedFont = (text: string) => {
    setFontText(text);
    const found = fonts.find(font => themeLabel(font).toLowerCase() === text.trim().toLowerCase()) ?? fonts.find(font => themeLabel(font).toLowerCase().startsWith(text.trim().toLowerCase()) && text.trim());
    if (found) set("fontFamily", found);
  };
  const pickSize = (size: string) => { setSizeText(size); set("fontSize", size); };
  // Word accepts any size from 1 to 1638 pt in half points (1.5, 18.5, 1000.5 ...).
  const typedSize = (text: string) => { setSizeText(text); const number = wordFontSize(text); if (number !== null) set("fontSize", String(number)); };
  // Spacing / Position keep the mode the student picked. It used to be worked out from the number,
  // so typing "0.5" into By: went through 0 first -> mode "Normal" -> the By box was disabled under
  // the student's fingers and the rest of the number was lost (EFFICIENCY TEST 3, Q4).
  const spacingNumber = Number(values.charSpacing) || 0;
  const [spacingMode, setSpacingMode] = useState<"normal" | "expanded" | "condensed">(spacingNumber > 0 ? "expanded" : spacingNumber < 0 ? "condensed" : "normal");
  const positionNumber = Number(values.charPosition) || 0;
  const [positionMode, setPositionMode] = useState<"normal" | "raised" | "lowered">(positionNumber > 0 ? "raised" : positionNumber < 0 ? "lowered" : "normal");
  const underlined = values.underlineStyle !== "none";
  const previewName = values.fontFamily ? themeLabel(values.fontFamily) : "+Body";
  const theme = values.fontFamily === "" || (WORD_THEME_FONTS as readonly string[]).includes(values.fontFamily);
  const previewStyle: CSSProperties = {
    fontFamily: values.fontFamily ? values.fontFamily.replace(/ \((Headings|Body)\)$/u, "") : "Calibri", fontSize: Math.min(22, Math.max(10, Number(values.fontSize) || 11)), fontWeight: values.bold ? 700 : 400, fontStyle: values.italic ? "italic" : "normal",
    fontVariant: values.smallCaps ? "small-caps" : "normal", textTransform: values.allCaps ? "uppercase" : "none", color: values.outline ? "transparent" : values.color || "#000", WebkitTextStroke: values.outline ? `1px ${values.color || "#000"}` : undefined,
    textShadow: values.emboss ? "1px 1px 0 rgba(255,255,255,.85),-1px -1px 0 rgba(0,0,0,.55)" : undefined, opacity: values.hidden ? 0.4 : 1,
    // Underline only here: its style and colour belong to the underline alone.
    // The strikethrough is drawn by the inner span below in the font colour --
    // one shared text-decoration made a double strikethrough take the
    // underline's colour (red) and the underline take the strikethrough's style.
    textDecorationLine: underlined ? "underline" : "none",
    textDecorationStyle: values.underlineStyle === "double" ? "double" : values.underlineStyle === "dotted" ? "dotted" : values.underlineStyle === "dashed" || values.underlineStyle.startsWith("dot-") ? "dashed" : values.underlineStyle === "wavy" ? "wavy" : "solid",
    textDecorationThickness: values.underlineStyle === "thick" ? 2 : undefined,
    textDecorationColor: values.underlineColor || undefined, letterSpacing: `${spacingNumber}pt`, display: "inline-block", transform: `scaleX(${(Number(values.charScale) || 100) / 100})`, position: "relative", top: `${-positionNumber}pt`,
    verticalAlign: values.superscript ? "super" : values.subscript ? "sub" : "baseline",
  };
  return (
    <Window13 title={title} width={514}>
      <Tabs13 tabs={[{ id: "font", label: <span><u>F</u>ont</span> }, { id: "advanced", label: <span>Ad<u>v</u>anced</span> }]} value={tab} onChange={setTab} />
      <div className="w13-panel" style={{ minHeight: 410, position: "relative" }}>
        {tab === "font" && <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 108px 56px", gap: 12, marginTop: 6 }}>
            <div><div style={{ marginBottom: 2 }}><u>F</u>ont:</div><input className="w13-field" aria-label="Font" style={{ width: "100%", marginBottom: 2 }} value={fontText} onChange={event => typedFont(event.target.value)} /><ListBox13 label="Font list" items={fontItems} value={values.fontFamily} onPick={pickFont} /></div>
            <div><div style={{ marginBottom: 2 }}>Font st<u>y</u>le:</div><input className="w13-field" aria-label="Font style" style={{ width: "100%", marginBottom: 2 }} value={styleText} readOnly /><ListBox13 label="Font style list" items={["Regular", "Italic", "Bold", "Bold Italic"].map(name => ({ id: name, label: name }))} value={style} onPick={pickStyle} /></div>
            <div><div style={{ marginBottom: 2 }}>&nbsp;<u>S</u>ize:</div><input className="w13-field" aria-label="Font size" style={{ width: "100%", marginBottom: 2 }} value={sizeText} onChange={event => typedSize(event.target.value)} /><ListBox13 label="Font size list" items={FONT_SIZES.map(size => ({ id: String(size), label: String(size) }))} value={values.fontSize} onPick={pickSize} /></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "125px 125px 1fr", gap: 14, marginTop: 14, alignItems: "end" }}>
            <div><div style={{ marginBottom: 2 }}>Font <u>c</u>olor:</div><ColorSelect13 label="Font color" value={/^#(000000|020618)$/i.test(values.color) ? "" : values.color} onChange={value => set("color", value || "#000000")} width={125} /></div>
            <div><div style={{ marginBottom: 2 }}><u>U</u>nderline style:</div>
              <UnderlineSelect13 value={values.underlineStyle} onChange={value => set("underlineStyle", value)} /></div>
            <div><div style={{ marginBottom: 2, color: underlined ? undefined : "#8a8a8a" }}>Underline c<u>o</u>lor:</div><ColorSelect13 label="Underline color" value={values.underlineColor} onChange={value => set("underlineColor", value)} width={125} disabled={!underlined} /></div>
          </div>
          <Group13>Effects</Group13>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 20px", marginLeft: 8 }}>
            <Check13 checked={values.strike} onChange={checked => setValues(current => ({ ...current, strike: checked, doubleStrike: checked ? false : current.doubleStrike }))}>Stri<u>k</u>ethrough</Check13>
            <Check13 checked={values.smallCaps} onChange={checked => setValues(current => ({ ...current, smallCaps: checked, allCaps: checked ? false : current.allCaps }))}>Small caps</Check13>
            <Check13 checked={values.doubleStrike} onChange={checked => setValues(current => ({ ...current, doubleStrike: checked, strike: checked ? false : current.strike }))}>Do<u>u</u>ble strikethrough</Check13>
            <Check13 checked={values.allCaps} onChange={checked => setValues(current => ({ ...current, allCaps: checked, smallCaps: checked ? false : current.smallCaps }))}>All caps</Check13>
            <Check13 checked={values.superscript} onChange={checked => setValues(current => ({ ...current, superscript: checked, subscript: checked ? false : current.subscript }))}>Su<u>p</u>erscript</Check13>
            <Check13 checked={values.hidden} onChange={checked => set("hidden", checked)}><u>H</u>idden</Check13>
            <Check13 checked={values.subscript} onChange={checked => setValues(current => ({ ...current, subscript: checked, superscript: checked ? false : current.superscript }))}>Sub<u>s</u>cript</Check13>
          </div>
          <Group13>Preview</Group13>
          <div className="w13-preview" style={{ display: "flex", height: 62, alignItems: "center", justifyContent: "center", overflow: "hidden" }}><span style={previewStyle}>{values.strike || values.doubleStrike ? <span style={{ textDecorationLine: "line-through", textDecorationStyle: values.doubleStrike ? "double" : "solid", textDecorationColor: "currentColor" }}>{previewName}</span> : previewName}</span></div>
          <p className="w13-note" style={{ margin: "6px 0 0" }}>{theme ? `This is the ${values.fontFamily === "Calibri Light (Headings)" ? "headings" : "body"} theme font. The current document theme defines which font will be used.` : "This is a TrueType font. This font will be used on both printer and screen."}</p>
        </>}
        {tab === "advanced" && <>
          <Group13>Character Spacing</Group13>
          <div style={{ display: "grid", gridTemplateColumns: "70px 120px 40px 80px", gap: "8px 8px", alignItems: "center", marginLeft: 8 }}>
            <span>S<u>c</u>ale:</span><select className="w13-select" aria-label="Scale" style={{ width: 120 }} value={values.charScale} onChange={event => set("charScale", event.target.value)}>{["200", "150", "100", "90", "80", "66", "50", "33", "25"].map(preset => <option key={preset} value={preset}>{preset}%</option>)}</select><span /><span />
            <span>S<u>p</u>acing:</span>
            <select className="w13-select" aria-label="Spacing" style={{ width: 120 }} value={spacingMode} onChange={event => { const mode = event.target.value as typeof spacingMode; setSpacingMode(mode); const magnitude = Math.abs(spacingNumber) || 1; set("charSpacing", event.target.value === "normal" ? "0" : String(event.target.value === "condensed" ? -magnitude : magnitude)); }}><option value="normal">Normal</option><option value="expanded">Expanded</option><option value="condensed">Condensed</option></select>
            <span>B<u>y</u>:</span><Number13 label="Spacing by" value={spacingMode === "normal" ? null : Math.abs(spacingNumber)} blankWhenEmpty unit="pt" dimension="points" step={0.1} min={0} max={100} decimals={1} disabled={spacingMode === "normal"} onChange={n => set("charSpacing", String(spacingMode === "condensed" ? -(n ?? 0) : n ?? 0))} />
            <span>Posi<u>t</u>ion:</span>
            <select className="w13-select" aria-label="Position" style={{ width: 120 }} value={positionMode} onChange={event => { const mode = event.target.value as typeof positionMode; setPositionMode(mode); const magnitude = Math.abs(positionNumber) || 3; set("charPosition", event.target.value === "normal" ? "0" : String(event.target.value === "lowered" ? -magnitude : magnitude)); }}><option value="normal">Normal</option><option value="raised">Raised</option><option value="lowered">Lowered</option></select>
            <span>By:</span><Number13 label="Position by" value={positionMode === "normal" ? null : Math.abs(positionNumber)} blankWhenEmpty unit="pt" dimension="points" step={0.5} min={0} max={100} decimals={1} disabled={positionMode === "normal"} onChange={n => set("charPosition", String(positionMode === "lowered" ? -(n ?? 0) : n ?? 0))} />
          </div>
          <div style={{ margin: "12px 0 0 8px", display: "flex", alignItems: "center", gap: 8 }}>
            <Check13 checked={values.kerningEnabled} onChange={checked => set("kerningEnabled", checked)}><u>K</u>erning for fonts:</Check13>
            <Number13 label="Kerning points and above" value={Number(values.kerningMin) || 0} unit="" step={1} min={0} max={72} decimals={0} width={64} disabled={!values.kerningEnabled} onChange={n => set("kerningMin", String(n ?? 0))} /><span>Points and above</span>
          </div>
          <Group13>Preview</Group13>
          <div className="w13-preview" style={{ display: "flex", height: 62, alignItems: "center", justifyContent: "center", overflow: "hidden" }}><span style={previewStyle}>{values.strike || values.doubleStrike ? <span style={{ textDecorationLine: "line-through", textDecorationStyle: values.doubleStrike ? "double" : "solid", textDecorationColor: "currentColor" }}>{previewName}</span> : previewName}</span></div>
        </>}
        {effectsOpen && <div className="w13" style={{ position: "absolute", right: 12, bottom: 12, width: 210, zIndex: 5 }}>
          <div className="w13-title"><span>Text Effects</span></div>
          <div className="w13-body" style={{ display: "grid", gap: 6 }}>
            <Check13 checked={values.outline} onChange={checked => set("outline", checked)}>Outline</Check13>
            <Check13 checked={values.emboss} onChange={checked => set("emboss", checked)}>Emboss</Check13>
            <div className="w13-footer" style={{ marginTop: 4, justifyContent: "flex-end" }}><Button13 isDefault onClick={() => setEffectsOpen(false)}>OK</Button13></div>
          </div>
        </div>}
      </div>
      <div className="w13-footer">
        <div style={{ display: "flex", gap: 8 }}><Button13 disabled title="Not available in this exam editor.">Set As Default</Button13><Button13 onClick={() => setEffectsOpen(open => !open)}>Text Effects…</Button13></div>
        <div className="w13-footer-right"><Button13 isDefault onClick={() => onSubmit(values)}>OK</Button13><Button13 onClick={chrome?.onClose}>Cancel</Button13></div>
      </div>
    </Window13>
  );
}

// =====================================================================
// Find and Replace
// =====================================================================
const SPECIAL_MENU: { id: string; label: string; code: string }[] = [
  { id: "p", label: "Paragraph Mark", code: "^p" }, { id: "t", label: "Tab Character", code: "^t" }, { id: "?", label: "Any Character", code: "^?" }, { id: "#", label: "Any Digit", code: "^#" },
  { id: "$", label: "Any Letter", code: "^$" }, { id: "^", label: "Caret Character", code: "^^" }, { id: "%", label: "§ Section Character", code: "^%" }, { id: "v", label: "¶ Paragraph Character", code: "^v" },
  { id: "n", label: "Column Break", code: "^n" }, { id: "+", label: "Em Dash", code: "^+" }, { id: "=", label: "En Dash", code: "^=" }, { id: "e", label: "Endnote Mark", code: "^e" },
  { id: "d", label: "Field", code: "^d" }, { id: "f", label: "Footnote Mark", code: "^f" }, { id: "g", label: "Graphic", code: "^g" }, { id: "l", label: "Manual Line Break", code: "^l" },
  { id: "m", label: "Manual Page Break", code: "^m" }, { id: "~", label: "Nonbreaking Hyphen", code: "^~" }, { id: "s", label: "Nonbreaking Space", code: "^s" }, { id: "-", label: "Optional Hyphen", code: "^-" },
  { id: "b", label: "Section Break", code: "^b" }, { id: "w", label: "White Space", code: "^w" },
];
// Specials that are valid in the "Replace with" box too.
const REPLACE_SPECIALS = new Set(["p", "t", "^", "%", "v", "+", "=", "l", "m", "~", "s", "-"]);
const FORMAT_MENU = [
  { id: "font", label: "Font…" }, { id: "paragraph", label: "Paragraph…" },
  { id: "tabs", label: "Tabs…", disabled: true, title: "Tab stops are not used in this exam editor." }, { id: "language", label: "Language…", disabled: true, title: "Per-text language is not used in this exam editor." },
  { id: "frame", label: "Frame…", disabled: true, title: "Frames are not used in this exam editor." }, { id: "style", label: "Style…", disabled: true, title: "Named styles are not used in this exam editor." },
  { id: "highlight", label: "Highlight" },
];
const GOTO_KINDS: { id: string; label: string; working: boolean }[] = [
  { id: "page", label: "Page", working: true }, { id: "section", label: "Section", working: false }, { id: "line", label: "Line", working: false }, { id: "bookmark", label: "Bookmark", working: true },
  { id: "comment", label: "Comment", working: false }, { id: "footnote", label: "Footnote", working: false }, { id: "endnote", label: "Endnote", working: false }, { id: "field", label: "Field", working: false },
  { id: "table", label: "Table", working: true }, { id: "graphic", label: "Graphic", working: false }, { id: "equation", label: "Equation", working: false }, { id: "object", label: "Object", working: false }, { id: "heading", label: "Heading", working: false },
];

export type FindDialogInput = { mode: "find" | "replace" | "goto"; query: string; replacement: string; hadSelection: boolean; selectionIsQuery?: boolean; bookmarks: string[]; highlightColor?: string };
// Formatting given to the "Replace with" text (the Format menu while that box has the cursor).
// Highlight uses the ribbon's current highlight colour, as in Word.
export type ReplaceFormat = { font?: Partial<FontValues>; highlight?: string };
export const BLANK_FONT_VALUES: FontValues = { bold: false, italic: false, fontFamily: "", fontSize: "", color: "", underlineStyle: "none", underlineColor: "", strike: false, doubleStrike: false, superscript: false, subscript: false, smallCaps: false, allCaps: false, hidden: false, outline: false, emboss: false, charScale: "100", charSpacing: "0", charPosition: "0", kerningEnabled: false, kerningMin: "" };
const changedFont = (values: FontValues): Partial<FontValues> => Object.fromEntries(Object.entries(values).filter(([key, value]) => value !== BLANK_FONT_VALUES[key as keyof FontValues])) as Partial<FontValues>;
// Word writes the replace format as "Font: 24 pt, Font color: Red" -- colours by name, all the
// font settings after one "Font:" label.
const describeReplaceFormat = (format: ReplaceFormat | null) => {
  if (!format) return "";
  const font = format.font ?? {};
  const named = (hex: string | null | undefined) => colorName(hex?.replace(/^#/, "")) ?? "";
  const items = [font.fontFamily ?? "", font.fontSize ? `${font.fontSize} pt` : "", font.bold ? "Bold" : "", font.italic ? "Italic" : "", font.underlineStyle && font.underlineStyle !== "none" ? `Underline${font.underlineColor ? `, Underline color: ${named(font.underlineColor)}` : ""}` : "", font.strike ? "Strikethrough" : "", font.doubleStrike ? "Double strikethrough" : "", font.superscript ? "Superscript" : "", font.subscript ? "Subscript" : "", font.color ? `Font color: ${named(font.color)}` : ""].filter(Boolean);
  return [items.length ? `Font: ${items.join(", ")}` : "", format.highlight ? "Highlight" : ""].filter(Boolean).join(", ");
};
type Scope = "selection" | "document";

export function FindReplaceDialog2013({ dialog, onFindNext, onReplaceOne, onReplaceAll, onHighlightAll, onSelectAll, onClearHighlight, onGoTo }: {
  dialog: FindDialogInput;
  onFindNext: (needle: string, options: FindEngineOptions, scope: Scope) => string;
  onReplaceOne: (needle: string, replacement: string, options: FindEngineOptions, scope: Scope, replaceFormat: ReplaceFormat | null) => string;
  onReplaceAll: (needle: string, replacement: string, options: FindEngineOptions, scope: Scope, replaceFormat: ReplaceFormat | null) => string;
  onHighlightAll: (needle: string, options: FindEngineOptions, scope: Scope) => string;
  onSelectAll: (needle: string, options: FindEngineOptions, scope: Scope) => string;
  onClearHighlight: (keepSelection?: boolean) => void;
  onGoTo: (kind: string, value: string) => void;
}) {
  const chrome = useContext(Word13Chrome);
  const [tab, setTab] = useState<string>(dialog.mode);
  const [query, setQuery] = useState(dialog.query), [replacement, setReplacement] = useState(dialog.replacement);
  const [more, setMore] = useState(false);
  const [scope, setScope] = useState<Scope>(dialog.hadSelection && !dialog.selectionIsQuery ? "selection" : "document");
  const [options, setOptions] = useState<FindEngineOptions>(DEFAULT_ENGINE_OPTIONS);
  const [highlightOn, setHighlightOn] = useState(false);
  const [message, setMessage] = useState("");
  // Word turns Cancel into Close once a search has run.
  const [searched, setSearched] = useState(false);
  const [fontPanel, setFontPanel] = useState<"font" | "replace-font" | "paragraph" | null>(null);
  const [replaceFormat, setReplaceFormat] = useState<ReplaceFormat | null>(null);
  const [gotoKind, setGotoKind] = useState("page"), [gotoValue, setGotoValue] = useState("");
  const findRef = useRef<HTMLInputElement>(null), replaceRef = useRef<HTMLInputElement>(null);
  const focused = useRef<"find" | "replace">("find");
  const set = <K extends keyof FindEngineOptions>(key: K, value: FindEngineOptions[K]) => setOptions(current => ({ ...current, [key]: value }));
  useEffect(() => { findRef.current?.focus(); findRef.current?.select(); }, [tab]);
  useEffect(() => () => onClearHighlight(true), []); // eslint-disable-line react-hooks/exhaustive-deps
  const canRun = query.length > 0 || Boolean(options.format);
  // Every match stays highlighted while the dialog is open (as Word marks the search results),
  // updated as Find what or the options change and after each Replace.
  const [refresh, setRefresh] = useState(0);
  const [matchCount, setMatchCount] = useState("");
  // Find In just selected every match in the new scope: the live highlight (and message reset) must
  // not run over that selection and its "Word found N items" message.
  const selectedAll = useRef(false);
  // As in Word, typing in Find what highlights nothing: matches are marked only by Reading
  // Highlight > Highlight All or Find In. Once highlighting is on it follows the search and
  // is refreshed after each Replace.
  useEffect(() => {
    if (selectedAll.current) return;
    if (tab === "goto" || !canRun) { if (highlightOn) { onClearHighlight(); setHighlightOn(false); } setMatchCount(""); return; }
    if (!highlightOn) { setMatchCount(""); return; }
    const timer = setTimeout(() => { const result = onHighlightAll(query, options, scope); setMatchCount(result); }, 200);
    return () => clearTimeout(timer);
  }, [query, options, scope, tab, refresh]); // eslint-disable-line react-hooks/exhaustive-deps
  // A message from the last action (e.g. "Search text not found.") is cleared as soon as the
  // search changes, so the live match count shows again.
  useEffect(() => { if (selectedAll.current) { selectedAll.current = false; return; } setMessage(""); }, [query, options, scope, tab]);
  // As in Word, the Format menu and No Formatting act on whichever box has the cursor.
  const formatTarget = () => (tab === "replace" && focused.current === "replace" ? "replace" : "find");
  const wild = options.wildcards;
  const run = (action: "next" | "replace" | "all" | "highlight") => {
    if (!canRun) return;
    const invalid = findWhatError(query, options);
    if (invalid) { setSearched(true); setMessage(invalid); return; }
    setSearched(true);
    if (action === "next") setMessage(onFindNext(query, options, scope));
    else if (action === "replace") { setMessage(onReplaceOne(query, replacement, options, scope, replaceFormat)); setRefresh(value => value + 1); }
    else if (action === "all") { setMessage(onReplaceAll(query, replacement, options, scope, replaceFormat)); setRefresh(value => value + 1); }
    else { if (highlightOn) { onClearHighlight(); setHighlightOn(false); setMessage(""); } else { setMessage(onHighlightAll(query, options, scope)); setHighlightOn(true); } }
  };
  const insertSpecial = (id: string) => {
    const item = SPECIAL_MENU.find(entry => entry.id === id);
    if (!item) return;
    const target = tab === "replace" && focused.current === "replace" ? "replace" : "find";
    if (target === "replace") { if (!REPLACE_SPECIALS.has(id)) { setMessage(`${item.label} can only be used in Find what.`); return; } setReplacement(current => current + item.code); replaceRef.current?.focus(); }
    else { setQuery(current => current + item.code); findRef.current?.focus(); }
  };
  const pickFormat = (id: string) => {
    const target = formatTarget();
    if (id === "font") setFontPanel(target === "replace" ? "replace-font" : "font");
    else if (id === "paragraph") setFontPanel("paragraph");
    else if (id === "highlight") { if (target === "replace") setReplaceFormat(current => ({ ...(current ?? {}), highlight: dialog.highlightColor || "#FFFF00" })); else set("format", { ...(options.format ?? {}), highlight: true }); }
  };
  const fontToFind = (values: FontValues): FindFormat | null => { const changed = changedFont(values); const next: FindFormat = { ...(options.format ?? {}) }; if ("bold" in changed) next.bold = values.bold; if ("italic" in changed) next.italic = values.italic; if ("underlineStyle" in changed) next.underline = values.underlineStyle !== "none"; if ("strike" in changed) next.strike = values.strike; if (values.superscript) next.superscript = true; if (values.subscript) next.subscript = true; if (values.fontFamily) next.fontName = values.fontFamily; const size = Number(values.fontSize); if (Number.isFinite(size) && size > 0) next.fontSize = size; if (values.color) next.color = values.color.replace("#", "").toUpperCase(); return Object.keys(next).length ? next : null; };
  const replaceText = describeReplaceFormat(replaceFormat);
  const formatText = describeFormat(options.format);
  // Word lists the search options in effect under Find what ("Search Down, Match Case, Whole Words").
  const optionsText = [options.direction === "down" ? "Search Down" : options.direction === "up" ? "Search Up" : "", options.matchCase ? "Match Case" : "", options.wholeWord ? "Whole Words" : "", options.wildcards ? "Use Wildcards" : "", options.soundsLike ? "Sounds Like" : "", options.allWordForms ? "All Word Forms" : "", options.matchPrefix ? "Match Prefix" : "", options.matchSuffix ? "Match Suffix" : "", options.ignorePunctuation ? "Ignore Punctuation" : "", options.ignoreWhitespace ? "Ignore White-space" : ""].filter(Boolean).join(", ");
  const gotoDefinition = GOTO_KINDS.find(item => item.id === gotoKind);
  const runGoTo = (direction: 1 | -1 | 0) => { if (!gotoDefinition?.working) return; const next = gotoKind === "bookmark" ? gotoValue : String(Math.max(1, (Number(gotoValue) || 1) + direction)); if (direction !== 0) setGotoValue(next); onGoTo(gotoKind, next); };
  const row = (labelText: ReactNode, field: ReactNode) => <div className="w13-row" style={{ alignItems: "flex-start" }}><span className="w13-label" style={{ width: 80, paddingTop: 3 }}>{labelText}</span><div style={{ flex: 1 }}>{field}</div></div>;
  return (
    <Window13 title="Find and Replace" width={574}>
      <Tabs13 tabs={[{ id: "find", label: <span>Fin<u>d</u></span> }, { id: "replace", label: <span>R<u>e</u>place</span> }, { id: "goto", label: <span><u>G</u>o To</span> }]} value={tab} onChange={id => { setTab(id); setMessage(""); }} />
      <div className="w13-panel" style={{ minHeight: tab === "goto" ? 270 : more ? 392 : 150, position: "relative" }}>
        {tab !== "goto" && <>
          {row(<span>Fi<u>n</u>d what:</span>, <>
            <input ref={findRef} className="w13-field" aria-label="Find what" style={{ width: "100%" }} value={query} onFocus={() => { focused.current = "find"; }} onChange={event => { setQuery(event.target.value); setMessage(""); }} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); run("next"); } }} />
            {optionsText && <div style={{ marginTop: 3, display: "flex", gap: 8 }}><span className="w13-label" style={{ width: 70, marginLeft: -88 }}>Options:</span><span>{optionsText}</span></div>}
            {formatText && <div className="w13-note" style={{ marginTop: 3 }}>Format: {formatText}</div>}
            {options.wildcards && <div className="w13-note" style={{ marginTop: 3 }}>Wildcards: ? * [ ] [!x] &lt; &gt; {"{n,m}"} @ ( ) \n</div>}
          </>)}
          {tab === "replace" && row(<span>Replace w<u>i</u>th:</span>, <><input ref={replaceRef} className="w13-field" aria-label="Replace with" style={{ width: "100%" }} value={replacement} onFocus={() => { focused.current = "replace"; }} onChange={event => setReplacement(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); run("replace"); } }} />
            {replaceText && <div className="w13-note" style={{ marginTop: 3 }}>Format: {replaceText}</div>}</>)}
          <div role="status" aria-live="polite" style={{ minHeight: more ? 12 : 22, margin: "4px 0 0 88px", color: message.includes("not found") || message.includes("only be") ? "#a4262c" : "#0b5a0b" }}>{message || matchCount}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: more ? 6 : 14 }}>
            <Button13 onClick={() => setMore(value => !value)}>{more ? "<< Less" : "More >>"}</Button13>
            <span style={{ flex: 1 }} />
            {tab === "find" ? <>
              <Button13 disabled={!canRun} onClick={() => run("highlight")}>{highlightOn ? "Clear Highlighting" : "Reading Highlight ▾"}</Button13>
              {/* Word 2013: Find In becomes available as soon as Find what has text. Picking Main Document (or
                  Current Selection, when there was one) marks every match in it at once; the scope then carries
                  over to the Replace tab. */}
              <MenuButton13 label="Find In" disabled={!canRun} items={[{ id: "selection", label: "Current Selection", disabled: !dialog.hadSelection }, { id: "document", label: "Main Document" }]} onPick={id => { const invalid = findWhatError(query, options); if (invalid) { setSearched(true); setMessage(invalid); return; } const picked = id as Scope; if (picked !== scope) selectedAll.current = true; setScope(picked); setHighlightOn(false); setSearched(true); setMessage(onSelectAll(query, options, picked)); }} />
              <Button13 isDefault disabled={!canRun} onClick={() => run("next")}>Find Next</Button13>
            </> : <>
              <Button13 disabled={!canRun} onClick={() => run("replace")}>Replace</Button13>
              <Button13 disabled={!canRun} onClick={() => run("all")}>Replace All</Button13>
              <Button13 isDefault disabled={!canRun} onClick={() => run("next")}>Find Next</Button13>
            </>}
            <Button13 onClick={chrome?.onClose}>{searched ? "Close" : "Cancel"}</Button13>
          </div>
          {more && <>
            <Group13>Search Options</Group13>
            <div className="w13-row" style={{ marginLeft: 4 }}><span>Searc<u>h</u>:</span>
              <select className="w13-select" aria-label="Search direction" style={{ width: 80 }} value={options.direction} onChange={event => set("direction", event.target.value as FindEngineOptions["direction"])}><option value="all">All</option><option value="down">Down</option><option value="up">Up</option></select>
              {dialog.hadSelection && <span className="w13-note" style={{ marginLeft: 10 }}>{scope === "selection" ? "Searching the current selection" : ""}</span>}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 30px", margin: "6px 0 0 4px" }}>
              <Check13 checked={options.matchCase || wild} disabled={wild} onChange={checked => set("matchCase", checked)}>Mat<u>c</u>h case</Check13>
              <Check13 checked={options.matchPrefix} disabled={wild || options.wholeWord} onChange={checked => set("matchPrefix", checked)}>Match prefi<u>x</u></Check13>
              <Check13 checked={options.wholeWord} disabled={wild} onChange={checked => setOptions(current => ({ ...current, wholeWord: checked, matchPrefix: false, matchSuffix: false }))}>Find whole words onl<u>y</u></Check13>
              <Check13 checked={options.matchSuffix} disabled={wild || options.wholeWord} onChange={checked => set("matchSuffix", checked)}>Match suffi<u>x</u></Check13>
              <Check13 checked={options.wildcards} onChange={checked => setOptions(current => ({ ...current, wildcards: checked, soundsLike: false, allWordForms: false, wholeWord: false, matchPrefix: false, matchSuffix: false }))}>Use wil<u>d</u>cards</Check13>
              <span />
              <Check13 checked={options.soundsLike} disabled={wild} onChange={checked => setOptions(current => ({ ...current, soundsLike: checked, allWordForms: checked ? false : current.allWordForms }))}>Sounds li<u>k</u>e (English)</Check13>
              <Check13 checked={options.ignorePunctuation} disabled={wild} onChange={checked => set("ignorePunctuation", checked)}>Ignore punctuation characters</Check13>
              <Check13 checked={options.allWordForms} disabled={wild} onChange={checked => setOptions(current => ({ ...current, allWordForms: checked, soundsLike: checked ? false : current.soundsLike }))}>Find all <u>w</u>ord forms (English)</Check13>
              <Check13 checked={options.ignoreWhitespace} disabled={wild} onChange={checked => set("ignoreWhitespace", checked)}>Ignore white-space characters</Check13>
            </div>
            <Group13>{tab === "replace" ? "Replace" : "Find"}</Group13>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <MenuButton13 label={<span>Forma<u>t</u></span>} items={FORMAT_MENU} onPick={pickFormat} />
              <MenuButton13 label={<span>Sp<u>e</u>cial</span>} items={SPECIAL_MENU.map(item => ({ id: item.id, label: item.label }))} onPick={insertSpecial} />
              <Button13 disabled={tab === "replace" && focused.current === "replace" ? !replaceFormat : !options.format} onClick={() => { if (formatTarget() === "replace") setReplaceFormat(null); else set("format", null); }}>No Formatting</Button13>
            </div>
          </>}
        </>}
        {tab === "goto" && <div style={{ display: "grid", gridTemplateColumns: "190px 1fr", gap: 14, marginTop: 6 }}>
          <div><div style={{ marginBottom: 2 }}>Go to wha<u>t</u>:</div><div className="w13-list" style={{ height: 190 }} role="listbox" aria-label="Go to what">{GOTO_KINDS.map(item => <button key={item.id} type="button" role="option" aria-selected={gotoKind === item.id} style={item.working || gotoKind === item.id ? undefined : { color: "#8a8a8a" }} onMouseDown={event => event.preventDefault()} onClick={() => { setGotoKind(item.id); setGotoValue(""); }}>{item.label}</button>)}</div></div>
          <div>
            {gotoDefinition?.working ? <>
              <div style={{ marginBottom: 2 }}>{gotoKind === "bookmark" ? "Enter bookmark name:" : `Enter ${gotoDefinition.label.toLowerCase()} number:`}</div>
              {gotoKind === "bookmark"
                ? <select className="w13-select" aria-label="Bookmark" style={{ width: "100%" }} value={gotoValue} onChange={event => setGotoValue(event.target.value)}><option value="">Choose a bookmark…</option>{dialog.bookmarks.map(name => <option key={name} value={name}>{name}</option>)}</select>
                : <input className="w13-field" aria-label="Go to number" style={{ width: "100%" }} inputMode="numeric" value={gotoValue} onChange={event => setGotoValue(event.target.value.replace(/[^0-9]/g, ""))} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); runGoTo(0); } }} />}
              {gotoKind === "bookmark" && !dialog.bookmarks.length && <p className="w13-note" style={{ marginTop: 6 }}>This document has no bookmarks yet.</p>}
            </> : <p className="w13-note">{gotoDefinition?.label} isn&apos;t applicable to this exam tool&apos;s document model. Choose Page, Bookmark or Table.</p>}
            <div style={{ display: "flex", gap: 8, marginTop: 120, justifyContent: "flex-end" }}>
              {gotoKind !== "bookmark" && <><Button13 disabled={!gotoDefinition?.working} onClick={() => runGoTo(-1)}>Previous</Button13><Button13 disabled={!gotoDefinition?.working} onClick={() => runGoTo(1)}>Next</Button13></>}
              <Button13 isDefault disabled={!gotoDefinition?.working} onClick={() => runGoTo(0)}>Go To</Button13><Button13 onClick={chrome?.onClose}>Close</Button13>
            </div>
          </div>
        </div>}
        {fontPanel === "paragraph" && <FindFormatPanel kind="paragraph" initial={options.format} onCancel={() => setFontPanel(null)} onOk={format => { set("format", format); setFontPanel(null); }} />}
        {/* Format > Font is Word's own Font dialog, titled Find Font / Replace Font. */}
        {(fontPanel === "font" || fontPanel === "replace-font") && <Word13Chrome.Provider value={{ ...(chrome ?? {}), onClose: () => setFontPanel(null) } as NonNullable<typeof chrome>}>
          <div style={{ position: "absolute", left: 8, top: -40, zIndex: 6 }}>
            <FontDialog2013 title={fontPanel === "font" ? "Find Font" : "Replace Font"} values={fontPanel === "replace-font" ? { ...BLANK_FONT_VALUES, ...(replaceFormat?.font ?? {}) } : BLANK_FONT_VALUES}
              onSubmit={values => { if (fontPanel === "font") set("format", fontToFind(values)); else { const font = changedFont(values); setReplaceFormat(current => (Object.keys(font).length || current?.highlight ? { ...(current ?? {}), font } : null)); } setFontPanel(null); }} />
          </div>
        </Word13Chrome.Provider>}
      </div>
    </Window13>
  );
}

// "Find Font" / "Find Paragraph" criteria shown over the dialog (Format ▾ menu).
function FindFormatPanel({ kind, initial, onOk, onCancel }: { kind: "font" | "paragraph"; initial: FindFormat | null; onOk: (format: FindFormat | null) => void; onCancel: () => void }) {
  const [draft, setDraft] = useState<FindFormat>(initial ?? {});
  const tri = (key: "bold" | "italic" | "underline" | "strike", label: string) => (
    <div className="w13-row"><span style={{ width: 96 }}>{label}:</span>
      <select className="w13-select" aria-label={label} style={{ width: 90 }} value={draft[key] === undefined ? "any" : draft[key] ? "yes" : "no"} onChange={event => setDraft(current => { const next = { ...current }; if (event.target.value === "any") delete next[key]; else next[key] = event.target.value === "yes"; return next; })}><option value="any">Any</option><option value="yes">Yes</option><option value="no">No</option></select></div>
  );
  const finish = () => { const clean: Record<string, unknown> = {}; for (const [key, value] of Object.entries(draft)) if (value !== undefined && value !== "") clean[key] = value; onOk(Object.keys(clean).length ? (clean as FindFormat) : null); };
  return (
    <div className="w13" style={{ position: "absolute", left: 24, top: 4, width: 330, zIndex: 6 }}>
      <div className="w13-title"><span>{kind === "font" ? "Find Font" : "Find Paragraph"}</span></div>
      <div className="w13-body">
        {kind === "font" ? <>
          <div className="w13-row"><span style={{ width: 96 }}>Font:</span>
            <select className="w13-select" aria-label="Font name" style={{ width: 160 }} value={draft.fontName ?? ""} onChange={event => setDraft(current => ({ ...current, fontName: event.target.value || undefined }))}><option value="">Any</option>{APPROVED_WORD_FONTS.map(font => <option key={font} value={font}>{themeLabel(font)}</option>)}</select></div>
          <div className="w13-row"><span style={{ width: 96 }}>Size (pt):</span><input className="w13-field" aria-label="Font size" style={{ width: 70 }} inputMode="decimal" value={draft.fontSize ?? ""} onChange={event => { const number = Number(event.target.value); setDraft(current => ({ ...current, fontSize: event.target.value && Number.isFinite(number) && number > 0 ? number : undefined })); }} /></div>
          {tri("bold", "Bold")}{tri("italic", "Italic")}{tri("underline", "Underline")}{tri("strike", "Strikethrough")}
          <div className="w13-row"><Check13 checked={Boolean(draft.superscript)} onChange={checked => setDraft(current => ({ ...current, superscript: checked || undefined, subscript: checked ? undefined : current.subscript }))}>Superscript</Check13><Check13 checked={Boolean(draft.subscript)} onChange={checked => setDraft(current => ({ ...current, subscript: checked || undefined, superscript: checked ? undefined : current.superscript }))}>Subscript</Check13></div>
          <div className="w13-row"><span style={{ width: 96 }}>Font color:</span><ColorSelect13 label="Font color" autoLabel="Any" value={draft.color ?? ""} onChange={value => setDraft(current => ({ ...current, color: value || undefined }))} width={130} /></div>
        </> : <div className="w13-row"><span style={{ width: 96 }}>Alignment:</span>
          <select className="w13-select" aria-label="Alignment" style={{ width: 130 }} value={draft.alignment ?? ""} onChange={event => setDraft(current => ({ ...current, alignment: (event.target.value || undefined) as FindFormat["alignment"] }))}><option value="">Any</option><option value="left">Left</option><option value="center">Centered</option><option value="right">Right</option><option value="justify">Justified</option></select></div>}
        <div className="w13-footer" style={{ justifyContent: "flex-end" }}><div className="w13-footer-right"><Button13 isDefault onClick={finish}>OK</Button13><Button13 onClick={onCancel}>Cancel</Button13></div></div>
      </div>
    </div>
  );
}

// ---- Insert tab dialogs (Insert Table, Page Number Format, Drop Cap, Date and Time, Symbol) ----

export function InsertTableDialog2013({ onSubmit }: { onSubmit: (rows: number, cols: number, layout: string) => void }) {
  const chrome = useContext(Word13Chrome);
  const [cols, setCols] = useState<number | null>(5), [rows, setRows] = useState<number | null>(2);
  const [layout, setLayout] = useState("fixed"), [remember, setRemember] = useState(false);
  return (
    <Window13 title="Insert Table" width={300}>
      <Group13>Table size</Group13>
      <div className="w13-row" style={{ marginLeft: 12 }}><span className="w13-label" style={{ width: 130 }}>Number of <u>c</u>olumns:</span><Number13 label="Number of columns" value={cols} onChange={setCols} min={1} max={20} decimals={0} width={64} /></div>
      <div className="w13-row" style={{ marginLeft: 12 }}><span className="w13-label" style={{ width: 130 }}>Number of <u>r</u>ows:</span><Number13 label="Number of rows" value={rows} onChange={setRows} min={1} max={50} decimals={0} width={64} /></div>
      <Group13>AutoFit behavior</Group13>
      {([["fixed", "Fixed column width:"], ["auto", "AutoFit to contents"], ["window", "AutoFit to window"]] as const).map(([id, label]) => (
        <div key={id} className="w13-row" style={{ marginLeft: 12 }}>
          <label className="w13-check"><input type="radio" name="w13-table-autofit" checked={layout === id} onChange={() => setLayout(id)} /><span>{label}</span></label>
          {id === "fixed" && <input className="w13-field" style={{ width: 64, marginLeft: "auto" }} value="Auto" disabled readOnly aria-label="Fixed column width" />}
        </div>
      ))}
      <div className="w13-row" style={{ marginTop: 10 }}><Check13 checked={remember} onChange={setRemember}>Re<u>m</u>ember dimensions for new tables</Check13></div>
      <div className="w13-footer"><span /><div className="w13-footer-right"><Button13 isDefault onClick={() => onSubmit(Math.round(rows ?? 2), Math.round(cols ?? 5), layout)}>OK</Button13><Button13 onClick={chrome?.onClose}>Cancel</Button13></div></div>
    </Window13>
  );
}

export type PageNumberFormatValues = { format: string; includeChapter: boolean; continueNumbering: boolean; startAt: number };
export function PageNumberFormatDialog2013({ values: initial, formats, onSubmit }: { values: PageNumberFormatValues; formats: { id: string; label: string }[]; onSubmit: (values: PageNumberFormatValues) => void }) {
  const chrome = useContext(Word13Chrome);
  const [values, setValues] = useState(initial);
  const set = (patch: Partial<PageNumberFormatValues>) => setValues(current => ({ ...current, ...patch }));
  const off = !values.includeChapter;
  const dim = off ? { color: "#8a8a8a" } : undefined;
  return (
    <Window13 title="Page Number Format" width={330}>
      <div className="w13-row" style={{ marginTop: 6 }}><span className="w13-label" style={{ width: 100 }}>Number <u>f</u>ormat:</span>
        <select className="w13-select" style={{ flex: 1 }} aria-label="Number format" value={values.format} onChange={event => set({ format: event.target.value })}>{formats.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></div>
      <div className="w13-row"><Check13 checked={values.includeChapter} onChange={includeChapter => set({ includeChapter })}>Include chapter <u>n</u>umber</Check13></div>
      <div className="w13-row" style={{ marginLeft: 20 }}><span className="w13-label" style={{ width: 140, ...dim }}>Chapter starts with style:</span><select className="w13-select" style={{ flex: 1 }} disabled={off} aria-label="Chapter starts with style"><option>Heading 1</option><option>Heading 2</option><option>Heading 3</option></select></div>
      <div className="w13-row" style={{ marginLeft: 20 }}><span className="w13-label" style={{ width: 140, ...dim }}>Use separator:</span><select className="w13-select" style={{ flex: 1 }} disabled={off} aria-label="Use separator"><option>- (hyphen)</option><option>. (period)</option><option>: (colon)</option><option>— (em dash)</option><option>– (en dash)</option></select></div>
      <div className="w13-row" style={{ marginLeft: 20, ...dim }}><span className="w13-label" style={{ width: 140 }}>Examples:</span><span>1-1, 1-A</span></div>
      <Group13>Page numbering</Group13>
      <div className="w13-row" style={{ marginLeft: 12 }}><label className="w13-check"><input type="radio" name="w13-page-numbering" checked={values.continueNumbering} onChange={() => set({ continueNumbering: true })} /><span><u>C</u>ontinue from previous section</span></label></div>
      <div className="w13-row" style={{ marginLeft: 12 }}><label className="w13-check" style={{ width: 90 }}><input type="radio" name="w13-page-numbering" checked={!values.continueNumbering} onChange={() => set({ continueNumbering: false })} /><span>St<u>a</u>rt at:</span></label>
        <Number13 label="Start at" value={values.startAt} onChange={value => set({ startAt: Math.max(1, Math.round(value ?? 1)) })} min={1} max={9999} decimals={0} width={70} disabled={values.continueNumbering} /></div>
      <div className="w13-footer"><span /><div className="w13-footer-right"><Button13 isDefault onClick={() => onSubmit(values)}>OK</Button13><Button13 onClick={chrome?.onClose}>Cancel</Button13></div></div>
    </Window13>
  );
}

export function DropCapIcon({ mode, size = 56 }: { mode: string; size?: number }) {
  const line = (index: number, from: number) => <path key={index} d={`M${from} ${10 + index * 7}H58`} stroke="#666" strokeWidth="1.4" />;
  return (
    <svg viewBox="0 0 64 54" width={size} height={size * 54 / 64} aria-hidden>
      <rect x="0.5" y="0.5" width="63" height="53" fill="#fff" stroke="#b0b0b0" />
      {mode === "none" && Array.from({ length: 6 }, (_, index) => line(index, 6))}
      {mode === "dropped" && <><text x="6" y="27" fontFamily="Times New Roman,serif" fontSize="24" fill="#2b579a">W</text>{Array.from({ length: 6 }, (_, index) => line(index, index < 3 ? 30 : 6))}</>}
      {mode === "margin" && <><text x="1" y="27" fontFamily="Times New Roman,serif" fontSize="24" fill="#2b579a">W</text><path d="M22 4V50" stroke="#aaa" strokeDasharray="2 2" />{Array.from({ length: 6 }, (_, index) => line(index, 26))}</>}
    </svg>
  );
}
export type DropCapValues = { position: string; fontFamily: string; lines: string; distance: string };
export function DropCapDialog2013({ values: initial, onSubmit }: { values: DropCapValues; onSubmit: (values: DropCapValues) => void }) {
  const chrome = useContext(Word13Chrome);
  const [values, setValues] = useState(initial);
  const set = (patch: Partial<DropCapValues>) => setValues(current => ({ ...current, ...patch }));
  const off = values.position === "none";
  const dim = off ? { color: "#8a8a8a" } : undefined;
  return (
    <Window13 title="Drop Cap" width={310}>
      <Group13>Position</Group13>
      <div className="w13-row" style={{ gap: 14, justifyContent: "center" }}>
        {([["none", "None"], ["dropped", "Dropped"], ["margin", "In margin"]] as const).map(([id, label]) => (
          <button key={id} type="button" aria-pressed={values.position === id} onMouseDown={event => event.preventDefault()} onClick={() => set({ position: id })}
            style={{ display: "grid", justifyItems: "center", gap: 3, border: values.position === id ? "2px solid #0078d7" : "2px solid transparent", background: "transparent", padding: 2, font: "inherit", cursor: "default" }}>
            <DropCapIcon mode={id} /><span>{label}</span>
          </button>
        ))}
      </div>
      <Group13>Options</Group13>
      <div style={{ marginLeft: 12 }}>
        <div style={dim}><u>F</u>ont:</div>
        <select className="w13-select" style={{ width: "100%", marginTop: 2 }} disabled={off} aria-label="Drop cap font" value={values.fontFamily} onChange={event => set({ fontFamily: event.target.value })}>
          <option value="">+Body</option>{APPROVED_WORD_FONTS.map(font => <option key={font} value={font}>{font}</option>)}
        </select>
        <div className="w13-row"><span className="w13-label" style={{ width: 140, ...dim }}><u>L</u>ines to drop:</span><Number13 label="Lines to drop" value={Number(values.lines) || 3} onChange={value => set({ lines: String(Math.round(value ?? 3)) })} min={1} max={10} decimals={0} width={80} disabled={off} /></div>
        <div className="w13-row"><span className="w13-label" style={{ width: 140, ...dim }}>Distance from te<u>x</u>t:</span><Number13 label="Distance from text" value={(Number(values.distance) || 0) * 2.54} unit="cm" dimension="length" step={0.1} min={0} max={5} decimals={2} onChange={value => set({ distance: String((value ?? 0) / 2.54) })} width={80} disabled={off} /></div>
      </div>
      <div className="w13-footer"><span /><div className="w13-footer-right"><Button13 isDefault onClick={() => onSubmit(values)}>OK</Button13><Button13 onClick={chrome?.onClose}>Cancel</Button13></div></div>
    </Window13>
  );
}

// Word 2013's Printed Watermark dialog (DESIGN > Watermark > Custom Watermark…). A text watermark
// has its own font, size, colour, Semitransparent and Diagonal/Horizontal layout; "Kruti Dev 010"
// is in the font list, so a Hindi watermark can be typed in Kruti Dev keystrokes.
export type WatermarkValues = { kind: "none" | "text"; text: string; font: string; size: string; color: string; semitransparent: boolean; layout: "diagonal" | "horizontal" };
export const WATERMARK_TEXTS = ["ASAP", "CONFIDENTIAL", "COPY", "DO NOT COPY", "DRAFT", "ORIGINAL", "PERSONAL", "SAMPLE", "TOP SECRET", "URGENT"];
export const WATERMARK_SIZES = ["Auto", "36", "40", "44", "48", "54", "60", "66", "72", "80", "90", "96", "105", "120", "144", "200"];
export const DEFAULT_WATERMARK: WatermarkValues = { kind: "text", text: "ASAP", font: "Calibri", size: "Auto", color: "C0C0C0", semitransparent: true, layout: "diagonal" };
export function WatermarkDialog2013({ values: initial, onSubmit }: { values: WatermarkValues; onSubmit: (values: WatermarkValues, keepOpen: boolean) => void }) {
  const chrome = useContext(Word13Chrome);
  const [values, setValues] = useState(initial);
  const set = (patch: Partial<WatermarkValues>) => setValues(current => ({ ...current, ...patch }));
  const off = values.kind !== "text";
  const dim = off ? { color: "#8a8a8a" } : undefined;
  const row = (label: ReactNode, field: ReactNode) => <div className="w13-row" style={{ marginLeft: 20 }}><span className="w13-label" style={{ width: 70, ...dim }}>{label}</span><div style={{ flex: 1 }}>{field}</div></div>;
  return (
    <Window13 title="Printed Watermark" width={430}>
      <div className="w13-row" style={{ marginTop: 6 }}><label className="w13-check"><input type="radio" name="w13-watermark" checked={values.kind === "none"} onChange={() => set({ kind: "none" })} /><span>N<u>o</u> watermark</span></label></div>
      <div className="w13-row"><label className="w13-check" title="Picture watermarks are not available in this exam tool"><input type="radio" name="w13-watermark" disabled /><span style={{ color: "#8a8a8a" }}>Pi<u>c</u>ture watermark</span></label></div>
      <div className="w13-row" style={{ marginLeft: 20, color: "#8a8a8a" }}><Button13 disabled>Select <u>P</u>icture…</Button13></div>
      <div className="w13-row"><label className="w13-check"><input type="radio" name="w13-watermark" checked={values.kind === "text"} onChange={() => set({ kind: "text" })} /><span>Te<u>x</u>t watermark</span></label></div>
      {row(<><u>L</u>anguage:</>, <select className="w13-select" style={{ width: "100%" }} disabled={off} aria-label="Watermark language"><option>English (United States)</option><option>Hindi</option></select>)}
      {row(<><u>T</u>ext:</>, <><input className="w13-field" style={{ width: "100%" }} disabled={off} aria-label="Watermark text" list="w13-watermark-texts" maxLength={40} value={values.text} onChange={event => set({ text: event.target.value })} /><datalist id="w13-watermark-texts">{WATERMARK_TEXTS.map(text => <option key={text} value={text} />)}</datalist></>)}
      {row(<><u>F</u>ont:</>, <select className="w13-select" style={{ width: "100%", fontFamily: values.font === "Kruti Dev 010" ? undefined : values.font }} disabled={off} aria-label="Watermark font" value={values.font} onChange={event => set({ font: event.target.value })}>{APPROVED_WORD_FONTS.map(font => <option key={font} value={font}>{font}</option>)}</select>)}
      {row(<><u>S</u>ize:</>, <select className="w13-select" style={{ width: 120 }} disabled={off} aria-label="Watermark size" value={values.size} onChange={event => set({ size: event.target.value })}>{WATERMARK_SIZES.map(size => <option key={size} value={size}>{size}</option>)}</select>)}
      {row(<><u>C</u>olor:</>, <div style={{ display: "flex", gap: 12, alignItems: "center" }}>{off ? <select className="w13-select" style={{ width: 140 }} disabled aria-label="Watermark color"><option>{colorLabel(values.color)}</option></select> : <PaletteSelect13 value={values.color} onChange={hex => set({ color: hex ?? "C0C0C0" })} label="Watermark color" autoLabel="Automatic" width={140} />}<Check13 checked={values.semitransparent} disabled={off} onChange={semitransparent => set({ semitransparent })}>S<u>e</u>mitransparent</Check13></div>)}
      {row(<>Layout:</>, <div style={{ display: "flex", gap: 18 }}><label className="w13-check"><input type="radio" name="w13-watermark-layout" disabled={off} checked={values.layout === "diagonal"} onChange={() => set({ layout: "diagonal" })} /><span><u>D</u>iagonal</span></label><label className="w13-check"><input type="radio" name="w13-watermark-layout" disabled={off} checked={values.layout === "horizontal"} onChange={() => set({ layout: "horizontal" })} /><span><u>H</u>orizontal</span></label></div>)}
      <div className="w13-footer"><span /><div className="w13-footer-right"><Button13 onClick={() => onSubmit({ ...values, text: values.text.trim() }, true)} disabled={!off && !values.text.trim()}><u>A</u>pply</Button13><Button13 isDefault onClick={() => onSubmit({ ...values, text: values.text.trim() }, false)} disabled={!off && !values.text.trim()}>OK</Button13><Button13 onClick={chrome?.onClose}>Cancel</Button13></div></div>
    </Window13>
  );
}

export function DateTimeDialog2013({ formats, languages, onSubmit }: { formats: (language: string) => string[]; languages: readonly string[]; onSubmit: (text: string) => void }) {
  const chrome = useContext(Word13Chrome);
  const [language, setLanguage] = useState(languages[0]);
  const [index, setIndex] = useState(0), [auto, setAuto] = useState(false);
  const list = formats(language);
  const items = list.map((label, position) => ({ id: String(position), label }));
  return (
    <Window13 title="Date and Time" width={430}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 160px", gap: 12, marginTop: 6 }}>
        <div><div><u>A</u>vailable formats:</div>
          <div className="w13-datetime-list"><ListBox13 label="Available formats" items={items} value={String(index)} onPick={id => setIndex(Number(id))} /></div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}><div><u>L</u>anguage:</div>
          <select className="w13-select" style={{ width: "100%", marginTop: 2 }} aria-label="Language" value={language} onChange={event => setLanguage(event.target.value)}>{languages.map(item => <option key={item}>{item}</option>)}</select>
          <div style={{ marginTop: "auto" }}><Check13 checked={auto} onChange={setAuto}>Update a<u>u</u>tomatically</Check13></div>
        </div>
      </div>
      <div className="w13-footer"><Button13 onClick={() => onSubmit(list[index] ?? list[0])}>Set As <u>D</u>efault</Button13><div className="w13-footer-right"><Button13 isDefault onClick={() => onSubmit(list[index] ?? list[0])}>OK</Button13><Button13 onClick={chrome?.onClose}>Cancel</Button13></div></div>
    </Window13>
  );
}

export function SymbolDialog2013({ subsets, symbolsIn, specials, recent, onInsert }: { subsets: { name: string }[]; symbolsIn: (subset: string) => string[]; specials: { name: string; char: string; shortcut: string }[]; recent: string[]; onInsert: (char: string) => void }) {
  const chrome = useContext(Word13Chrome);
  const [tab, setTab] = useState("symbols");
  const [subset, setSubset] = useState(subsets[0].name);
  const [chosen, setChosen] = useState(() => symbolsIn(subsets[0].name)[0] ?? "");
  const [special, setSpecial] = useState(specials[0].name);
  const symbols = symbolsIn(subset);
  const code = chosen ? chosen.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0") : "";
  const insert = () => { const char = tab === "symbols" ? chosen : specials.find(item => item.name === special)?.char; if (char) onInsert(char); };
  const cell = (char: string) => <button key={char} type="button" aria-label={char} aria-pressed={char === chosen} onMouseDown={event => event.preventDefault()} onClick={() => setChosen(char)} onDoubleClick={() => onInsert(char)}>{char}</button>;
  return (
    <Window13 title="Symbol" width={540}>
      <Tabs13 tabs={[{ id: "symbols", label: <><u>S</u>ymbols</> }, { id: "special", label: <>S<u>p</u>ecial Characters</> }]} value={tab} onChange={setTab} />
      <div className="w13-panel">
        {tab === "symbols" ? <>
          <div className="w13-row"><span className="w13-label"><u>F</u>ont:</span><select className="w13-select" style={{ width: 150 }} aria-label="Symbol font" defaultValue="(normal text)"><option>(normal text)</option></select>
            <span className="w13-label" style={{ marginLeft: "auto" }}>S<u>u</u>bset:</span><select className="w13-select" style={{ width: 180 }} aria-label="Subset" value={subset} onChange={event => { setSubset(event.target.value); setChosen(symbolsIn(event.target.value)[0] ?? ""); }}>{subsets.map(item => <option key={item.name}>{item.name}</option>)}</select></div>
          <div className="w13-symbol-grid" aria-label="Symbols">{symbols.map(cell)}</div>
          <div style={{ marginTop: 6 }}><u>R</u>ecently used symbols:</div>
          <div className="w13-symbol-grid w13-symbol-recent">{recent.slice(0, 16).map(cell)}</div>
          <div className="w13-row"><span>Selected: <b style={{ fontSize: 14 }}>{chosen}</b></span><span style={{ marginLeft: "auto" }}><u>C</u>haracter code: <input className="w13-field" style={{ width: 54 }} readOnly value={code} aria-label="Character code" /> from: Unicode (hex)</span></div>
        </> : <div className="w13-list" role="listbox" aria-label="Special characters" style={{ height: 250 }}>
          {specials.map(item => <button key={item.name} type="button" role="option" aria-selected={item.name === special} onMouseDown={event => event.preventDefault()} onClick={() => setSpecial(item.name)} onDoubleClick={() => onInsert(item.char)} style={{ display: "grid", gridTemplateColumns: "40px 1fr 140px" }}><span>{item.char.trim() ? item.char : ""}</span><span>{item.name}</span><span>{item.shortcut}</span></button>)}
        </div>}
      </div>
      <div className="w13-footer"><span /><div className="w13-footer-right"><Button13 isDefault onClick={insert}><u>I</u>nsert</Button13><Button13 onClick={chrome?.onClose}>Cancel</Button13></div></div>
    </Window13>
  );
}

// ---- Table Tools dialogs, laid out like Word 2013's: Table Properties (Table, Row, Column,
// Cell, Alt Text), Table Options, Cell Options, Insert Cells, Delete Cells, Split Cells, Sort
// (+ Sort Options), Convert Table To Text, Convert Text to Table, Formula, and Borders and
// Shading (Borders, Page Border, Shading). Presentational: values in, values out. ----

const Radio13 = ({ name, checked, onChange, children, disabled }: { name: string; checked: boolean; onChange: () => void; children: ReactNode; disabled?: boolean }) => <label className="w13-check" aria-disabled={disabled}><input type="radio" name={name} checked={checked} disabled={disabled} onChange={onChange} /><span>{children}</span></label>;
const OkCancel13 = ({ onOk, okLabel = "OK", left }: { onOk: () => void; okLabel?: string; left?: ReactNode }) => { const chrome = useContext(Word13Chrome); return <div className="w13-footer">{left ?? <span />}<div className="w13-footer-right"><Button13 isDefault onClick={onOk}>{okLabel}</Button13><Button13 onClick={chrome?.onClose}>Cancel</Button13></div></div>; };

// A second dialog opened from inside a dialog (Table Properties > Options…), drawn over it.
function SubDialog13({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const startDrag = (event: ReactMouseEvent<HTMLDivElement>) => {
    const start = { x: event.clientX - offset.x, y: event.clientY - offset.y };
    const move = (moveEvent: MouseEvent) => setOffset({ x: moveEvent.clientX - start.x, y: moveEvent.clientY - start.y });
    const up = () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
    window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
  };
  if (typeof document === "undefined") return null;
  return createPortal(<div className="w13-sub-overlay" role="dialog" aria-modal="true"><div style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}><Word13Chrome.Provider value={{ onClose, startDrag }}>{children}</Word13Chrome.Provider></div></div>, document.body);
}

const UNIT_SELECT = (value: "cm" | "pct", onChange: (unit: "cm" | "pct") => void, disabled: boolean, label: string) =>
  <select className="w13-select" aria-label={label} disabled={disabled} style={{ width: 104 }} value={value} onChange={event => onChange(event.target.value as "cm" | "pct")}><option value="cm">Centimeters</option><option value="pct">Percent</option></select>;

function Tile13({ selected, onClick, label, children, width = 52, height = 40 }: { selected: boolean; onClick: () => void; label: ReactNode; children: ReactNode; width?: number; height?: number }) {
  return <button type="button" className="w13-tile" aria-pressed={selected} onMouseDown={event => event.preventDefault()} onClick={onClick}>
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden><rect x="0.5" y="0.5" width={width - 1} height={height - 1} fill="#fff" stroke="#a0a0a0" />{children}</svg><span>{label}</span>
  </button>;
}
const textLines = (x: number, y: number, width: number, count: number) => Array.from({ length: count }, (_, i) => <rect key={i} x={x} y={y + i * 4} width={width} height="1.6" fill="#8c8c8c" />);
const miniTable = (x: number, y: number, w: number, h: number) => <><rect x={x} y={y} width={w} height={h} fill="#dfe8f5" stroke="#2b579a" /><path d={`M${x} ${y + h / 2}h${w}M${x + w / 2} ${y}v${h}`} stroke="#2b579a" strokeWidth=".8" /></>;

export type TableRowProps = { heightOn: boolean; height: number; rule: "atLeast" | "exactly"; canSplit: boolean };
export type TableColumnProps = { widthOn: boolean; width: number; unit: "cm" | "pct" };
export type TablePropertiesValues = {
  widthOn: boolean; width: number; widthUnit: "cm" | "pct";
  tableAlign: "left" | "center" | "right"; indent: number; wrap: "none" | "around";
  rows: TableRowProps[]; rowIndex: number; repeatHeader: boolean;
  columns: TableColumnProps[]; columnIndex: number;
  cellWidthOn: boolean; cellWidth: number; cellUnit: "cm" | "pct"; cellVAlign: "top" | "middle" | "bottom";
  title: string; description: string;
};
export function TablePropertiesDialog2013({ values: initial, initialTab = "table", onSubmit, renderOptions, renderBordersShading, renderCellOptions }: {
  values: TablePropertiesValues; initialTab?: "table" | "row" | "column" | "cell" | "alt"; onSubmit: (values: TablePropertiesValues) => void;
  renderOptions: (close: () => void) => ReactNode; renderBordersShading: (close: () => void) => ReactNode; renderCellOptions: (close: () => void) => ReactNode;
}) {
  const [values, setValues] = useState(initial);
  const [tab, setTab] = useState<string>(initialTab);
  const [sub, setSub] = useState<"options" | "borders" | "cell" | null>(null);
  const set = (patch: Partial<TablePropertiesValues>) => setValues(current => ({ ...current, ...patch }));
  const row = values.rows[values.rowIndex] ?? { heightOn: false, height: 0.6, rule: "atLeast", canSplit: true };
  const setRow = (patch: Partial<TableRowProps>) => setValues(current => ({ ...current, rows: current.rows.map((item, i) => (i === current.rowIndex ? { ...item, ...patch } : item)) }));
  const column = values.columns[values.columnIndex] ?? { widthOn: false, width: 2.5, unit: "cm" };
  const setColumn = (patch: Partial<TableColumnProps>) => setValues(current => ({ ...current, columns: current.columns.map((item, i) => (i === current.columnIndex ? { ...item, ...patch } : item)) }));
  const close = () => setSub(null);
  return (
    <Window13 title="Table Properties" width={470}>
      <Tabs13 tabs={[{ id: "table", label: <><u>T</u>able</> }, { id: "row", label: <><u>R</u>ow</> }, { id: "column", label: <>Col<u>u</u>mn</> }, { id: "cell", label: <>C<u>e</u>ll</> }, { id: "alt", label: <>Alt Te<u>x</u>t</> }]} value={tab} onChange={setTab} />
      <div className="w13-panel" style={{ minHeight: 268 }}>
        {tab === "table" && <>
          <Group13>Size</Group13>
          <div className="w13-row" style={{ marginLeft: 12 }}>
            <Check13 checked={values.widthOn} onChange={on => set({ widthOn: on })}><u>P</u>referred width:</Check13>
            <Number13 label="Preferred table width" value={values.width} onChange={value => set({ width: value ?? 0 })} unit={values.widthUnit === "pct" ? "%" : "cm"} dimension={values.widthUnit === "pct" ? "plain" : "length"} step={values.widthUnit === "pct" ? 5 : 0.1} min={0.1} max={values.widthUnit === "pct" ? 100 : 60} decimals={values.widthUnit === "pct" ? 0 : 2} width={78} disabled={!values.widthOn} />
            <span>Measure in:</span>{UNIT_SELECT(values.widthUnit, unit => set({ widthUnit: unit, width: unit === "pct" ? 100 : 15 }), !values.widthOn, "Table width measure in")}
          </div>
          <Group13>Alignment</Group13>
          <div className="w13-row" style={{ marginLeft: 12, alignItems: "flex-start", gap: 14 }}>
            <Tile13 selected={values.tableAlign === "left"} onClick={() => set({ tableAlign: "left" })} label={<><u>L</u>eft</>}>{miniTable(5, 12, 22, 16)}{textLines(30, 12, 16, 5)}</Tile13>
            <Tile13 selected={values.tableAlign === "center"} onClick={() => set({ tableAlign: "center" })} label={<><u>C</u>enter</>}>{miniTable(15, 12, 22, 16)}</Tile13>
            <Tile13 selected={values.tableAlign === "right"} onClick={() => set({ tableAlign: "right" })} label={<>Rig<u>h</u>t</>}>{textLines(5, 12, 16, 5)}{miniTable(25, 12, 22, 16)}</Tile13>
            <div style={{ display: "grid", gap: 3, marginLeft: "auto" }}><span style={{ color: values.tableAlign === "left" ? undefined : "#8a8a8a" }}>I<u>n</u>dent from left:</span><Number13 label="Indent from left" value={values.indent} onChange={value => set({ indent: value ?? 0 })} unit="cm" dimension="length" step={0.1} min={-20} max={20} decimals={2} width={84} disabled={values.tableAlign !== "left"} /></div>
          </div>
          <Group13>Text wrapping</Group13>
          <div className="w13-row" style={{ marginLeft: 12, gap: 14 }}>
            <Tile13 selected={values.wrap === "none"} onClick={() => set({ wrap: "none" })} label={<><u>N</u>one</>}>{textLines(5, 5, 42, 2)}{miniTable(14, 14, 24, 12)}{textLines(5, 30, 42, 2)}</Tile13>
            <Tile13 selected={values.wrap === "around"} onClick={() => set({ wrap: "around" })} label={<><u>A</u>round</>}>{textLines(5, 5, 42, 2)}{miniTable(5, 14, 22, 14)}{textLines(30, 14, 17, 4)}{textLines(5, 32, 42, 1)}</Tile13>
            <div style={{ marginLeft: "auto" }}><Button13 disabled title="Table positioning is not used in this exam editor; Around wraps text beside the table at its alignment.">P<u>o</u>sitioning…</Button13></div>
          </div>
          <div className="w13-row" style={{ justifyContent: "flex-end", marginTop: 14, gap: 8 }}><Button13 onClick={() => setSub("borders")}><u>B</u>orders and Shading…</Button13><Button13 onClick={() => setSub("options")}><u>O</u>ptions…</Button13></div>
        </>}
        {tab === "row" && <>
          <div style={{ fontWeight: 600 }}>Row {values.rowIndex + 1}:</div>
          <Group13>Size</Group13>
          <div className="w13-row" style={{ marginLeft: 12 }}>
            <Check13 checked={row.heightOn} onChange={on => setRow({ heightOn: on })}><u>S</u>pecify height:</Check13>
            <Number13 label="Row height" value={row.height} onChange={value => setRow({ height: value ?? 0.6 })} unit="cm" dimension="length" step={0.1} min={0.1} max={50} decimals={2} width={80} disabled={!row.heightOn} />
            <span style={{ color: row.heightOn ? undefined : "#8a8a8a" }}>Row height <u>i</u>s:</span>
            <select className="w13-select" aria-label="Row height is" disabled={!row.heightOn} style={{ width: 92 }} value={row.rule} onChange={event => setRow({ rule: event.target.value as TableRowProps["rule"] })}><option value="atLeast">At least</option><option value="exactly">Exactly</option></select>
          </div>
          <Group13>Options</Group13>
          <div style={{ display: "grid", gap: 6, marginLeft: 12 }}>
            <Check13 checked={row.canSplit} onChange={on => setRow({ canSplit: on })}>Allow row to brea<u>k</u> across pages</Check13>
            <Check13 checked={values.repeatHeader && values.rowIndex === 0} disabled={values.rowIndex !== 0} onChange={on => set({ repeatHeader: on })} title={values.rowIndex !== 0 ? "Only the table's first row can repeat as its header row." : undefined}>Repeat as <u>h</u>eader row at the top of each page</Check13>
          </div>
          <div className="w13-row" style={{ marginTop: 18, gap: 8 }}>
            <Button13 disabled={values.rowIndex === 0} onClick={() => set({ rowIndex: values.rowIndex - 1 })}>▲ <u>P</u>revious Row</Button13>
            <Button13 disabled={values.rowIndex >= values.rows.length - 1} onClick={() => set({ rowIndex: values.rowIndex + 1 })}>▼ <u>N</u>ext Row</Button13>
          </div>
        </>}
        {tab === "column" && <>
          <div style={{ fontWeight: 600 }}>Column {values.columnIndex + 1}:</div>
          <Group13>Size</Group13>
          <div className="w13-row" style={{ marginLeft: 12 }}>
            <Check13 checked={column.widthOn} onChange={on => setColumn({ widthOn: on })}><u>P</u>referred width:</Check13>
            <Number13 label="Column width" value={column.width} onChange={value => setColumn({ width: value ?? 2.5 })} unit={column.unit === "pct" ? "%" : "cm"} dimension={column.unit === "pct" ? "plain" : "length"} step={column.unit === "pct" ? 5 : 0.1} min={0.1} max={column.unit === "pct" ? 100 : 60} decimals={column.unit === "pct" ? 0 : 2} width={80} disabled={!column.widthOn} />
            <span>Measure in:</span>{UNIT_SELECT(column.unit, unit => setColumn({ unit, width: unit === "pct" ? Math.round(100 / Math.max(1, values.columns.length)) : 2.5 }), !column.widthOn, "Column width measure in")}
          </div>
          <div className="w13-row" style={{ marginTop: 18, gap: 8 }}>
            <Button13 disabled={values.columnIndex === 0} onClick={() => set({ columnIndex: values.columnIndex - 1 })}>◄ <u>P</u>revious Column</Button13>
            <Button13 disabled={values.columnIndex >= values.columns.length - 1} onClick={() => set({ columnIndex: values.columnIndex + 1 })}>► <u>N</u>ext Column</Button13>
          </div>
        </>}
        {tab === "cell" && <>
          <Group13>Size</Group13>
          <div className="w13-row" style={{ marginLeft: 12 }}>
            <Check13 checked={values.cellWidthOn} onChange={on => set({ cellWidthOn: on })}><u>P</u>referred width:</Check13>
            <Number13 label="Cell width" value={values.cellWidth} onChange={value => set({ cellWidth: value ?? 2.5 })} unit={values.cellUnit === "pct" ? "%" : "cm"} dimension={values.cellUnit === "pct" ? "plain" : "length"} step={values.cellUnit === "pct" ? 5 : 0.1} min={0.1} max={values.cellUnit === "pct" ? 100 : 60} decimals={values.cellUnit === "pct" ? 0 : 2} width={80} disabled={!values.cellWidthOn} />
            <span>Measure in:</span>{UNIT_SELECT(values.cellUnit, unit => set({ cellUnit: unit, cellWidth: unit === "pct" ? 25 : 2.5 }), !values.cellWidthOn, "Cell width measure in")}
          </div>
          <Group13>Vertical alignment</Group13>
          <div className="w13-row" style={{ gap: 14, marginLeft: 12 }}>
            {(["top", "middle", "bottom"] as const).map(vertical => <Tile13 key={vertical} selected={values.cellVAlign === vertical} onClick={() => set({ cellVAlign: vertical })} label={vertical === "top" ? <><u>T</u>op</> : vertical === "middle" ? <><u>C</u>enter</> : <><u>B</u>ottom</>} width={40}>{textLines(8, vertical === "top" ? 6 : vertical === "middle" ? 15 : 24, 24, 3)}</Tile13>)}
          </div>
          <div className="w13-row" style={{ justifyContent: "flex-end", marginTop: 30 }}><Button13 onClick={() => setSub("cell")}>Opt<u>i</u>ons…</Button13></div>
        </>}
        {tab === "alt" && <>
          <div style={{ marginTop: 4 }}><u>T</u>itle:</div>
          <input className="w13-field" style={{ width: "100%", marginTop: 3 }} aria-label="Alt text title" maxLength={255} value={values.title} onChange={event => set({ title: event.target.value })} />
          <div style={{ marginTop: 10 }}><u>D</u>escription:</div>
          <textarea className="w13-field" style={{ width: "100%", height: 120, marginTop: 3, resize: "none", padding: 4 }} aria-label="Alt text description" maxLength={2000} value={values.description} onChange={event => set({ description: event.target.value })} />
          <div className="w13-note" style={{ marginTop: 6 }}>Titles and descriptions provide alternative, text-based representations of the information contained in tables.</div>
        </>}
      </div>
      <OkCancel13 onOk={() => onSubmit(values)} />
      {sub === "options" && <SubDialog13 onClose={close}>{renderOptions(close)}</SubDialog13>}
      {sub === "borders" && <SubDialog13 onClose={close}>{renderBordersShading(close)}</SubDialog13>}
      {sub === "cell" && <SubDialog13 onClose={close}>{renderCellOptions(close)}</SubDialog13>}
    </Window13>
  );
}

export type CellMarginValues = { top: number; bottom: number; left: number; right: number };
const marginGrid = (values: CellMarginValues, onChange: (key: keyof CellMarginValues, value: number) => void, disabled = false) => {
  const field = (key: keyof CellMarginValues, label: ReactNode) => <div className="w13-row" style={{ margin: "3px 0" }}><span className="w13-label" style={{ width: 52, color: disabled ? "#8a8a8a" : undefined }}>{label}</span><Number13 label={`${key} cell margin`} value={values[key]} onChange={value => onChange(key, Math.max(0, value ?? 0))} unit="cm" dimension="length" step={0.05} min={0} max={10} decimals={2} width={84} disabled={disabled} /></div>;
  return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", marginLeft: 12 }}>{field("top", <><u>T</u>op:</>)}{field("left", <><u>L</u>eft:</>)}{field("bottom", <><u>B</u>ottom:</>)}{field("right", <><u>R</u>ight:</>)}</div>;
};

export type TableOptionsValues = CellMarginValues & { spacingOn: boolean; spacing: number; autoResize: boolean };
export function TableOptionsDialog2013({ values: initial, onSubmit }: { values: TableOptionsValues; onSubmit: (values: TableOptionsValues) => void }) {
  const [values, setValues] = useState(initial);
  const set = (patch: Partial<TableOptionsValues>) => setValues(current => ({ ...current, ...patch }));
  return (
    <Window13 title="Table Options" width={340}>
      <Group13>Default cell margins</Group13>
      {marginGrid(values, (key, value) => set({ [key]: value }))}
      <Group13>Default cell spacing</Group13>
      <div className="w13-row" style={{ marginLeft: 12 }}><Check13 checked={values.spacingOn} onChange={on => set({ spacingOn: on })}>Allow <u>s</u>pacing between cells</Check13><Number13 label="Spacing between cells" value={values.spacing} onChange={value => set({ spacing: Math.max(0, value ?? 0) })} unit="cm" dimension="length" step={0.05} min={0} max={5} decimals={2} width={84} disabled={!values.spacingOn} /></div>
      <Group13>Options</Group13>
      <div style={{ marginLeft: 12 }}><Check13 checked={values.autoResize} onChange={on => set({ autoResize: on })}>Automatically res<u>i</u>ze to fit contents</Check13></div>
      <OkCancel13 onOk={() => onSubmit(values)} />
    </Window13>
  );
}

export type CellOptionsValues = { sameAsTable: boolean; margins: CellMarginValues; wrapText: boolean; fitText: boolean };
export function CellOptionsDialog2013({ values: initial, onSubmit }: { values: CellOptionsValues; onSubmit: (values: CellOptionsValues) => void }) {
  const [values, setValues] = useState(initial);
  const set = (patch: Partial<CellOptionsValues>) => setValues(current => ({ ...current, ...patch }));
  return (
    <Window13 title="Cell Options" width={340}>
      <Group13>Cell margins</Group13>
      <div style={{ marginLeft: 12 }}><Check13 checked={values.sameAsTable} onChange={on => set({ sameAsTable: on })}><u>S</u>ame as the whole table</Check13></div>
      {marginGrid(values.margins, (key, value) => set({ margins: { ...values.margins, [key]: value } }), values.sameAsTable)}
      <Group13>Options</Group13>
      <div style={{ display: "grid", gap: 6, marginLeft: 12 }}>
        <Check13 checked={values.wrapText} onChange={on => set({ wrapText: on })}><u>W</u>rap text</Check13>
        <Check13 checked={values.fitText} onChange={on => set({ fitText: on })}><u>F</u>it text</Check13>
      </div>
      <OkCancel13 onOk={() => onSubmit(values)} />
    </Window13>
  );
}

export function InsertCellsDialog2013({ onSubmit }: { onSubmit: (choice: "right" | "down" | "row" | "column") => void }) {
  const [choice, setChoice] = useState<"right" | "down" | "row" | "column">("down");
  return (
    <Window13 title="Insert Cells" width={240}>
      <div style={{ display: "grid", gap: 6, marginTop: 10, marginLeft: 6 }}>
        <Radio13 name="w13-ins" checked={choice === "right"} onChange={() => setChoice("right")}>Shift cells r<u>i</u>ght</Radio13>
        <Radio13 name="w13-ins" checked={choice === "down"} onChange={() => setChoice("down")}>Shift cells <u>d</u>own</Radio13>
        <Radio13 name="w13-ins" checked={choice === "row"} onChange={() => setChoice("row")}>Insert entire <u>r</u>ow</Radio13>
        <Radio13 name="w13-ins" checked={choice === "column"} onChange={() => setChoice("column")}>Insert entire <u>c</u>olumn</Radio13>
      </div>
      <OkCancel13 onOk={() => onSubmit(choice)} />
    </Window13>
  );
}

export function DeleteCellsDialog2013({ onSubmit }: { onSubmit: (choice: "left" | "up" | "row" | "column") => void }) {
  const [choice, setChoice] = useState<"left" | "up" | "row" | "column">("left");
  return (
    <Window13 title="Delete Cells" width={240}>
      <div style={{ display: "grid", gap: 6, marginTop: 10, marginLeft: 6 }}>
        <Radio13 name="w13-del" checked={choice === "left"} onChange={() => setChoice("left")}>Shift cells l<u>e</u>ft</Radio13>
        <Radio13 name="w13-del" checked={choice === "up"} onChange={() => setChoice("up")}>Shift cells <u>u</u>p</Radio13>
        <Radio13 name="w13-del" checked={choice === "row"} onChange={() => setChoice("row")}>Delete entire <u>r</u>ow</Radio13>
        <Radio13 name="w13-del" checked={choice === "column"} onChange={() => setChoice("column")}>Delete entire <u>c</u>olumn</Radio13>
      </div>
      <OkCancel13 onOk={() => onSubmit(choice)} />
    </Window13>
  );
}

export function SplitCellsDialog2013({ canMerge, onSubmit }: { canMerge: boolean; onSubmit: (columns: number, rows: number, mergeFirst: boolean) => void }) {
  const [columns, setColumns] = useState<number | null>(2), [rows, setRows] = useState<number | null>(1), [mergeFirst, setMergeFirst] = useState(canMerge);
  return (
    <Window13 title="Split Cells" width={260}>
      <div className="w13-row" style={{ marginTop: 10 }}><span className="w13-label" style={{ width: 130 }}>Number of <u>c</u>olumns:</span><Number13 label="Number of columns" value={columns} onChange={setColumns} min={1} max={20} decimals={0} width={64} /></div>
      <div className="w13-row"><span className="w13-label" style={{ width: 130 }}>Number of <u>r</u>ows:</span><Number13 label="Number of rows" value={rows} onChange={setRows} min={1} max={50} decimals={0} width={64} /></div>
      <div className="w13-row" style={{ marginTop: 8 }}><Check13 checked={mergeFirst && canMerge} disabled={!canMerge} onChange={setMergeFirst}><u>M</u>erge cells before split</Check13></div>
      <OkCancel13 onOk={() => onSubmit(Math.round(columns ?? 2), Math.round(rows ?? 1), mergeFirst && canMerge)} />
    </Window13>
  );
}

export type SortKeyValues = { column: number | null; type: "text" | "number" | "date"; order: "ascending" | "descending" };
export type SortValues = { keys: SortKeyValues[]; hasHeader: boolean; caseSensitive: boolean; columnOnly: boolean };
export function SortDialog2013({ columns, headerNames, onSubmit }: { columns: number; headerNames: string[]; onSubmit: (values: SortValues) => void }) {
  const [values, setValues] = useState<SortValues>({ keys: [{ column: 0, type: "text", order: "ascending" }, { column: null, type: "text", order: "ascending" }, { column: null, type: "text", order: "ascending" }], hasHeader: true, caseSensitive: false, columnOnly: false });
  const [optionsOpen, setOptionsOpen] = useState(false);
  const setKey = (index: number, patch: Partial<SortKeyValues>) => setValues(current => ({ ...current, keys: current.keys.map((key, i) => (i === index ? { ...key, ...patch } : key)) }));
  const names = Array.from({ length: columns }, (_, c) => (values.hasHeader && headerNames[c]?.trim() ? headerNames[c].trim() : `Column ${c + 1}`));
  const keyRow = (index: number, heading: ReactNode) => {
    const key = values.keys[index];
    const off = index > 0 && key.column === null;
    const enabled = index === 0 || values.keys[index - 1].column !== null;
    return <div key={index}>
      <Group13>{heading}</Group13>
      <div style={{ display: "grid", gridTemplateColumns: "150px auto 1fr", gap: "4px 10px", alignItems: "center", marginLeft: 12 }}>
        <select className="w13-select" aria-label={index === 0 ? "Sort by" : `Then by ${index}`} disabled={!enabled} style={{ width: 150 }} value={key.column ?? ""} onChange={event => setKey(index, { column: event.target.value === "" ? null : Number(event.target.value) })}>{index > 0 && <option value="">(none)</option>}{names.map((name, c) => <option key={c} value={c}>{name}</option>)}</select>
        <div className="w13-row" style={{ margin: 0 }}><span style={{ width: 40, color: off ? "#8a8a8a" : undefined }}>T<u>y</u>pe:</span><select className="w13-select" aria-label={`Sort type ${index + 1}`} disabled={off || !enabled} style={{ width: 92 }} value={key.type} onChange={event => setKey(index, { type: event.target.value as SortKeyValues["type"] })}><option value="text">Text</option><option value="number">Number</option><option value="date">Date</option></select></div>
        <Radio13 name={`w13-sort-order-${index}`} disabled={off || !enabled} checked={key.order === "ascending"} onChange={() => setKey(index, { order: "ascending" })}><u>A</u>scending</Radio13>
        <span />
        <div className="w13-row" style={{ margin: 0 }}><span style={{ width: 40, color: "#8a8a8a" }}>Using:</span><select className="w13-select" aria-label={`Sort using ${index + 1}`} disabled style={{ width: 92 }} value="paragraphs" onChange={() => undefined}><option value="paragraphs">Paragraphs</option></select></div>
        <Radio13 name={`w13-sort-order-${index}`} disabled={off || !enabled} checked={key.order === "descending"} onChange={() => setKey(index, { order: "descending" })}><u>D</u>escending</Radio13>
      </div>
    </div>;
  };
  return (
    <Window13 title="Sort" width={470}>
      {keyRow(0, <><u>S</u>ort by</>)}
      {keyRow(1, <><u>T</u>hen by</>)}
      {keyRow(2, <>Then <u>b</u>y</>)}
      <Group13>My list has</Group13>
      <div className="w13-row" style={{ marginLeft: 12, gap: 18 }}><Radio13 name="w13-sort-header" checked={values.hasHeader} onChange={() => setValues(current => ({ ...current, hasHeader: true }))}>Hea<u>d</u>er row</Radio13><Radio13 name="w13-sort-header" checked={!values.hasHeader} onChange={() => setValues(current => ({ ...current, hasHeader: false }))}>No header ro<u>w</u></Radio13></div>
      <OkCancel13 left={<Button13 onClick={() => setOptionsOpen(true)}><u>O</u>ptions…</Button13>} onOk={() => onSubmit(values)} />
      {optionsOpen && <SubDialog13 onClose={() => setOptionsOpen(false)}><SortOptionsDialog2013 values={{ caseSensitive: values.caseSensitive, columnOnly: values.columnOnly }} onSubmit={next => { setValues(current => ({ ...current, ...next })); setOptionsOpen(false); }} /></SubDialog13>}
    </Window13>
  );
}

function SortOptionsDialog2013({ values: initial, onSubmit }: { values: { caseSensitive: boolean; columnOnly: boolean }; onSubmit: (values: { caseSensitive: boolean; columnOnly: boolean }) => void }) {
  const [values, setValues] = useState(initial);
  return (
    <Window13 title="Sort Options" width={320}>
      <Group13>Separate fields at</Group13>
      <div className="w13-row" style={{ marginLeft: 12, gap: 14, color: "#8a8a8a" }}><Radio13 name="w13-sort-sep" checked disabled onChange={() => undefined}><u>T</u>abs</Radio13><Radio13 name="w13-sort-sep" checked={false} disabled onChange={() => undefined}><u>C</u>ommas</Radio13><Radio13 name="w13-sort-sep" checked={false} disabled onChange={() => undefined}><u>O</u>ther:</Radio13></div>
      <Group13>Sort options</Group13>
      <div style={{ display: "grid", gap: 6, marginLeft: 12 }}>
        <Check13 checked={values.columnOnly} onChange={on => setValues(current => ({ ...current, columnOnly: on }))}>Sort column onl<u>y</u></Check13>
        <Check13 checked={values.caseSensitive} onChange={on => setValues(current => ({ ...current, caseSensitive: on }))}>Case <u>s</u>ensitive</Check13>
      </div>
      <Group13>Sorting language</Group13>
      <select className="w13-select" aria-label="Sorting language" style={{ width: "calc(100% - 12px)", marginLeft: 12 }} value="en-US" onChange={() => undefined}><option value="en-US">English (United States)</option></select>
      <OkCancel13 onOk={() => onSubmit(values)} />
    </Window13>
  );
}

const SEPARATOR_CHOICES: [string, ReactNode][] = [["paragraph", <><u>P</u>aragraph marks</>], ["tab", <><u>T</u>abs</>], ["comma", <><u>C</u>ommas</>], ["other", <><u>O</u>ther:</>]];
const separatorValue = (kind: string, other: string) => (kind === "paragraph" ? "\n" : kind === "tab" ? "\t" : kind === "comma" ? "," : other || "-");

export function ConvertToTextDialog2013({ onSubmit }: { onSubmit: (separator: string) => void }) {
  const [kind, setKind] = useState("tab"), [other, setOther] = useState("-");
  return (
    <Window13 title="Convert Table To Text" width={280}>
      <Group13>Separate text with</Group13>
      <div style={{ display: "grid", gap: 4, marginLeft: 12 }}>{SEPARATOR_CHOICES.map(([id, label]) => <div key={id} className="w13-row" style={{ margin: 0 }}><Radio13 name="w13-convert-text" checked={kind === id} onChange={() => setKind(id)}>{label}</Radio13>{id === "other" && <input className="w13-field" style={{ width: 30 }} maxLength={1} value={other} aria-label="Other separator" onChange={event => { setOther(event.target.value); setKind("other"); }} />}</div>)}</div>
      <div style={{ marginTop: 8, marginLeft: 12 }}><Check13 checked={false} disabled title="This document's tables cannot contain nested tables.">Convert nested <u>t</u>ables</Check13></div>
      <OkCancel13 onOk={() => onSubmit(separatorValue(kind, other))} />
    </Window13>
  );
}

export function ConvertTextToTableDialog2013({ guessColumns, rows, onSubmit }: { guessColumns: (separator: string) => number; rows: number; onSubmit: (separator: string, columns: number, layout: string) => void }) {
  const [kind, setKind] = useState("tab"), [other, setOther] = useState("-");
  const [columns, setColumns] = useState<number | null>(() => guessColumns("\t"));
  const [layout, setLayout] = useState("fixed");
  const pick = (id: string) => { setKind(id); setColumns(guessColumns(separatorValue(id, other))); };
  return (
    <Window13 title="Convert Text to Table" width={320}>
      <Group13>Table size</Group13>
      <div className="w13-row" style={{ marginLeft: 12 }}><span className="w13-label" style={{ width: 130 }}>Number of <u>c</u>olumns:</span><Number13 label="Number of columns" value={columns} onChange={setColumns} min={1} max={20} decimals={0} width={64} /></div>
      <div className="w13-row" style={{ marginLeft: 12 }}><span className="w13-label" style={{ width: 130, color: "#8a8a8a" }}>Number of rows:</span><input className="w13-field" style={{ width: 64 }} disabled readOnly value={rows} aria-label="Number of rows" /></div>
      <Group13>AutoFit behavior</Group13>
      <div style={{ display: "grid", gap: 4, marginLeft: 12 }}>
        <div className="w13-row" style={{ margin: 0 }}><Radio13 name="w13-ttt-fit" checked={layout === "fixed"} onChange={() => setLayout("fixed")}>Fi<u>x</u>ed column width:</Radio13><input className="w13-field" style={{ width: 62, marginLeft: "auto" }} disabled={layout !== "fixed"} readOnly value="Auto" aria-label="Fixed column width" /></div>
        <Radio13 name="w13-ttt-fit" checked={layout === "auto"} onChange={() => setLayout("auto")}>Auto<u>F</u>it to contents</Radio13>
        <Radio13 name="w13-ttt-fit" checked={layout === "window"} onChange={() => setLayout("window")}>AutoFit to win<u>d</u>ow</Radio13>
      </div>
      <Group13>Separate text at</Group13>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, marginLeft: 12 }}>{SEPARATOR_CHOICES.map(([id, label]) => <div key={id} className="w13-row" style={{ margin: 0 }}><Radio13 name="w13-ttt-sep" checked={kind === id} onChange={() => pick(id)}>{id === "paragraph" ? <><u>P</u>aragraphs</> : label}</Radio13>{id === "other" && <input className="w13-field" style={{ width: 30 }} maxLength={1} value={other} aria-label="Other separator" onChange={event => { setOther(event.target.value); setKind("other"); setColumns(guessColumns(event.target.value || "-")); }} />}</div>)}</div>
      <OkCancel13 onOk={() => onSubmit(separatorValue(kind, other), Math.round(columns ?? 1), layout)} />
    </Window13>
  );
}

const NUMBER_FORMATS = ["", "0", "0.00", "#,##0", "#,##0.00", "0%", "0.00%", "$#,##0.00;($#,##0.00)"];
export function formatFormulaResult(value: number, format: string) {
  if (format === "0") return String(Math.round(value));
  if (format === "0.00") return value.toFixed(2);
  if (format === "#,##0") return Math.round(value).toLocaleString("en-US");
  if (format === "#,##0.00") return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (format === "0%") return `${Math.round(value)}%`;
  if (format === "0.00%") return `${value.toFixed(2)}%`;
  if (format.startsWith("$")) { const text = `$${Math.abs(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; return value < 0 ? `(${text})` : text; }
  return String(value);
}
export function FormulaDialog2013({ initial, onSubmit }: { initial: string; onSubmit: (formula: string, format: string) => void }) {
  const [formula, setFormula] = useState(initial), [format, setFormat] = useState("");
  return (
    <Window13 title="Formula" width={360}>
      <div style={{ marginTop: 6 }}><u>F</u>ormula:</div>
      <input className="w13-field" style={{ width: "100%", marginTop: 2 }} aria-label="Formula" value={formula} onChange={event => setFormula(event.target.value)} />
      <div style={{ marginTop: 8 }}><u>N</u>umber format:</div>
      <select className="w13-select" style={{ width: "100%", marginTop: 2 }} aria-label="Number format" value={format} onChange={event => setFormat(event.target.value)}>{NUMBER_FORMATS.map(item => <option key={item} value={item}>{item}</option>)}</select>
      <div className="w13-row" style={{ marginTop: 10, gap: 10 }}>
        <div style={{ display: "grid", gap: 2, flex: 1 }}><span>Paste f<u>u</u>nction:</span>
          <select className="w13-select" aria-label="Paste function" value="" onChange={event => { if (event.target.value) setFormula(current => `${current || "="}${event.target.value}()`); }}><option value="" /><option>ABS</option><option>AVERAGE</option><option>COUNT</option><option>MAX</option><option>MIN</option><option>PRODUCT</option><option>SUM</option></select></div>
        <div style={{ display: "grid", gap: 2, flex: 1 }}><span style={{ color: "#8a8a8a" }}>Paste <u>b</u>ookmark:</span>
          <select className="w13-select" aria-label="Paste bookmark" disabled value="" onChange={() => undefined}><option value="" /></select></div>
      </div>
      <OkCancel13 onOk={() => onSubmit(formula, format)} />
    </Window13>
  );
}

// ---- Borders and Shading ----
export type BorderEdgeKey = "top" | "bottom" | "left" | "right" | "insideH" | "insideV" | "diagonalDown" | "diagonalUp";
export type BorderEdges = Record<BorderEdgeKey, boolean>;
export const SHADING_PATTERNS: { id: string; label: string; strength: number }[] = [
  { id: "clear", label: "Clear", strength: 0 }, { id: "solid", label: "Solid (100%)", strength: 1 },
  ...[5, 10, 12.5, 15, 20, 25, 30, 35, 37.5, 40, 45, 50, 55, 60, 62.5, 65, 70, 75, 80, 85, 87.5, 90, 95].map(pct => ({ id: String(pct), label: `${pct}%`, strength: pct / 100 })),
];
export type BordersShadingValues = {
  setting: "none" | "box" | "all" | "grid" | "shadow" | "3d" | "custom"; edges: BorderEdges; style: "solid" | "double" | "dotted" | "dashed"; color: string; width: number; applyTo: "cell" | "table" | "paragraph" | "text";
  fill: string | null; pattern: string; patternColor: string | null; shadingApplyTo: "cell" | "table" | "paragraph" | "text";
  pageSetting: "none" | "box" | "shadow" | "3d" | "custom"; pageStyle: "solid" | "double" | "dotted" | "dashed" | "wave" | "doubleWave"; pageColor: string; pageWidth: number;
  /** Page Border sides (Word: click the preview or its buttons; e.g. bottom and right only). */
  pageEdges?: { top: boolean; bottom: boolean; left: boolean; right: boolean };
};
const EDGE_PRESETS: Record<"none" | "box" | "all" | "grid", BorderEdges> = {
  none: { top: false, bottom: false, left: false, right: false, insideH: false, insideV: false, diagonalDown: false, diagonalUp: false },
  box: { top: true, bottom: true, left: true, right: true, insideH: false, insideV: false, diagonalDown: false, diagonalUp: false },
  all: { top: true, bottom: true, left: true, right: true, insideH: true, insideV: true, diagonalDown: false, diagonalUp: false },
  grid: { top: true, bottom: true, left: true, right: true, insideH: true, insideV: true, diagonalDown: false, diagonalUp: false },
};
export const bordersPreset = (setting: "none" | "box" | "all" | "grid") => ({ ...EDGE_PRESETS[setting] });
const STYLE_LIST = ["solid", "dotted", "dashed", "double"] as const;
// Word's Page Border style list also has Wave and Double wave (paragraph/table borders here keep the
// four CSS line styles). A page border "with a waved line" could not be made before.
const PAGE_STYLE_LIST = [...STYLE_LIST, "wave", "doubleWave"] as const;
const WaveSample = ({ double }: { double?: boolean }) => <svg aria-hidden width="100%" height={double ? 12 : 8} preserveAspectRatio="none" viewBox={`0 0 100 ${double ? 12 : 8}`} style={{ display: "block", margin: "4px 0" }}><path d="M0 4 Q2.5 0 5 4 T10 4 T15 4 T20 4 T25 4 T30 4 T35 4 T40 4 T45 4 T50 4 T55 4 T60 4 T65 4 T70 4 T75 4 T80 4 T85 4 T90 4 T95 4 T100 4" fill="none" stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke" />{double && <path d="M0 9 Q2.5 5 5 9 T10 9 T15 9 T20 9 T25 9 T30 9 T35 9 T40 9 T45 9 T50 9 T55 9 T60 9 T65 9 T70 9 T75 9 T80 9 T85 9 T90 9 T95 9 T100 9" fill="none" stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke" />}</svg>;
const PT_LABELS: Record<number, string> = { 0.25: "¼ pt", 0.5: "½ pt", 0.75: "¾ pt", 1: "1 pt", 1.5: "1 ½ pt", 2.25: "2 ¼ pt", 3: "3 pt", 4.5: "4 ½ pt", 6: "6 pt" };
const cssLine = (style: string, width: number, color: string) => `${style === "double" ? Math.max(3, Math.round(width * 4 / 3)) : Math.max(1, Math.round(width * 4 / 3))}px ${style} #${color}`;

function PaletteSelect13({ value, onChange, label, autoLabel, width = "100%" }: { value: string | null; onChange: (hex: string | null) => void; label: string; autoLabel: string; width?: number | string }) {
  const menu = useMenu();
  return <>
    <button ref={element => { menu.buttonRef.current = element; }} type="button" className="w13-select" aria-label={label} aria-haspopup="menu" style={{ width, textAlign: "left" }} onMouseDown={event => event.preventDefault()} onClick={() => menu.setOpen(open => !open)}>
      {value ? <span aria-hidden style={{ display: "inline-block", width: 40, height: 12, marginRight: 6, border: "1px solid #666", background: `#${value}`, verticalAlign: "-2px" }} /> : null}<span>{value ? colorLabel(value) : autoLabel}</span>
    </button>
    {menu.open && createPortal(<div ref={menu.menuRef} role="menu" aria-label={`${label} palette`} className="wi-menu wr-menu" style={{ ...menu.style, width: 232 }}><WordPalette noneLabel={autoLabel} close={() => menu.setOpen(false)} onPick={onChange} /></div>, document.body)}
  </>;
}
const colorLabel = (hex: string) => TABLE_COLORS.find(color => color.hex === hex.toUpperCase())?.name ?? `#${hex.toUpperCase()}`;

// Word 2013's Borders and Shading dialog. mode "table" borders table cells (Setting: None, Box,
// All, Grid, Custom; inside and diagonal edges); mode "paragraph" is the dialog Home > Borders
// opens for text (Setting: None, Box, Shadow, 3-D, Custom; top/bottom/left/right; Apply to:
// Paragraph or Text). The Page Border tab can have any sides, e.g. bottom and right only.
export function BordersShadingDialog2013({ initial, widths, initialTab = "borders", onSubmit, mode = "table" }: { initial: BordersShadingValues; widths: number[]; initialTab?: "borders" | "page" | "shading"; onSubmit: (values: BordersShadingValues) => void; mode?: "table" | "paragraph" }) {
  const paragraph = mode === "paragraph";
  const allSides = { top: true, bottom: true, left: true, right: true }, noSides = { top: false, bottom: false, left: false, right: false };
  const [values, setValues] = useState<BordersShadingValues>(() => ({ ...initial, pageEdges: initial.pageEdges ?? (initial.pageSetting === "none" ? noSides : allSides) }));
  const [tab, setTab] = useState<string>(initialTab);
  const set = (patch: Partial<BordersShadingValues>) => setValues(current => ({ ...current, ...patch }));
  const toggle = (edge: BorderEdgeKey) => setValues(current => ({ ...current, setting: "custom", edges: { ...current.edges, [edge]: !current.edges[edge] } }));
  const pageEdges = values.pageEdges ?? allSides;
  const togglePage = (edge: keyof typeof allSides) => setValues(current => { const edges = { ...(current.pageEdges ?? allSides), [edge]: !(current.pageEdges ?? allSides)[edge] }; const any = edges.top || edges.bottom || edges.left || edges.right; return { ...current, pageEdges: edges, pageSetting: any ? "custom" : "none" }; });
  const boxEdges = { ...bordersPreset("box") };
  const settingTile = (id: BordersShadingValues["setting"], label: ReactNode, drawing: ReactNode) => <button type="button" className="w13-setting" aria-pressed={values.setting === id} onMouseDown={event => event.preventDefault()} onClick={() => { if (id === "custom") set({ setting: "custom" }); else if (id === "shadow" || id === "3d") set({ setting: id, edges: boxEdges }); else set({ setting: id, edges: bordersPreset(id as "none" | "box" | "all" | "grid") }); }}><svg width="40" height="34" viewBox="0 0 40 34" aria-hidden><rect x="1" y="1" width="38" height="32" fill="#fff" stroke="#d0d0d0" />{drawing}</svg><span>{label}</span></button>;
  const page = (stroke: number) => <rect x="8" y="5" width="24" height="24" fill="none" stroke="#000" strokeWidth={stroke} />;
  const cells = <path d="M20 5v24M8 17h24" stroke="#bbb" strokeWidth=".7" />;
  const lines = <path d="M12 10h16M12 14h16M12 18h16M12 22h16M12 26h10" stroke="#9a9a9a" strokeWidth=".9" />;
  const edgeLine = (edge: BorderEdgeKey) => values.edges[edge] ? cssLine(values.style, values.width, values.color) : "1px dashed #c6c6c6";
  const edgeButton = (pressed: boolean, onClick: () => void, drawing: ReactNode, name: string) => <button type="button" className="w13-edge" aria-pressed={pressed} aria-label={name} title={name} onMouseDown={event => event.preventDefault()} onClick={onClick}><svg width="20" height="20" viewBox="0 0 20 20" aria-hidden><rect x="3" y="3" width="14" height="14" fill="#fff" stroke="#bbb" strokeDasharray="1.5 1" />{drawing}</svg></button>;
  const edge = (key: BorderEdgeKey, drawing: ReactNode, name: string) => edgeButton(values.edges[key], () => toggle(key), drawing, name);
  const pageEdge = (key: keyof typeof allSides, drawing: ReactNode, name: string) => edgeButton(pageEdges[key] && values.pageSetting !== "none", () => togglePage(key), drawing, name);
  const ln = (d: string) => <path d={d} stroke="#000" strokeWidth="1.6" />;
  const pattern = SHADING_PATTERNS.find(item => item.id === values.pattern) ?? SHADING_PATTERNS[0];
  const shadingResult = pattern.strength === 0 ? values.fill : mixColors(values.fill ?? "FFFFFF", values.patternColor ?? "000000", pattern.strength);
  const styleList = <S extends string>(current: string, onPick: (style: S) => void, label: string, list: readonly S[] = STYLE_LIST as unknown as readonly S[]) => <div className="w13-list" role="listbox" aria-label={label} style={{ height: 92 }}>
    {list.map(style => <button key={style} type="button" role="option" aria-label={({ solid: "Single line", dotted: "Dotted", dashed: "Dashed", double: "Double", wave: "Wave", doubleWave: "Double wave" } as Record<string, string>)[style] ?? style} aria-selected={current === style} onMouseDown={event => event.preventDefault()} onClick={() => onPick(style)}>{style === "wave" || style === "doubleWave" ? <WaveSample double={style === "doubleWave"} /> : <span style={{ display: "block", margin: "7px 4px", borderTop: `${style === "double" ? 3 : 1}px ${style} currentColor` }} />}</button>)}
  </div>;
  const nearest = (event: React.MouseEvent<HTMLElement>, keys: BorderEdgeKey[]) => { const box = event.currentTarget.getBoundingClientRect(); const x = (event.clientX - box.left) / box.width, y = (event.clientY - box.top) / box.height; const distance: Record<string, number> = { top: y, bottom: 1 - y, left: x, right: 1 - x, insideH: Math.abs(y - 0.5), insideV: Math.abs(x - 0.5) }; return [...keys].sort((first, second) => distance[first] - distance[second])[0]; };
  const paragraphShadow = values.setting === "shadow" ? "4px 4px 0 #000" : values.setting === "3d" ? "-2px -2px 0 #999" : undefined;
  const pageLine = cssLine(values.pageStyle, values.pageWidth, values.pageColor);
  const pageSide = (key: keyof typeof allSides) => values.pageSetting !== "none" && pageEdges[key] ? pageLine : "1px dashed #c6c6c6";
  const sideTiles = (current: string, pick: (id: "none" | "box" | "shadow" | "3d" | "custom") => void) => (["none", "box", "shadow", "3d", "custom"] as const).map(id => <button key={id} type="button" className="w13-setting" aria-pressed={current === id} onMouseDown={event => event.preventDefault()} onClick={() => pick(id)}>
    <svg width="40" height="34" viewBox="0 0 40 34" aria-hidden><rect x="1" y="1" width="38" height="32" fill="#fff" stroke="#d0d0d0" />{id !== "none" && id !== "custom" && <rect x="9" y="4" width="22" height="26" fill="#fff" stroke="#000" strokeWidth="1.3" />}{id === "shadow" && <path d="M32 6v25H11" stroke="#000" strokeWidth="2.4" />}{id === "3d" && <path d="M9 4l2-2h22v26l-2 2" stroke="#777" />}{id === "custom" && <path d="M9 4h22M9 30h22" stroke="#000" strokeWidth="1.3" strokeDasharray="2 1.5" />}{lines}</svg>
    <span>{id === "none" ? <><u>N</u>one</> : id === "box" ? <>Bo<u>x</u></> : id === "shadow" ? <>Sh<u>a</u>dow</> : id === "3d" ? <>3-<u>D</u></> : <>C<u>u</u>stom</>}</span></button>);
  return (
    <Window13 title="Borders and Shading" width={560}>
      <Tabs13 tabs={[{ id: "borders", label: <><u>B</u>orders</> }, { id: "page", label: <><u>P</u>age Border</> }, { id: "shading", label: <><u>S</u>hading</> }]} value={tab} onChange={setTab} />
      <div className="w13-panel" style={{ minHeight: 300 }}>
        {tab === "borders" && <div style={{ display: "grid", gridTemplateColumns: "96px 150px 1fr", gap: 14 }}>
          <div style={{ display: "grid", gap: 4, alignContent: "start" }}><span>Setting:</span>
            {paragraph ? sideTiles(values.setting, id => { if (id === "custom") set({ setting: "custom" }); else set({ setting: id, edges: id === "none" ? bordersPreset("none") : boxEdges }); }) : <>
              {settingTile("none", <><u>N</u>one</>, null)}
              {settingTile("box", <>Bo<u>x</u></>, page(1.4))}
              {settingTile("all", <><u>A</u>ll</>, <>{page(1.4)}<path d="M20 5v24M8 17h24" stroke="#000" strokeWidth="1" /></>)}
              {settingTile("grid", <>Gri<u>d</u></>, <>{page(2.6)}<path d="M20 5v24M8 17h24" stroke="#000" strokeWidth="1" /></>)}
              {settingTile("custom", <>C<u>u</u>stom</>, <>{cells}<path d="M8 5h24M20 5v24" stroke="#000" strokeWidth="1.4" /></>)}
            </>}
          </div>
          <div><span>St<u>y</u>le:</span>
            {styleList<BordersShadingValues["style"]>(values.style, style => set({ style, setting: values.setting === "none" ? "box" : values.setting, edges: values.setting === "none" ? boxEdges : values.edges }), "Border style")}
            <div style={{ marginTop: 8 }}><u>C</u>olor:</div>
            <PaletteSelect13 label="Border color" autoLabel="Automatic" value={values.color === "000000" ? null : values.color} onChange={hex => set({ color: hex ?? "000000" })} />
            <div style={{ marginTop: 8 }}><u>W</u>idth:</div>
            <select className="w13-select" style={{ width: "100%" }} aria-label="Border width" value={values.width} onChange={event => set({ width: Number(event.target.value) })}>{widths.map(width => <option key={width} value={width}>{PT_LABELS[width] ?? `${width} pt`}</option>)}</select>
          </div>
          <div><span>Preview</span>
            <div className="w13-note" style={{ fontSize: 11, margin: "2px 0 4px", textAlign: "center" }}>Click on diagram below or use buttons to apply borders</div>
            <div style={{ display: "grid", gridTemplateColumns: "26px 1fr", gap: 4 }}>
              <div style={{ display: "grid", gap: 6, alignContent: "start", paddingTop: paragraph ? 18 : 0 }}>
                {edge("top", ln("M3 3h14"), "Top Border")}{!paragraph && edge("insideH", ln("M3 10h14"), "Inside Horizontal Border")}{edge("bottom", ln("M3 17h14"), "Bottom Border")}
              </div>
              <div>
                {paragraph
                  ? <div className="w13-border-preview w13-paragraph-preview" onMouseDown={event => event.preventDefault()} onClick={event => toggle(nearest(event, ["top", "bottom", "left", "right"]))}>
                    <div style={{ borderTop: edgeLine("top"), borderBottom: edgeLine("bottom"), borderLeft: edgeLine("left"), borderRight: edgeLine("right"), boxShadow: values.setting !== "none" ? paragraphShadow : undefined }}>
                      {Array.from({ length: 6 }, (_, index) => <span key={index} style={{ width: index === 5 ? "45%" : "100%" }} />)}
                    </div>
                  </div>
                  : <div className="w13-border-preview" onMouseDown={event => event.preventDefault()} onClick={event => toggle(nearest(event, ["top", "bottom", "left", "right", "insideH", "insideV"]))}
                    style={{ borderTop: edgeLine("top"), borderBottom: edgeLine("bottom"), borderLeft: edgeLine("left"), borderRight: edgeLine("right") }}>
                    <span style={{ position: "absolute", left: 0, right: 0, top: "50%", borderTop: edgeLine("insideH") }} />
                    <span style={{ position: "absolute", top: 0, bottom: 0, left: "50%", borderLeft: edgeLine("insideV") }} />
                    {values.edges.diagonalDown && <svg className="w13-diag" viewBox="0 0 10 10" preserveAspectRatio="none" aria-hidden><path d="M0 0L10 10" stroke={`#${values.color}`} strokeWidth=".15" /></svg>}
                    {values.edges.diagonalUp && <svg className="w13-diag" viewBox="0 0 10 10" preserveAspectRatio="none" aria-hidden><path d="M0 10L10 0" stroke={`#${values.color}`} strokeWidth=".15" /></svg>}
                    {[0, 1, 2, 3].map(i => <span key={i} className="w13-preview-text" style={{ gridArea: `${Math.floor(i / 2) + 1} / ${(i % 2) + 1}` }}>Text text text text text</span>)}
                  </div>}
                <div className="w13-row" style={{ justifyContent: paragraph ? "space-around" : "space-between", marginTop: 6 }}>
                  {!paragraph && edge("diagonalUp", ln("M3 17L17 3"), "Diagonal Up Border")}{edge("left", ln("M3 3v14"), "Left Border")}{!paragraph && edge("insideV", ln("M10 3v14"), "Inside Vertical Border")}{edge("right", ln("M17 3v14"), "Right Border")}{!paragraph && edge("diagonalDown", ln("M3 3l14 14"), "Diagonal Down Border")}
                </div>
              </div>
            </div>
            <div style={{ marginTop: 8 }}>Apply t<u>o</u>:</div>
            <select className="w13-select" style={{ width: "100%" }} aria-label="Apply to" value={values.applyTo} onChange={event => set({ applyTo: event.target.value as BordersShadingValues["applyTo"] })}>{paragraph ? <><option value="paragraph">Paragraph</option><option value="text">Text</option></> : <><option value="table">Table</option><option value="cell">Cell</option></>}</select>
            <div className="w13-row" style={{ justifyContent: "flex-end", marginTop: 6 }}><Button13 disabled title={paragraph ? "The distance between the border and the text is fixed in this exam editor." : "Table cell spacing is set in Table Options."}><u>O</u>ptions…</Button13></div>
          </div>
        </div>}
        {tab === "page" && <div style={{ display: "grid", gridTemplateColumns: "96px 150px 1fr", gap: 14 }}>
          <div style={{ display: "grid", gap: 4, alignContent: "start" }}><span>Setting:</span>
            {sideTiles(values.pageSetting, id => set({ pageSetting: id, pageEdges: id === "none" ? noSides : id === "custom" ? pageEdges : allSides }))}
          </div>
          <div><span>St<u>y</u>le:</span>
            {styleList<BordersShadingValues["pageStyle"]>(values.pageStyle, style => set({ pageStyle: style, pageSetting: values.pageSetting === "none" ? "box" : values.pageSetting, pageEdges: values.pageSetting === "none" ? allSides : pageEdges }), "Page border style", PAGE_STYLE_LIST)}
            <div style={{ marginTop: 8 }}><u>C</u>olor:</div>
            <PaletteSelect13 label="Page border color" autoLabel="Automatic" value={values.pageColor === "000000" ? null : values.pageColor} onChange={hex => set({ pageColor: hex ?? "000000" })} />
            <div style={{ marginTop: 8 }}><u>W</u>idth:</div>
            <select className="w13-select" style={{ width: "100%" }} aria-label="Page border width" value={values.pageWidth} onChange={event => set({ pageWidth: Number(event.target.value) })}>{widths.map(width => <option key={width} value={width}>{PT_LABELS[width] ?? `${width} pt`}</option>)}</select>
            <div style={{ marginTop: 8, color: "#8a8a8a" }}>A<u>r</u>t:</div>
            <select className="w13-select" style={{ width: "100%" }} aria-label="Page border art" disabled value="" onChange={() => undefined}><option value="">(none)</option></select>
          </div>
          <div><span>Preview</span>
            <div className="w13-note" style={{ fontSize: 11, margin: "2px 0 4px", textAlign: "center" }}>Click on diagram below or use buttons to apply borders</div>
            <div style={{ display: "grid", gridTemplateColumns: "26px 1fr", gap: 4 }}>
              <div style={{ display: "grid", gap: 40, alignContent: "start", paddingTop: 22 }}>
                {pageEdge("top", ln("M3 3h14"), "Top Border")}{pageEdge("bottom", ln("M3 17h14"), "Bottom Border")}
              </div>
              <div>
                <div className="w13-page-preview" onMouseDown={event => event.preventDefault()} onClick={event => togglePage(nearest(event, ["top", "bottom", "left", "right"]) as keyof typeof allSides)}>
                  <div style={{ borderTop: pageSide("top"), borderBottom: pageSide("bottom"), borderLeft: pageSide("left"), borderRight: pageSide("right"), boxShadow: values.pageSetting === "shadow" ? "4px 4px 0 #000" : values.pageSetting === "3d" ? "-2px -2px 0 #999" : undefined }}>{Array.from({ length: 9 }, (_, index) => <span key={index} className="w13-page-line" style={{ width: index === 8 ? "45%" : "78%" }} />)}</div>
                </div>
                <div className="w13-row" style={{ justifyContent: "space-around", marginTop: 6 }}>{pageEdge("left", ln("M3 3v14"), "Left Border")}{pageEdge("right", ln("M17 3v14"), "Right Border")}</div>
              </div>
            </div>
            <div style={{ marginTop: 8 }}>Apply t<u>o</u>:</div>
            <select className="w13-select" style={{ width: "100%" }} aria-label="Page border apply to" value="document" onChange={() => undefined}><option value="document">Whole document</option></select>
            <div className="w13-row" style={{ justifyContent: "flex-end", marginTop: 6 }}><Button13 disabled title="The page border's distance from the text is fixed in this exam editor."><u>O</u>ptions…</Button13></div>
          </div>
        </div>}
        {tab === "shading" && <div style={{ display: "grid", gridTemplateColumns: "1fr 210px", gap: 18 }}>
          <div>
            <Group13>Fi<u>l</u>l</Group13>
            <div style={{ marginLeft: 12 }}><PaletteSelect13 label="Shading fill" autoLabel="No Color" value={values.fill} onChange={hex => set({ fill: hex })} width={140} /></div>
            <Group13>Patterns</Group13>
            <div className="w13-row" style={{ marginLeft: 12 }}><span style={{ width: 42 }}>St<u>y</u>le:</span><select className="w13-select" style={{ width: 130 }} aria-label="Pattern style" value={values.pattern} onChange={event => set({ pattern: event.target.value })}>{SHADING_PATTERNS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></div>
            <div className="w13-row" style={{ marginLeft: 12 }}><span style={{ width: 42, color: pattern.strength === 0 ? "#8a8a8a" : undefined }}><u>C</u>olor:</span><PaletteSelect13 label="Pattern color" autoLabel="Automatic" value={values.patternColor} onChange={hex => set({ patternColor: hex })} width={130} /></div>
          </div>
          <div><span>Preview</span>
            {paragraph
              ? <div className="w13-page-preview" style={{ height: 118 }}><div style={{ border: 0, background: "#fff" }}>{Array.from({ length: 9 }, (_, index) => <span key={index} className="w13-page-line" style={{ width: index === 8 ? "45%" : "78%", background: shadingResult && index > 1 && index < 7 ? `#${shadingResult}` : undefined, height: shadingResult && index > 1 && index < 7 ? 6 : undefined }} />)}</div></div>
              : <div className="w13-preview" style={{ height: 110, marginTop: 4, display: "grid", placeItems: "center", background: shadingResult ? `#${shadingResult}` : "#fff" }}><span style={{ fontSize: 11 }}>AaBbCcYyZz</span></div>}
            <div style={{ marginTop: 8 }}>Apply t<u>o</u>:</div>
            <select className="w13-select" style={{ width: "100%" }} aria-label="Shading apply to" value={values.shadingApplyTo} onChange={event => set({ shadingApplyTo: event.target.value as BordersShadingValues["shadingApplyTo"] })}>{paragraph ? <><option value="paragraph">Paragraph</option><option value="text">Text</option></> : <><option value="cell">Cell</option><option value="table">Table</option></>}</select>
          </div>
        </div>}
      </div>
      <OkCancel13 left={paragraph ? <span /> : <Button13 disabled title="Horizontal lines are not part of this exam editor.">Hori<u>z</u>ontal Line…</Button13>} onOk={() => onSubmit(values)} />
    </Window13>
  );
}
/** The colour a Shading fill + pattern produces (null = no shading). */
export function shadingResultColor(values: Pick<BordersShadingValues, "fill" | "pattern" | "patternColor">) {
  const pattern = SHADING_PATTERNS.find(item => item.id === values.pattern) ?? SHADING_PATTERNS[0];
  return pattern.strength === 0 ? values.fill : mixColors(values.fill ?? "FFFFFF", values.patternColor ?? "000000", pattern.strength);
}

// ---- Page Setup (PAGE LAYOUT > Page Setup launcher / Custom Margins… / More Paper Sizes…) ----
function PagePreview13({ values }: { values: PageSetupValues }) {
  // A small page drawn to scale: portrait or landscape, margins and gutter around the text.
  const landscape = values.orientation === "landscape";
  const pw = landscape ? values.height : values.width, ph = landscape ? values.width : values.height;
  const scale = 80 / Math.max(pw, ph), w = pw * scale, h = ph * scale;
  const gutterLeft = values.gutterPosition === "left" ? values.gutter : 0, gutterTop = values.gutterPosition === "top" ? values.gutter : 0;
  const x = Math.min(w - 4, (values.left + gutterLeft) * scale), y = Math.min(h - 4, (values.top + gutterTop) * scale);
  const tw = Math.max(4, w - x - values.right * scale), th = Math.max(4, h - y - values.bottom * scale);
  const lines = Math.max(1, Math.floor(th / 4));
  return <svg width={w + 6} height={h + 6} viewBox={`-1 -1 ${w + 6} ${h + 6}`} aria-label="Page preview" role="img">
    <defs><pattern id="w13-gutter" width="3" height="3" patternUnits="userSpaceOnUse"><path d="M0 3L3 0" stroke="#a0a0a0" strokeWidth=".6" /></pattern></defs>
    <rect x="3" y="3" width={w} height={h} fill="#7f7f7f" />
    <rect x="0" y="0" width={w} height={h} fill="#fff" stroke="#3c3c3c" />
    {values.gutter > 0 && <rect x="0" y="0" width={values.gutterPosition === "left" ? gutterLeft * scale : w} height={values.gutterPosition === "top" ? gutterTop * scale : h} fill="url(#w13-gutter)" />}
    {Array.from({ length: lines }, (_, i) => <rect key={i} x={x} y={y + i * 4} width={i % 5 === 4 ? tw * 0.6 : tw} height="1.4" fill="#1f1f1f" />)}
  </svg>;
}

export function PageSetupDialog2013({ values: initial, initialTab = "margins", onSubmit, renderBorders }: { values: PageSetupValues; initialTab?: "margins" | "paper" | "layout"; onSubmit: (values: PageSetupValues) => void; renderBorders: (close: () => void) => ReactNode }) {
  const [values, setValues] = useState(initial);
  const [tab, setTab] = useState<string>(initialTab);
  const [sub, setSub] = useState<"lineNumbers" | "borders" | null>(null);
  const set = (patch: Partial<PageSetupValues>) => setValues(current => ({ ...current, ...patch }));
  const mirror = values.multiplePages === "mirror";
  const field = (key: "top" | "bottom" | "left" | "right" | "gutter", label: ReactNode, aria: string) => <>
    <span className="w13-label">{label}</span>
    <Number13 label={aria} value={values[key]} onChange={value => set({ [key]: Math.max(0, value ?? 0) })} dimension="inches" step={0.1} min={0} max={55.88} decimals={2} width={96} />
  </>;
  const apply = <div className="w13-row" style={{ marginTop: 8 }}><span>Appl<u>y</u> to:</span><select className="w13-select" style={{ width: 140 }} aria-label="Apply to" value="whole" onChange={() => undefined}><option value="whole">Whole document</option></select></div>;
  return (
    <Window13 title="Page Setup" width={420}>
      <Tabs13 tabs={[{ id: "margins", label: <><u>M</u>argins</> }, { id: "paper", label: <>Pap<u>e</u>r</> }, { id: "layout", label: <><u>L</u>ayout</> }]} value={tab} onChange={setTab} />
      <div className="w13-panel" style={{ minHeight: 400 }}>
        {tab === "margins" && <>
          <Group13>Margins</Group13>
          <div style={{ display: "grid", gridTemplateColumns: "auto auto auto auto", gap: "6px 10px", alignItems: "center", marginLeft: 12 }}>
            {field("top", <><u>T</u>op:</>, "Top margin")}{field("bottom", <><u>B</u>ottom:</>, "Bottom margin")}
            {field("left", mirror ? <>I<u>n</u>side:</> : <><u>L</u>eft:</>, mirror ? "Inside margin" : "Left margin")}{field("right", mirror ? <>O<u>u</u>tside:</> : <><u>R</u>ight:</>, mirror ? "Outside margin" : "Right margin")}
            {field("gutter", <><u>G</u>utter:</>, "Gutter")}
            <span className="w13-label">G<u>u</u>tter position:</span>
            <select className="w13-select" aria-label="Gutter position" style={{ width: 96 }} value={values.gutterPosition} disabled={mirror} onChange={event => set({ gutterPosition: event.target.value as PageSetupValues["gutterPosition"] })}><option value="left">Left</option><option value="top">Top</option></select>
          </div>
          <Group13>Orientation</Group13>
          <div className="w13-row" style={{ marginLeft: 12, gap: 10 }}>
            {(["portrait", "landscape"] as const).map(orientation => <button key={orientation} type="button" className="w13-tile" aria-pressed={values.orientation === orientation} onMouseDown={event => event.preventDefault()} onClick={() => set({ orientation })}>
              <svg width="44" height="44" viewBox="0 0 44 44" aria-hidden>{orientation === "portrait" ? <rect x="10.5" y="4.5" width="23" height="33" fill="#fff" stroke="#1f1f1f" /> : <rect x="4.5" y="10.5" width="35" height="23" fill="#fff" stroke="#1f1f1f" />}<text x="15" y="29" fontSize="18" fontFamily="Times New Roman, serif" fontWeight="700" fill="#1f1f1f">A</text></svg>
              <span>{orientation === "portrait" ? <><u>P</u>ortrait</> : <>Land<u>s</u>cape</>}</span>
            </button>)}
          </div>
          <Group13>Pages</Group13>
          <div className="w13-row" style={{ marginLeft: 12 }}><span><u>M</u>ultiple pages:</span>
            <select className="w13-select" aria-label="Multiple pages" style={{ width: 140 }} value={values.multiplePages} onChange={event => set({ multiplePages: event.target.value as PageSetupValues["multiplePages"], gutterPosition: event.target.value === "mirror" ? "left" : values.gutterPosition })}><option value="normal">Normal</option><option value="mirror">Mirror margins</option><option value="twoPerSheet" disabled>2 pages per sheet</option><option value="bookFold" disabled>Book fold</option></select>
          </div>
          <Group13>Preview</Group13>
          <div style={{ marginLeft: 50 }}><PagePreview13 values={values} /></div>
          {apply}
        </>}
        {tab === "paper" && <>
          <div style={{ marginTop: 4 }}>Pape<u>r</u> size:</div>
          <select className="w13-select" aria-label="Paper size" style={{ width: 210, marginTop: 3 }} value={values.paper} onChange={event => { const size = PAPER_SIZES.find(item => item.id === event.target.value); set(size ? { paper: size.id, width: size.width, height: size.height } : { paper: "custom" }); }}>
            {PAPER_SIZES.map(size => <option key={size.id} value={size.id}>{size.name}</option>)}<option value="custom">Custom size</option>
          </select>
          <div style={{ display: "grid", gridTemplateColumns: "60px auto", gap: "6px 8px", alignItems: "center", marginTop: 8, marginLeft: 12 }}>
            <span className="w13-label"><u>W</u>idth:</span><Number13 label="Paper width" value={values.width} onChange={value => set({ width: Math.max(1, value ?? values.width), paper: "custom" })} unit="cm" dimension="length" step={0.1} min={1} max={55.88} decimals={2} width={96} />
            <span className="w13-label">H<u>e</u>ight:</span><Number13 label="Paper height" value={values.height} onChange={value => set({ height: Math.max(1, value ?? values.height), paper: "custom" })} unit="cm" dimension="length" step={0.1} min={1} max={55.88} decimals={2} width={96} />
          </div>
          <Group13>Paper source</Group13>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginLeft: 12, color: "#8a8a8a" }}>
            <div><div><u>F</u>irst page:</div><div className="w13-list" style={{ height: 64, background: "#ece6df" }}><button type="button" disabled aria-selected="true">Default tray</button></div></div>
            <div><div><u>O</u>ther pages:</div><div className="w13-list" style={{ height: 64, background: "#ece6df" }}><button type="button" disabled aria-selected="true">Default tray</button></div></div>
          </div>
          <Group13>Preview</Group13>
          <div style={{ marginLeft: 50 }}><PagePreview13 values={values} /></div>
          {apply}
        </>}
        {tab === "layout" && <>
          <Group13>Section</Group13>
          <div className="w13-row" style={{ marginLeft: 12, color: "#8a8a8a" }}><span>Section sta<u>r</u>t:</span><select className="w13-select" disabled style={{ width: 140 }} aria-label="Section start" value="newPage" onChange={() => undefined}><option value="newPage">New page</option></select></div>
          <Group13>Headers and footers</Group13>
          <div style={{ display: "grid", gap: 6, marginLeft: 12 }}>
            <Check13 checked={false} disabled title="Headers and footers are the same on every page in this exam editor.">Different <u>o</u>dd and even</Check13>
            <Check13 checked={false} disabled title="Headers and footers are the same on every page in this exam editor.">Different first <u>p</u>age</Check13>
          </div>
          <Group13>Page</Group13>
          <div className="w13-row" style={{ marginLeft: 12, color: "#8a8a8a" }}><span><u>V</u>ertical alignment:</span><select className="w13-select" disabled style={{ width: 110 }} aria-label="Vertical alignment" value="top" onChange={() => undefined}><option value="top">Top</option></select></div>
          <Group13>Preview</Group13>
          <div style={{ marginLeft: 50 }}><PagePreview13 values={values} /></div>
          {apply}
          <div className="w13-row" style={{ justifyContent: "flex-end", gap: 8, marginTop: 10 }}>
            <Button13 onClick={() => setSub("lineNumbers")}>Line <u>N</u>umbers…</Button13>
            <Button13 onClick={() => setSub("borders")}><u>B</u>orders…</Button13>
          </div>
        </>}
      </div>
      <OkCancel13 left={<Button13 disabled title="Default page settings for new documents are not used in this exam editor.">Set As <u>D</u>efault</Button13>} onOk={() => onSubmit(values)} />
      {sub === "lineNumbers" && <SubDialog13 onClose={() => setSub(null)}><LineNumbersDialog2013 value={values.lineNumbers} onSubmit={on => { set({ lineNumbers: on }); setSub(null); }} /></SubDialog13>}
      {sub === "borders" && <SubDialog13 onClose={() => setSub(null)}>{renderBorders(() => setSub(null))}</SubDialog13>}
    </Window13>
  );
}

function LineNumbersDialog2013({ value, onSubmit }: { value: boolean; onSubmit: (on: boolean) => void }) {
  const [on, setOn] = useState(value);
  return (
    <Window13 title="Line Numbers" width={300}>
      <div style={{ marginTop: 8 }}><Check13 checked={on} onChange={setOn}>Add <u>l</u>ine numbering</Check13></div>
      <div style={{ display: "grid", gridTemplateColumns: "auto auto", gap: "6px 10px", alignItems: "center", marginTop: 8, marginLeft: 22, color: "#8a8a8a" }}>
        <span>Start <u>a</u>t:</span><input className="w13-field" style={{ width: 70 }} disabled readOnly value="1" aria-label="Start at" />
        <span>From <u>t</u>ext:</span><input className="w13-field" style={{ width: 70 }} disabled readOnly value="Auto" aria-label="From text" />
        <span>Count <u>b</u>y:</span><input className="w13-field" style={{ width: 70 }} disabled readOnly value="1" aria-label="Count by" />
      </div>
      <Group13>Numbering</Group13>
      <div style={{ display: "grid", gap: 4, marginLeft: 12 }}>
        <Radio13 name="w13-ln" checked={false} disabled onChange={() => undefined}>Restart each <u>p</u>age</Radio13>
        <Radio13 name="w13-ln" checked={false} disabled onChange={() => undefined}>Restart each <u>s</u>ection</Radio13>
        <Radio13 name="w13-ln" checked={on} disabled={!on} onChange={() => undefined}><u>C</u>ontinuous</Radio13>
      </div>
      <OkCancel13 onOk={() => onSubmit(on)} />
    </Window13>
  );
}
