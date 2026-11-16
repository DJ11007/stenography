// The SCTyping installer currently hosted at public/downloads/sctyping-setup.exe. Installed apps
// read this (via app/offline-app/latest/route.ts) to decide whether to show "Update now!", so
// bump it in the same commit that replaces the installer -- never before, or apps would be told
// to update to a version that isn't downloadable yet.
export const SCTYPING_LATEST = {
  version: "0.1.21",
  notes: "Exam tests in pages of 50 in serial order with Word Length, branded Download Test, Printout Mode, Hide Typing, true full screen, Two Words backspace, Change Interface, Highlight Errors and your name on the test screen.",
} as const;
