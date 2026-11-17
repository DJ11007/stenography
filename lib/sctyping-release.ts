// The SCTyping installer currently hosted at public/downloads/sctyping-setup.exe. Installed apps
// read this (via app/offline-app/latest/route.ts) to decide whether to show "Update now!", so
// bump it in the same commit that replaces the installer -- never before, or apps would be told
// to update to a version that isn't downloadable yet.
export const SCTYPING_LATEST = {
  version: "0.1.29",
  notes: "Excel: Accounting / Number formats now keep 2 decimals and get their marks. Word: a red text outline stays red. Windows 7/8: now also works on 32-bit Windows.",
} as const;

// The Windows 7 / 8 installer carries Microsoft WebView2 109 (~140 MB), too big for the git repository (GitHub's
// 100 MB file limit), so it is a GitHub release asset. Same app version as SCTYPING_LATEST.
// Since 0.1.29 it is a 32-bit build, so the one installer runs on both 32-bit and 64-bit Windows 7 / 8.
export const SCTYPING_WIN7 = {
  version: "0.1.29",
  url: "https://github.com/DJ11007/stenography/releases/download/sctyping-v0.1.29/SCTyping_0.1.29_Windows7-8-setup.exe",
  sizeMb: 142,
} as const;
