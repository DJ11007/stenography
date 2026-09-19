import type { Metadata } from "next";
import { KeyHunterGame } from "./key-hunter-game";

export const metadata: Metadata = { title: "Key Hunter | Samradhi Classes" };

// requireStudent()/TypingStudentProvider already applied by
// app/typing/layout.tsx. Unlike WordTris/Speed Race/Word Defender, Key
// Hunter needs no server-fetched word bank -- its content is the same
// static GLYPH_KEYS keyboard-key list the tutors and WordTris's character
// mode already use, imported directly by the client component.
export default function KeyHunterPage() {
  return <KeyHunterGame />;
}
