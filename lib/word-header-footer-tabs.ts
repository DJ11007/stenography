// A header/footer line laid out in Word's three tab positions -- Blank (Three Columns), or Tab pressed
// in the line (rich-document-editor headerFooterTab) -- is saved as Word saves it: text with tab
// characters. "1\t\tSAMRADHI CLASSES" = page number on the left, text on the right. Loading turns
// the tabs back into the three positions, so the layout (and what it is graded on) survives a reload.

const ELEMENT_NODE = 1;
const asElement = (node: Node | null): HTMLElement | null => (node && node.nodeType === ELEMENT_NODE ? node as HTMLElement : null);

export function isHeaderFooterZone(node: Node): node is HTMLElement {
  const element = asElement(node);
  return Boolean(element && element.style.display === "inline-block" && element.style.width === "33%");
}

/** 0 = left, 1 = centre, 2 = right position of a node inside a header/footer block (0 when not laid out). */
export function headerFooterZone(node: Node, block: Element): number {
  for (let current: Node | null = node; current && current !== block; current = current.parentNode) {
    if (current.parentNode === block && isHeaderFooterZone(current)) return Math.min(2, [...block.childNodes].filter(isHeaderFooterZone).indexOf(current));
  }
  return 0;
}

export function restoreHeaderFooterTabs(editor: HTMLElement) {
  const document = editor.ownerDocument;
  for (const area of editor.querySelectorAll<HTMLElement>(":scope > header, :scope > footer")) {
    if (!(area.textContent ?? "").includes("\t") || [...area.childNodes].some(isHeaderFooterZone)) continue;
    const zones = (["left", "center", "right"] as const).map(align => {
      const zone = document.createElement("span");
      zone.style.display = "inline-block";
      zone.style.width = "33%";
      if (align !== "left") zone.style.textAlign = align;
      return zone;
    });
    let at = 0;
    for (const child of [...area.childNodes]) {
      const element = asElement(child), text = child.textContent ?? "";
      // A field (page number, date) is never split; it stays whole in the position it is in.
      if (!text.includes("\t") || (element && element.hasAttribute("data-field"))) { zones[at].append(child); continue; }
      text.split("\t").forEach((part, index) => {
        if (index > 0) at = Math.min(2, at + 1);
        if (!part) return;
        const piece = element ? element.cloneNode(false) as HTMLElement : document.createElement("span");
        piece.textContent = part;
        zones[at].append(piece);
      });
    }
    area.replaceChildren(...zones);
  }
}
