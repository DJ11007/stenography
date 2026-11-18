import { BUSINESS, FULL_ADDRESS } from "@/lib/seo";

const SUPPORT_PHONE_DISPLAY = BUSINESS.phoneDisplay;
const WEBSITE_DISPLAY = "sctyping.com";
const ADDRESS = FULL_ADDRESS;

// Keep in step with the SCTyping app's src/lib/branded-print.ts (same design).
// The printed / saved-as-PDF test page ("⬇ Download Test"), branded for Samradhi Classes: logo, name and contact
// details at the top, a faint logo + repeated name watermark behind the passage, and a promotion footer. The
// watermark can't stop a determined copier, but every copy that gets shared still advertises the institute.
//
// The whole test is ONE A4 sheet (owner's request, 18 Nov 2026): the passage is bold, and its font is reduced step by
// step until everything -- header, title, passage, footer -- fits on that one page. The sheet has its own even margins
// and @page has none, so the browser has no room to add its own date / title / web-address lines, and nothing repeats
// on a second page (earlier the fixed footer was redrawn on every page, on top of the passage, and long passages ran
// onto 2-3 pages).
export type BrandedTestPage = {
  title: string;
  details: string[];
  passage: string;
  fontFamily: string;
  fontSize: number;
  fontFace?: string;
  logoUrl: string;
};

const esc = (text: string) => text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));

// A4 at the browser's 96 px per inch.
const A4_WIDTH_PX = 794, A4_HEIGHT_PX = 1123;
const MIN_FONT_PX = 7;

