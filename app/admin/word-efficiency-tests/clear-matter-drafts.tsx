"use client";
import { useEffect } from "react";
import { clearAllMatterDrafts } from "@/lib/word-matter-draft";

// After a test is saved, the parked working documents (see lib/word-matter-draft.ts) are no longer needed.
export function ClearMatterDrafts() {
  useEffect(() => { clearAllMatterDrafts(); }, []);
  return null;
}
