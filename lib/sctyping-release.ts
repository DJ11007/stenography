// The SCTyping installer currently hosted at public/downloads/sctyping-setup.exe. Installed apps
// read this (via app/offline-app/latest/route.ts) to decide whether to show "Update now!", so
// bump it in the same commit that replaces the installer -- never before, or apps would be told
// to update to a version that isn't downloadable yet.
export const SCTYPING_LATEST = {
  version: "0.1.28",
  notes: "Complete result screen like the website after every test, fully offline. Windows 7/8: WebView2 now built in, no separate installation.",
} as const;

// The Windows 7 / 8 installer carries Microsoft WebView2 109 (~150 MB), too big for the git repository (GitHub's
// 100 MB file limit), so it is a GitHub release asset. Same app version as SCTYPING_LATEST.
export const SCTYPING_WIN7 = {
  version: "0.1.28",
  url: "https://github.com/DJ11007/stenography/releases/download/sctyping-v0.1.28/SCTyping_0.1.28_Windows7-8_x64-setup.exe",
  sizeMb: 163,
} as const;