export function brandedTestPageHtml(page: BrandedTestPage): string {
  const mark = esc("SAMRADHI CLASSES · " + WEBSITE_DISPLAY);
  const watermarkRows = Array.from({ length: 14 }, () => `<div>${Array.from({ length: 4 }, () => `<span>${mark}</span>`).join("")}</div>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(page.title)} — Samradhi Classes</title><style>
${page.fontFace ?? ""}
@page{size:A4;margin:0}
*{-webkit-print-color-adjust:exact;print-color-adjust:exact;box-sizing:border-box}
html,body{margin:0;padding:0;background:#fff}
body{font-family:Arial,Helvetica,sans-serif;color:#0f172a}
.sheet{position:relative;width:210mm;height:296mm;padding:11mm 12mm 9mm;display:flex;flex-direction:column;overflow:hidden;break-after:avoid;page-break-after:avoid}
.head{display:flex;align-items:center;gap:12px;padding:8px 12px;border:2px solid #1e3a8a;border-radius:10px;background:#eff6ff;flex:none}
.head img{width:56px;height:56px;object-fit:contain}
.brand{flex:1;min-width:0}
.brand .name{font-size:22px;font-weight:900;letter-spacing:.06em;color:#1e3a8a;margin:0;white-space:nowrap}
.brand .tag{font-size:10px;font-weight:700;color:#b91c1c;margin:2px 0 0;letter-spacing:.04em}
.contact{text-align:right;font-size:10.5px;line-height:1.5;color:#1e293b;max-width:42%}
.contact b{color:#1e3a8a}
.title{margin:10px 0 1px;font-size:18px;font-weight:900;flex:none}
.meta{margin:0 0 8px;font-size:11px;color:#475569;flex:none}
.passage{position:relative;flex:none;font-family:${page.fontFamily.replace(/"/g, "'")};font-size:${page.fontSize}px;font-weight:700;line-height:1.9;text-align:justify;white-space:pre-wrap;padding:10px 14px;border:1px solid #94a3b8;border-radius:8px;color:#000}
.wm{position:absolute;inset:0;z-index:-1;overflow:hidden;pointer-events:none}
.wm .rows{position:absolute;left:-30%;top:-10%;width:160%;transform:rotate(-30deg);opacity:.07;font-size:22px;font-weight:900;letter-spacing:.12em;color:#1e3a8a;white-space:nowrap}
.wm .rows div{margin:46px 0}
.wm .rows span{margin-right:60px}
.wm img{position:absolute;left:50%;top:50%;width:320px;height:320px;transform:translate(-50%,-50%);opacity:.06;object-fit:contain}
.foot{margin-top:auto;padding-top:5px;flex:none;text-align:center;font-size:9.5px;color:#334155;border-top:1px solid #cbd5e1}
.foot b{color:#b91c1c}
</style></head><body><div class="sheet">
<div class="wm"><img src="${esc(page.logoUrl)}" alt=""><div class="rows">${watermarkRows}</div></div>
<div class="head">
  <img src="${esc(page.logoUrl)}" alt="Samradhi Classes">
  <div class="brand"><p class="name">SAMRADHI CLASSES</p><p class="tag">TYPING · STENOGRAPHY · WORD / EXCEL EFFICIENCY · RSMSSB · SSC · HIGH COURT</p></div>
  <div class="contact"><b>Call / WhatsApp:</b> ${esc(SUPPORT_PHONE_DISPLAY)}<br><b>Website:</b> ${esc(WEBSITE_DISPLAY)}<br>${esc(ADDRESS)}</div>
</div>
<p class="title">${esc(page.title)}</p>
<p class="meta">${page.details.map(esc).join(" · ")}</p>
<div class="passage">${esc(page.passage)}</div>
<div class="foot">Practise this test with live speed &amp; accuracy on the <b>SCTyping</b> app — free download at <b>${esc(WEBSITE_DISPLAY)}</b> · Admissions &amp; enquiry: <b>${esc(SUPPORT_PHONE_DISPLAY)}</b> · © Samradhi Classes, for students' practice only</div>
</div></body></html>`;
}

// Shrinks the passage (font size first, then line spacing) until the whole sheet's content fits on the one page.
export function fitBrandedSheet(doc: Document) {
  const sheet = doc.querySelector<HTMLElement>(".sheet");
  const passage = doc.querySelector<HTMLElement>(".passage");
  const foot = doc.querySelector<HTMLElement>(".foot");
  if (!sheet || !passage || !foot) return;
  const fits = () => {
    const bottom = sheet.getBoundingClientRect().bottom - parseFloat(doc.defaultView?.getComputedStyle(sheet).paddingBottom || "0");
    return foot.getBoundingClientRect().bottom <= bottom + 0.5 && passage.getBoundingClientRect().bottom <= foot.getBoundingClientRect().top;
  };
  let size = parseFloat(doc.defaultView?.getComputedStyle(passage).fontSize || "16");
  let lineHeight = 1.9;
  for (let step = 0; step < 200 && !fits(); step++) {
    if (lineHeight > 1.5) lineHeight = Math.max(1.5, lineHeight - 0.1);
    else if (size > MIN_FONT_PX) size = Math.max(MIN_FONT_PX, size - 0.5);
    else break;
    passage.style.fontSize = `${size}px`;
    passage.style.lineHeight = String(lineHeight);
  }
}

// Writes the page into a hidden A4-sized frame, fits it to one page, then opens the print / "Save as PDF" dialog once
// the logo and fonts are ready.
export function printBrandedTestPage(page: BrandedTestPage) {
  const frame = document.createElement("iframe");
  // Laid out at A4 size off-screen, so the one-page fitting measures the real printed layout.
  Object.assign(frame.style, { position: "fixed", left: "-10000px", top: "0", width: `${A4_WIDTH_PX}px`, height: `${A4_HEIGHT_PX}px`, border: "0" });
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  const win = frame.contentWindow;
  if (!doc || !win) { frame.remove(); return; }
  doc.open();
  doc.write(brandedTestPageHtml(page));
  doc.close();
  const images = Array.from(doc.images).map((img) => (img.complete ? Promise.resolve() : new Promise<void>((resolve) => { img.onload = () => resolve(); img.onerror = () => resolve(); })));
  const fonts = doc.fonts?.ready ?? Promise.resolve();
  Promise.all([...images, fonts]).then(() => {
    fitBrandedSheet(doc);
    win.focus();
    win.print();
    window.setTimeout(() => frame.remove(), 60000);
  });
}
