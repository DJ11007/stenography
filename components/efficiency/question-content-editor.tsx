"use client";
import { useRef } from "react";
import { tabularTextToMarkdownTable } from "@/lib/question-content";

/** The instruction textarea used by both the Word and Excel admin question
 * editors. A small toolbar inserts the same bold/list/table markdown that
 * components/efficiency/question-content.tsx renders, and pasting a table
 * copied straight out of Word or Excel is auto-converted into that table
 * markdown instead of landing as a wall of tab characters. */
export function QuestionContentEditor({ value, onChange, required, ariaLabel }: { value: string; onChange: (value: string) => void; required?: boolean; ariaLabel?: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const replaceSelection = (build: (selected: string) => { text: string; cursorOffset: number }) => {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart, end = el.selectionEnd;
    const { text, cursorOffset } = build(value.slice(start, end));
    const next = value.slice(0, start) + text + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => { el.focus(); const cursor = start + cursorOffset; el.setSelectionRange(cursor, cursor); });
  };

  const insertBlock = (block: string) => {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart, end = el.selectionEnd;
    const needsLeadingBreak = start > 0 && value[start - 1] !== "\n";
    const prefix = needsLeadingBreak ? "\n\n" : "";
    const next = value.slice(0, start) + prefix + block + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => { el.focus(); const cursor = start + prefix.length + block.length; el.setSelectionRange(cursor, cursor); });
  };

  const applyBold = () => replaceSelection((selected) => { const text = selected || "bold text"; return { text: `**${text}**`, cursorOffset: text.length + 4 }; });
  const applyBullets = () => replaceSelection((selected) => { const source = selected || "First item\nSecond item"; const text = source.split("\n").map((line) => (line.trim() ? `- ${line.replace(/^[-*]\s+/, "")}` : line)).join("\n"); return { text, cursorOffset: text.length }; });
  const applyNumbers = () => replaceSelection((selected) => { const source = selected || "First item\nSecond item"; const text = source.split("\n").map((line, index) => (line.trim() ? `${index + 1}. ${line.replace(/^\d+[.)]\s+/, "")}` : line)).join("\n"); return { text, cursorOffset: text.length }; });
  const insertTable = () => insertBlock("| Column 1 | Column 2 | Column 3 |\n|---|---|---|\n|  |  |  |\n|  |  |  |");

  const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const text = event.clipboardData.getData("text/plain");
    if (!text) return;
    const table = tabularTextToMarkdownTable(text);
    if (!table) return;
    event.preventDefault();
    insertBlock(table);
  };

  return (
    <div className="grid gap-1.5">
      <div className="flex flex-wrap gap-1.5">
        <ToolbarButton label="Bold" onClick={applyBold} />
        <ToolbarButton label="• Bullet list" onClick={applyBullets} />
        <ToolbarButton label="1. Numbered list" onClick={applyNumbers} />
        <ToolbarButton label="⊞ Insert table" onClick={insertTable} />
      </div>
      <textarea ref={ref} aria-label={ariaLabel} className="input min-h-28 font-mono text-sm" required={required} value={value} onChange={(event) => onChange(event.target.value)} onPaste={handlePaste} />
      <p className="text-[11px] text-slate-500">Tip: paste a table copied straight from Word or Excel here — it converts automatically into a rendered table for students. Use the buttons above for bold text or a blank list/table.</p>
    </div>
  );
}

function ToolbarButton({ label, onClick }: { label: string; onClick: () => void }) {
  return <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={onClick} className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-50">{label}</button>;
}
