import type { TypingScript } from "@/lib/typing-language";
import { PRACTICE_DURATION_MINUTES, type TypingSettings } from "@/lib/typing-test";
import type { TypingFontPreferences } from "@/lib/typing-font-preferences";
import { FontSizeControls } from "./font-size-controls";

type UniversalTypingSettingsProps = {
  settings: TypingSettings; autoScroll: boolean; showScrollbar?: boolean; fonts: TypingFontPreferences; script: TypingScript;
  rulesLocked?: boolean;
  // Real reported bug: an exam category whose real highlighting rule was
  // never actually researched/confirmed was still locking the Highlight
  // control as if it were a genuine official rule, indistinguishable from
  // a category (like RRB NTPC) that HAS a confirmed rule. Callers now pass
  // this separately -- it defaults to rulesLocked for any caller that
  // doesn't distinguish the two, but a caller that knows better
  // (configurable-typing-exam.tsx) can unlock just this one control while
  // Backspace/Word calculation stay locked.
  highlightLocked?: boolean;
  // Real requested feature: a student sometimes has a genuine reason to
  // deviate from an official/managed test's locked rules (e.g. practicing
  // without the real exam's harsh "no correction at all" restriction) --
  // rather than the platform guessing whether every category's locked rule
  // is exactly right for them, one explicit unlock toggle lets them
  // override every official-rule control themselves "when necessary"
  // (Highlight, Backspace, and Word calculation alike), defaulting to
  // locked. Word calculation's on-screen number can briefly desync from
  // what a managed test's server-side rescore ultimately saves (the server
  // always rescores using the test's real wordMethod regardless of the
  // client's local setting) -- the warning shown alongside the toggle below
  // covers that.
  backspaceLocked?: boolean;
  wordMethodLocked?: boolean;
  manualUnlock?: boolean;
  onManualUnlockChange?: (value: boolean) => void;
  compact?: boolean; durationMinutes?: number; durationLocked?: boolean;
  onDurationChange?: (value: number) => void; onSettingsChange: (changes: Partial<TypingSettings>) => void;
  onScrollChange: (value: boolean) => void; onScrollbarChange?: (value: boolean) => void;
  onFontsChange: (value: TypingFontPreferences) => void; onReset?: () => void;
  showPassageWordCount?: boolean; passageWordCount?: number; passageWordCountLocked?: boolean; onPassageWordCountChange?: (value: number | null) => void;
};

