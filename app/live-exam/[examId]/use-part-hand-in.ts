import { useEffect, useState } from "react";

type Part = { id: string };

// Which part's screen the exam shows: the part running now, or — after its end — the part that has not handed its
// answer in yet, for up to 2.5 minutes (the server accepts a late answer for 2). Real bugs it fixes: at the end second
// the page used to switch to the break and remove the screen while it was still confirming the end with the server,
// and a first fix decided the hold in an effect, which left one frame without the screen — enough to remove the typing
// screen and its text. Here the hold is decided while rendering, so the same screen stays. A part that has started
// always comes first, so a part still handing in never holds up the next one.
export function usePartHandIn<T extends Part>(openSection: T | null, preview: boolean, onHandedIn?: () => void) {
  const [handedIn, setHandedIn] = useState<ReadonlySet<string>>(() => new Set());
  const [closing, setClosing] = useState<T | null>(null);
  const [lastOpen, setLastOpen] = useState<T | null>(null);
  if ((openSection?.id ?? null) !== (lastOpen?.id ?? null)) {
    setLastOpen(openSection);
    setClosing(openSection ? null : lastOpen && !preview && !handedIn.has(lastOpen.id) ? lastOpen : null);
  }
  useEffect(() => { if (!closing) return; const timer = window.setTimeout(() => setClosing(null), 150000); return () => window.clearTimeout(timer); }, [closing]);
  const handIn = (sectionId: string) => {
    setHandedIn((current) => new Set(current).add(sectionId));
    setClosing((current) => (current?.id === sectionId ? null : current));
    onHandedIn?.();
  };
  return { active: openSection ?? closing, handIn };
}
