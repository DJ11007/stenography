"use client";

import { useRef, type ReactNode } from "react";
import type { HeaderFooter } from "@/lib/excel-document";
import { previewHeaderText } from "@/lib/excel-sheet-model";

// Excel 2013's Insert > Header & Footer: the sheet shows its page with three header boxes (left, centre, right) at
// the top and three footer boxes at the bottom, typed straight on the page, while the contextual
// HEADER & FOOTER TOOLS > DESIGN tab inserts the codes (&[Page], &[Pages], &[Date] ...). The boxes save to the same
// sheet.header / sheet.footer {left, center, right} the Page Setup dialog uses, so marking is unchanged.

export type HfPart = "header" | "footer";
export type HfSide = "left" | "center" | "right";
export type HfTarget = { part: HfPart; side: HfSide };
export const HF_SIDES: HfSide[] = ["left", "center", "right"];

// The Header / Footer drop-down presets Excel 2013 lists (Book1 / Sheet1 as this workbook is named).
export const HF_PRESETS: { label: string; value: HeaderFooter }[] = [
  { label: "(none)", value: {} },
  { label: "Page 1", value: { center: "Page &[Page]" } },
  { label: "Page 1 of ?", value: { center: "Page &[Page] of &[Pages]" } },
  { label: "Sheet1", value: { center: "&[Tab]" } },
  { label: "Book1", value: { center: "&[File]" } },
  { label: "Sheet1, Page 1", value: { center: "&[Tab], Page &[Page]" } },
  { label: "Book1, Page 1", value: { center: "&[File], Page &[Page]" } },
  { label: "Page 1, Sheet1", value: { left: "Page &[Page]", center: "&[Tab]" } },
  { label: "Page 1, Book1", value: { left: "Page &[Page]", center: "&[File]" } },
  { label: "Book1, Sheet1", value: { left: "&[File]", center: "&[Tab]" } },
];

export const HF_ELEMENTS: { code: string; label: string; icon: keyof typeof HF_ICON }[] = [
  { code: "&[Page]", label: "Page Number", icon: "pageNumber" },
  { code: "&[Pages]", label: "Number of Pages", icon: "pages" },
  { code: "&[Date]", label: "Current Date", icon: "date" },
  { code: "&[Time]", label: "Current Time", icon: "time" },
  { code: "&[Path]&[File]", label: "File Path", icon: "path" },
  { code: "&[File]", label: "File Name", icon: "file" },
  { code: "&[Tab]", label: "Sheet Name", icon: "sheet" },
];

const C = { frame: "#7a7a7a", line: "#a6a6a6", green: "#217346", fill: "#d5ead9", gold: "#f2c811", blue: "#2b579a" };
const svg = (children: ReactNode) => <svg aria-hidden viewBox="0 0 32 32" width="32" height="32" fill="none" strokeWidth="1">{children}</svg>;
const page = (children: ReactNode) => svg(<><rect x="6.5" y="2.5" width="19" height="27" fill="#fff" stroke={C.frame} />{children}</>);
const label = (text: string, size = 9) => <text x="16" y="21" fontSize={size} fontFamily="Segoe UI, Arial" fontWeight="700" fill={C.blue} textAnchor="middle">{text}</text>;

