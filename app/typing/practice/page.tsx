import { redirect } from "next/navigation";

// The "Practice Tests" section was removed from the website at the owner's request (16 Nov 2026). Old links and
// bookmarks to it land on the Typing hub. Stenography practice (/typing/practice/stenography/...) and the error
// drill keep working: they are separate pages under this folder.
export default function PracticeCataloguePage() {
  redirect("/typing");
}
