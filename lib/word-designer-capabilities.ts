import { recommendedWordEditorCapabilities, type HierarchicalEditorCapabilities } from "./word-editor-capabilities.ts";

// What the admin can use while DESIGNING the working document: everything in the Home tab's Clipboard,
// Font, Paragraph and Editing groups (including the Font and Paragraph dialogs), exactly as students get
// them, plus tables. Pictures, columns, headers and page setup are left out because a working document
// cannot hold them. A few Font/Paragraph effects cannot be stored either (for example superscript or
// first-line indents): they stay usable, but the admin is told when the document is saved that they
// were not kept (see lib/word-matter-from-editor.ts).
const KEEP: Record<string, Record<string, string[] | "all">> = {
  Home: {
    clipboard: ["undo", "redo", "paste", "cut", "copy", "formatPainter"],
    font: "all",
    paragraph: "all",
    editing: "all",
  },
  Insert: { tables: ["insertTable"] },
  View: { show: ["ruler"], zoom: ["zoom100", "onePage", "twoPages"] },
};
export const DESIGNER_FONTS = ["Calibri (Body)", "Arial", "Times New Roman", "Mangal"];

export function designerCapabilities(): HierarchicalEditorCapabilities {
  const base = recommendedWordEditorCapabilities();
  for (const [tabId, tab] of Object.entries(base.tabs)) {
    let tabEnabled = tabId === "File";
    for (const [groupId, group] of Object.entries(tab.groups)) {
      const keep = KEEP[tabId]?.[groupId] ?? [];
      let groupEnabled = false;
      for (const optionId of Object.keys(group.options)) {
        group.options[optionId] = keep === "all" || keep.includes(optionId);
        groupEnabled ||= group.options[optionId];
      }
      group.enabled = groupEnabled;
      tabEnabled ||= groupEnabled;
    }
    tab.enabled = tabEnabled;
  }
  base.fonts = [...DESIGNER_FONTS];
  return base;
}