export const HF_ICON = {
  header: page(<><rect x="7" y="3" width="18" height="6" fill={C.gold} opacity=".55" /><path d="M10 14h12M10 17h12M10 20h9" stroke={C.line} /></>),
  footer: page(<><rect x="7" y="23" width="18" height="6" fill={C.gold} opacity=".55" /><path d="M10 8h12M10 11h12M10 14h9" stroke={C.line} /></>),
  pageNumber: page(label("#", 12)),
  pages: page(<>{label("##", 10)}<path d="M10 8h12" stroke={C.line} /></>),
  date: svg(<><rect x="4.5" y="6.5" width="23" height="20" fill="#fff" stroke={C.frame} /><path d="M4.5 11.5h23" stroke={C.blue} strokeWidth="2.2" /><path d="M8 16h3M14 16h3M20 16h3M8 21h3M14 21h3" stroke={C.line} strokeWidth="1.6" /></>),
  time: svg(<><circle cx="16" cy="16" r="11.5" fill="#fff" stroke={C.blue} strokeWidth="1.4" /><path d="M16 9v7l5 3" stroke={C.blue} strokeWidth="1.6" /></>),
  path: svg(<><path d="M3.5 9.5h9l2 2h14v15h-25z" fill="#f8d775" stroke="#c39b2a" /><rect x="13.5" y="5.5" width="12" height="15" fill="#fff" stroke={C.frame} /><path d="M16 10h7M16 13h7M16 16h5" stroke={C.line} /></>),
  file: page(<><path d="M10 8h12M10 11h12" stroke={C.line} /><rect x="9" y="15" width="14" height="8" fill={C.fill} stroke={C.green} /></>),
  sheet: svg(<><rect x="4.5" y="5.5" width="23" height="21" fill="#fff" stroke={C.frame} /><path d="M4.5 12.5h23M4.5 19.5h23M12.5 5.5v21M20.5 5.5v21" stroke={C.line} /><rect x="5" y="22" width="9" height="4" fill={C.green} /></>),
  picture: svg(<><rect x="3.5" y="5.5" width="25" height="21" fill="#fff" stroke={C.frame} /><circle cx="11" cy="12" r="3" fill="#f0c767" /><path d="M5 24l8-8 5 5 3-3 6 6" fill="#cfe3f4" stroke="#4f81bd" /></>),
  formatPicture: svg(<><rect x="3.5" y="5.5" width="19" height="17" fill="#fff" stroke={C.frame} /><circle cx="9" cy="11" r="2.5" fill="#f0c767" /><path d="M5 20l6-6 4 4 2-2 4 4" fill="#cfe3f4" stroke="#4f81bd" /><path d="M20 28l8-8-3-3-8 8v3z" fill="#fff" stroke={C.blue} /></>),
  goToHeader: page(<><rect x="7" y="3" width="18" height="6" fill={C.fill} stroke={C.green} /><path d="M16 23V13M12.5 16.5 16 13l3.5 3.5" stroke={C.green} strokeWidth="1.6" /></>),
  goToFooter: page(<><rect x="7" y="23" width="18" height="6" fill={C.fill} stroke={C.green} /><path d="M16 8v10M12.5 14.5 16 18l3.5-3.5" stroke={C.green} strokeWidth="1.6" /></>),
};

/** One header or footer band of the page: a label and three boxes, each showing its text with the codes filled in
 *  (Page 1, Sheet1 ...) until clicked, then the codes themselves to edit, as Excel does. */
export function HeaderFooterBand({ part, values, target, disabled, onFocus, onChange, onCommit, inputs, pages, sheetName }: {
  part: HfPart; values: HeaderFooter; target: HfTarget | null; disabled?: boolean; pages: number; sheetName: string;
  onFocus: (target: HfTarget) => void; onChange: (side: HfSide, text: string) => void; onCommit: () => void;
  inputs: React.MutableRefObject<Record<string, HTMLInputElement | null>>;
}) {
  const band = useRef<HTMLDivElement>(null);
  const empty = HF_SIDES.every((side) => !values[side]);
  return (
    <div ref={band} data-hf-band={part} className={`relative bg-white px-[0.7in] ${part === "header" ? "pb-2 pt-[0.3in]" : "pb-[0.3in] pt-2"}`}
      onMouseDown={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
      {target?.part === part && <span className="absolute left-1 top-1 text-[11px] text-[#666]">{part === "header" ? "Header" : "Footer"}</span>}
      <div className="grid grid-cols-3 gap-0">
        {HF_SIDES.map((side) => {
          const key = `${part}-${side}`, active = target?.part === part && target.side === side, text = values[side] ?? "";
          return (
            <label key={side} className={`relative block h-[34px] border border-dashed ${active ? "border-[#7a7a7a] bg-white" : "border-transparent hover:border-[#b5b5b5]"}`}>
              <input ref={(element) => { inputs.current[key] = element; }} disabled={disabled} value={text} maxLength={255}
                aria-label={`${part === "header" ? "Header" : "Footer"} ${side === "center" ? "center" : side} section`}
                onFocus={() => onFocus({ part, side })} onBlur={onCommit}
                onChange={(event) => onChange(side, event.target.value.slice(0, 255))}
                onKeyDown={(event) => { if (event.key === "Enter" || event.key === "Escape") { event.preventDefault(); event.currentTarget.blur(); } }}
                className={`h-full w-full bg-transparent px-1 text-[13px] outline-none ${side === "left" ? "text-left" : side === "right" ? "text-right" : "text-center"} ${active ? "text-[#262626]" : "opacity-0"}`} />
              {!active && <span aria-hidden className={`pointer-events-none absolute inset-0 flex items-center overflow-hidden whitespace-nowrap px-1 text-[13px] ${side === "left" ? "justify-start" : side === "right" ? "justify-end" : "justify-center"} ${text ? "text-[#262626]" : "text-[#7f7f7f]"}`}>
                {text ? previewHeaderText(text.replace(/&\[Tab\]/gi, sheetName), 1, pages) : side === "center" && empty ? `Click to add ${part}` : ""}
              </span>}
            </label>
          );
        })}
      </div>
    </div>
  );
}
