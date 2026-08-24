"use client";

import { DEFAULT_TYPING_SETTINGS } from "@/lib/typing-test";
import { UniversalTypingSettings } from "../../../../_components/universal-typing-settings";
import { useTypingPlatformSettings } from "../../../../_components/typing-platform-provider";
import { TypingBrandHeader } from "../../../../_components/typing-brand";

export default function UniversalSettingsPage() {
  const { preferences, updatePreferences } = useTypingPlatformSettings();
  const settings = { ...DEFAULT_TYPING_SETTINGS, backspaceMode: preferences.backspaceMode, highlightMode: preferences.highlightMode, wordMethod: preferences.wordMethod };
  return <main className="min-h-screen bg-slate-100"><TypingBrandHeader/><section className="mx-auto max-w-2xl px-4 py-10"><div className="rounded-3xl bg-white p-6 shadow-xl sm:p-8"><h1 className="text-3xl font-black">Universal Typing Settings</h1><p className="mt-2 text-slate-600">These preferences follow you across lessons, practice tests, custom simulations and accessibility controls in official presets.</p><div className="mt-7"><UniversalTypingSettings settings={settings} autoScroll={preferences.autoScroll} fonts={preferences.fonts.latin} script="Latin" onSettingsChange={(changes) => updatePreferences(changes)} onScrollChange={(autoScroll) => updatePreferences({autoScroll})} onFontsChange={(latin) => updatePreferences({fonts:{...preferences.fonts,latin}})}/></div></div></section></main>;
}
