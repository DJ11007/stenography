export type EditorRunStyles=Partial<Pick<CSSStyleDeclaration,"fontFamily"|"fontSize"|"fontWeight"|"fontStyle"|"color"|"backgroundColor"|"textDecoration"|"textDecorationLine"|"textDecorationStyle"|"textDecorationColor"|"textDecorationThickness"|"verticalAlign"|"fontVariant"|"textTransform"|"opacity"|"letterSpacing"|"display"|"transform"|"transformOrigin"|"position"|"top"|"fontKerning"|"webkitTextStroke"|"textShadow">>;

// A COLLAPSED range (just a cursor, no real selection -- the common case
// for "click into a paragraph, then open the Line Spacing/Paragraph
// dialog") must resolve to exactly the one block the cursor is actually
// in. Range.intersectsNode() is designed for genuine spanning selections
// and is well documented to be ambiguous right at a block boundary --
// browsers can report a collapsed cursor as intersecting BOTH the block
// it's in and its neighbor, which silently applied paragraph-level
// formatting (line spacing, alignment, indent, shading) to an unrelated
// adjacent paragraph the admin never touched. Walking up from the range's
// own container to the block that's a direct child of the editor sidesteps
// that ambiguity entirely -- a collapsed cursor can only ever be inside
// one such block. A real (non-collapsed) selection still uses
// intersectsNode, which is the correct check for "every block this
// selection actually spans".
export function selectedEditorBlocks(editor:HTMLElement,range:Range){
 if(range.collapsed){
  let node:Node|null=range.startContainer;
  while(node&&node.parentNode!==editor)node=node.parentNode;
  // nodeType===1, not `instanceof HTMLElement` -- this file also runs
  // under plain Node.js test environments (happy-dom) where the global
  // `HTMLElement` constructor isn't the same one happy-dom's nodes are
  // instances of.
  return node&&node.nodeType===1?[node as HTMLElement]:[];
 }
 const blocks=[...editor.children].filter((node):node is HTMLElement=>node.nodeType===1&&range.intersectsNode(node))as HTMLElement[];
 // Real reported bug: triple-clicking a paragraph selects it up to offset 0
 // of the NEXT paragraph (a browser selection quirk), so line spacing,
 // indents and every other paragraph-level setting also landed on the
 // paragraph below -- in a real Model Answer, settings meant for one
 // paragraph ended up on its neighbour. A first or last block the range
 // only touches at its edge, with none of its text selected, is not part of
 // the selection (an empty paragraph still counts once the range reaches
 // into it), and at least one block always remains.
 if(blocks.length>1){
  const document=editor.ownerDocument;
  const last=blocks[blocks.length-1];
  const tail=document.createRange();tail.setStart(last,0);tail.setEnd(range.endContainer,range.endOffset);
  if(!tail.toString()&&(tail.collapsed||last.textContent!==""))blocks.pop();
 }
 if(blocks.length>1){
  const document=editor.ownerDocument;
  const first=blocks[0];
  const head=document.createRange();head.setStart(range.startContainer,range.startOffset);head.setEnd(first,first.childNodes.length);
  if(!head.toString()&&(head.collapsed||first.textContent!==""))blocks.shift();
 }
 return blocks;
}

// Real reported bug, reproduced via a genuinely graded Word Efficiency
// attempt: triple-clicking a whole paragraph (the natural way to answer
// "Apply this effect to paragraph N") then applying underline/color/
// Format Painter produced a range whose end boundary sat at the very
// START of the NEXT top-level block (a browser triple-click selection
// commonly ends there, not at the last character of the clicked
// paragraph). range.surroundContents() doesn't reject that as
// out-of-bounds -- it happily swallows the next block (or a boundary-
// adjacent clone of it, sometimes emptied) INSIDE the new wrapper span
// instead of leaving it as a sibling. Confirmed live: an "Apply Underline
// to paragraph 6" answer produced a duplicate, emptied clone of the very
// next list item, nested inside the new span -- invisible on screen, but
// it corrupts the block structure every downstream auto-grading rule
// (and every later question targeting a later paragraph) depends on.
// Clamping the range's end boundary to the end of whichever block-level
// element (p/li/table/figure/hr -- the same tag set makeBlock() itself
// treats as a block) the SELECTION STARTED in keeps surroundContents/
// extractContents operating on a range guaranteed to stay within that one
// block, since every caller of this function only ever means "the one
// block the user selected", never a run spilling into the next one.
const BLOCK_TAGS=new Set(["P","LI","TABLE","FIGURE","HR"]);
function clampRangeToStartBlock(range:Range):Range{
 let node:Node|null=range.startContainer;
 while(node&&!(node.nodeType===1&&BLOCK_TAGS.has((node as Element).tagName)))node=node.parentNode;
 if(!node||(node as Element).contains(range.endContainer))return range;
 const clamped=range.cloneRange();
 clamped.setEnd(node,node.childNodes.length);
 return clamped;
}
export function wrapEditorRange(range:Range,styles:EditorRunStyles,attributes:Record<string,string>={}){if(range.collapsed)return null;const document=range.startContainer.ownerDocument;if(!document)return null;const safeRange=clampRangeToStartBlock(range);const span=document.createElement("span");Object.assign(span.style,styles);for(const[name,value]of Object.entries(attributes))span.dataset[name]=value;try{safeRange.surroundContents(span)}catch{span.append(safeRange.extractContents());safeRange.insertNode(span)}const selected=document.createRange();selected.selectNodeContents(span);return{span,range:selected}}

