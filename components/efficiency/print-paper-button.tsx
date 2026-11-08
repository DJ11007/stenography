"use client";

// Opens the browser's print window for the question paper; choosing "Save as PDF" there downloads it.
export function PrintPaperButton() {
  return (
    <button type="button" onClick={() => window.print()} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-black text-white shadow-sm hover:bg-blue-600">
      Download PDF
    </button>
  );
}
