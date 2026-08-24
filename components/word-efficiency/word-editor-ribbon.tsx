"use client";

import { useState, type KeyboardEvent } from "react";
import {
  WORD_EDITOR_RIBBON,
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
};

export function WordEditorRibbon({ capabilities, activeTab, onTabChange, preview = false, activeOption, onCommand, onFontChange, onFontSizeChange, onColorChange, onUnderlineChange }: Props) {
  const visibleTabs = WORD_EDITOR_RIBBON.filter(tab => capabilities.tabs[tab.id].enabled);
  const selectedTab = visibleTabs.some(tab => tab.id === activeTab) ? activeTab : visibleTabs[0]?.id;
  const definition = WORD_EDITOR_RIBBON.find(tab => tab.id === selectedTab);
  const groups = definition?.groups.map(group => ({
    ...group,
    options: group.options.filter(option => capabilities.tabs[definition.id].groups[group.id].options[option.id]),
  })).filter(group => capabilities.tabs[definition.id].groups[group.id].enabled && group.options.length > 0) ?? [];

  return <div className="word-office-ribbon" data-preview={preview || undefined}>
    <div role="tablist" aria-label={preview ? "Capability preview tabs" : "Document editor ribbon"} className="word-ribbon-tabs">
      {visibleTabs.map(tab => <button key={tab.id} type="button" role="tab" aria-selected={selectedTab === tab.id} aria-controls={`ribbon-${tab.id.replaceAll(" ", "-")}`} onClick={() => onTabChange(tab.id)} onKeyDown={event => navigateTabs(event, tab.id, visibleTabs.map(item => item.id), onTabChange)}>{tab.id.toUpperCase()}</button>)}
    </div>
    <div id={`ribbon-${String(selectedTab).replaceAll(" ", "-")}`} role="tabpanel" aria-label={`${selectedTab} tools`} className="word-ribbon-panel">
      <div className="word-ribbon-groups">
        {groups.map(group => <section key={group.id} data-ribbon-group={group.id} className="word-ribbon-group">
          <div className="word-ribbon-options">
            {group.options.map(option => <RibbonControl key={option.id} option={option} capabilities={capabilities} preview={preview} active={activeOption?.(option.id) ?? false} onCommand={onCommand} onFontChange={onFontChange} onFontSizeChange={onFontSizeChange} onColorChange={onColorChange} onUnderlineChange={onUnderlineChange}/>) }
          </div>
          <span className="word-ribbon-group-name">{group.label}</span>
        </section>)}
      </div>
    </div>
  </div>;
}

