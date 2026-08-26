"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import {
  WORD_EDITOR_RIBBON,
  WORD_THEME_FONTS,
  type HierarchicalEditorCapabilities,
  type RibbonOption,
  type WordEditorTab,
} from "@/lib/word-editor-capabilities";

type Props = {
  capabilities: HierarchicalEditorCapabilities;
  activeTab: WordEditorTab;
  onTabChange: (tab: WordEditorTab) => void;
  preview?: boolean;
  activeOption?: (id: string) => boolean;
  onCommand?: (id: string) => void;
  onFontChange?: (font: string) => void;
  onFontSizeChange?: (size: number) => void;
  onColorChange?: (id: string, color: string) => void;
  onUnderlineChange?: (style: string, color?: string) => void;
  onValueCommand?: (id: string, value: string) => void;
  currentFontFamily?: string;
};

const CLEAR_FORMAT_DEPENDENCIES = ["fontName", "fontSize", "bold", "italic", "underline", "strikeThrough", "subscript", "superscript", "textEffects", "highlightColor", "fontColor"] as const;
const CLEAR_FORMAT_OPTION: RibbonOption = { id: "clearCharacterFormatting", label: "Clear all formatting", icon: "eraser", kind: "button" };
const MESSAGE_BAR_OPTION: RibbonOption = { id: "messageBar", label: "Message Bar", icon: "message", kind: "button", unsupported: "Message Bar is unavailable because this editor has no safe document-message source." };
const THUMBNAILS_OPTION: RibbonOption = { id: "thumbnails", label: "Thumbnails", icon: "thumbnails", kind: "button" };
const ZOOM_OPTION: RibbonOption = { id: "zoom", label: "Zoom", icon: "zoom", kind: "button" };
const PAGE_WIDTH_OPTION: RibbonOption = { id: "pageWidth", label: "Page Width", icon: "pageWidth", kind: "button" };

export function WordEditorRibbon({ capabilities, activeTab, onTabChange, preview = false, activeOption, onCommand, onFontChange, onFontSizeChange, onColorChange, onUnderlineChange, onValueCommand, currentFontFamily }: Props) {
  const visibleTabs = WORD_EDITOR_RIBBON.filter(tab => capabilities.tabs[tab.id].enabled);
  const selectedTab = visibleTabs.some(tab => tab.id === activeTab) ? activeTab : visibleTabs[0]?.id;
  const definition = WORD_EDITOR_RIBBON.find(tab => tab.id === selectedTab);
  const groups = definition?.groups.map(group => {
    const configured = capabilities.tabs[definition.id].groups[group.id];
    const options = group.options.filter(option => configured.options[option.id]);
    if (definition.id === "Home" && group.id === "font" && CLEAR_FORMAT_DEPENDENCIES.every(id => configured.options[id])) options.splice(5, 0, CLEAR_FORMAT_OPTION);
    return { ...group, options: definition.id === "View" ? expandViewOptions(group.id, options) : options };
  }).filter(group => capabilities.tabs[definition.id].groups[group.id].enabled && group.options.length > 0) ?? [];

  return <div className="word-office-ribbon" data-preview={preview || undefined}>
    <div role="tablist" aria-label={preview ? "Capability preview tabs" : "Document editor ribbon"} className="word-ribbon-tabs">
      {visibleTabs.map(tab => <button key={tab.id} type="button" role="tab" data-tab-id={tab.id} aria-selected={selectedTab === tab.id} aria-controls={`ribbon-${tab.id.replaceAll(" ", "-")}`} onClick={() => onTabChange(tab.id)} onKeyDown={event => navigateTabs(event, tab.id, visibleTabs.map(item => item.id), onTabChange)}>{tab.id.toUpperCase()}</button>)}
    </div>
    <div id={`ribbon-${String(selectedTab).replaceAll(" ", "-")}`} role="tabpanel" aria-label={`${selectedTab} tools`} className="word-ribbon-panel">
      <div className="word-ribbon-groups">
        {groups.map(group => <section key={group.id} data-ribbon-group={group.id} className="word-ribbon-group">
          <div className="word-ribbon-options">
            {group.options.map(option => <div key={option.id} data-ribbon-option={option.id} className="word-ribbon-option-slot"><RibbonControl option={option} capabilities={capabilities} preview={preview} active={activeOption?.(option.id) ?? false} onCommand={onCommand} onFontChange={onFontChange} onFontSizeChange={onFontSizeChange} onColorChange={onColorChange} onUnderlineChange={onUnderlineChange} onValueCommand={onValueCommand} currentFontFamily={currentFontFamily}/></div>) }
          </div>
          <span className="word-ribbon-group-name">{group.label}</span>
        </section>)}
      </div>
    </div>
  </div>;
}

