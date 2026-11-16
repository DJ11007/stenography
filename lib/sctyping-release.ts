// The SCTyping installer currently hosted at public/downloads/sctyping-setup.exe. Installed apps
// read this (via app/offline-app/latest/route.ts) to decide whether to show "Update now!", so
// bump it in the same commit that replaces the installer -- never before, or apps would be told
// to update to a version that isn't downloadable yet.
export const SCTYPING_LATEST = {
  version: "0.1.10",
  notes: "Efficiency tests now grouped into English and Hindi, in test-number order. Word and Excel tests open in the real Word/Excel 2013-style editors.",
} as const;