export function applyParagraphStyle(blocks:HTMLElement[],styles:Partial<Pick<CSSStyleDeclaration,"textAlign"|"marginLeft"|"marginRight"|"lineHeight"|"marginTop"|"marginBottom"|"backgroundColor"|"border">>){for(const block of blocks)Object.assign(block.style,styles);return blocks.length>0}

export function snapshotPaintStyle(style:CSSStyleDeclaration):EditorRunStyles{return{fontWeight:style.fontWeight,fontStyle:style.fontStyle,textDecorationLine:style.textDecorationLine,textDecorationStyle:style.textDecorationStyle,fontFamily:style.fontFamily,fontSize:style.fontSize,color:style.color,backgroundColor:style.backgroundColor,verticalAlign:style.verticalAlign}}

export function replaceEditorRangeText(range:Range,value:string){const document=range.startContainer.ownerDocument;if(!document)return null;range.deleteContents();const node=document.createTextNode(value);range.insertNode(node);const selected=document.createRange();selected.selectNodeContents(node);return selected}

export function changeEditorRangeCase(range:Range,mode:"upper"|"lower"|"title"|"sentence"|"toggle"){const source=range.toString();let value=source;if(mode==="upper")value=source.toLocaleUpperCase();else if(mode==="lower")value=source.toLocaleLowerCase();else if(mode==="title")value=source.replace(/\p{L}[\p{L}\p{M}]*/gu,word=>word[0].toLocaleUpperCase()+word.slice(1).toLocaleLowerCase());else if(mode==="sentence")value=source.toLocaleLowerCase().replace(/(^|[.!?]\s+)(\p{L})/gu,(_,prefix,letter)=>prefix+letter.toLocaleUpperCase());else value=[...source].map(character=>character===character.toLocaleUpperCase()?character.toLocaleLowerCase():character.toLocaleUpperCase()).join("");return replaceEditorRangeTextPreservingRuns(range,source,value)}

// replaceEditorRangeText deletes the WHOLE selection and inserts one bare,
// unstyled text node -- correct for Clear Formatting (which means to strip
// styling), catastrophic for Change Case, which should only ever touch
// letter casing. Reproduced live: a real student applied Bold+Italic+
// Underline to a paragraph (Q1 of a real test), then Capitalize Each Word
// to the same paragraph (Q3) -- clearEditorRangeCase's plain-text-node
// replacement silently wiped out all three, and the final submitted
// document had none of them, confirmed via the admin grading view. Since
// case changes never add or remove characters for the modes this editor
// offers, the fix rewrites each intersected text node'S OWN characters in
// place (same node objects, same parent spans) instead of replacing the
// DOM structure -- formatting is simply never touched. Length-changing
// Unicode case folding (e.g. German ß -> SS under toLocaleUpperCase in
// some locales) is the one case where per-node realignment can't work
// exactly right; that falls back to the prior (formatting-losing but at
// least textually correct) plain replacement rather than risk corrupting
// the text.
function replaceEditorRangeTextPreservingRuns(range:Range,source:string,value:string):Range|null{
 const document=range.startContainer.ownerDocument;
 if(!document)return null;
 if(value.length!==source.length)return replaceEditorRangeText(range,value);
 const root=range.commonAncestorContainer;
 const nodes:Text[]=[];
 // A selection inside a single text node has that text node itself as its
 // common ancestor, and a TreeWalker rooted at a text node never yields
 // anything (it only visits descendants) -- the case change silently did
 // nothing for exactly the most common selection, a phrase inside one run.
 if(root.nodeType===3)nodes.push(root as Text);
 else{const walker=document.createTreeWalker(root,4);for(let node=walker.nextNode();node;node=walker.nextNode())if(range.intersectsNode(node))nodes.push(node as Text)}
 let cursor=0;
 for(const node of nodes){
  const text=node.textContent??"";
  const startInNode=node===range.startContainer?range.startOffset:0;
  const endInNode=node===range.endContainer?range.endOffset:text.length;
  if(startInNode>=endInNode)continue;
  const length=endInNode-startInNode;
  node.textContent=text.slice(0,startInNode)+value.slice(cursor,cursor+length)+text.slice(endInNode);
  cursor+=length;
 }
 const selected=document.createRange();
 selected.setStart(range.startContainer,range.startOffset);
 selected.setEnd(range.endContainer,range.endOffset);
 return selected;
}

