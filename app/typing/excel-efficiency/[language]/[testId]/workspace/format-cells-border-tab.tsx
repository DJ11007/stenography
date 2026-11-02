"use client";
import { useState, type MouseEvent as ReactMouseEvent } from "react";
import type { BorderEdge, BorderLine, BorderLineStyle } from "@/lib/excel-sheet-model";

// The Border tab of Excel 2013's Format Cells dialog: pick a line style and colour on the left, then draw it with
// the None / Outline / Inside presets, the eight buttons round the preview, or by clicking the preview itself.
// Clicking a line that already has the picked style takes it off again, as in Excel.
export type BorderLines = Partial<Record<BorderEdge, BorderLine | null>>;

// Left column, then right column, as Excel lists them.
const STYLE_COLUMNS: (BorderLineStyle | null)[][] = [
  [null, "hair", "dotted", "dashDotDot", "dashDot", "dashed", "thin"],
  ["mediumDashDotDot", "slantDashDot", "mediumDashDot", "mediumDashed", "medium", "thick", "double"],
];
const STYLE_NAMES: Record<BorderLineStyle, string> = {
  hair: "Hair", dotted: "Dotted", dashDotDot: "Dash Dot Dot", dashDot: "Dash Dot", dashed: "Dashed", thin: "Thin",
  mediumDashDotDot: "Medium Dash Dot Dot", slantDashDot: "Slanted Dash Dot", mediumDashDot: "Medium Dash Dot", mediumDashed: "Medium Dashed", medium: "Medium", thick: "Thick", double: "Double",
};
const COLORS: [string, string][] = [
  ["000000", "Black"], ["FFFFFF", "White"], ["E7E6E6", "Gray"], ["44546A", "Blue-Gray"], ["4472C4", "Blue, Accent 1"], ["ED7D31", "Orange, Accent 2"], ["A5A5A5", "Gray, Accent 3"], ["FFC000", "Gold, Accent 4"], ["5B9BD5", "Blue, Accent 5"], ["70AD47", "Green, Accent 6"],
  ["C00000", "Dark Red"], ["FF0000", "Red"], ["FFC000", "Orange"], ["FFFF00", "Yellow"], ["92D050", "Light Green"], ["00B050", "Green"], ["00B0F0", "Light Blue"], ["0070C0", "Blue"], ["002060", "Dark Blue"], ["7030A0", "Purple"],
];

/** Stroke settings that draw a line style in SVG (a double line is two thin strokes). */
function strokeOf(style: BorderLineStyle): { width: number; dash?: string; double?: boolean } {
  switch (style) {
    case "hair": return { width: 1, dash: "1 1" };
    case "dotted": return { width: 1, dash: "1 2" };
    case "dashDotDot": return { width: 1, dash: "6 2 1 2 1 2" };
    case "dashDot": return { width: 1, dash: "6 2 1 2" };
    case "dashed": return { width: 1, dash: "3 2" };
    case "thin": return { width: 1 };
    case "mediumDashDotDot": return { width: 2, dash: "7 2 2 2 2 2" };
    case "slantDashDot": return { width: 2, dash: "9 1 4 1" };
    case "mediumDashDot": return { width: 2, dash: "7 3 2 3" };
    case "mediumDashed": return { width: 2, dash: "6 3" };
    case "medium": return { width: 2 };
    case "thick": return { width: 3 };
    case "double": return { width: 1, double: true };
  }
}
function Stroke({ x1, y1, x2, y2, line }: { x1: number; y1: number; x2: number; y2: number; line: BorderLine }) {
  const { width, dash, double } = strokeOf(line.style);
  const color = `#${line.color ?? "000000"}`;
  if (!double) return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={width} strokeDasharray={dash} />;
  // Two strokes 3px apart, across the line.
  const length = Math.hypot(x2 - x1, y2 - y1) || 1, nx = (-(y2 - y1) / length) * 1.5, ny = ((x2 - x1) / length) * 1.5;
  return <><line x1={x1 + nx} y1={y1 + ny} x2={x2 + nx} y2={y2 + ny} stroke={color} /><line x1={x1 - nx} y1={y1 - ny} x2={x2 - nx} y2={y2 - ny} stroke={color} /></>;
}

