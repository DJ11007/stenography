"use client";
import { createPortal } from "react-dom";
import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { APPROVED_WORD_FONTS, WORD_THEME_FONTS } from "@/lib/word-editor-capabilities";
import { DEFAULT_ENGINE_OPTIONS, describeFormat, type FindEngineOptions, type FindFormat } from "@/lib/word-find-engine";

// Word 2013-style dialogs: Find and Replace (with Special / Format / search options),
// Font (Font + Advanced tabs) and Paragraph (Indents and Spacing + Line and Page Breaks).
// They are presentational: every value comes from, and goes back to, the editor through props.

type Chrome = { onClose: () => void; startDrag: (event: ReactMouseEvent<HTMLDivElement>) => void };
export const Word13Chrome = createContext<Chrome | null>(null);

function Window13({ title, width, children }: { title: string; width: number; children: ReactNode }) {
  const chrome = useContext(Word13Chrome);
  return (
    <div className="w13" role="document" style={{ width, maxWidth: "calc(100vw - 16px)" }}>
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
type Dimension = "length" | "points" | "plain";
const TO_CM: Record<string, number> = { cm: 1, mm: 0.1, in: 2.54, '"': 2.54, pt: 2.54 / 72, pc: 2.54 / 6 };
const TO_PT: Record<string, number> = { pt: 1, in: 72, '"': 72, cm: 72 / 2.54, mm: 72 / 25.4, pc: 12 };
function parseMeasure(text: string, dimension: Dimension): number | null {
  const match = /^\s*(-?\d*\.?\d+)\s*(cm|mm|in|"|pt|pc)?\s*$/i.exec(text.replace(",", "."));
  if (!match) return null;
  const amount = Number(match[1]);
  const unit = (match[2] ?? "").toLowerCase();
  if (!unit || dimension === "plain") return amount;
  return amount * (dimension === "length" ? TO_CM[unit] : TO_PT[unit]);
}
const formatNumber = (value: number, decimals: number) => String(Number(value.toFixed(decimals)));

function Number13({ value, onChange, unit = "", dimension = "plain", step = 1, min = 0, max = 1000, decimals = 2, disabled, label, width = 78, blankWhenEmpty }: {
  value: number | null; onChange: (value: number | null) => void; unit?: string; dimension?: Dimension; step?: number; min?: number; max?: number; decimals?: number; disabled?: boolean; label: string; width?: number; blankWhenEmpty?: boolean;
}) {
  const show = (current: number | null) => (current === null ? "" : `${formatNumber(current, decimals)}${unit ? ` ${unit}` : ""}`);
  const [text, setText] = useState(() => show(value));
  const [editing, setEditing] = useState(false);
  useEffect(() => { if (!editing) setText(show(value)); }, [value, editing]); // eslint-disable-line react-hooks/exhaustive-deps
  const clamp = (number: number) => Math.min(max, Math.max(min, number));
  const spin = (direction: 1 | -1) => { const next = clamp((value ?? 0) + direction * step); onChange(Number(next.toFixed(decimals + 1))); setText(show(next)); };
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
    const height = Math.min(menu.scrollHeight, window.innerHeight - 16), width = menu.offsetWidth;
    const below = window.innerHeight - button.bottom - 8, above = button.top - 8;
    const openUp = height > below && above > below;
    const top = openUp ? Math.max(8, button.top - height - 1) : Math.min(button.bottom + 1, window.innerHeight - height - 8);
    setStyle({ left: Math.max(8, Math.min(button.left, window.innerWidth - width - 8)), top, maxHeight: openUp ? Math.min(height, above) : Math.min(height, below), visibility: "visible" });
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
      {menu.open && createPortal(<div ref={menu.menuRef} role="menu" aria-label={`${label} palette`} className="w13-menu" style={{ ...menu.style, padding: 4, width: 186 }}>
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
            <span>Left:</span><Number13 label="Left indent" value={leftCm} unit="cm" dimension="length" step={0.1} min={0} max={25} onChange={n => set("marginLeft", asInches(n))} />
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 52 }}>Special:</span><span style={{ flex: 1 }} /><span>By:</span></div>
            <span>Right:</span><Number13 label="Right indent" value={rightCm} unit="cm" dimension="length" step={0.1} min={0} max={25} onChange={n => set("marginRight", asInches(n))} />
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <select className="w13-select" aria-label="Special indent" style={{ width: 118 }} value={values.specialIndentMode} onChange={event => { const mode = event.target.value; setValues(current => ({ ...current, specialIndentMode: mode, specialIndentAmount: mode === "none" ? "0" : Number(current.specialIndentAmount) > 0 ? current.specialIndentAmount : "0.5" })); }}><option value="none">(none)</option><option value="firstLine">First line</option><option value="hanging">Hanging</option></select>
              <Number13 label="Special indent by" value={values.specialIndentMode === "none" ? null : byCm} blankWhenEmpty unit="cm" dimension="length" step={0.1} min={0} max={25} disabled={values.specialIndentMode === "none"} width={70} onChange={n => set("specialIndentAmount", asInches(n))} />
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
const FONT_SIZES = [8, 9, 10, 10.5, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72];
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

export function FontDialog2013({ values: initial, onSubmit }: { values: FontValues; onSubmit: (values: FontValues) => void }) {
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
  const typedSize = (text: string) => { setSizeText(text); const number = Number(text); if (Number.isFinite(number) && number >= 8 && number <= 72) set("fontSize", String(number)); };
  const spacingNumber = Number(values.charSpacing) || 0, spacingMode = spacingNumber > 0 ? "expanded" : spacingNumber < 0 ? "condensed" : "normal";
  const positionNumber = Number(values.charPosition) || 0, positionMode = positionNumber > 0 ? "raised" : positionNumber < 0 ? "lowered" : "normal";
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
    <Window13 title="Font" width={514}>
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
            <select className="w13-select" aria-label="Spacing" style={{ width: 120 }} value={spacingMode} onChange={event => { const magnitude = Math.abs(spacingNumber) || 1; set("charSpacing", event.target.value === "normal" ? "0" : String(event.target.value === "condensed" ? -magnitude : magnitude)); }}><option value="normal">Normal</option><option value="expanded">Expanded</option><option value="condensed">Condensed</option></select>
            <span>B<u>y</u>:</span><Number13 label="Spacing by" value={spacingMode === "normal" ? null : Math.abs(spacingNumber)} blankWhenEmpty unit="pt" dimension="points" step={0.1} min={0} max={100} decimals={1} disabled={spacingMode === "normal"} onChange={n => set("charSpacing", String(spacingMode === "condensed" ? -(n ?? 0) : n ?? 0))} />
            <span>Posi<u>t</u>ion:</span>
            <select className="w13-select" aria-label="Position" style={{ width: 120 }} value={positionMode} onChange={event => { const magnitude = Math.abs(positionNumber) || 3; set("charPosition", event.target.value === "normal" ? "0" : String(event.target.value === "lowered" ? -magnitude : magnitude)); }}><option value="normal">Normal</option><option value="raised">Raised</option><option value="lowered">Lowered</option></select>
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

export type FindDialogInput = { mode: "find" | "replace" | "goto"; query: string; replacement: string; hadSelection: boolean; bookmarks: string[] };
type Scope = "selection" | "document";

export function FindReplaceDialog2013({ dialog, onFindNext, onReplaceOne, onReplaceAll, onHighlightAll, onSelectAll, onClearHighlight, onGoTo }: {
  dialog: FindDialogInput;
  onFindNext: (needle: string, options: FindEngineOptions, scope: Scope) => string;
  onReplaceOne: (needle: string, replacement: string, options: FindEngineOptions, scope: Scope) => string;
  onReplaceAll: (needle: string, replacement: string, options: FindEngineOptions, scope: Scope) => string;
  onHighlightAll: (needle: string, options: FindEngineOptions, scope: Scope) => string;
  onSelectAll: (needle: string, options: FindEngineOptions, scope: Scope) => string;
  onClearHighlight: () => void;
  onGoTo: (kind: string, value: string) => void;
}) {
  const chrome = useContext(Word13Chrome);
  const [tab, setTab] = useState<string>(dialog.mode);
  const [query, setQuery] = useState(dialog.query), [replacement, setReplacement] = useState(dialog.replacement);
  const [more, setMore] = useState(false);
  const [scope, setScope] = useState<Scope>(dialog.hadSelection ? "selection" : "document");
  const [options, setOptions] = useState<FindEngineOptions>(DEFAULT_ENGINE_OPTIONS);
  const [highlightOn, setHighlightOn] = useState(false);
  const [message, setMessage] = useState("");
  // Word turns Cancel into Close once a search has run.
  const [searched, setSearched] = useState(false);
  const [fontPanel, setFontPanel] = useState<"font" | "paragraph" | null>(null);
  const [gotoKind, setGotoKind] = useState("page"), [gotoValue, setGotoValue] = useState("");
  const findRef = useRef<HTMLInputElement>(null), replaceRef = useRef<HTMLInputElement>(null);
  const focused = useRef<"find" | "replace">("find");
  const set = <K extends keyof FindEngineOptions>(key: K, value: FindEngineOptions[K]) => setOptions(current => ({ ...current, [key]: value }));
  useEffect(() => { findRef.current?.focus(); findRef.current?.select(); }, [tab]);
  useEffect(() => () => onClearHighlight(), []); // eslint-disable-line react-hooks/exhaustive-deps
  const canRun = query.length > 0 || Boolean(options.format);
  const wild = options.wildcards;
  const run = (action: "next" | "replace" | "all" | "highlight") => {
    if (!canRun) return;
    setSearched(true);
    if (action === "next") setMessage(onFindNext(query, options, scope));
    else if (action === "replace") setMessage(onReplaceOne(query, replacement, options, scope));
    else if (action === "all") setMessage(onReplaceAll(query, replacement, options, scope));
    else { if (highlightOn) { onClearHighlight(); setHighlightOn(false); setMessage(""); } else { setMessage(onHighlightAll(query, options, scope)); setHighlightOn(true); } }
  };
  const insertSpecial = (id: string) => {
    const item = SPECIAL_MENU.find(entry => entry.id === id);
    if (!item) return;
    const target = tab === "replace" && focused.current === "replace" ? "replace" : "find";
    if (target === "replace") { if (!REPLACE_SPECIALS.has(id)) { setMessage(`${item.label} can only be used in Find what.`); return; } setReplacement(current => current + item.code); replaceRef.current?.focus(); }
    else { setQuery(current => current + item.code); findRef.current?.focus(); }
  };
  const pickFormat = (id: string) => { if (id === "font") setFontPanel("font"); else if (id === "paragraph") setFontPanel("paragraph"); else if (id === "highlight") set("format", { ...(options.format ?? {}), highlight: true }); };
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
          {tab === "replace" && row(<span>Replace w<u>i</u>th:</span>, <input ref={replaceRef} className="w13-field" aria-label="Replace with" style={{ width: "100%" }} value={replacement} onFocus={() => { focused.current = "replace"; }} onChange={event => setReplacement(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); run("replace"); } }} />)}
          <div role="status" aria-live="polite" style={{ minHeight: more ? 12 : 22, margin: "4px 0 0 88px", color: message.includes("not found") || message.includes("only be") ? "#a4262c" : "#0b5a0b" }}>{message}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: more ? 6 : 14 }}>
            <Button13 onClick={() => setMore(value => !value)}>{more ? "<< Less" : "More >>"}</Button13>
            <span style={{ flex: 1 }} />
            {tab === "find" ? <>
              <Button13 disabled={!canRun} onClick={() => run("highlight")}>{highlightOn ? "Clear Highlighting" : "Reading Highlight ▾"}</Button13>
              {/* Word 2013: Find In becomes available as soon as Find what has text. Picking Main Document (or
                  Current Selection, when there was one) marks every match in it at once; the scope then carries
                  over to the Replace tab. */}
              <MenuButton13 label="Find In" disabled={!canRun} items={[{ id: "selection", label: "Current Selection", disabled: !dialog.hadSelection }, { id: "document", label: "Main Document" }]} onPick={id => { const picked = id as Scope; setScope(picked); setHighlightOn(false); setSearched(true); setMessage(onSelectAll(query, options, picked)); }} />
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
              <Button13 disabled={!options.format} onClick={() => set("format", null)}>No Formatting</Button13>
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
        {fontPanel && <FindFormatPanel kind={fontPanel} initial={options.format} onCancel={() => setFontPanel(null)} onOk={format => { set("format", format); setFontPanel(null); }} />}
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
