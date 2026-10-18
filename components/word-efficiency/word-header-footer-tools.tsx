"use client";

import { useState, type ReactNode } from "react";
import { Big, BigDrop, Group, MenuItem, Small } from "./word-table-tools";

// Word 2013's HEADER & FOOTER TOOLS > DESIGN tab, shown while the cursor is in
// the header or footer: Header & Footer, Insert, Navigation, Options, Position
// and Close. The Header / Footer / Page Number galleries are the same menus the
// INSERT tab uses (passed in as `menus`).

export type HeaderFooterAction = "dateTime" | "fileName" | "documentTitle" | "picture" | "goToHeader" | "goToFooter" | "showDocumentText" | "headerFromTop" | "footerFromBottom" | "close";
type On = (action: HeaderFooterAction, value?: string) => void;

const C = { frame: "#7a7a7a", line: "#a6a6a6", blue: "#2b579a", accent: "#4f81bd", fill: "#c5d9f1", gold: "#f2c811", red: "#d24726" };
const svg32 = (children: ReactNode) => <svg viewBox="0 0 32 32" width="32" height="32" fill="none" strokeWidth="1">{children}</svg>;
const svg16 = (children: ReactNode) => <svg viewBox="0 0 16 16" width="16" height="16" fill="none" strokeWidth="1">{children}</svg>;
const page = (children: ReactNode) => svg32(<><rect x="6.5" y="2.5" width="19" height="27" fill="#fff" stroke={C.frame} />{children}</>);

