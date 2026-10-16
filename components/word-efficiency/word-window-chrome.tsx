"use client";
import { useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";

// Microsoft Word 2013-style window chrome that wraps the exam editor: the title
// bar with the Quick Access Toolbar, the horizontal/vertical rulers and the
// status bar. These are presentational -- every value shown (indents, margins,
// page, word count, zoom) is passed in from the live editor, and the only
// actions (save, undo, redo, view mode, zoom, indent drag) call the editor's own
// handlers. Window buttons and the help icon are purely decorative.

export const PX_PER_INCH = 96;
const SNAP_PX = PX_PER_INCH / 16;
const iconProps = { width: 16, height: 16, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.2, "aria-hidden": true } as const;

const SaveIcon = () => <svg {...iconProps}><path d="M2.5 2.5h9l2 2v9h-11z" fill="#dbe7f5" stroke="#2b579a" /><path d="M5 2.5v3.5h5V2.5M4.5 13.5V9h7v4.5" stroke="#2b579a" /></svg>;
const UndoIcon = () => <svg {...iconProps}><path d="M5.5 3.5 2.5 6.5l3 3" stroke="#2b579a" /><path d="M2.8 6.5h6.2a3.5 3.5 0 0 1 0 7H6" stroke="#2b579a" /></svg>;
const RedoIcon = () => <svg {...iconProps}><path d="m10.5 3.5 3 3-3 3" stroke="#2b579a" /><path d="M13.2 6.5H7a3.5 3.5 0 0 0 0 7h3" stroke="#2b579a" /></svg>;
const HelpIcon = () => <svg {...iconProps}><circle cx="8" cy="8" r="6" stroke="#2b579a" /><path d="M6.2 6.3a1.9 1.9 0 1 1 2.6 1.7c-.6.3-.8.6-.8 1.2M8 11.3v.2" stroke="#2b579a" /></svg>;
const RibbonDisplayIcon = ({ collapsed }: { collapsed: boolean }) => <svg {...iconProps}><rect x="2.5" y="3" width="11" height="10" stroke="#555" /><path d={collapsed ? "M5.5 7l2.5 2.5L10.5 7" : "M5.5 9.5 8 7l2.5 2.5"} stroke="#555" /></svg>;

export function WordTitleBar({ title = "Document1 - Microsoft Word", canEdit, canUndo = true, canRedo = true, onSave, onUndo, onRedo, ribbonCollapsed, onToggleRibbon }: {
  title?: string; canEdit: boolean; canUndo?: boolean; canRedo?: boolean; onSave: () => void; onUndo: () => void; onRedo: () => void; ribbonCollapsed: boolean; onToggleRibbon: () => void;
}) {
  const stop = (event: { preventDefault: () => void }) => event.preventDefault();
  return <div className="word-titlebar" data-word-titlebar>
    <div className="word-qat" role="toolbar" aria-label="Quick Access Toolbar">
      <span className="word-titlebar-app" aria-hidden>W</span>
      <button type="button" title="Save" aria-label="Save" disabled={!canEdit} onMouseDown={stop} onClick={onSave}><SaveIcon /></button>
      <button type="button" title="Undo (Ctrl+Z)" aria-label="Undo" disabled={!canEdit || !canUndo} onMouseDown={stop} onClick={onUndo}><UndoIcon /></button>
      <button type="button" title="Redo (Ctrl+Y)" aria-label="Redo" disabled={!canEdit || !canRedo} onMouseDown={stop} onClick={onRedo}><RedoIcon /></button>
      <span className="word-qat-caret" aria-hidden>▾</span>
    </div>
    <p className="word-titlebar-title">{title}</p>
    <div className="word-titlebar-right">
      <span className="word-titlebar-icon" aria-hidden title="Help"><HelpIcon /></span>
      <button type="button" className="word-titlebar-icon" aria-pressed={ribbonCollapsed} aria-label={ribbonCollapsed ? "Show the ribbon" : "Collapse the ribbon"} title="Ribbon Display Options" onClick={onToggleRibbon}><RibbonDisplayIcon collapsed={ribbonCollapsed} /></button>
      <span className="word-window-buttons" aria-hidden><span>–</span><span>▢</span><span>✕</span></span>
    </div>
  </div>;
}

export type RulerIndent = { left: number; first: number; right: number };
export type RulerMetrics = { pageWidth: number; marginLeft: number; marginRight: number };

type Marker = "first" | "hanging" | "left" | "right";

// Horizontal ruler. All numbers are unzoomed CSS pixels (96 per inch); the parent
// applies the same CSS `zoom` as the page, so the two stay aligned at any zoom.
export function WordRuler({ metrics, indent, editable, zoom, onIndent }: {
  metrics: RulerMetrics; indent: RulerIndent | null; editable: boolean; zoom: number; onIndent: (next: RulerIndent, commit: boolean) => void;
}) {
  const { pageWidth: width, marginLeft, marginRight } = metrics;
  const drag = useRef<{ marker: Marker; startX: number; start: RulerIndent; latest: RulerIndent } | null>(null);
  const textWidth = Math.max(0, width - marginLeft - marginRight);
  const ticks: ReactNode[] = [];
  const eighth = PX_PER_INCH / 8;
  for (let k = -Math.floor(marginLeft / eighth); marginLeft + k * eighth <= width; k += 1) {
    const x = marginLeft + k * eighth;
    if (x < 0.5 || x > width - 0.5) continue;
    if (k % 8 === 0) {
      if (k !== 0) ticks.push(<text key={`n${k}`} x={x} y={12} textAnchor="middle" className="word-ruler-number">{Math.abs(k / 8)}</text>);
    } else if (k % 4 === 0) ticks.push(<line key={`t${k}`} x1={x} x2={x} y1={6} y2={12} className="word-ruler-tick" />);
    else ticks.push(<line key={`t${k}`} x1={x} x2={x} y1={8} y2={10} className="word-ruler-tick" />);
  }
  const clampIndent = (marker: Marker, start: RulerIndent, delta: number): RulerIndent => {
    const snap = (value: number) => Math.round(value / SNAP_PX) * SNAP_PX;
    const maxText = Math.max(0, textWidth - SNAP_PX);
    if (marker === "right") return { ...start, right: Math.min(maxText - start.left, Math.max(0, snap(start.right - delta))) };
    if (marker === "first") return { ...start, first: Math.min(maxText - start.left, Math.max(-start.left, snap(start.first + delta))) };
    const left = Math.min(maxText - start.right, Math.max(0, snap(start.left + delta)));
    // Dragging the hanging marker moves the left indent but keeps the first-line marker where it is;
    // dragging the rectangle under it moves both together.
    return { ...start, left, first: marker === "hanging" ? start.first + start.left - left : start.first };
  };
  const down = (marker: Marker) => (event: ReactPointerEvent<SVGGElement>) => {
    if (!editable || !indent) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { marker, startX: event.clientX, start: indent, latest: indent };
  };
  const move = (event: ReactPointerEvent<SVGGElement>) => {
    const current = drag.current;
    if (!current) return;
    current.latest = clampIndent(current.marker, current.start, (event.clientX - current.startX) / (zoom / 100));
    onIndent(current.latest, false);
  };
  const up = () => {
    const current = drag.current;
    drag.current = null;
    if (current) onIndent(current.latest, true);
  };
  const handlers = (marker: Marker) => ({ onPointerDown: down(marker), onPointerMove: move, onPointerUp: up, onPointerCancel: up });
  const firstX = indent ? marginLeft + indent.left + indent.first : 0;
  const leftX = indent ? marginLeft + indent.left : 0;
  const rightX = indent ? width - marginRight - indent.right : 0;
  const cursor = editable ? "ew-resize" : "default";
  return <svg role="img" aria-label="Document ruler" className="word-ruler" width={width} height={18} viewBox={`0 0 ${width} 18`}>
    <rect x={0} y={2} width={width} height={14} className="word-ruler-margin" />
    <rect x={marginLeft} y={2} width={textWidth} height={14} className="word-ruler-text" />
    {ticks}
    {indent && <>
      <g {...handlers("first")} style={{ cursor }}><title>First Line Indent</title><path d={`M${firstX - 4.5} 1.5h9v3.5l-4.5 3.5-4.5-3.5z`} className="word-ruler-marker" /></g>
      <g {...handlers("hanging")} style={{ cursor }}><title>Hanging Indent</title><path d={`M${leftX} 9.5l4.5 3.5v1.5h-9V13z`} className="word-ruler-marker" /></g>
      <g {...handlers("left")} style={{ cursor }}><title>Left Indent</title><rect x={leftX - 4.5} y={14.5} width={9} height={3} className="word-ruler-marker" /></g>
      <g {...handlers("right")} style={{ cursor }}><title>Right Indent</title><path d={`M${rightX} 9.5l4.5 3.5v3h-9v-3z`} className="word-ruler-marker" /></g>
    </>}
  </svg>;
}

export function WordVerticalRuler({ height, marginTop, marginBottom }: { height: number; marginTop: number; marginBottom: number }) {
  const width = 18;
  const ticks: ReactNode[] = [];
  const eighth = PX_PER_INCH / 8;
  const bottomMargin = Math.min(marginBottom, height);
  for (let k = -Math.floor(marginTop / eighth); marginTop + k * eighth <= height; k += 1) {
    const y = marginTop + k * eighth;
    if (y < 0.5 || y > height - 0.5) continue;
    if (k % 8 === 0) {
      if (k !== 0) ticks.push(<text key={`n${k}`} x={9} y={y + 3.5} textAnchor="middle" className="word-ruler-number">{Math.abs(k / 8)}</text>);
    } else if (k % 4 === 0) ticks.push(<line key={`t${k}`} x1={5} x2={13} y1={y} y2={y} className="word-ruler-tick" />);
    else ticks.push(<line key={`t${k}`} x1={7} x2={11} y1={y} y2={y} className="word-ruler-tick" />);
  }
  return <svg role="img" aria-label="Vertical ruler" className="word-ruler word-ruler-vertical" width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
    <rect x={2} y={0} width={14} height={height} className="word-ruler-margin" />
    <rect x={2} y={marginTop} width={14} height={Math.max(0, height - marginTop - bottomMargin)} className="word-ruler-text" />
    {ticks}
  </svg>;
}

export function WordStatusBar({ page, pages, words, language, mode, onMode, zoom, onZoom, status, actions }: {
  page: number; pages: number; words: number; language: string; mode: string; onMode: (mode: "print" | "web" | "reading") => void; zoom: number; onZoom: (value: number) => void; status?: string;
  /** Extra buttons at the far right (the admin editors' Save button). */
  actions?: ReactNode;
}) {
  const modes: { id: "reading" | "print" | "web"; label: string; icon: ReactNode }[] = [
    { id: "reading", label: "Read Mode", icon: <svg {...iconProps}><path d="M2.5 3.5h4.7c.5 0 .8.3.8.8v8.2c0-.5-.3-.8-.8-.8H2.5zM13.5 3.5H8.8c-.5 0-.8.3-.8.8v8.2c0-.5.3-.8.8-.8h4.7z" /></svg> },
    { id: "print", label: "Print Layout", icon: <svg {...iconProps}><rect x="3.5" y="2.5" width="9" height="11" fill="#fff" /><path d="M5.5 5.5h5M5.5 7.5h5M5.5 9.5h5" /></svg> },
    { id: "web", label: "Web Layout", icon: <svg {...iconProps}><circle cx="8" cy="8" r="5.5" /><path d="M2.5 8h11M8 2.5c-2 2.2-2 8.8 0 11M8 2.5c2 2.2 2 8.8 0 11" /></svg> },
  ];
  const clamped = Math.min(200, Math.max(25, zoom));
  return <footer className="word-statusbar" data-word-statusbar aria-label="Status bar">
    <div className="word-statusbar-left" aria-live="polite">
      <span>PAGE {page} OF {pages}</span>
      <span>{words} {words === 1 ? "WORD" : "WORDS"}</span>
      <span>{language.toUpperCase()}</span>
      {status ? <span className="word-statusbar-status">{status}</span> : null}
    </div>
    <div className="word-statusbar-right">
      <div className="word-view-buttons" role="group" aria-label="Document views">
        {modes.map(item => <button key={item.id} type="button" title={item.label} aria-label={item.label} aria-pressed={mode === item.id} onClick={() => onMode(item.id)}>{item.icon}</button>)}
      </div>
      <button type="button" className="word-zoom-step" aria-label="Zoom out" title="Zoom out" onClick={() => onZoom(Math.max(25, Math.round((zoom - 10) / 5) * 5))}>−</button>
      <input type="range" className="word-zoom-slider" aria-label="Zoom" min={25} max={200} step={5} value={clamped} onChange={event => onZoom(Number(event.target.value))} />
      <button type="button" className="word-zoom-step" aria-label="Zoom in" title="Zoom in" onClick={() => onZoom(Math.min(200, Math.round((zoom + 10) / 5) * 5))}>+</button>
      <button type="button" className="word-zoom-value" title="Zoom to 100%" onClick={() => onZoom(100)}>{zoom}%</button>
      {actions ? <span className="word-statusbar-actions">{actions}</span> : null}
    </div>
  </footer>;
}