function RibbonControl({ option, capabilities, preview, active, onCommand, onFontChange, onFontSizeChange, onColorChange,onUnderlineChange }: { option: RibbonOption; capabilities: HierarchicalEditorCapabilities; preview: boolean; active: boolean; onCommand?: (id: string) => void; onFontChange?: (font: string) => void; onFontSizeChange?: (size: number) => void; onColorChange?: (id: string, color: string) => void;onUnderlineChange?:(style:string,color?:string)=>void }) {
  const[open,setOpen]=useState(false);
  if (option.id === "fontName") return <label className="word-ribbon-select word-ribbon-font"><span className="sr-only">{option.label}</span><select aria-label={option.label} disabled={preview} defaultValue="Calibri (Body)" onChange={event => onFontChange?.(event.target.value)}>{capabilities.fonts.map(font => <option key={font}>{font}</option>)}</select></label>;
  if (option.id === "fontSize") return <label className="word-ribbon-select word-ribbon-size"><span className="sr-only">{option.label}</span><select aria-label={option.label} disabled={preview} defaultValue="11" onChange={event => onFontSizeChange?.(Number(event.target.value))}>{[8,9,10,11,12,14,16,18,20,24,28,32,36,48,72].filter(size => size >= capabilities.fontSizeMin && size <= capabilities.fontSizeMax).map(size => <option key={size}>{size}</option>)}</select></label>;
  if (["highlightColor", "fontColor", "pageColor"].includes(option.id)) return <label className="word-ribbon-tool word-ribbon-color" title={option.label} aria-disabled={preview}><RibbonIcon id={option.id}/><span>{option.label}</span><input aria-label={option.label} disabled={preview} type="color" onChange={event => onColorChange?.(option.id, event.target.value)}/></label>;
  if(option.id==="underline")return <div className="word-ribbon-menu-wrap"><button type="button" className="word-ribbon-tool" aria-label="Underline styles" aria-haspopup="menu" aria-expanded={open} aria-pressed={active||undefined} onMouseDown={event=>event.preventDefault()} onClick={()=>setOpen(value=>!value)}><RibbonIcon id="underline"/><span>Underline <i aria-hidden>▾</i></span></button>{open&&<div role="menu" className="word-ribbon-menu" onKeyDown={event=>{if(event.key==="Escape"){setOpen(false);(event.currentTarget.previousElementSibling as HTMLElement)?.focus()}}}>{["none","single","double","thick","dotted","dashed","dot-dash","dot-dot-dash","wavy","words-only"].map(style=><button role="menuitem" type="button" key={style} onMouseDown={event=>event.preventDefault()} onClick={()=>{if(!preview)onUnderlineChange?.(style);setOpen(false)}}>{underlineLabel(style)}</button>)}<label>Underline color<input type="color" disabled={preview} onChange={event=>{onUnderlineChange?.("color",event.target.value);setOpen(false)}}/></label></div>}</div>;
  return <button type="button" className="word-ribbon-tool" aria-label={option.label} aria-haspopup={option.menu ? "menu" : undefined} aria-pressed={active || undefined} disabled={preview} title={option.label} onMouseDown={event => { if (!preview) event.preventDefault(); }} onClick={() => onCommand?.(option.id)}><RibbonIcon id={option.id}/><span>{option.label}{option.menu && <i aria-hidden>▾</i>}</span></button>;
}
function underlineLabel(style:string){return({none:"None",single:"Single",double:"Double",thick:"Thick",dotted:"Dotted",dashed:"Dashed","dot-dash":"Dot-dash","dot-dot-dash":"Dot-dot-dash",wavy:"Wavy","words-only":"Words only"}as Record<string,string>)[style]??style}

