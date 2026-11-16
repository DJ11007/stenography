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

// The App control admin is split into one simple page per area (hub at /admin/app-control).
export type AppArea = "general" | "learn" | "exam" | "steno-boards" | "word" | "excel";
export const APP_AREAS: Array<{ id: AppArea; title: string; blurb: string; manageHref?: string; manageLabel?: string }> = [
  { id: "general", title: "Home sections, notice & trial", blurb: "Turn whole sections on or off on the app home page, show a notice banner, and set the free-trial limits." },
  { id: "learn", title: "Learn Typing", blurb: "Show, hide or lock the Hindi (Kruti Dev) and English lessons.", manageHref: "/admin/learning-tests", manageLabel: "Create / edit learning lessons" },
  { id: "exam", title: "Typing Exam Simulator", blurb: "Show, hide or lock each exam board (SSC CGL, RRB NTPC, ...) in the typing exam simulator.", manageHref: "/admin/exam-tests", manageLabel: "Create / edit exam tests" },
  { id: "steno-boards", title: "Stenography exam boards", blurb: "Show, hide or lock each stenography exam board.", manageHref: "/admin/stenography-tests", manageLabel: "Create / upload stenography tests" },
  { id: "word", title: "Word Efficiency tests", blurb: "Show, hide or lock each Word efficiency test.", manageHref: "/admin/word-efficiency-tests", manageLabel: "Create / upload Word tests" },
  { id: "excel", title: "Excel Efficiency tests", blurb: "Show, hide or lock each Excel efficiency test.", manageHref: "/admin/excel-efficiency-tests", manageLabel: "Create / upload Excel tests" },
];
