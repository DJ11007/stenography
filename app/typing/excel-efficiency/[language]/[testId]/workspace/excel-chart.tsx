"use client";
import type { SheetCell, SheetChart } from "@/lib/excel-document";
import { parseRange, refAt } from "@/lib/excel-sheet-model";

// An inserted chart, drawn as Excel 2013 draws its default chart styles: series colours, a title, a value axis
// with gridlines, category labels and a legend. The data comes from the chart's range; as in Excel, a text
// first column gives the categories and a text first row gives the series names.
const COLORS = ["#5B9BD5", "#ED7D31", "#A5A5A5", "#FFC000", "#4472C4", "#70AD47", "#264478", "#9E480E"];
const W = 380, H = 230;

export function chartData(cells: Record<string, SheetCell>, range: string) {
  const rect = parseRange(range);
  if (!rect) return { categories: [] as string[], series: [] as { name: string; values: number[] }[] };
  const at = (row: number, col: number) => cells[refAt(row, col)]?.value ?? null;
  const textAt = (row: number, col: number) => typeof at(row, col) === "string";
  const valueCols = rect.c2 > rect.c1 ? Array.from({ length: rect.c2 - rect.c1 }, (_, i) => rect.c1 + 1 + i) : [rect.c1];
  const headerRow = rect.r2 > rect.r1 && valueCols.some((col) => textAt(rect.r1, col));
  const labelCol = rect.c2 > rect.c1 && Array.from({ length: rect.r2 - rect.r1 + 1 }, (_, i) => rect.r1 + i).some((row) => (!headerRow || row !== rect.r1) && textAt(row, rect.c1));
  const firstRow = headerRow ? rect.r1 + 1 : rect.r1, firstCol = labelCol ? rect.c1 + 1 : rect.c1;
  const categories = Array.from({ length: Math.max(0, rect.r2 - firstRow + 1) }, (_, i) => (labelCol ? String(at(firstRow + i, rect.c1) ?? "") : String(i + 1)));
  const series = Array.from({ length: Math.max(0, rect.c2 - firstCol + 1) }, (_, j) => ({
    name: headerRow ? String(at(rect.r1, firstCol + j) ?? `Series${j + 1}`) : `Series${j + 1}`,
    values: categories.map((_, i) => { const value = at(firstRow + i, firstCol + j); return typeof value === "number" ? value : Number(value) || 0; }),
  }));
  return { categories, series };
}

function niceMax(value: number) {
  if (value <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(value)), unit = value / power;
  return (unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 5 ? 5 : 10) * power;
}
const short = (value: number) => (Math.abs(value) >= 1000 ? value.toLocaleString("en-IN") : String(Math.round(value * 100) / 100));