export function UniversalTypingSettings({ settings, autoScroll, showScrollbar, fonts, script, rulesLocked = false, highlightLocked, backspaceLocked, wordMethodLocked, manualUnlock = false, onManualUnlockChange, compact = false, durationMinutes, durationLocked = false, onDurationChange, onSettingsChange, onScrollChange, onScrollbarChange, onFontsChange, onReset, showPassageWordCount = false, passageWordCount, passageWordCountLocked = false, onPassageWordCountChange }: UniversalTypingSettingsProps) {
  const highlightIsLocked = highlightLocked ?? rulesLocked;
  const backspaceIsLocked = backspaceLocked ?? rulesLocked;
  const wordMethodIsLocked = wordMethodLocked ?? rulesLocked;
  return <div className={compact ? "space-y-3" : "space-y-5"}>
    {durationMinutes !== undefined && onDurationChange && <label className="block text-sm font-bold">Duration<select disabled={durationLocked} value={durationMinutes} onChange={(event) => onDurationChange(Number(event.target.value))} className="input mt-2">{(PRACTICE_DURATION_MINUTES.includes(durationMinutes) ? PRACTICE_DURATION_MINUTES : [...PRACTICE_DURATION_MINUTES, durationMinutes].sort((a, b) => a - b)).map((minutes) => <option key={minutes} value={minutes}>{minutes} min</option>)}</select></label>}
    <FontSizeControls value={fonts} script={script} compact={compact} onChange={onFontsChange}/>
    <SettingOptions compact={compact} label="Highlight" value={settings.highlightMode} disabled={highlightIsLocked} values={[["character","Character"],["word","Current Word"],["none","None"]]} onChange={(highlightMode) => onSettingsChange({ highlightMode: highlightMode as TypingSettings["highlightMode"] })}/>
    <SettingOptions compact={compact} label="Backspace" value={settings.backspaceMode} disabled={backspaceIsLocked} values={[["full","Full"],["word","Current Word"],["disabled","Disabled"]]} onChange={(backspaceMode) => onSettingsChange({ backspaceMode: backspaceMode as TypingSettings["backspaceMode"] })}/>
    <SettingOptions compact={compact} label="Word calculation" value={settings.wordMethod} disabled={wordMethodIsLocked} values={[["characters","5 Characters"],["spaces","Space-separated Words"]]} onChange={(wordMethod) => onSettingsChange({ wordMethod: wordMethod as TypingSettings["wordMethod"] })}/>
    {showPassageWordCount && onPassageWordCountChange && <label className={compact ? "block text-xs font-bold" : "block text-sm font-bold"}>Passage length (words){passageWordCountLocked && <span className="ml-1 font-normal text-slate-500">— locked to this test&apos;s own length</span>}<input type="number" min={150} max={700} disabled={passageWordCountLocked} value={passageWordCount ?? ""} onChange={(event) => { const raw = Number(event.target.value); if (!Number.isFinite(raw)) return; onPassageWordCountChange(Math.min(700, Math.max(150, Math.round(raw)))); }} className="input mt-1"/></label>}
    <SettingOptions compact={compact} label="Auto Scroll" value={autoScroll ? "auto" : "manual"} values={[["auto","On"],["manual","Off"]]} onChange={(value) => onScrollChange(value === "auto")}/>
    {showScrollbar !== undefined && onScrollbarChange && <label className={`flex cursor-pointer items-center gap-2 rounded-lg bg-slate-50 font-bold text-slate-800 ${compact ? "p-2 text-xs" : "p-3 text-sm"}`}><input type="checkbox" checked={showScrollbar} onChange={(event) => onScrollbarChange(event.target.checked)}/><span>Show Scrollbar</span></label>}
    {rulesLocked && onManualUnlockChange && <button type="button" onClick={() => onManualUnlockChange(!manualUnlock)} className={`flex w-full items-center justify-center gap-2 rounded-lg border font-black ${compact ? "p-2 text-xs" : "p-3 text-sm"} ${manualUnlock ? "border-amber-400 bg-amber-100 text-amber-900" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}>
      <span aria-hidden="true">{manualUnlock ? "🔓" : "🔒"}</span>{manualUnlock ? "Official rules unlocked — using your own settings" : "Unlock official rules for this attempt"}
    </button>}
    {rulesLocked && <p className={`rounded-lg bg-amber-50 font-bold text-amber-900 ${compact ? "p-2 text-xs" : "p-3 text-sm"}`}>{manualUnlock ? "This attempt no longer matches this test's official rules, so it won't reflect genuine exam-readiness -- lock it again above before you rely on the result." : `${highlightIsLocked ? "Official rule controls are shown but locked. Visual and accessibility controls remain editable." : "Backspace and word calculation are official rules and stay locked. Highlighting isn't part of the real exam's rules, so it's yours to set."}${onManualUnlockChange ? " Use the button above to unlock them for this attempt, if you need to." : ""}`}</p>}
    {onReset && <button type="button" onClick={onReset} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-black text-slate-700 hover:bg-slate-50">Reset settings</button>}
  </div>;
}

function SettingOptions({ label, value, values, disabled = false, compact = false, onChange }: { label: string; value: string; values: [string,string][]; disabled?: boolean; compact?: boolean; onChange: (value: string) => void }) {
  return <fieldset disabled={disabled}><legend className={compact ? "mb-1 text-xs font-bold" : "mb-2 text-sm font-bold"}>{label}</legend><div className={compact ? `grid gap-1.5 ${values.length === 3 ? "grid-cols-3" : "grid-cols-2"}` : "grid gap-2 sm:grid-cols-3 xl:grid-cols-1"}>{values.map(([id,text]) => <button key={id} type="button" disabled={disabled} aria-pressed={value === id} onClick={() => onChange(id)} className={`rounded-lg border text-left font-bold disabled:cursor-not-allowed disabled:opacity-60 ${compact ? "min-h-8 px-2 py-1 text-xs" : "px-3 py-2 text-sm"} ${value === id ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-slate-50"}`}>{value === id ? "●" : "○"} {text}</button>)}</div></fieldset>;
}