export function clearEditorRangeFormatting(range:Range){const value=range.toString(),container=range.commonAncestorContainer,element=(container.nodeType===1?container:container.parentElement)as HTMLElement|null;if(element?.tagName==="SPAN"&&element.textContent===value){const document=element.ownerDocument,node=document.createTextNode(value),selected=document.createRange();element.replaceWith(node);selected.selectNodeContents(node);return selected}return replaceEditorRangeText(range,value)}

export function replaceEditorText(root:HTMLElement,needle:string,replacement:string){if(!needle)return 0;let count=0;const document=root.ownerDocument,walker=document.createTreeWalker(root,4);for(let node=walker.nextNode();node;node=walker.nextNode()){const text=node.textContent??"",parts=text.split(needle);if(parts.length>1){count+=parts.length-1;node.textContent=parts.join(replacement)}}return count}

// A stored CSS length can be in any unit -- most of this app writes "in",
// but some paths (and any pt-native source, like a real .docx import)
// write "pt", and the browser's own getComputedStyle always reports "px".
// A bare Number.parseFloat() on a value like "88.56pt" silently returns
// 88.56 as if it were already inches -- the exact bug already fixed once
// for font size (px taken literally as pt) -- so every place that needs a
// stored length AS INCHES must go through this, never parseFloat directly.
export function parseInches(raw:string|null|undefined):number{const match=(raw??"").trim().match(/^(-?\d+(?:\.\d+)?)\s*(in|pt|px)?$/i);if(!match)return 0;const amount=Number(match[1]),unit=(match[2]??"in").toLowerCase();return unit==="pt"?amount/72:unit==="px"?amount/96:amount}

export function adjustParagraphIndent(blocks:HTMLElement[],direction:-1|1,stepInches=.25){for(const block of blocks){const inches=parseInches(block.style.marginLeft);block.style.marginLeft=`${Math.max(0,inches+direction*stepInches)}in`}return blocks.length>0}

// Real reported bug: selecting a whole bullet/numbered line the normal way
// (triple-click) and clicking Underline in the word-efficiency editor
// (rich-document-editor.tsx's exec, right after document.execCommand) has
// a Chromium execCommand failure mode distinct from the whole-block-split
// case pruneStrayEmptyBlocks already guards -- confirmed live: it unwraps
// the ENTIRE <ul>/<ol>, turning every sibling <li> into a direct child of
// the editor root instead of staying nested, and replaces the actually-
// selected <li> with a bare formatting <span> that has no list-item-ness
// at all. pruneStrayEmptyBlocks can't catch this -- none of the newly-
// orphaned top-level children are empty, they're the list's own real
// content, so its emptiness check waves them through -- and left alone,
// the list silently stops being one block in the saved document; it
// becomes several, which corrupts position-based grading (every block
// after it shifts by however many items the list had). Rewrap any run of
// top-level <li> elements -- promoting a lone non-<li> element sitting in
// the middle of such a run back into an <li> first, covering the demoted-
// span case -- into a single list, reusing a directly adjacent <ul>/<ol>
// if the run sits right next to one so an existing list's type/marker
// style is preserved rather than split into two lists.
export function reattachOrphanedListItems(root:HTMLElement){
 const document=root.ownerDocument;
 const isOrphanedListMember=(element:Element)=>element.tagName==="LI"||(!/^(P|UL|OL|TABLE|HR|FIGURE|SECTION|HEADER|FOOTER)$/.test(element.tagName)&&(element.textContent??"").trim()!=="");
 const promoteToListItem=(element:HTMLElement)=>{const li=document.createElement("li");li.dataset.listStyle="bullet";element.replaceWith(li);li.appendChild(element);return li};
 for(let guard=0;guard<50;guard++){
  const children=[...root.children];
  const liIndex=children.findIndex(child=>child.tagName==="LI");
  if(liIndex===-1)return;
  let start=liIndex,end=liIndex;
  while(start>0&&isOrphanedListMember(children[start-1]))start--;
  while(end<children.length-1&&isOrphanedListMember(children[end+1]))end++;
  const run=children.slice(start,end+1).map(member=>member.tagName==="LI"?member as HTMLElement:promoteToListItem(member as HTMLElement));
  const before=children[start-1]??null,after=run[run.length-1].nextElementSibling;
  const reuse=before&&/^(UL|OL)$/.test(before.tagName)?before as HTMLElement:after&&/^(UL|OL)$/.test(after.tagName)?after as HTMLElement:null;
  const target=reuse??(()=>{const list=document.createElement("ul");list.dataset.listStyle="bullet";root.insertBefore(list,run[0]);return list})();
  const anchor=target===before?null:target.firstChild;
  for(const item of run)target.insertBefore(item,anchor);
 }
}

