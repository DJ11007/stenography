import type { TypingScript } from "@/lib/typing-language";
import type { TypingSettings } from "@/lib/typing-test";
import type { TypingFontPreferences } from "@/lib/typing-font-preferences";
import { FontSizeControls } from "./font-size-controls";

type UniversalTypingSettingsProps = {
  settings: TypingSettings; autoScroll: boolean; showScrollbar?: boolean; fonts: TypingFontPreferences; script: TypingScript;
  rulesLocked?: boolean; compact?: boolean; durationMinutes?: number; durationLocked?: boolean;
  onDurationChange?: (value: number) => void; onSettingsChange: (changes: Partial<TypingSettings>) => void;
  onScrollChange: (value: boolean) => void; onScrollbarChange?: (value: boolean) => void;
  onFontsChange: (value: TypingFontPreferences) => void; onReset?: () => void;
};

export function UniversalTypingSettings({ settings, autoScroll, showScrollbar, fonts, script, rulesLocked = false, compact = false, durationMinutes, durationLocked = false, onDurationChange, onSettingsChange, onScrollChange, onScrollbarChange, onFontsChange, onReset }: UniversalTypingSettingsProps) {
  return <div className={compact ? "space-y-3" : "space-y-5"}>
    {durationMinutes !== undefined && onDurationChange && <label className="block text-sm font-bold">Duration (1–60 minutes)<input type="number" min={1} max={60} disabled={durationLocked} value={durationMinutes} onChange={(event) => { const value = Number(event.target.value); if (Number.isInteger(value) && value >= 1 && value <= 60) onDurationChange(value); }} className="input mt-2"/></label>}
    <FontSizeControls value={fonts} script={script} compact={compact} onChange={onFontsChange}/>
    <SettingOptions compact={compact} label="Highlight" value={settings.highlightMode} disabled={rulesLocked} values={[["character","Character"],["word","Current Word"],["none","None"]]} onChange={(highlightMode) => onSettingsChange({ highlightMode: highlightMode as TypingSettings["highlightMode"] })}/>
    <SettingOptions compact={compact} label="Backspace" value={settings.backspaceMode} disabled={rulesLocked} values={[["full","Full"],["word","Current Word"],["disabled","Disabled"]]} onChange={(backspaceMode) => onSettingsChange({ backspaceMode: backspaceMode as TypingSettings["backspaceMode"] })}/>
    <SettingOptions compact={compact} label="Word calculation" value={settings.wordMethod} disabled={rulesLocked} values={[["characters","5 Characters"],["spaces","Space-separated Words"]]} onChange={(wordMethod) => onSettingsChange({ wordMethod: wordMethod as TypingSettings["wordMethod"] })}/>
    <SettingOptions compact={compact} label="Auto Scroll" value={autoScroll ? "auto" : "manual"} values={[["auto","On"],["manual","Off"]]} onChange={(value) => onScrollChange(value === "auto")}/>
    {showScrollbar !== undefined && onScrollbarChange && <label className={`flex cursor-pointer items-center gap-2 rounded-lg bg-slate-50 font-bold text-slate-800 ${compact ? "p-2 text-xs" : "p-3 text-sm"}`}><input type="checkbox" checked={showScrollbar} onChange={(event) => onScrollbarChange(event.target.checked)}/><span>Show Scrollbar</span></label>}
    {rulesLocked && <p className={`rounded-lg bg-amber-50 font-bold text-amber-900 ${compact ? "p-2 text-xs" : "p-3 text-sm"}`}>Official rule controls are shown but locked. Visual and accessibility controls remain editable.</p>}
    {onReset && <button type="button" onClick={onReset} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-black text-slate-700 hover:bg-slate-50">Reset settings</button>}
  </div>;
}

function SettingOptions({ label, value, values, disabled = false, compact = false, onChange }: { label: string; value: string; values: [string,string][]; disabled?: boolean; compact?: boolean; onChange: (value: string) => void }) {
  return <fieldset disabled={disabled}><legend className={compact ? "mb-1 text-xs font-bold" : "mb-2 text-sm font-bold"}>{label}</legend><div className={compact ? `grid gap-1.5 ${values.length === 3 ? "grid-cols-3" : "grid-cols-2"}` : "grid gap-2 sm:grid-cols-3 xl:grid-cols-1"}>{values.map(([id,text]) => <button key={id} type="button" disabled={disabled} aria-pressed={value === id} onClick={() => onChange(id)} className={`rounded-lg border text-left font-bold disabled:cursor-not-allowed disabled:opacity-60 ${compact ? "min-h-8 px-2 py-1 text-xs" : "px-3 py-2 text-sm"} ${value === id ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-slate-50"}`}>{value === id ? "●" : "○"} {text}</button>)}</div></fieldset>;
}