function RibbonIcon({ id }: { id: string }) {
  const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.55, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (["bold","italic","underline","strikeThrough","subscript","superscript"].includes(id)) return <svg viewBox="0 0 24 24" aria-hidden><text x="12" y="17" textAnchor="middle" fontFamily="Georgia,serif" fontSize="16" fontWeight={id === "bold" ? 800 : 600} fontStyle={id === "italic" ? "italic" : undefined}>{id === "subscript" ? "X₂" : id === "superscript" ? "X²" : id === "strikeThrough" ? "S̶" : id === "underline" ? "U̲" : id === "italic" ? "I" : "B"}</text></svg>;
  if (["alignLeft","alignCenter","alignRight","justify","lineSpacing"].includes(id)) return <svg viewBox="0 0 24 24" aria-hidden {...stroke}>{[6,10,14,18].map((y,index) => <path key={y} d={id === "alignCenter" ? `M${index%2?6:4} ${y}h${index%2?12:16}` : id === "alignRight" ? `M${index%2?6:4} ${y}h${index%2?14:16}` : `M4 ${y}h${id === "justify" ? 16 : index%2 ? 12 : 16}`}/>)}</svg>;
  if (["bullets","numbering","multilevelList"].includes(id)) return <svg viewBox="0 0 24 24" aria-hidden {...stroke}><path d="M9 6h11M9 12h11M9 18h11"/><text x="3" y="8" fontSize="6">{id === "bullets" ? "•" : id === "numbering" ? "1" : "›"}</text><text x="3" y="14" fontSize="6">{id === "bullets" ? "•" : id === "numbering" ? "2" : "›"}</text><text x="3" y="20" fontSize="6">{id === "bullets" ? "•" : id === "numbering" ? "3" : "›"}</text></svg>;
  if (["insertPicture","onlinePictures","shapes","coverPage","blankPage","pageBreak","insertTable"].includes(id)) return <svg viewBox="0 0 24 24" aria-hidden {...stroke}><rect x="4" y="3" width="16" height="18" rx="1"/>{id.includes("Picture") ? <><circle cx="9" cy="9" r="2"/><path d="m5 18 5-5 3 3 2-2 4 4"/></> : id === "insertTable" ? <><path d="M4 9h16M4 15h16M10 3v18M15 3v18"/></> : id === "pageBreak" ? <path d="M6 12h12m-8-3 2 3-2 3"/> : <path d="M8 7h8M8 11h8M8 15h5"/>}</svg>;
  if (["paste","cut","copy","formatPainter"].includes(id)) return <svg viewBox="0 0 24 24" aria-hidden {...stroke}>{id === "cut" ? <><circle cx="6" cy="7" r="3"/><circle cx="6" cy="17" r="3"/><path d="m8 9 11 8M8 15 19 7"/></> : id === "formatPainter" ? <><path d="M5 4h12v6H5zM8 10v3h6v-3M9 13h4v7H9z"/></> : <><rect x="6" y="5" width="12" height="15" rx="1"/><path d="M9 5V3h6v2M9 9h6M9 13h6"/></>}</svg>;
  if (["find","replace","hyperlink","bookmark","crossReference"].includes(id)) return <svg viewBox="0 0 24 24" aria-hidden {...stroke}>{id === "find" || id === "replace" ? <><circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/></> : id === "bookmark" ? <path d="M7 3h10v18l-5-4-5 4z"/> : <><path d="M9 15 7 17a4 4 0 0 1-6-6l3-3a4 4 0 0 1 6 0M15 9l2-2a4 4 0 0 1 6 6l-3 3a4 4 0 0 1-6 0M8 12h8"/></>}</svg>;
  if (["header","footer","pageNumber","margins","orientation","pageSize","columns","sectionBreak","lineNumbers"].includes(id)) return <svg viewBox="0 0 24 24" aria-hidden {...stroke}><rect x="4" y="3" width="16" height="18" rx="1"/><path d={id === "columns" ? "M9 6v12M15 6v12" : id === "margins" ? "M7 3v18M17 3v18" : id === "header" ? "M4 7h16" : id === "footer" ? "M4 17h16" : "M8 7h8M8 11h8M8 15h8"}/></svg>;
  if (["watermark","pageColor","pageBorders","shading","borders","highlightColor","fontColor","textEffects"].includes(id)) return <svg viewBox="0 0 24 24" aria-hidden {...stroke}><path d="M5 19h14M7 16l5-12 5 12M9 12h6"/><rect x="3" y="3" width="18" height="18" rx="1" opacity=".35"/></svg>;
  if (["fullScreenReading","printLayout","webLayout","outlineView","draftView","ruler","gridlines","documentMap","zoom100","onePage","twoPages"].includes(id)) return <svg viewBox="0 0 24 24" aria-hidden {...stroke}>{id === "gridlines" ? <><path d="M4 4h16v16H4zM4 10h16M4 16h16M10 4v16M16 4v16"/></> : id === "ruler" ? <><path d="M3 8h18v8H3zM7 8v4M11 8v2M15 8v4M19 8v2"/></> : <><rect x="4" y="3" width="16" height="18" rx="1"/><path d="M8 7h8M8 11h8M8 15h6"/></>}</svg>;
  return <svg viewBox="0 0 24 24" aria-hidden {...stroke}><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 12h8M12 8v8"/></svg>;
}

function navigateTabs(event: KeyboardEvent, current: WordEditorTab, tabs: WordEditorTab[], setTab: (tab: WordEditorTab) => void) {
  if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
  event.preventDefault();
  const index = tabs.indexOf(current);
  setTab(event.key === 'Home' ? tabs[0] : event.key === 'End' ? tabs.at(-1)! : tabs[(index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length]);
}
