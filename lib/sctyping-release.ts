// The SCTyping installer currently hosted at public/downloads/sctyping-setup.exe. Installed apps
// read this (via app/offline-app/latest/route.ts) to decide whether to show "Update now!", so
// bump it in the same commit that replaces the installer -- never before, or apps would be told
// to update to a version that isn't downloadable yet.
export const SCTYPING_LATEST = {
  version: "0.1.13",
  notes: "New typing defaults: both font sizes 20px and linked, Courier New for English, virtual keyboard off. Plus the full typing settings and test toolbar.",
} as const;
