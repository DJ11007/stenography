"use client";
import { useEffect } from "react";
import { clearAllMatterDrafts } from "@/lib/word-matter-draft";

// After a test is saved, the parked working documents (see lib/word-matter-draft.ts), the form drafts kept in
// this browser and the extracted-question previews are no longer needed. Without this the next "New test" came
// back filled with the test just saved.
export function ClearMatterDrafts() {
  useEffect(() => {
    clearAllMatterDrafts();
    try {
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith("samradhi-word-efficiency-draft-v2:") || /^samradhi-(word|excel)-efficiency-pdf-preview-v1/.test(key)) localStorage.removeItem(key);
      }
    } catch { /* storage unavailable: nothing was kept */ }
  }, []);
  return null;
}