/** A small picture of one line of the preview, drawn on the buttons beside it (grey dotted cell, the line in black). */
function EdgeIcon({ edge }: { edge: BorderEdge }) {
  const paths: Record<BorderEdge, string> = {
    top: "M2 2.5h14", bottom: "M2 15.5h14", left: "M2.5 2v14", right: "M15.5 2v14", insideH: "M2 9h14", insideV: "M9 2v14", diagUp: "M2.5 15.5L15.5 2.5", diagDown: "M2.5 2.5l13 13",
  };
  return (
    <svg aria-hidden viewBox="0 0 18 18" width="18" height="18" fill="none">
      <path d="M2.5 2.5h13v13h-13zM9 2.5v13M2.5 9h13" stroke="#9a9a9a" strokeDasharray="1 1" />
      <path d={paths[edge]} stroke="#1e1e1e" />
    </svg>
  );
}

export function FormatCellsBorderTab({ lines, setLines, rows, cols }: { lines: BorderLines; setLines: (lines: BorderLines) => void; rows: boolean; cols: boolean }) {
  // Thin, Automatic: what Excel picks when the dialog opens.
  const [style, setStyle] = useState<BorderLineStyle | null>("thin");
  const [color, setColor] = useState<string | null>(null);
  const [palette, setPalette] = useState(false);
  const picked: BorderLine | null = style ? { style, color } : null;
  const inside = rows || cols;
  const available = (edge: BorderEdge) => (edge === "insideH" ? rows : edge === "insideV" ? cols : true);
  const same = (a: BorderLine | null | undefined, b: BorderLine | null) => (a ?? null) === b || (Boolean(a && b) && a!.style === b!.style && a!.color === b!.color);
  const toggle = (edge: BorderEdge) => {
    if (!available(edge)) return;
    setLines({ ...lines, [edge]: picked && !same(lines[edge], picked) ? picked : null });
  };
  const preset = (name: "none" | "outline" | "inside") => {
    if (name === "none") setLines(Object.fromEntries((["top", "bottom", "left", "right", "insideH", "insideV", "diagUp", "diagDown"] as BorderEdge[]).map((edge) => [edge, null])));
    else if (name === "outline") setLines({ ...lines, top: picked, bottom: picked, left: picked, right: picked });
    else setLines({ ...lines, ...(rows ? { insideH: picked } : {}), ...(cols ? { insideV: picked } : {}) });
  };

  // The preview: a box (with the lines between cells when more than one is selected) and "Text" in each cell.
  const W = 150, H = 96, X = 8, Y = 8;
  const clickPreview = (event: ReactMouseEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - box.left) / box.width) * (W + 2 * X) - X, y = ((event.clientY - box.top) / box.height) * (H + 2 * Y) - Y;
    const near = 9;
    const choices: [BorderEdge, number][] = [
      ["top", Math.abs(y)], ["bottom", Math.abs(y - H)], ["left", Math.abs(x)], ["right", Math.abs(x - W)],
      ...(rows ? [["insideH", Math.abs(y - H / 2)] as [BorderEdge, number]] : []), ...(cols ? [["insideV", Math.abs(x - W / 2)] as [BorderEdge, number]] : []),
    ];
    const [edge, distance] = choices.sort((a, b) => a[1] - b[1])[0];
    if (distance <= near) { toggle(edge); return; }
    // Elsewhere inside the box: the diagonal the click is closer to.
    if (x > 0 && x < W && y > 0 && y < H) {
      const up = Math.abs(y - (H - (x * H) / W)), down = Math.abs(y - (x * H) / W);
      toggle(up < down ? "diagUp" : "diagDown");
    }
  };
  const texts = [rows ? [H / 4, (3 * H) / 4] : [H / 2]].flat().flatMap((ty) => (cols ? [W / 4, (3 * W) / 4] : [W / 2]).map((tx) => [tx, ty]));
  const lineAt = (edge: BorderEdge) => lines[edge];
  const edgeButton = (edge: BorderEdge, label: string) => (
    <button key={edge} type="button" aria-label={label} title={label} aria-pressed={Boolean(lineAt(edge))} disabled={!available(edge)} onClick={() => toggle(edge)}
      className={`grid h-6 w-6 place-items-center border disabled:opacity-35 ${lineAt(edge) ? "border-[#7da2ce] bg-[#cce4f7]" : "border-slate-300 bg-white hover:border-[#7da2ce]"}`}><EdgeIcon edge={edge} /></button>
  );

  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-[150px_1fr] gap-4">
        <fieldset className="border border-slate-300 px-2 pb-2">
          <legend className="px-1">Line</legend>
          <p className="mb-1"><u>S</u>tyle:</p>
          <div role="listbox" aria-label="Line style" className="grid grid-cols-2 gap-x-1 border border-slate-400 bg-white p-1">
            {STYLE_COLUMNS[0].map((_, index) => STYLE_COLUMNS.map((column) => column[index])).flat().map((value, index) => (
              <button key={value ?? "none"} type="button" role="option" aria-selected={style === value} aria-label={value ? STYLE_NAMES[value] : "None"} title={value ? STYLE_NAMES[value] : "None"} onClick={() => setStyle(value)}
                className={`grid h-[18px] place-items-center ${style === value ? "outline outline-1 outline-slate-500" : ""}`} style={{ gridColumn: (index % 2) + 1 }}>
                {value ? <svg aria-hidden viewBox="0 0 56 8" width="56" height="8"><Stroke x1={1} y1={4} x2={55} y2={4} line={{ style: value, color: null }} /></svg> : <span className="text-[11px]">None</span>}
              </button>
            ))}
          </div>
          <p className="mb-1 mt-3"><u>C</u>olor:</p>
          <div className="relative">
            <button type="button" aria-haspopup="listbox" aria-expanded={palette} onClick={() => setPalette(!palette)} className="flex h-6 w-full items-center justify-between border border-slate-400 bg-white px-1">
              {color ? <span className="h-3.5 flex-1 border border-slate-400" style={{ backgroundColor: `#${color}` }} /> : <span className="flex-1 text-center">Automatic</span>}
              <span aria-hidden className="ml-1 border-l border-slate-300 pl-1 text-[9px]">▼</span>
            </button>
            {palette && (
              <div role="listbox" aria-label="Line color" className="absolute left-0 top-7 z-10 w-[214px] border border-slate-400 bg-white p-1.5 shadow-lg">
                <button type="button" role="option" aria-selected={color === null} onClick={() => { setColor(null); setPalette(false); }} className="mb-1.5 flex w-full items-center gap-2 border border-transparent px-1 py-0.5 hover:border-[#7da2ce] hover:bg-[#e5f1fb]"><span className="h-3.5 w-3.5 border border-slate-400 bg-black" />Automatic</button>
                <div className="grid grid-cols-10 gap-1">
                  {COLORS.map(([hex, name], index) => <button key={`${hex}-${index}`} type="button" role="option" aria-selected={color === hex} aria-label={name} title={name} onClick={() => { setColor(hex); setPalette(false); }} className={`h-4 w-4 border ${color === hex ? "outline outline-2 outline-[#f29436]" : "border-slate-300"}`} style={{ backgroundColor: `#${hex}` }} />)}
                </div>
              </div>
            )}
          </div>
        </fieldset>
        <div className="grid content-start gap-2">
          <p className="border-b border-slate-200 pb-0.5">Presets</p>
          <div className="flex gap-4 pl-10">
            {([["none", "None", ""], ["outline", "Outline", "M4.5 4.5h27v27h-27z"], ["inside", "Inside", "M18 4.5v27M4.5 18h27"]] as const).map(([name, label, path]) => (
              <button key={name} type="button" disabled={name === "inside" && !inside} onClick={() => preset(name)} className="group grid justify-items-center gap-1 disabled:text-slate-400">
                <span className="grid h-11 w-11 place-items-center border border-slate-300 bg-white group-hover:border-[#7da2ce] group-hover:bg-[#e5f1fb] group-disabled:opacity-40">
                  <svg aria-hidden viewBox="0 0 36 36" width="36" height="36" fill="none"><path d="M4.5 4.5h27v27h-27zM18 4.5v27M4.5 18h27" stroke="#9a9a9a" strokeDasharray="1 1" />{path && <path d={path} stroke="#1e1e1e" strokeWidth="1.5" />}</svg>
                </span>
                <span><u>{label[0]}</u>{label.slice(1)}</span>
              </button>
            ))}
          </div>
          <p className="border-b border-slate-200 pb-0.5">Border</p>
          <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1">
            <div className="grid content-between py-0.5">{edgeButton("top", "Top border")}{edgeButton("insideH", "Inside horizontal border")}{edgeButton("bottom", "Bottom border")}</div>
            <svg role="img" aria-label="Border preview: click a side, a line between cells or a diagonal to draw or remove it" viewBox={`${-X} ${-Y} ${W + 2 * X} ${H + 2 * Y}`} width={W + 2 * X} height={H + 2 * Y} onClick={clickPreview} className="cursor-pointer border border-slate-300 bg-white">
              {/* Excel's corner and middle ticks show where the lines go. */}
              <path d={`M0 -6v4M-6 0h4M${W} -6v4M${W + 2} 0h4M0 ${H + 2}v4M-6 ${H}h4M${W} ${H + 2}v4M${W + 2} ${H}h4${cols ? `M${W / 2} -6v4M${W / 2} ${H + 2}v4` : ""}${rows ? `M-6 ${H / 2}h4M${W + 2} ${H / 2}h4` : ""}`} stroke="#555" />
              {texts.map(([tx, ty]) => <text key={`${tx}-${ty}`} x={tx} y={ty + 4} textAnchor="middle" fontSize="12" fill="#222">Text</text>)}
              {lineAt("top") && <Stroke x1={0} y1={0} x2={W} y2={0} line={lineAt("top")!} />}
              {lineAt("bottom") && <Stroke x1={0} y1={H} x2={W} y2={H} line={lineAt("bottom")!} />}
              {lineAt("left") && <Stroke x1={0} y1={0} x2={0} y2={H} line={lineAt("left")!} />}
              {lineAt("right") && <Stroke x1={W} y1={0} x2={W} y2={H} line={lineAt("right")!} />}
              {rows && lineAt("insideH") && <Stroke x1={0} y1={H / 2} x2={W} y2={H / 2} line={lineAt("insideH")!} />}
              {cols && lineAt("insideV") && <Stroke x1={W / 2} y1={0} x2={W / 2} y2={H} line={lineAt("insideV")!} />}
              {lineAt("diagUp") && <Stroke x1={0} y1={H} x2={W} y2={0} line={lineAt("diagUp")!} />}
              {lineAt("diagDown") && <Stroke x1={0} y1={0} x2={W} y2={H} line={lineAt("diagDown")!} />}
            </svg>
            <span />
            <div className="flex items-center justify-between" style={{ width: W + 2 * X }}>
              {edgeButton("diagUp", "Diagonal up border")}{edgeButton("left", "Left border")}{edgeButton("insideV", "Inside vertical border")}{edgeButton("right", "Right border")}{edgeButton("diagDown", "Diagonal down border")}
            </div>
          </div>
        </div>
      </div>
      <p>The selected border style can be applied by clicking the presets, preview diagram or the buttons above.</p>
    </div>
  );
}
