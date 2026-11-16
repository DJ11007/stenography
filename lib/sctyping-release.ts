// The SCTyping installer currently hosted at public/downloads/sctyping-setup.exe. Installed apps
// read this (via app/offline-app/latest/route.ts) to decide whether to show "Update now!", so
// bump it in the same commit that replaces the installer -- never before, or apps would be told
// to update to a version that isn't downloadable yet.
export const SCTYPING_LATEST = {
  version: "0.1.9",
  notes: "Word and Excel efficiency tests in the real Word/Excel 2013-style editors, new tests sent by Samradhi Classes (typing and stenography with audio), notices from the admin.",
} as const;