export const HF_ICONS = {
  header: page(<><rect x="7" y="3" width="18" height="6" fill={C.gold} opacity=".55" /><path d="M10 6h12M10 14h12M10 17h12M10 20h9" stroke={C.line} /></>),
  footer: page(<><rect x="7" y="23" width="18" height="6" fill={C.gold} opacity=".55" /><path d="M10 7h12M10 10h12M10 13h9M10 26h12" stroke={C.line} /></>),
  pageNumber: page(<><text x="16" y="21" fontSize="11" fontFamily="Segoe UI, Arial" fontWeight="700" fill={C.blue} textAnchor="middle">#</text></>),
};
const ICON = {
  dateTime: svg32(<><rect x="3.5" y="5.5" width="20" height="18" fill="#fff" stroke={C.frame} /><path d="M3.5 10.5h20" stroke={C.blue} strokeWidth="2" /><path d="M7 14h3M12 14h3M17 14h3M7 18h3M12 18h3" stroke={C.line} /><circle cx="23" cy="22" r="6.5" fill="#fff" stroke={C.blue} /><path d="M23 18v4l3 2" stroke={C.blue} strokeWidth="1.2" /></>),
  documentInfo: page(<><path d="M10 9h12M10 12h12M10 15h8" stroke={C.line} /><rect x="13" y="18" width="14" height="10" fill={C.fill} stroke={C.accent} /><path d="M16 22h8M16 25h6" stroke={C.blue} /></>),
  quickParts: svg32(<><rect x="3.5" y="4.5" width="17" height="22" fill="#fff" stroke={C.frame} /><path d="M7 9h10M7 12h10M7 15h7" stroke={C.line} /><rect x="14.5" y="14.5" width="14" height="13" fill={C.fill} stroke={C.accent} /><path d="M18 19h7M18 22h5" stroke={C.blue} /></>),
  pictures: svg32(<><rect x="3.5" y="5.5" width="25" height="21" fill="#fff" stroke={C.frame} /><circle cx="11" cy="12" r="3" fill="#f0c767" /><path d="M5 24l8-8 5 5 3-3 6 6" fill="#cfe3f4" stroke={C.accent} /></>),
  onlinePictures: svg32(<><rect x="3.5" y="5.5" width="21" height="21" fill="#fff" stroke={C.frame} /><circle cx="10" cy="12" r="2.5" fill="#f0c767" /><path d="M5 24l7-7 4 4 3-3 5 5" fill="#cfe3f4" stroke={C.accent} /><circle cx="24" cy="10" r="6" fill="#fff" stroke={C.blue} /><path d="M18 10h12M24 4c-3 3-3 9 0 12M24 4c3 3 3 9 0 12" stroke={C.blue} strokeWidth=".8" /></>),
  goToHeader: page(<><rect x="7" y="3" width="18" height="6" fill={C.fill} stroke={C.accent} /><path d="M16 22V12M12.5 15.5 16 12l3.5 3.5" stroke={C.blue} strokeWidth="1.6" /></>),
  goToFooter: page(<><rect x="7" y="23" width="18" height="6" fill={C.fill} stroke={C.accent} /><path d="M16 8v10M12.5 14.5 16 18l3.5-3.5" stroke={C.blue} strokeWidth="1.6" /></>),
  close: svg32(<><rect x="5" y="5" width="22" height="22" rx="2" fill={C.red} /><path d="M11 11l10 10M21 11L11 21" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" /></>),
  previous: svg16(<><rect x="5.5" y="1.5" width="9" height="13" fill="#fff" stroke={C.frame} /><rect x="6" y="2" width="8" height="3" fill={C.fill} /><path d="M3 5 1 3M3 5 1 7M3 5h-2" stroke={C.blue} /></>),
  next: svg16(<><rect x="5.5" y="1.5" width="9" height="13" fill="#fff" stroke={C.frame} /><rect x="6" y="11" width="8" height="3" fill={C.fill} /><path d="M1 11l2 2 2-2M3 13V9" stroke={C.blue} /></>),
  link: svg16(<><rect x="1.5" y="2.5" width="6" height="5" fill="#fff" stroke={C.frame} /><rect x="8.5" y="8.5" width="6" height="5" fill="#fff" stroke={C.frame} /><path d="M6 10h2M8 6h2" stroke={C.blue} /></>),
  headerTop: svg16(<><rect x="1.5" y="1.5" width="10" height="13" fill="#fff" stroke={C.frame} /><rect x="2" y="2" width="9" height="3" fill={C.gold} opacity=".6" /><path d="M14 1v5M12.5 2.5 14 1l1.5 1.5" stroke={C.blue} /></>),
  footerBottom: svg16(<><rect x="1.5" y="1.5" width="10" height="13" fill="#fff" stroke={C.frame} /><rect x="2" y="11" width="9" height="3" fill={C.gold} opacity=".6" /><path d="M14 15v-5M12.5 13.5 14 15l1.5-1.5" stroke={C.blue} /></>),
  alignTab: svg16(<><rect x="1.5" y="2.5" width="13" height="11" fill="#fff" stroke={C.frame} /><path d="M4 8h6M8 6l2 2-2 2" stroke={C.blue} /></>),
};

// "Header from Top" / "Footer from Bottom" box (cm), committed on Enter, blur or the arrows.
function CmSpin({ label, value, onCommit }: { label: string; value: number; onCommit: (value: number) => void }) {
  const [text, setText] = useState<string | null>(null);
  const clamp = (number: number) => Math.min(10, Math.max(0, Math.round(number * 100) / 100));
  const commit = (raw: string) => { setText(null); const match = /^\s*(\d*\.?\d+)\s*(cm|mm|in|")?\s*$/i.exec(raw.replace(",", ".")); if (!match) return; const amount = Number(match[1]), unit = (match[2] ?? "cm").toLowerCase(); onCommit(clamp(unit === "mm" ? amount / 10 : unit === "in" || unit === '"' ? amount * 2.54 : amount)); };
  return <span className="wt-spin wp-spin">
    <input aria-label={label} value={text ?? `${value} cm`} onChange={event => setText(event.target.value)} onBlur={() => text !== null && commit(text)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); commit((event.target as HTMLInputElement).value); } if (event.key === "ArrowUp") { event.preventDefault(); onCommit(clamp(value + 0.1)); } if (event.key === "ArrowDown") { event.preventDefault(); onCommit(clamp(value - 0.1)); } }} />
    <span className="wt-spin-buttons"><button type="button" tabIndex={-1} aria-label={`Increase ${label}`} onMouseDown={event => event.preventDefault()} onClick={() => onCommit(clamp(value + 0.1))}>▲</button><button type="button" tabIndex={-1} aria-label={`Decrease ${label}`} onMouseDown={event => event.preventDefault()} onClick={() => onCommit(clamp(value - 0.1))}>▼</button></span>
  </span>;
}

export function HeaderFooterToolsGroups({ kind, showDocumentText, headerFromTop, footerFromBottom, hasFileName, menus, on }: {
  kind: "header" | "footer"; showDocumentText: boolean; headerFromTop: number; footerFromBottom: number; hasFileName: boolean;
  menus: { header: ReactNode; footer: ReactNode; pageNumber: ReactNode }; on: On;
}) {
  const none = "Not available in this exam editor";
  return <>
    <Group id="headerFooter" name="Header & Footer">
      <div className="wt-row wh-menus">{menus.header}{menus.footer}{menus.pageNumber}</div>
    </Group>
    <Group id="hfInsert" name="Insert">
      <div className="wt-row">
        <Big label={"Date &\nTime"} onClick={() => on("dateTime")} icon={ICON.dateTime} />
        <BigDrop label={"Document\nInfo"} width={210} icon={ICON.documentInfo}>
          {close => <>
            <MenuItem disabled onClick={() => undefined}>Author</MenuItem>
            <MenuItem disabled={!hasFileName} onClick={() => { on("fileName"); close(); }}>File Name</MenuItem>
            <MenuItem disabled onClick={() => undefined}>File Path</MenuItem>
            <MenuItem disabled={!hasFileName} onClick={() => { on("documentTitle"); close(); }}>Document Title</MenuItem>
            <div className="wi-sep" />
            <MenuItem disabled onClick={() => undefined}>Document Property ›</MenuItem>
            <MenuItem disabled onClick={() => undefined}>Field…</MenuItem>
          </>}
        </BigDrop>
        <BigDrop label={"Quick\nParts"} width={230} title="Quick Parts" icon={ICON.quickParts}>
          {() => <>
            <MenuItem disabled onClick={() => undefined}>AutoText ›</MenuItem>
            <MenuItem disabled onClick={() => undefined}>Document Property ›</MenuItem>
            <MenuItem disabled onClick={() => undefined}>Field…</MenuItem>
            <MenuItem disabled onClick={() => undefined}>Building Blocks Organizer…</MenuItem>
            <div className="wi-sep" />
            <MenuItem disabled onClick={() => undefined}>Save Selection to Quick Part Gallery…</MenuItem>
          </>}
        </BigDrop>
        <Big label="Pictures" onClick={() => on("picture")} icon={ICON.pictures} />
        <Big label={"Online\nPictures"} disabled title="Online picture search is not available in this exam editor" icon={ICON.onlinePictures} />
      </div>
    </Group>
    <Group id="hfNavigation" name="Navigation">
      <div className="wt-row">
        <Big label={"Go to\nHeader"} disabled={kind === "header"} onClick={() => on("goToHeader")} icon={ICON.goToHeader} />
        <Big label={"Go to\nFooter"} disabled={kind === "footer"} onClick={() => on("goToFooter")} icon={ICON.goToFooter} />
        <div className="wt-stack">
          <Small label="Previous" disabled title="This document has one section, so one header and one footer" icon={ICON.previous} />
          <Small label="Next" disabled title="This document has one section, so one header and one footer" icon={ICON.next} />
          <Small label="Link to Previous" disabled title="This document has one section, so one header and one footer" icon={ICON.link} />
        </div>
      </div>
    </Group>
    <Group id="hfOptions" name="Options">
      <div className="wv-checks">
        <label className="wt-check" title={none}><input type="checkbox" disabled checked={false} onChange={() => undefined} /><span>Different First Page</span></label>
        <label className="wt-check" title={none}><input type="checkbox" disabled checked={false} onChange={() => undefined} /><span>Different Odd &amp; Even Pages</span></label>
        <label className="wt-check"><input type="checkbox" checked={showDocumentText} onChange={event => on("showDocumentText", String(event.target.checked))} /><span>Show Document Text</span></label>
      </div>
    </Group>
    <Group id="hfPosition" name="Position">
      <div className="wp-para"><div className="wp-para-col">
        <label><span className="wr-small-icon" aria-hidden>{ICON.headerTop}</span><span className="wh-position-label">Header from Top:</span><CmSpin label="Header from Top" value={headerFromTop} onCommit={value => on("headerFromTop", String(value))} /></label>
        <label><span className="wr-small-icon" aria-hidden>{ICON.footerBottom}</span><span className="wh-position-label">Footer from Bottom:</span><CmSpin label="Footer from Bottom" value={footerFromBottom} onCommit={value => on("footerFromBottom", String(value))} /></label>
        <Small label="Insert Alignment Tab" disabled title="Tab stops are not available in this exam editor" icon={ICON.alignTab} />
      </div></div>
    </Group>
    <Group id="hfClose" name="Close">
      <Big label={"Close Header\nand Footer"} onClick={() => on("close")} icon={ICON.close} />
    </Group>
  </>;
}
