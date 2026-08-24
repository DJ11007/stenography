"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { DEFAULT_PLATFORM_PREFERENCES, TYPING_PLATFORM_SETTINGS_KEY, TYPING_PLATFORM_SETTINGS_VERSION, migrateTypingPlatformSettings, type UniversalTypingPreferences } from "@/lib/typing-platform-settings";

type ContextValue = { preferences: UniversalTypingPreferences; loaded: boolean; updatePreferences: (changes: Partial<UniversalTypingPreferences>) => void };
const TypingPlatformContext = createContext<ContextValue | null>(null);

export function TypingPlatformProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferences] = useState(DEFAULT_PLATFORM_PREFERENCES);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { const timer = window.setTimeout(() => { try { const currentText = localStorage.getItem(TYPING_PLATFORM_SETTINGS_KEY); const legacyKeys = ["rssb-ldc-typing-settings", "samradhi-typing-font-sizes-v1-latin-unicode", "samradhi-typing-font-sizes-v1-devanagari-unicode", "samradhi-typing-font-sizes-v1-devanagari-krutidev-legacy"]; const legacy: Record<string, unknown> = {}; for (const key of legacyKeys) { const text = localStorage.getItem(key); if (text) { try { legacy[key] = JSON.parse(text); } catch {} } } const store = migrateTypingPlatformSettings(currentText ? JSON.parse(currentText) : null, legacy); setPreferences(store.preferences); localStorage.setItem(TYPING_PLATFORM_SETTINGS_KEY, JSON.stringify(store)); } catch { setPreferences(DEFAULT_PLATFORM_PREFERENCES); } setLoaded(true); }, 0); return () => window.clearTimeout(timer); }, []);
  const updatePreferences = (changes: Partial<UniversalTypingPreferences>) => setPreferences((current) => { const next = { ...current, ...changes }; try { localStorage.setItem(TYPING_PLATFORM_SETTINGS_KEY, JSON.stringify({ version: TYPING_PLATFORM_SETTINGS_VERSION, preferences: next })); } catch {} return next; });
  return <TypingPlatformContext.Provider value={{ preferences, loaded, updatePreferences }}>{children}</TypingPlatformContext.Provider>;
}

export function useTypingPlatformSettings() { const value = useContext(TypingPlatformContext); if (!value) throw new Error("TypingPlatformProvider is required."); return value; }
