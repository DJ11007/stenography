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
    for (const zone of zones) keepPositionTypeable(zone);
    ensureHeaderFooterMarkers(area);
  }
}

// ---------- tab stops: the cursor at the start of a position, typing in an empty one, Backspace / Delete ----------

/** The three positions of a header/footer line, or null when it is not laid out in positions. */
export function headerFooterPositions(area: Element): HTMLElement[] | null {
  const zones = [...area.childNodes].filter(isHeaderFooterZone);
  return zones.length === 3 ? zones : null;
}

const hasContent = (zone: HTMLElement) => Boolean((zone.textContent ?? "").replace(/​/g, "") || zone.querySelector("[data-field],[data-placeholder],img"));
const markerOf = (zone: HTMLElement) => zone.querySelector(":scope > [data-hf-tab]");

/**
 * The tab stop before the centre and right positions, drawn as an empty invisible box at the start of the position.
 * Without it the browser treats "the start of the right-hand text" and "the end of the centre text" as the same
 * place, so the cursor could never be put at the start of the right-hand text, Backspace there could not mean
 * "delete the tab", and text typed in an empty position went into the neighbouring one. It holds no text, so
 * it is never part of what is saved (the tabs are written from the positions, see rich-document-editor makeBlock).
 */
function makeMarker(document: Document) {
  const marker = document.createElement("span");
  marker.setAttribute("data-hf-tab", "");
  marker.setAttribute("contenteditable", "false");
  marker.style.cssText = "display:inline-block;width:0;height:1em;vertical-align:baseline";
  return marker;
}

/** Every position after the first starts with its tab marker (and the first never has one). */
export function ensureHeaderFooterMarkers(area: Element) {
  const zones = headerFooterPositions(area);
  if (!zones) return;
  zones.forEach((zone, index) => {
    const marker = markerOf(zone);
    if (index === 0) { marker?.remove(); return; }
    if (marker && zone.firstChild === marker) return;
    marker?.remove();
    zone.prepend(makeMarker(zone.ownerDocument));
  });
}

/**
 * An empty position holds a line break so it has a line (and a height) of its own. The browser removes the
 * break by itself, or typeInPosition does, once something is typed.
 */
export function keepPositionTypeable(zone: HTMLElement) {
  if (!hasContent(zone) && !zone.querySelector("br")) zone.append(zone.ownerDocument.createElement("br"));
}

/** Where the cursor goes in a position: after what it holds, or at the start of an empty one (after its tab marker). */
export function caretInPosition(zone: HTMLElement): Range {
  const range = zone.ownerDocument.createRange();
  if (hasContent(zone)) { range.selectNodeContents(zone); range.collapse(false); return range; }
  keepPositionTypeable(zone);
  range.setStart(zone, markerOf(zone) ? 1 : 0); range.collapse(true);
  return range;
}

const isScaffold = (node: Node) => node.nodeName === "BR" || Boolean(asElement(node)?.hasAttribute("data-hf-tab"));

/**
 * Backspace (or Delete) across a tab stop, as Word does it: the tab is a character, so deleting it pulls the
 * text after it back to the stop before. "A⇥B⇥C" with the cursor at the start of C and Backspace gives "A⇥BC";
 * from the start of B it gives "AB⇥C" (C moves up to the centre stop). The line stays in three positions.
 * Returns the cursor to set, or null when the cursor is not at the edge of a position (nothing to do).
 */
export function mergeHeaderFooterPositions(area: HTMLElement, caret: Range, forward: boolean): Range | null {
  const zones = headerFooterPositions(area);
  if (!zones || !caret.collapsed) return null;
  const index = zones.findIndex((zone) => zone.contains(caret.startContainer));
  if (index < 0 || zones.some((zone) => zone.querySelector("[data-placeholder]"))) return null;
  const probe = area.ownerDocument.createRange();
  probe.selectNodeContents(zones[index]);
  if (forward) probe.setStart(caret.startContainer, caret.startOffset); else probe.setEnd(caret.startContainer, caret.startOffset);
  const edge = probe.cloneContents();
  if ((edge.textContent ?? "").replace(/​/g, "") || edge.querySelector("[data-field],img")) return null; // text is in the way
  const joint = forward ? index + 1 : index; // the position whose tab (the one before it) is deleted
  if (joint < 1 || joint > 2) return null;
  const nodes = zones.map((zone) => [...zone.childNodes].filter((node) => !isScaffold(node)));
  const before = nodes[joint - 1].length;
  const next = [...nodes.slice(0, joint - 1), [...nodes[joint - 1], ...nodes[joint]], ...nodes.slice(joint + 1)];
  while (next.length < 3) next.push([]);
  zones.forEach((zone, i) => { zone.replaceChildren(...next[i]); keepPositionTypeable(zone); });
  ensureHeaderFooterMarkers(area);
  const target = zones[joint - 1], range = area.ownerDocument.createRange();
  if (before > 0) { range.setStart(target, before + (markerOf(target) ? 1 : 0)); range.collapse(true); return range; }
  return caretInPosition(target);
}

/**
 * The empty header/footer position the (collapsed) caret is in, else null. Chrome puts a character typed there
 * into the end of the position before it, so the first character is inserted by hand (typeInPosition).
 */
export function emptyPositionAt(caret: Range): HTMLElement | null {
  if (!caret.collapsed) return null;
  const start = caret.startContainer;
  for (let node: Node | null = asElement(start) ?? start.parentElement; node; node = node.parentNode) {
    if (isHeaderFooterZone(node)) return node.parentElement?.matches("header, footer") && !hasContent(node) ? node : null;
  }
  return null;
}

/** Puts typed text into an empty position (dropping its line break) and returns the cursor after it. */
export function typeInPosition(zone: HTMLElement, text: string): Range {
  for (const lineBreak of [...zone.querySelectorAll("br")]) lineBreak.remove();
  const node = zone.ownerDocument.createTextNode(text);
  zone.append(node);
  const range = zone.ownerDocument.createRange();
  range.setStart(node, node.length);
  range.collapse(true);
  return range;
}
