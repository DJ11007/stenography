export type EditorRunStyles=Partial<Pick<CSSStyleDeclaration,"fontFamily"|"fontSize"|"fontWeight"|"fontStyle"|"color"|"backgroundColor"|"textDecoration"|"textDecorationLine"|"textDecorationStyle"|"textDecorationColor"|"verticalAlign"|"fontVariant"|"textTransform"|"opacity"|"letterSpacing"|"display"|"transform"|"transformOrigin"|"position"|"top"|"fontKerning"|"webkitTextStroke"|"textShadow">>;

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
 return[...editor.children].filter((node):node is HTMLElement=>node.nodeType===1&&range.intersectsNode(node))as HTMLElement[];
}

export function wrapEditorRange(range:Range,styles:EditorRunStyles,attributes:Record<string,string>={}){if(range.collapsed)return null;const document=range.startContainer.ownerDocument;if(!document)return null;const span=document.createElement("span");Object.assign(span.style,styles);for(const[name,value]of Object.entries(attributes))span.dataset[name]=value;try{range.surroundContents(span)}catch{span.append(range.extractContents());range.insertNode(span)}const selected=document.createRange();selected.selectNodeContents(span);return{span,range:selected}}

export function applyParagraphStyle(blocks:HTMLElement[],styles:Partial<Pick<CSSStyleDeclaration,"textAlign"|"marginLeft"|"marginRight"|"lineHeight"|"marginTop"|"marginBottom"|"backgroundColor"|"border">>){for(const block of blocks)Object.assign(block.style,styles);return blocks.length>0}

export function snapshotPaintStyle(style:CSSStyleDeclaration):EditorRunStyles{return{fontWeight:style.fontWeight,fontStyle:style.fontStyle,textDecorationLine:style.textDecorationLine,textDecorationStyle:style.textDecorationStyle,fontFamily:style.fontFamily,fontSize:style.fontSize,color:style.color,backgroundColor:style.backgroundColor,verticalAlign:style.verticalAlign}}

export function replaceEditorRangeText(range:Range,value:string){const document=range.startContainer.ownerDocument;if(!document)return null;range.deleteContents();const node=document.createTextNode(value);range.insertNode(node);const selected=document.createRange();selected.selectNodeContents(node);return selected}

export function changeEditorRangeCase(range:Range,mode:"upper"|"lower"|"title"|"sentence"|"toggle"){const source=range.toString();let value=source;if(mode==="upper")value=source.toLocaleUpperCase();else if(mode==="lower")value=source.toLocaleLowerCase();else if(mode==="title")value=source.replace(/\p{L}[\p{L}\p{M}]*/gu,word=>word[0].toLocaleUpperCase()+word.slice(1).toLocaleLowerCase());else if(mode==="sentence")value=source.toLocaleLowerCase().replace(/(^|[.!?]\s+)(\p{L})/gu,(_,prefix,letter)=>prefix+letter.toLocaleUpperCase());else value=[...source].map(character=>character===character.toLocaleUpperCase()?character.toLocaleLowerCase():character.toLocaleUpperCase()).join("");return replaceEditorRangeText(range,value)}

export function clearEditorRangeFormatting(range:Range){const value=range.toString(),container=range.commonAncestorContainer,element=(container.nodeType===1?container:container.parentElement)as HTMLElement|null;if(element?.tagName==="SPAN"&&element.textContent===value){const document=element.ownerDocument,node=document.createTextNode(value),selected=document.createRange();element.replaceWith(node);selected.selectNodeContents(node);return selected}return replaceEditorRangeText(range,value)}

export function replaceEditorText(root:HTMLElement,needle:string,replacement:string){if(!needle)return 0;let count=0;const document=root.ownerDocument,walker=document.createTreeWalker(root,4);for(let node=walker.nextNode();node;node=walker.nextNode()){const text=node.textContent??"",parts=text.split(needle);if(parts.length>1){count+=parts.length-1;node.textContent=parts.join(replacement)}}return count}

export function adjustParagraphIndent(blocks:HTMLElement[],direction:-1|1,stepInches=.25){for(const block of blocks){const raw=block.style.marginLeft.trim(),match=raw.match(/^(-?\d+(?:\.\d+)?)\s*(in|pt|px)?$/i);let inches=0;if(match){const amount=Number(match[1]),unit=(match[2]??"in").toLowerCase();inches=unit==="pt"?amount/72:unit==="px"?amount/96:amount}block.style.marginLeft=`${Math.max(0,inches+direction*stepInches)}in`}return blocks.length>0}