export function ChartView({ chart, cells, selected }: { chart: SheetChart; cells: Record<string, SheetCell>; selected?: boolean }) {
  const { categories, series } = chartData(cells, chart.range);
  const top = chart.title ? 34 : 14, bottom = 46, left = 52, right = 14;
  const plotW = W - left - right, plotH = H - top - bottom;
  const all = series.flatMap((s) => s.values);
  const max = niceMax(Math.max(0, ...all)), min = Math.min(0, ...all) < 0 ? -niceMax(-Math.min(...all)) : 0;
  const span = max - min || 1;
  const y = (value: number) => top + plotH - ((value - min) / span) * plotH;
  const ticks = Array.from({ length: 6 }, (_, i) => min + (span * i) / 5);
  const legend = chart.type === "pie" ? categories.map((name, i) => ({ name, color: COLORS[i % COLORS.length] })) : series.map((s, i) => ({ name: s.name, color: COLORS[i % COLORS.length] }));
  let body: React.ReactNode = null;
  if (!categories.length || !series.length) body = <text x={W / 2} y={H / 2} textAnchor="middle" fontSize={12} fill="#777">No data in {chart.range}</text>;
  else if (chart.type === "pie") {
    const values = series[0].values.map((v) => Math.max(0, v)), total = values.reduce((a, b) => a + b, 0) || 1;
    const cx = left + plotW / 2 - 40, cy = top + plotH / 2, r = Math.min(plotW, plotH) / 2 - 4;
    let angle = -Math.PI / 2;
    body = values.map((value, i) => {
      const sweep = (value / total) * Math.PI * 2, end = angle + sweep;
      const path = sweep >= Math.PI * 2 - 1e-6 ? `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r} Z` : `M ${cx} ${cy} L ${cx + r * Math.cos(angle)} ${cy + r * Math.sin(angle)} A ${r} ${r} 0 ${sweep > Math.PI ? 1 : 0} 1 ${cx + r * Math.cos(end)} ${cy + r * Math.sin(end)} Z`;
      angle = end;
      return <path key={i} d={path} fill={COLORS[i % COLORS.length]} stroke="#fff" strokeWidth={1.5}><title>{`${categories[i]}: ${value}`}</title></path>;
    });
  } else if (chart.type === "bar") {
    const band = plotH / categories.length, barH = (band * 0.66) / series.length;
    const x = (value: number) => left + ((value - min) / span) * plotW;
    body = <>
      {ticks.map((tick, i) => <g key={i}><line x1={x(tick)} x2={x(tick)} y1={top} y2={top + plotH} stroke="#d9d9d9" /><text x={x(tick)} y={top + plotH + 14} textAnchor="middle" fontSize={9} fill="#595959">{short(tick)}</text></g>)}
      {categories.map((name, i) => <text key={name + i} x={left - 4} y={top + band * i + band / 2 + 3} textAnchor="end" fontSize={9} fill="#595959">{name.slice(0, 12)}</text>)}
      {series.map((s, j) => s.values.map((value, i) => <rect key={`${j}-${i}`} x={x(Math.min(0, value))} y={top + band * i + band * 0.17 + barH * j} width={Math.abs(x(value) - x(0))} height={barH} fill={COLORS[j % COLORS.length]}><title>{`${s.name}, ${categories[i]}: ${value}`}</title></rect>))}
    </>;
  } else {
    const band = plotW / categories.length;
    const cx = (i: number) => left + band * i + band / 2;
    body = <>
      {ticks.map((tick, i) => <g key={i}><line x1={left} x2={left + plotW} y1={y(tick)} y2={y(tick)} stroke="#d9d9d9" /><text x={left - 4} y={y(tick) + 3} textAnchor="end" fontSize={9} fill="#595959">{short(tick)}</text></g>)}
      {categories.map((name, i) => <text key={name + i} x={cx(i)} y={top + plotH + 13} textAnchor="middle" fontSize={9} fill="#595959">{name.slice(0, 12)}</text>)}
      {chart.type === "column" && series.map((s, j) => { const barW = (band * 0.66) / series.length; return s.values.map((value, i) => <rect key={`${j}-${i}`} x={left + band * i + band * 0.17 + barW * j} y={y(Math.max(0, value))} width={barW} height={Math.abs(y(value) - y(0))} fill={COLORS[j % COLORS.length]}><title>{`${s.name}, ${categories[i]}: ${value}`}</title></rect>); })}
      {chart.type === "line" && series.map((s, j) => <g key={j}><polyline fill="none" stroke={COLORS[j % COLORS.length]} strokeWidth={2.25} points={s.values.map((value, i) => `${cx(i)},${y(value)}`).join(" ")} />{s.values.map((value, i) => <circle key={i} cx={cx(i)} cy={y(value)} r={2.5} fill={COLORS[j % COLORS.length]}><title>{`${s.name}, ${categories[i]}: ${value}`}</title></circle>)}</g>)}
    </>;
  }
  return (
    <svg role="img" aria-label={`${chart.type} chart${chart.title ? `: ${chart.title}` : ""}`} width={W} height={H} viewBox={`0 0 ${W} ${H}`} className={`bg-white ${selected ? "outline outline-2 outline-[#217346]" : "outline outline-1 outline-[#d9d9d9]"}`}>
      {chart.title && <text x={W / 2} y={22} textAnchor="middle" fontSize={14} fill="#595959">{chart.title}</text>}
      {body}
      <g>{legend.slice(0, 8).map((item, i) => {
        const pie = chart.type === "pie";
        const lx = pie ? W - 120 : left + (plotW / Math.max(1, legend.length)) * i + 4, ly = pie ? top + 10 + i * 16 : H - 12;
        return <g key={item.name + i}><rect x={lx} y={ly - 7} width={8} height={8} fill={item.color} /><text x={lx + 12} y={ly} fontSize={9} fill="#595959">{item.name.slice(0, 16)}</text></g>;
      })}</g>
    </svg>
  );
}