// Real reported bug (Word Efficiency auto-grading): a student who underlined a
// paragraph with the toolbar's U button and also made it bold/italic got
// underline:false in the saved snapshot, so the automatic check scored Q1 as 0
// while the teacher, seeing the underline on screen, gave full marks.
// document.execCommand("underline") wraps text in a plain <u>, and with bold and
// italic applied the text node's own parent is a <b>/<i> INSIDE that <u>.
// text-decoration is not an inherited CSS property -- it is painted from the
// ancestor -- so getComputedStyle(parent).textDecoration on that inner element is
// "none", and the snapshot builder (which only looked at the immediate parent,
// plus the gallery's data-underline-style span) lost the underline. Same for
// strikethrough via <s>/<strike>. This walks every ancestor up to the block and
// reports whether an underline or strikethrough is painted over the text, by tag
// (u, ins, s, strike, del) or by an inline text-decoration on any ancestor.
export function inheritedTextDecoration(textNode:Node,root:Element):{underline:boolean;strike:boolean;doubleStrike:boolean}{
 let underline=false,strike=false,doubleStrike=false;
 for(let element=textNode.parentElement;element;element=element.parentElement){
  const tag=element.tagName;
  if(tag==="U"||tag==="INS")underline=true;
  if(tag==="S"||tag==="STRIKE"||tag==="DEL")strike=true;
  const style=(element as HTMLElement).style;
  const inline=`${style?.textDecorationLine??""} ${style?.textDecoration??""}`;
  if(inline.includes("underline"))underline=true;
  if(inline.includes("line-through")){strike=true;if(style?.textDecorationStyle==="double"||inline.includes("double"))doubleStrike=true}
  if((element as HTMLElement).dataset?.doubleStrike==="true")doubleStrike=true;
  if(element===root)break;
 }
 return{underline,strike:strike&&!doubleStrike,doubleStrike};
}

// The Underline button is a toggle (like Word): when every character of the selection is already
// underlined the click removes the underline, otherwise it applies one.
export function selectionFullyUnderlined(root: HTMLElement, range: Range): boolean {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let any = false;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!range.intersectsNode(node)) continue;
    const text = node.textContent ?? "";
    const from = node === range.startContainer ? range.startOffset : 0;
    const to = node === range.endContainer ? range.endOffset : text.length;
    if (to <= from || !text.slice(from, to).trim()) continue;
    any = true;
    if (!inheritedTextDecoration(node, root).underline && !node.parentElement?.closest("[data-underline-style]")) return false;
  }
  return any;
}

// Removes every underline (<u> or a styled span) that touches the range. Returns whether anything changed.
export function stripUnderline(root: HTMLElement, range: Range): boolean {
  let touched = false;
  for (const element of Array.from(root.querySelectorAll<HTMLElement>("u,[data-underline-style],[style*='underline']"))) {
    if (!range.intersectsNode(element)) continue;
    if (element.tagName === "U") element.replaceWith(...Array.from(element.childNodes));
    else {
      delete element.dataset.underlineStyle;
      delete element.dataset.underlineColor;
      delete element.dataset.underlineThickness;
      delete element.dataset.underlineWordsOnly;
      element.style.textDecorationLine = element.style.textDecorationLine.replace("underline", "").trim();
      element.style.textDecorationStyle = "";
      element.style.textDecorationColor = "";
      element.style.textDecorationThickness = "";
    }
    touched = true;
  }
  return touched;
}