function RibbonControl({ option, capabilities, preview, active, onCommand, onFontChange, onFontSizeChange, onColorChange,onUnderlineChange,onValueCommand,currentFontFamily }: { option: RibbonOption; capabilities: HierarchicalEditorCapabilities; preview: boolean; active: boolean; onCommand?: (id: string) => void; onFontChange?: (font: string) => void; onFontSizeChange?: (size: number) => void; onColorChange?: (id: string, color: string) => void;onUnderlineChange?:(style:string,color?:string)=>void;onValueCommand?:(id:string,value:string)=>void;currentFontFamily?:string }) {
  const[swatch,setSwatch]=useState(()=>defaultSwatch(option.id));
  if (option.id === "fontName") return <FontGallery fonts={capabilities.fonts} preview={preview} onChange={onFontChange} currentFontFamily={currentFontFamily}/>;
  if (option.id === "fontSize") return <label data-ribbon-option={option.id} className="word-ribbon-select word-ribbon-size"><span className="sr-only">{option.label}</span><select aria-label={option.label} disabled={preview} defaultValue="11" onChange={event => {const size=Number(event.target.value);if(!preview)window.dispatchEvent(new CustomEvent("word-editor-font-size",{detail:size}));else onFontSizeChange?.(size)}}>{[8,9,10,11,12,14,16,18,20,24,28,32,36,48,72].filter(size => size >= capabilities.fontSizeMin && size <= capabilities.fontSizeMax).map(size => <option key={size}>{size}</option>)}</select></label>;
  if (["highlightColor", "fontColor", "shading"].includes(option.id)) return <ColorSplitButton option={option} preview={preview} swatch={swatch} setSwatch={setSwatch} onChange={onColorChange}/>;
  if (option.id === "pageColor") return <label data-ribbon-option={option.id} className="word-ribbon-tool word-ribbon-color" title={option.label} aria-disabled={preview}><span className="word-ribbon-color-icon"><RibbonIcon id={option.id}/><span className="word-ribbon-color-bar" style={{background:swatch}} aria-hidden/></span><span>{option.label}</span><input aria-label={option.label} disabled={preview} type="color" onChange={event => { setSwatch(event.target.value); onColorChange?.(option.id, event.target.value); }}/></label>;
  if(option.id==="underline")return <UnderlineSplitButton preview={preview} active={active} onChange={onUnderlineChange}/>;
  if(option.id==="changeCase")return <GalleryMenu option={option} preview={preview} items={CASE_ITEMS} onPick={value=>onValueCommand?.("changeCase",value)}/>;
  if(option.id==="bullets")return <GalleryMenu option={option} preview={preview} items={BULLET_ITEMS} onPick={value=>onValueCommand?.("bullets",value)}/>;
  if(option.id==="numbering")return <GalleryMenu option={option} preview={preview} items={NUMBER_ITEMS} onPick={value=>onValueCommand?.("numbering",value)}/>;
  if(option.id==="multilevelList")return <GalleryMenu option={option} preview={preview} items={MULTILEVEL_ITEMS} onPick={value=>onValueCommand?.("multilevelList",value)}/>;
  if(option.id==="lineSpacing")return <GalleryMenu option={option} preview={preview} items={SPACING_ITEMS} onPick={value=>onValueCommand?.("lineSpacing",value)} actions={SPACING_ACTIONS} onAction={id=>onValueCommand?.("lineSpacingAction",id)}/>;
  if(option.id==="borders")return <GalleryMenu option={option} preview={preview} items={BORDER_ITEMS} onPick={value=>onValueCommand?.("borders",value)}/>;
  const disabled = preview || Boolean(option.unsupported);
  return <button type="button" className="word-ribbon-tool" aria-label={option.label} aria-description={option.unsupported} aria-haspopup={option.menu ? "menu" : undefined} aria-pressed={active || undefined} disabled={disabled} title={option.unsupported ?? option.label} onMouseDown={event => { if (!disabled) event.preventDefault(); }} onClick={() => onCommand?.(option.id === "zoom" ? "zoom100" : option.id)}><RibbonIcon id={option.id}/><span>{option.label}{option.menu && <i aria-hidden>▾</i>}</span></button>;
}
const RECENT_FONTS_KEY="word-efficiency-recent-fonts";
function FontGallery({fonts,preview,onChange,currentFontFamily}:{fonts:string[];preview:boolean;onChange?:(font:string)=>void;currentFontFamily?:string}){
  const[open,setOpen]=useState(false),[query,setQuery]=useState(""),[selected,setSelected]=useState(currentFontFamily||"Calibri (Body)"),[recent,setRecent]=useState<string[]>([]),[position,setPosition]=useState<CSSProperties>({});
  const buttonRef=useRef<HTMLButtonElement>(null);
  useEffect(()=>{if(currentFontFamily&&currentFontFamily!==selected&&!open)setSelected(currentFontFamily)},[currentFontFamily]);
  useLayoutEffect(()=>{if(!open)return;const rect=buttonRef.current?.getBoundingClientRect();if(rect)setPosition({position:"fixed",left:Math.max(4,Math.min(rect.left,window.innerWidth-290)),top:rect.bottom+2,right:"auto",bottom:"auto"})},[open]);
  useEffect(()=>{try{const value=JSON.parse(localStorage.getItem(RECENT_FONTS_KEY)??"[]");if(Array.isArray(value))setRecent(value.filter((font):font is string=>typeof font==="string"&&fonts.includes(font)).slice(0,8))}catch{}},[fonts]);
  const choose=(font:string)=>{if(preview||!fonts.includes(font))return;setSelected(font);setOpen(false);setQuery("");const next=[font,...recent.filter(item=>item!==font)].slice(0,8);setRecent(next);try{localStorage.setItem(RECENT_FONTS_KEY,JSON.stringify(next))}catch{}onChange?.(font)};
  const filter=(items:readonly string[])=>items.filter(font=>fonts.includes(font)&&font.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const theme=filter(WORD_THEME_FONTS),recentFonts=filter(recent),all=filter(fonts.filter(font=>!WORD_THEME_FONTS.includes(font as typeof WORD_THEME_FONTS[number])));
  const gallery=open&&typeof document!=="undefined"?createPortal(<div className="word-font-gallery" role="listbox" aria-label="Font family" style={position}><input autoFocus aria-label="Search fonts" placeholder="Search fonts" value={query} onChange={event=>setQuery(event.target.value)} onMouseDown={event=>event.stopPropagation()}/><FontSection title="Theme Fonts" fonts={theme} choose={choose}/><FontSection title="Recently Used Fonts" fonts={recentFonts} choose={choose}/><FontSection title="All Fonts" fonts={all} choose={choose}/>{!theme.length&&!recentFonts.length&&!all.length&&<p>No approved fonts found.</p>}</div>,document.body):null;
  return <div data-ribbon-option="fontName" className="word-font-picker"><button ref={buttonRef} type="button" aria-label="Font family" aria-haspopup="listbox" aria-expanded={open} disabled={preview} onMouseDown={event=>event.preventDefault()} onClick={()=>setOpen(value=>!value)}><span style={{fontFamily:fontCssName(selected)}}>{selected}</span><i aria-hidden>▾</i></button>{gallery}</div>
}
function FontSection({title,fonts,choose}:{title:string;fonts:readonly string[];choose:(font:string)=>void}){if(!fonts.length)return null;return <section><h3>{title}</h3>{fonts.map(font=><button role="option" type="button" key={font} style={{fontFamily:fontCssName(font)}} onMouseDown={event=>event.preventDefault()} onClick={()=>choose(font)}><span>{font.replace(/ \((?:Headings|Body)\)$/u,"")}</span>{font.endsWith("(Headings)")&&<small>(Headings)</small>}{font.endsWith("(Body)")&&<small>(Body)</small>}</button>)}</section>}
function fontCssName(font:string){return font.replace(/ \((?:Headings|Body)\)$/u,"")}
const SAFE_COLORS=["#000000","#7f7f7f","#a6a6a6","#d9d9d9","#ffffff","#c00000","#ff0000","#ffc000","#ffff00","#92d050","#00b050","#00b0f0","#0070c0","#002060","#7030a0","#fff2cc","#f4cccc","#d9ead3","#cfe2f3","#d9d2e9","#ed7d31","#70ad47","#4472c4","#a9d18e","#9dc3e6","#f9cb9c"];
const CLEAR_LABEL:Record<string,string>={fontColor:"Automatic",highlightColor:"No Color",shading:"No Fill"};
function ColorSplitButton({option,preview,swatch,setSwatch,onChange}:{option:RibbonOption;preview:boolean;swatch:string;setSwatch:(color:string)=>void;onChange?:Props["onColorChange"]}){
  const[open,setOpen]=useState(false),[position,setPosition]=useState<CSSProperties>({});
  const arrowRef=useRef<HTMLButtonElement>(null);
  useLayoutEffect(()=>{if(!open)return;const rect=arrowRef.current?.getBoundingClientRect();if(rect)setPosition({position:"fixed",left:Math.max(4,Math.min(rect.left-134,window.innerWidth-158)),top:rect.bottom+2,right:"auto",bottom:"auto"})},[open]);
  const apply=(color=swatch)=>{if(!preview)onChange?.(option.id,color)};
  const clearLabel=CLEAR_LABEL[option.id]??"No Color";
  const palette=open&&typeof document!=="undefined"?createPortal(<div role="menu" aria-label={`${option.label} colors`} className="word-color-palette" style={{...position,gridTemplateColumns:"repeat(5,20px)",width:"auto"}}>{SAFE_COLORS.map(color=><button role="menuitem" type="button" key={color} aria-label={`${option.label} ${color}`} style={{backgroundColor:color}} onMouseDown={event=>event.preventDefault()} onClick={()=>{setSwatch(color);apply(color);setOpen(false)}}/>)}<button role="menuitem" type="button" onMouseDown={event=>event.preventDefault()} onClick={()=>{apply(option.id==="fontColor"?"automatic":"transparent");setOpen(false)}} style={{gridColumn:"1 / -1",marginTop:4,padding:"4px 2px",fontSize:10,fontWeight:700,background:"#fff",border:"1px solid #999",borderRadius:2}}>{clearLabel}</button></div>,document.body):null;
  return <div data-ribbon-option={option.id} className="word-color-split"><button type="button" className="word-color-apply" aria-label={`Apply ${option.label}`} disabled={preview} title={option.label} onMouseDown={event=>event.preventDefault()} onClick={()=>apply()}><RibbonIcon id={option.id}/><span className="word-ribbon-color-bar" style={{background:swatch}} aria-hidden/></button><button ref={arrowRef} type="button" className="word-color-arrow" aria-label={`Open ${option.label} palette`} aria-haspopup="menu" aria-expanded={open} disabled={preview} onMouseDown={event=>event.preventDefault()} onClick={()=>setOpen(value=>!value)}>▾</button>{palette}</div>}
const UNDERLINE_STYLES=["single","double","thick","dotted","dashed","dot-dash","dot-dot-dash","wavy"] as const;
const UNDERLINE_COLORS=["#000000","#c00000","#ed7d31","#ffc000","#70ad47","#5b9bd5","#4472c4","#7030a0"];
function UnderlineSplitButton({preview,active,onChange}:{preview:boolean;active:boolean;onChange?:(style:string,color?:string)=>void}){
  const[open,setOpen]=useState(false),[moreOpen,setMoreOpen]=useState(false),[colorOpen,setColorOpen]=useState(false),[lastStyle,setLastStyle]=useState("single"),[thickness,setThickness]=useState("3"),[wordsOnly,setWordsOnly]=useState(false),[position,setPosition]=useState<CSSProperties>({});
  const arrowRef=useRef<HTMLButtonElement>(null),menuRef=useRef<HTMLDivElement>(null);
  useLayoutEffect(()=>{if(!open)return;const rect=arrowRef.current?.getBoundingClientRect();if(rect)setPosition({position:"fixed",left:Math.max(4,Math.min(rect.left-24,window.innerWidth-184)),top:rect.bottom+2});requestAnimationFrame(()=>menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus())},[open]);
  const close=()=>{setOpen(false);setMoreOpen(false);setColorOpen(false);arrowRef.current?.focus()};
  const applyStyle=(style:string)=>{if(!preview){setLastStyle(style==="none"?lastStyle:style);onChange?.(style)}close()};
  const move=(event:KeyboardEvent<HTMLDivElement>)=>{const items=[...event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])')],index=items.indexOf(document.activeElement as HTMLElement);if(event.key==="Escape"){event.preventDefault();close()}else if(["ArrowDown","ArrowRight"].includes(event.key)){event.preventDefault();items[(index+1+items.length)%items.length]?.focus()}else if(["ArrowUp","ArrowLeft"].includes(event.key)){event.preventDefault();items[(index-1+items.length)%items.length]?.focus()}else if(event.key==="Home"){event.preventDefault();items[0]?.focus()}else if(event.key==="End"){event.preventDefault();items.at(-1)?.focus()}};
  const gallery=open&&typeof document!=="undefined"?createPortal(<div ref={menuRef} role="menu" aria-label="Underline gallery" className="word-underline-gallery" style={position} onKeyDown={move}>
    {UNDERLINE_STYLES.map(style=><button role="menuitem" type="button" key={style} className="word-underline-sample" data-underline-sample={style} aria-label={`${underlineLabel(style)} underline`} title={`${underlineLabel(style)} underline`} onMouseDown={event=>event.preventDefault()} onClick={()=>applyStyle(style)}><span aria-hidden/></button>)}
    <button role="menuitem" type="button" className="word-underline-text-command" onMouseDown={event=>event.preventDefault()} onClick={()=>applyStyle("none")}>None</button>
    <button role="menuitem" type="button" className="word-underline-text-command" aria-haspopup="dialog" aria-expanded={moreOpen} onMouseDown={event=>event.preventDefault()} onClick={()=>{setMoreOpen(value=>!value);setColorOpen(false)}}>More Underlines…</button>
    {moreOpen&&<div role="dialog" aria-label="More underline settings" className="word-underline-more" onMouseDown={event=>event.preventDefault()}><fieldset><legend>Underline style</legend>{[...UNDERLINE_STYLES,"words-only"].map(style=><button type="button" key={style} aria-pressed={lastStyle===style} onClick={()=>setLastStyle(style)}><span data-underline-sample={style} aria-hidden/><span className="sr-only">{underlineLabel(style)}</span></button>)}</fieldset><label>Thickness <input aria-label="Underline thickness" type="number" min="1" max="5" value={thickness} onChange={event=>setThickness(event.target.value)}/></label><label><input type="checkbox" checked={wordsOnly} onChange={event=>setWordsOnly(event.target.checked)}/> Words only</label><button type="button" onClick={()=>{onChange?.(lastStyle);onChange?.("thickness",thickness);onChange?.("words-only",String(wordsOnly));close()}}>Apply</button></div>}
    <button role="menuitem" type="button" className="word-underline-text-command word-underline-color-command" aria-haspopup="menu" aria-expanded={colorOpen} onMouseDown={event=>event.preventDefault()} onClick={()=>{setColorOpen(value=>!value);setMoreOpen(false)}}><span aria-hidden>▱</span>Underline Color <i aria-hidden>›</i></button>
    {colorOpen&&<div role="menu" aria-label="Underline colors" className="word-underline-colors">{UNDERLINE_COLORS.map(color=><button role="menuitem" type="button" key={color} aria-label={`Underline color ${color}`} title={color} style={{backgroundColor:color}} onMouseDown={event=>event.preventDefault()} onClick={()=>{onChange?.("color",color);close()}}/>)}</div>}
  </div>,document.body):null;
  return <div className="word-underline-split"><button type="button" className="word-ribbon-tool word-underline-apply" aria-label={`Apply ${underlineLabel(lastStyle)} underline`} aria-pressed={active||undefined} disabled={preview} title={`Apply ${underlineLabel(lastStyle)} underline`} onMouseDown={event=>event.preventDefault()} onClick={()=>{if(!preview)onChange?.(lastStyle)}}><RibbonIcon id="underline"/></button><button ref={arrowRef} type="button" className="word-ribbon-tool word-underline-arrow" aria-label="Open underline gallery" aria-haspopup="menu" aria-expanded={open} disabled={preview} title="Underline styles" onMouseDown={event=>event.preventDefault()} onClick={()=>setOpen(value=>!value)}>▾</button>{gallery}</div>;
}
function expandViewOptions(groupId:string,options:RibbonOption[]){if(groupId==="show"){const expanded:RibbonOption[]=[];for(const item of options){expanded.push(item);if(item.id==="gridlines")expanded.push(MESSAGE_BAR_OPTION);if(item.id==="documentMap")expanded.push(THUMBNAILS_OPTION)}return expanded}if(groupId==="zoom"){const expanded:RibbonOption[]=[];for(const item of options){if(item.id==="zoom100")expanded.push(ZOOM_OPTION);expanded.push(item);if(item.id==="twoPages")expanded.push(PAGE_WIDTH_OPTION)}return expanded}return options}
function underlineLabel(style:string){return({none:"None",single:"Single",double:"Double",thick:"Thick",dotted:"Dotted",dashed:"Dashed","dot-dash":"Dot-dash","dot-dot-dash":"Dot-dot-dash",wavy:"Wavy","words-only":"Words only"}as Record<string,string>)[style]??style}
function defaultSwatch(id:string){return({fontColor:"#c00000",highlightColor:"#ffff00",pageColor:"#ffffff",shading:"#ffff00"}as Record<string,string>)[id]??"#000000"}
const CASE_ITEMS=[{value:"sentence",label:"Sentence case."},{value:"lower",label:"lowercase"},{value:"upper",label:"UPPERCASE"},{value:"title",label:"Capitalize Each Word"},{value:"toggle",label:"tOGGLE cASE"}];
const BULLET_ITEMS=[{value:"none",label:"None",swatch:""},{value:"bullet-disc",label:"Filled round bullets",swatch:"•"},{value:"bullet-circle",label:"Hollow round bullets",swatch:"○"},{value:"bullet-square",label:"Filled square bullets",swatch:"■"},{value:"bullet-diamond",label:"Diamond bullets",swatch:"◆"},{value:"bullet-arrow",label:"Arrow bullets",swatch:"➤"},{value:"bullet-check",label:"Checkmark bullets",swatch:"✓"}];
const NUMBER_ITEMS=[{value:"none",label:"None",swatch:""},{value:"decimal",label:"1.  2.  3.",swatch:"1."},{value:"decimal-paren",label:"1)  2)  3)",swatch:"1)"},{value:"upper-roman",label:"I.  II.  III.",swatch:"I."},{value:"upper-alpha",label:"A.  B.  C.",swatch:"A."},{value:"lower-alpha-paren",label:"a)  b)  c)",swatch:"a)"},{value:"lower-alpha",label:"a.  b.  c.",swatch:"a."},{value:"lower-roman",label:"i.  ii.  iii.",swatch:"i."}];
const MULTILEVEL_ITEMS=NUMBER_ITEMS;
const GALLERY_NOTES:Record<string,string>={multilevelList:"This editor supports one numbering level per list, not nested outline levels."};
const SPACING_ITEMS=[{value:"1",label:"1.0"},{value:"1.15",label:"1.15"},{value:"1.5",label:"1.5"},{value:"2",label:"2.0"},{value:"2.5",label:"2.5"},{value:"3",label:"3.0"}];
const SPACING_ACTIONS=[{id:"options",label:"Line Spacing Options…"},{id:"add-space-before",label:"Add Space Before Paragraph"},{id:"remove-space-after",label:"Remove Space After Paragraph"}];
const BORDER_ITEMS=[{value:"none",label:"No Border"},{value:"box",label:"All Borders (Box)"}];
function GalleryMenu({option,preview,items,onPick,actions,onAction}:{option:RibbonOption;preview:boolean;items:{value:string;label:string;swatch?:string}[];onPick:(value:string)=>void;actions?:{id:string;label:string}[];onAction?:(id:string)=>void}){
  const[open,setOpen]=useState(false),[position,setPosition]=useState<CSSProperties>({});
  const buttonRef=useRef<HTMLButtonElement>(null);
  useLayoutEffect(()=>{if(!open)return;const rect=buttonRef.current?.getBoundingClientRect();if(rect)setPosition({position:"fixed",left:Math.max(4,Math.min(rect.left,window.innerWidth-204)),top:rect.bottom+2,right:"auto",bottom:"auto"})},[open]);
  const note=GALLERY_NOTES[option.id];
  const menu=open&&typeof document!=="undefined"?createPortal(<div role="menu" aria-label={option.label} className="word-gallery-menu" style={position}>{items.map(item=><button role="menuitem" type="button" key={item.value} data-list-preview={item.swatch!==undefined?"":undefined} onMouseDown={event=>event.preventDefault()} onClick={()=>{onPick(item.value);setOpen(false)}}>{item.swatch!==undefined&&<span className="word-gallery-swatch" aria-hidden>{item.swatch}</span>}<span>{item.label}</span></button>)}{note&&<p className="word-gallery-note">{note}</p>}{actions&&actions.length>0&&<><hr className="word-gallery-divider"/>{actions.map(action=><button role="menuitem" type="button" key={action.id} onMouseDown={event=>event.preventDefault()} onClick={()=>{onAction?.(action.id);setOpen(false)}}>{action.label}</button>)}</>}</div>,document.body):null;
  return <div data-ribbon-option={option.id}>
    <button ref={buttonRef} type="button" className="word-ribbon-tool" aria-label={option.label} aria-haspopup="menu" aria-expanded={open} disabled={preview} onMouseDown={event=>event.preventDefault()} onClick={()=>setOpen(value=>!value)}><RibbonIcon id={option.id}/><span>{option.label}<i aria-hidden>▾</i></span></button>
    {menu}
  </div>;
}

function RibbonIcon({ id }: { id: string }) {
  const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.55, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if(id==="highlightColor")return <svg viewBox="0 0 24 24" aria-hidden {...stroke}><path d="m5 15 9-9 4 4-9 9H5z" fill="#fff"/><path d="m13 7 4 4M3 21h13" stroke="#d0b800" strokeWidth="2.5"/></svg>;
  if(id==="fontColor")return <svg viewBox="0 0 24 24" aria-hidden><text x="12" y="17" textAnchor="middle" fontFamily="Segoe UI,Arial" fontSize="18" fontWeight="600">A</text><path d="M4 21h16" stroke="#c00000" strokeWidth="3"/></svg>;
  if (["increaseFontSize","decreaseFontSize"].includes(id)) return <svg viewBox="0 0 24 24" aria-hidden><text x="4" y="18" fontFamily="Segoe UI,Arial" fontSize="16" fontWeight="600">A</text><path d={id==="increaseFontSize"?"m15 10 3-3 3 3M18 7v9":"m15 13 3 3 3-3M18 7v9"} {...stroke}/></svg>;
  if (id === "changeCase") return <svg viewBox="0 0 24 24" aria-hidden><text x="2" y="17" fontFamily="Segoe UI,Arial" fontSize="15" fontWeight="600">Aa</text><path d="m18 8 2 2 2-2" {...stroke}/></svg>;
  if (id === "clearCharacterFormatting") return <svg viewBox="0 0 24 24" aria-hidden {...stroke}><path d="M4 19 10 4h2l4 11M6 14h8"/><path d="m13 18 5-5 3 3-5 5h-3z" fill="#f3a0b2"/></svg>;
  if (["decreaseIndent","increaseIndent"].includes(id)) return <svg viewBox="0 0 24 24" aria-hidden {...stroke}><path d="M10 6h10M10 10h10M4 14h16M4 18h16"/><path d={id==="decreaseIndent"?"m8 7-4 3 4 3":"m4 7 4 3-4 3"}/></svg>;
  if (id === "sort") return <svg viewBox="0 0 24 24" aria-hidden {...stroke}><text x="3" y="10" fontFamily="Segoe UI,Arial" fontSize="8">A</text><text x="3" y="20" fontFamily="Segoe UI,Arial" fontSize="8">Z</text><path d="M14 5v14m-3-3 3 3 3-3"/></svg>;
  if (id === "formattingMarks") return <svg viewBox="0 0 24 24" aria-hidden><text x="12" y="18" textAnchor="middle" fontFamily="Georgia,serif" fontSize="19" fill="currentColor">¶</text></svg>;
  if (id === "shading") return <svg viewBox="0 0 24 24" aria-hidden {...stroke}><path d="m7 5 8 8-5 5-8-8zM6 4l2-2 2 2"/><path d="M13 19h8"/><path d="M18 12c0 2 3 3 3 0 0-1-1-2-1.5-3-.5 1-1.5 2-1.5 3Z" fill="#d9e8f5"/></svg>;
  if (id === "borders") return <svg viewBox="0 0 24 24" aria-hidden {...stroke}><rect x="4" y="4" width="15" height="15"/><path d="M9 4v15M14 4v15M4 9h15M4 14h15" strokeDasharray="1.5 1.5"/></svg>;
  if (id === "find") return <svg viewBox="0 0 24 24" aria-hidden {...stroke}><circle cx="8" cy="9" r="3"/><circle cx="16" cy="9" r="3"/><path d="M5 12 3 20h4l1-5 1 5h6l1-5 1 5h4l-2-8M11 6h2M10 12h4"/></svg>;
  if (id === "replace") return <svg viewBox="0 0 24 24" aria-hidden><text x="2" y="9" fontFamily="Segoe UI,Arial" fontSize="7" fill="currentColor">ab</text><text x="13" y="20" fontFamily="Segoe UI,Arial" fontSize="7" fill="currentColor">ac</text><path d="M9 7h9l-2-2m2 2-2 2M15 17H6l2-2m-2 2 2 2" {...stroke}/></svg>;
  if (id === "selectAll") return <svg viewBox="0 0 24 24" aria-hidden {...stroke}><path d="m5 3 12 10-6 1 4 6-3 1-4-6-3 4z" fill="white"/></svg>;
  if (["coverPage","blankPage","pageBreak"].includes(id)) return <svg viewBox="0 0 24 24" aria-hidden {...stroke}><path d="M6 2h10l4 4v16H6z" fill="white"/><path d="M16 2v5h4"/>{id==="coverPage"?<><path d="M9 10h8M9 13h8M9 17h5"/><rect x="8" y="8" width="10" height="10" opacity=".18" fill="#4d84b8"/></>:id==="pageBreak"?<><path d="M8 10h10M8 15h10"/><path d="m12 12 2 2 2-2"/></>:<path d="M9 9h8M9 13h8M9 17h6"/>}</svg>;
  if (id === "insertTable") return <svg viewBox="0 0 32 32" aria-hidden {...stroke}><rect x="3" y="4" width="26" height="24" fill="white"/><path d="M3 10h26M3 16h26M3 22h26M10 4v24M17 4v24M24 4v24"/></svg>;
  if (["insertPicture","onlinePictures"].includes(id)) return <svg viewBox="0 0 32 32" aria-hidden {...stroke}><rect x="3" y="5" width="25" height="22" fill="white"/><circle cx="11" cy="12" r="3" fill="#f0c767"/><path d="m5 24 8-8 5 5 3-3 6 6" fill="#cfe3f4"/>{id==="onlinePictures"&&<><circle cx="24" cy="8" r="6" fill="white"/><path d="M18 8h12M24 2c-3 3-3 9 0 12M24 2c3 3 3 9 0 12"/></>}</svg>;
  if (id === "hyperlink") return <svg viewBox="0 0 24 24" aria-hidden {...stroke}><path d="m9 15-2 2a4 4 0 0 1-6-6l3-3a4 4 0 0 1 6 0m5 1 2-2a4 4 0 0 1 6 6l-3 3a4 4 0 0 1-6 0M8 12h8"/></svg>;
  if (id === "crossReference") return <svg viewBox="0 0 24 24" aria-hidden {...stroke}><rect x="4" y="3" width="12" height="16" fill="white"/><path d="M7 7h6M7 11h6M7 15h4M14 14h7m-3-3 3 3-3 3"/></svg>;
  if (["header","footer","pageNumber"].includes(id)) return <svg viewBox="0 0 32 32" aria-hidden {...stroke}><path d="M7 3h15l4 4v22H7z" fill="white"/><path d="M22 3v5h4"/>{id==="header"?<path d="M10 9h13M11 12h11"/>:id==="footer"?<path d="M10 24h13M11 21h11"/>:<><text x="13" y="21" fontFamily="Segoe UI,Arial" fontSize="12" fill="currentColor">#</text><path d="M10 9h13"/></>}</svg>;
  if (id === "dropCap") return <svg viewBox="0 0 32 32" aria-hidden><text x="3" y="25" fontFamily="Georgia,serif" fontSize="25" fill="currentColor">A</text><path d="M20 8h10M20 12h10M20 16h10M20 20h10M20 24h10" {...stroke}/></svg>;
  if (id === "dateTime") return <svg viewBox="0 0 24 24" aria-hidden {...stroke}><rect x="3" y="5" width="18" height="16" rx="1" fill="white"/><path d="M3 10h18M8 3v4M16 3v4"/><circle cx="14" cy="15" r="4" fill="white"/><path d="M14 13v3l2 1"/></svg>;
  if (id === "symbol") return <svg viewBox="0 0 32 32" aria-hidden><text x="16" y="24" textAnchor="middle" fontFamily="Georgia,serif" fontSize="25" fill="currentColor">Ω</text></svg>;
  if (id === "watermark") return <svg viewBox="0 0 32 32" aria-hidden {...stroke}><path d="M7 2h14l5 5v23H7z" fill="white"/><path d="M21 2v6h5"/><path d="m10 21 11-11" stroke="#c98787" strokeWidth="2.2"/><text x="9" y="23" fontFamily="Segoe UI,Arial" fontSize="7" fill="#b87575" transform="rotate(-43 9 23)">A</text></svg>;
  if (id === "pageColor") return <svg viewBox="0 0 32 32" aria-hidden {...stroke}><path d="M8 3h14l5 5v21H8z" fill="white"/><path d="M22 3v6h5"/><path d="m5 17 7-7 8 8-7 7z" fill="#d8e9f5"/><path d="m11 9 2-2 2 2M5 27h23"/><path d="M23 18c0 2.4 4 2.4 4 0 0-1.2-1.3-2.5-2-3.6-.7 1.1-2 2.4-2 3.6Z" fill="#73a8ce"/></svg>;
  if (id === "pageBorders") return <svg viewBox="0 0 32 32" aria-hidden {...stroke}><path d="M7 2h17l4 4v24H7z" fill="white"/><path d="M24 2v5h4"/><rect x="10" y="9" width="14" height="17" stroke="#caa349"/><rect x="12.5" y="11.5" width="9" height="12" stroke="#caa349" strokeDasharray="1.5 1.5"/></svg>;
  if (id === "margins") return <svg viewBox="0 0 32 32" aria-hidden {...stroke}><rect x="6" y="2" width="20" height="28" fill="white"/><path d="M11 2v28M21 2v28M6 9h20M6 23h20"/><path d="M8 5h2M22 5h2M8 27h2M22 27h2" stroke="#5b8aaa"/></svg>;
  if (id === "orientation") return <svg viewBox="0 0 32 32" aria-hidden {...stroke}><path d="M4 7h14l4 4v18H4z" fill="white"/><path d="M18 7v5h4"/><path d="M13 3c7 0 12 3 12 8" stroke="#397cae"/><path d="m22 8 3 3 3-3" stroke="#397cae"/><path d="M14 12h14v17H14z" fill="white"/></svg>;
  if (id === "pageSize") return <svg viewBox="0 0 32 32" aria-hidden {...stroke}><path d="M7 3h17l4 4v23H7z" fill="white"/><path d="M24 3v5h4M4 7V1h6M4 1l5 5" stroke="#397cae"/></svg>;
  if (id === "columns") return <svg viewBox="0 0 32 32" aria-hidden {...stroke}><rect x="4" y="3" width="24" height="27" fill="white"/><path d="M8 7h7M8 10h7M8 13h7M8 16h7M8 19h7M8 22h7M8 25h7M18 7h6M18 10h6M18 13h6M18 16h6M18 19h6M18 22h6M18 25h6"/></svg>;
  if (id === "sectionBreak") return <svg viewBox="0 0 24 24" aria-hidden {...stroke}><path d="M3 6h18M3 18h18M5 10h14M5 14h14"/><path d="M4 4v4M20 4v4" stroke="#397cae"/></svg>;
  if (id === "lineNumbers") return <svg viewBox="0 0 24 24" aria-hidden {...stroke}><text x="2" y="8" fontFamily="Segoe UI,Arial" fontSize="6" fill="currentColor">1</text><text x="2" y="14" fontFamily="Segoe UI,Arial" fontSize="6" fill="currentColor">2</text><text x="2" y="20" fontFamily="Segoe UI,Arial" fontSize="6" fill="currentColor">3</text><path d="M9 6h12M9 12h12M9 18h12"/></svg>;
  if (["bold","italic","underline","strikeThrough","subscript","superscript"].includes(id)) return <svg viewBox="0 0 24 24" aria-hidden><text x="12" y="17" textAnchor="middle" fontFamily="Georgia,serif" fontSize="16" fontWeight={id === "bold" ? 800 : 600} fontStyle={id === "italic" ? "italic" : undefined}>{id === "subscript" ? "X₂" : id === "superscript" ? "X²" : id === "strikeThrough" ? "S̶" : id === "underline" ? "U̲" : id === "italic" ? "I" : "B"}</text></svg>;
  if (["alignLeft","alignCenter","alignRight","justify","lineSpacing"].includes(id)) return <svg viewBox="0 0 24 24" aria-hidden {...stroke}>{[6,10,14,18].map((y,index) => <path key={y} d={id === "alignCenter" ? `M${index%2?6:4} ${y}h${index%2?12:16}` : id === "alignRight" ? `M${index%2?6:4} ${y}h${index%2?14:16}` : `M4 ${y}h${id === "justify" ? 16 : index%2 ? 12 : 16}`}/>)}</svg>;
  if (["bullets","numbering","multilevelList"].includes(id)) return <svg viewBox="0 0 24 24" aria-hidden {...stroke}><path d="M9 6h11M9 12h11M9 18h11"/><text x="3" y="8" fontSize="6">{id === "bullets" ? "•" : id === "numbering" ? "1" : "›"}</text><text x="3" y="14" fontSize="6">{id === "bullets" ? "•" : id === "numbering" ? "2" : "›"}</text><text x="3" y="20" fontSize="6">{id === "bullets" ? "•" : id === "numbering" ? "3" : "›"}</text></svg>;
  if (id === "shapes") return <svg viewBox="0 0 24 24" aria-hidden {...stroke}><circle cx="7" cy="7" r="3.2"/><rect x="12.5" y="4" width="7.5" height="7.5"/><path d="M7 13.5 12 21H2z"/></svg>;
  if (["insertPicture","onlinePictures","coverPage","blankPage","pageBreak","insertTable"].includes(id)) return <svg viewBox="0 0 24 24" aria-hidden {...stroke}><rect x="4" y="3" width="16" height="18" rx="1"/>{id.includes("Picture") ? <><circle cx="9" cy="9" r="2"/><path d="m5 18 5-5 3 3 2-2 4 4"/></> : id === "insertTable" ? <><path d="M4 9h16M4 15h16M10 3v18M15 3v18"/></> : id === "pageBreak" ? <path d="M6 12h12m-8-3 2 3-2 3"/> : <path d="M8 7h8M8 11h8M8 15h5"/>}</svg>;
  if (id === "copy") return <svg viewBox="0 0 24 24" aria-hidden {...stroke}><rect x="8" y="8" width="11" height="13" rx="1"/><rect x="5" y="4" width="11" height="13" rx="1" fill="white"/></svg>;
  if (["paste","cut","formatPainter"].includes(id)) return <svg viewBox="0 0 24 24" aria-hidden {...stroke}>{id === "cut" ? <><circle cx="6" cy="7" r="3"/><circle cx="6" cy="17" r="3"/><path d="m8 9 11 8M8 15 19 7"/></> : id === "formatPainter" ? <><path d="M5 4h12v6H5zM8 10v3h6v-3M9 13h4v7H9z"/></> : <><rect x="9" y="2" width="6" height="3" rx="1"/><path d="M6 5h1a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1h1a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z"/><path d="M8 12h8M8 16h5"/></>}</svg>;
  if (["find","replace","hyperlink","bookmark","crossReference"].includes(id)) return <svg viewBox="0 0 24 24" aria-hidden {...stroke}>{id === "find" || id === "replace" ? <><circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/></> : id === "bookmark" ? <path d="M7 3h10v18l-5-4-5 4z"/> : <><path d="M9 15 7 17a4 4 0 0 1-6-6l3-3a4 4 0 0 1 6 0M15 9l2-2a4 4 0 0 1 6 6l-3 3a4 4 0 0 1-6 0M8 12h8"/></>}</svg>;
  if (["header","footer","pageNumber"].includes(id)) return <svg viewBox="0 0 24 24" aria-hidden {...stroke}><rect x="4" y="3" width="16" height="18" rx="1"/><path d={id === "header" ? "M4 7h16" : id === "footer" ? "M4 17h16" : "M8 7h8M8 11h8M8 15h8"}/></svg>;
  if (["shading","borders","textEffects"].includes(id)) return <svg viewBox="0 0 24 24" aria-hidden {...stroke}><path d="M5 19h14M7 16l5-12 5 12M9 12h6"/><rect x="3" y="3" width="18" height="18" rx="1" opacity=".35"/></svg>;
  if (["printLayout","fullScreenReading","webLayout","outlineView","draftView"].includes(id)) return <svg viewBox="0 0 32 32" aria-hidden {...stroke}><rect x="5" y="3" width="22" height="26" fill="white"/><path d={id==="outlineView"?"M9 8h3M15 8h9M9 13h3M15 13h9M9 18h3M15 18h9M9 23h3M15 23h9":id==="draftView"?"M8 8h16M8 12h16M8 16h16M8 20h16M8 24h11":"M9 7h14M9 11h14M9 15h14M9 19h14M9 23h10"}/>{id==="fullScreenReading"&&<path d="M16 7v17M8 6c4 0 6 1 8 3 2-2 4-3 8-3v18c-4 0-6 1-8 3-2-2-4-3-8-3z" fill="#d9e8f5"/>}{id==="webLayout"&&<circle cx="23" cy="22" r="6" fill="#6bb66b"/>}</svg>;
  if (["ruler","gridlines","messageBar","documentMap","thumbnails"].includes(id)) return <svg viewBox="0 0 20 20" aria-hidden {...stroke}>{id==="ruler"?<path d="M2 6h16v8H2zM5 6v4M8 6v2M11 6v4M14 6v2"/>:id==="gridlines"?<path d="M3 3h14v14H3zM3 8h14M3 13h14M8 3v14M13 3v14"/>:id==="messageBar"?<><rect x="2" y="4" width="16" height="11"/><path d="m5 8 5 4 5-4"/></>:id==="thumbnails"?<><rect x="2" y="3" width="6" height="7"/><rect x="11" y="3" width="6" height="7"/><rect x="2" y="12" width="6" height="6"/><rect x="11" y="12" width="6" height="6"/></>:<path d="M5 3v14M8 5h9M8 9h9M8 13h9M8 17h6"/>}</svg>;
  if (["zoom","zoom100","onePage","twoPages","pageWidth"].includes(id)) return <svg viewBox="0 0 32 32" aria-hidden {...stroke}>{id==="zoom"?<><circle cx="13" cy="13" r="8" fill="white"/><path d="m19 19 8 8"/></>:id==="zoom100"?<><path d="M7 3h15l4 4v22H7z" fill="white"/><text x="16" y="20" textAnchor="middle" fontFamily="Segoe UI,Arial" fontSize="9" fill="currentColor">100</text></>:id==="twoPages"?<><rect x="3" y="5" width="11" height="20" fill="white"/><rect x="18" y="5" width="11" height="20" fill="white"/></>:id==="pageWidth"?<><rect x="3" y="7" width="26" height="18" fill="white"/><path d="M8 16H4m0 0 3-3m-3 3 3 3m17-3h4m0 0-3-3m3 3-3 3"/></>:<rect x="8" y="3" width="16" height="26" fill="white"/>}</svg>;
  return <svg viewBox="0 0 24 24" aria-hidden {...stroke}><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 12h8M12 8v8"/></svg>;
}

function navigateTabs(event: KeyboardEvent, current: WordEditorTab, tabs: WordEditorTab[], setTab: (tab: WordEditorTab) => void) {
  if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
  event.preventDefault();
  const index = tabs.indexOf(current);
  setTab(event.key === 'Home' ? tabs[0] : event.key === 'End' ? tabs.at(-1)! : tabs[(index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length]);
}
