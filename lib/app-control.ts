// Shared by the admin "App control" page and the /offline-app/control feed.
// Keys are the contract with the installed app (stenography-offline/src/lib/app-control.ts):
//   section:<learn|practice|exam|steno|efficiency>, learn:<krutidev|english>,
//   exam:<category slug>, steno:<category slug>, word:<test slug>, excel:<test slug>.
export type AppAccess = "default" | "free" | "activated";
export type AppRule = { key: string; visible: boolean; access: AppAccess };
export type AppSettings = { notice: string; trialSeconds: string; trialWords: string };
export type AppControlItem = { key: string; label: string; hint?: string };
export type AppControlGroup = { heading: string; items: AppControlItem[] };

export const APP_SECTION_ITEMS: AppControlItem[] = [
  { key: "section:learn", label: "Learn Typing" },
  { key: "section:practice", label: "Quick Practice" },
  { key: "section:exam", label: "Exam Simulator" },
  { key: "section:steno", label: "Stenography" },
  { key: "section:efficiency", label: "Word / Excel Efficiency" },
];

export const APP_LEARN_ITEMS: AppControlItem[] = [
  { key: "learn:krutidev", label: "Hindi — Kruti Dev lessons" },
  { key: "learn:english", label: "English lessons" },
];

export function normaliseRules(raw: unknown): AppRule[] {
  if (!raw || typeof raw !== "object") return [];
  return Object.entries(raw as Record<string, { visible?: boolean; access?: string }>).map(([key, value]) => ({
    key,
    visible: value?.visible !== false,
    access: value?.access === "free" || value?.access === "activated" ? value.access : "default",
  }));
}
