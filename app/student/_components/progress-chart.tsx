"use client";

import { useId, useState } from "react";
import type { ProgressPoint } from "@/lib/typing-progress";

const PERIODS: { id: "week" | "month"; label: string }[] = [
  { id: "week", label: "Weekly" },
  { id: "month", label: "Monthly" },
];

// Single-series line charts (Net WPM and Accuracy are different units/scales,
// so per the "never dual-axis" rule they're two separate charts, not one
// chart with two Y axes) -- each with a hover+keyboard-focus crosshair
// tooltip, and every value also reachable without hovering via the <details>
// table beneath it (tooltips enhance, they never gate).
function TrendLine({ points, color, unit, height = 160 }: { points: ProgressPoint[]; color: string; unit: "wpm" | "%"; height?: number }) {
  const gradientId = useId();
  const [hover, setHover] = useState<number | null>(null);
  const width = 560;
  const padX = 28, padTop = 16, padBottom = 26;
  const plotW = width - padX * 2, plotH = height - padTop - padBottom;
  const values = points.map((p) => (unit === "wpm" ? p.netWpm : p.accuracy));
  const maxValue = Math.max(...values, 1);
  const niceMax = unit === "%" ? 100 : Math.ceil((maxValue * 1.15) / 5) * 5;
  const x = (i: number) => (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW) + padX;
  const y = (v: number) => padTop + plotH - (v / niceMax) * plotH;
  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(unit === "wpm" ? p.netWpm : p.accuracy).toFixed(1)}`).join(" ");
  const gridLines = [0.25, 0.5, 0.75, 1];

  if (points.length === 0) {
    return <div className="flex h-[160px] items-center justify-center rounded-xl bg-slate-50 text-sm font-semibold text-slate-400">Keep practising — your trend will appear here.</div>;
  }

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${unit === "wpm" ? "Net WPM" : "Accuracy"} trend over time`} className="w-full touch-none" onPointerLeave={() => setHover(null)}>
        {gridLines.map((fraction) => (
          <line key={fraction} x1={padX} x2={width - padX} y1={padTop + plotH * (1 - fraction)} y2={padTop + plotH * (1 - fraction)} stroke="#e2e8f0" strokeWidth={1} />
        ))}
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.18} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <path d={`${linePath} L${x(points.length - 1).toFixed(1)},${padTop + plotH} L${x(0).toFixed(1)},${padTop + plotH} Z`} fill={`url(#${gradientId})`} stroke="none" />
        <path d={linePath} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {hover != null && <line x1={x(hover)} x2={x(hover)} y1={padTop} y2={padTop + plotH} stroke="#94a3b8" strokeWidth={1} strokeDasharray="3 3" />}
        {points.map((p, i) => {
          const value = unit === "wpm" ? p.netWpm : p.accuracy;
          const isHovered = hover === i;
          return (
            <g key={p.key}>
              <text x={x(i)} y={height - 6} textAnchor="middle" className="fill-slate-400" style={{ fontSize: 10, fontWeight: 700 }}>{p.label}</text>
              <circle cx={x(i)} cy={y(value)} r={isHovered ? 5 : 3.5} fill={color} stroke="white" strokeWidth={1.5} />
              {isHovered && (
                <g transform={`translate(${Math.min(Math.max(x(i), padX + 34), width - padX - 34)}, ${Math.max(y(value) - 30, padTop)})`}>
                  <rect x={-34} y={-14} width={68} height={22} rx={6} fill="#0f172a" />
                  <text x={0} y={1} textAnchor="middle" className="fill-white" style={{ fontSize: 11, fontWeight: 800 }}>{value}{unit === "%" ? "%" : " WPM"}</text>
                </g>
              )}
              <circle cx={x(i)} cy={y(value)} r={12} fill="transparent" tabIndex={0} aria-label={`${p.label}: ${value}${unit === "%" ? "%" : " net WPM"} across ${p.attempts} attempt${p.attempts === 1 ? "" : "s"}`} onPointerEnter={() => setHover(i)} onFocus={() => setHover(i)} onBlur={() => setHover((current) => (current === i ? null : current))} className="outline-none focus-visible:stroke-slate-900 focus-visible:stroke-2" />
            </g>
          );
        })}
      </svg>
      <details className="mt-1">
        <summary className="cursor-pointer text-xs font-bold text-slate-400 hover:text-slate-600">Show values as a table</summary>
        <table className="mt-2 w-full text-left text-xs"><thead><tr className="text-slate-400"><th className="pb-1 font-bold">Period</th><th className="pb-1 font-bold">{unit === "wpm" ? "Best Net WPM" : "Best Accuracy"}</th><th className="pb-1 font-bold">Attempts</th></tr></thead>
          <tbody>{points.map((p) => <tr key={p.key} className="border-t border-slate-100"><td className="py-1 font-semibold text-slate-700">{p.label}</td><td className="py-1 font-black text-slate-900">{unit === "wpm" ? p.netWpm : p.accuracy}{unit === "%" ? "%" : ""}</td><td className="py-1 text-slate-500">{p.attempts}</td></tr>)}</tbody>
        </table>
      </details>
    </div>
  );
}

export function ProgressChart({ weekly, monthly }: { weekly: ProgressPoint[]; monthly: ProgressPoint[] }) {
  const [period, setPeriod] = useState<"week" | "month">("week");
  const points = period === "week" ? weekly : monthly;
  const hasAnyData = weekly.length > 0 || monthly.length > 0;

  if (!hasAnyData) return null;

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-black text-slate-950">Your Progress</h2>
        <div className="flex gap-1.5 rounded-xl bg-slate-100 p-1" role="tablist" aria-label="Progress chart period">
          {PERIODS.map(({ id, label }) => (
            <button key={id} type="button" role="tab" aria-selected={period === id} onClick={() => setPeriod(id)} className={`rounded-lg px-4 py-1.5 text-xs font-black transition ${period === id ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-5 grid gap-6 lg:grid-cols-2">
        <div><p className="mb-2 text-xs font-black uppercase tracking-widest text-blue-700">Net WPM (best per {period})</p><TrendLine points={points} color="#1d4ed8" unit="wpm" /></div>
        <div><p className="mb-2 text-xs font-black uppercase tracking-widest text-emerald-700">Accuracy (best per {period})</p><TrendLine points={points} color="#059669" unit="%" /></div>
      </div>
    </section>
  );
}
