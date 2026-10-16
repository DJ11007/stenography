"use client";

import type { ReactNode } from "react";
import { Big, Group, Small } from "./word-table-tools";

// Word 2013's VIEW tab: Views (Read Mode, Print Layout, Web Layout, Outline,
// Draft), Show (Ruler, Gridlines, Navigation Pane) and Zoom (Zoom, 100%, One
// Page, Multiple Pages, Page Width). Each button runs the editor's existing
// view command; `active` says which view / options are on.

const C = { frame: "#7a7a7a", line: "#a6a6a6", blue: "#2b579a", accent: "#4f81bd", fill: "#c5d9f1", light: "#deebf7" };
const svg32 = (children: ReactNode) => <svg viewBox="0 0 32 32" width="32" height="32" fill="none" strokeWidth="1">{children}</svg>;
const svg16 = (children: ReactNode) => <svg viewBox="0 0 16 16" width="16" height="16" fill="none" strokeWidth="1">{children}</svg>;
const lines = (x: number, y: number, w: number, n: number, gap = 3) => <path d={Array.from({ length: n }, (_, i) => `M${x} ${y + i * gap}h${w}`).join("")} stroke={C.line} />;

const ICONS: Record<string, ReactNode> = {
  fullScreenReading: svg32(<><path d="M3 7c4-2 9-2 13 1v19c-4-3-9-3-13-1z" fill="#fff" stroke={C.blue} /><path d="M29 7c-4-2-9-2-13 1v19c4-3 9-3 13-1z" fill="#fff" stroke={C.blue} />{lines(6, 11, 7, 4, 3)}{lines(19, 11, 7, 4, 3)}</>),
  printLayout: svg32(<><rect x="6.5" y="2.5" width="19" height="27" fill="#fff" stroke={C.frame} />{lines(10, 8, 12, 6, 3)}<path d="M10 26h8" stroke={C.line} /></>),
  webLayout: svg32(<><rect x="3.5" y="4.5" width="20" height="24" fill="#fff" stroke={C.frame} />{lines(7, 10, 12, 5, 3)}<circle cx="23" cy="21" r="7" fill="#fff" stroke={C.blue} /><path d="M16 21h14M23 14c-3 3-3 11 0 14M23 14c3 3 3 11 0 14" stroke={C.blue} strokeWidth=".9" /></>),
  outlineView: svg16(<><path d="M2 3h2M2 8h2M2 13h2" stroke={C.blue} strokeWidth="1.6" /><path d="M6 3h8M8 8h6M8 13h6" stroke={C.line} /></>),
  draftView: svg16(<><rect x="2.5" y="1.5" width="11" height="13" fill="#fff" stroke={C.frame} /><path d="M4.5 5h7M4.5 8h7M4.5 11h5" stroke={C.line} /></>),
  zoom: svg32(<><circle cx="13" cy="13" r="8.5" fill="#fff" stroke={C.frame} strokeWidth="1.8" /><path d="M19.5 19.5l8 8" stroke={C.frame} strokeWidth="3" strokeLinecap="round" /></>),
  zoom100: svg32(<><rect x="5.5" y="2.5" width="18" height="25" fill="#fff" stroke={C.frame} /><path d="M18.5 2.5v6h5" stroke={C.frame} /><rect x="9" y="17" width="20" height="11" fill={C.blue} /><text x="19" y="25.5" fontSize="8" fontFamily="Segoe UI, Arial" fontWeight="700" fill="#fff" textAnchor="middle">100</text><path d="M12 9l4 3-4 3" stroke={C.blue} strokeWidth="1.4" /></>),
  onePage: svg16(<><rect x="4.5" y="1.5" width="8" height="13" fill="#fff" stroke={C.frame} /><path d="M6.5 4h4M6.5 7h4M6.5 10h4" stroke={C.line} /></>),
  twoPages: svg16(<><rect x="1.5" y="2.5" width="6" height="11" fill="#fff" stroke={C.frame} /><rect x="8.5" y="2.5" width="6" height="11" fill="#fff" stroke={C.frame} /></>),
  pageWidth: svg16(<><rect x="1.5" y="3.5" width="13" height="10" fill="#fff" stroke={C.frame} /><path d="M2 8h12M4 6 2 8l2 2M12 6l2 2-2 2" stroke={C.blue} /></>),
};

export function ViewGroups({ active, enabled, run }: { active: (id: string) => boolean; enabled: (id: string) => boolean; run: (id: string) => void }) {
  const big = (id: string, label: string) => enabled(id) && <Big key={id} label={label} pressed={active(id)} onClick={() => run(id)} icon={ICONS[id]} />;
  const small = (id: string, label: string, toggle = true) => enabled(id) && <Small key={id} label={label} pressed={toggle ? active(id) : undefined} onClick={() => run(id)} icon={ICONS[id]} />;
  const check = (id: string, label: string) => enabled(id) && <label key={id} className="wt-check"><input type="checkbox" checked={active(id)} onChange={() => run(id)} /><span>{label}</span></label>;
  return <>
    <Group id="viewViews" name="Views">
      <div className="wt-row">
        {big("fullScreenReading", "Read\nMode")}
        {big("printLayout", "Print\nLayout")}
        {big("webLayout", "Web\nLayout")}
        <div className="wt-stack">{small("outlineView", "Outline")}{small("draftView", "Draft")}</div>
      </div>
    </Group>
    <Group id="viewShow" name="Show">
      <div className="wv-checks">{check("ruler", "Ruler")}{check("gridlines", "Gridlines")}{check("documentMap", "Navigation Pane")}</div>
    </Group>
    <Group id="viewZoom" name="Zoom">
      <div className="wt-row">
        {enabled("zoom100") && <Big label="Zoom" onClick={() => run("zoom")} icon={ICONS.zoom} />}
        {big("zoom100", "100%")}
        <div className="wt-stack">{small("onePage", "One Page", false)}{small("twoPages", "Multiple Pages", false)}{small("pageWidth", "Page Width", false)}</div>
      </div>
    </Group>
  </>;
}
