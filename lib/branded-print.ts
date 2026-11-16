import { BUSINESS, FULL_ADDRESS } from "@/lib/seo";

const SUPPORT_PHONE_DISPLAY = BUSINESS.phoneDisplay;
const WEBSITE_DISPLAY = "sctyping.com";
const ADDRESS = FULL_ADDRESS;

// The printed / saved-as-PDF test page ("⬇ Download Test"), branded for Samradhi Classes: logo, name and contact
// details at the top, a faint logo + repeated name watermark behind the passage on EVERY page (fixed-position
// elements repeat on each printed page), and a promotion footer. The watermark can't stop a determined copier, but
// every copy that gets shared still advertises the institute. Keep in step with the SCTyping app's
// src/lib/branded-print.ts (same design).
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

export function brandedTestPageHtml(page: BrandedTestPage): string {
  const mark = esc("SAMRADHI CLASSES · " + WEBSITE_DISPLAY);
  const watermarkRows = Array.from({ length: 14 }, () => `<div>${Array.from({ length: 4 }, () => `<span>${mark}</span>`).join("")}</div>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(page.title)} — Samradhi Classes</title><style>
${page.fontFace ?? ""}
@page{size:A4;margin:14mm 14mm 22mm}
*{-webkit-print-color-adjust:exact;print-color-adjust:exact;box-sizing:border-box}
body{margin:0;font-family:Arial,Helvetica,sans-serif;color:#0f172a}
.head{display:flex;align-items:center;gap:14px;padding:10px 14px;border:2px solid #1e3a8a;border-radius:12px;background:#eff6ff}
.head img{width:64px;height:64px;object-fit:contain}
.brand{flex:1;min-width:0}
.brand .name{font-size:24px;font-weight:900;letter-spacing:.06em;color:#1e3a8a;margin:0;white-space:nowrap}
.brand .tag{font-size:11px;font-weight:700;color:#b91c1c;margin:2px 0 0;letter-spacing:.04em}
.contact{text-align:right;font-size:11px;line-height:1.55;color:#1e293b;max-width:42%}
.contact b{color:#1e3a8a}
.title{margin:16px 0 2px;font-size:20px;font-weight:900}
.meta{margin:0 0 12px;font-size:12px;color:#475569}
.passage{position:relative;font-family:${page.fontFamily.replace(/"/g, "'")};font-size:${page.fontSize}px;line-height:1.95;text-align:justify;white-space:pre-wrap;padding:14px 16px;border:1px solid #cbd5e1;border-radius:10px}
.wm{position:fixed;inset:0;z-index:-1;overflow:hidden;pointer-events:none}
.wm .rows{position:absolute;left:-30%;top:-10%;width:160%;transform:rotate(-30deg);opacity:.07;font-size:22px;font-weight:900;letter-spacing:.12em;color:#1e3a8a;white-space:nowrap}
.wm .rows div{margin:46px 0}
.wm .rows span{margin-right:60px}
.wm img{position:absolute;left:50%;top:50%;width:320px;height:320px;transform:translate(-50%,-50%);opacity:.06;object-fit:contain}
.foot{position:fixed;left:0;right:0;bottom:-16mm;text-align:center;font-size:10px;color:#334155;border-top:1px solid #cbd5e1;padding-top:4px}
.foot b{color:#b91c1c}
</style></head><body>
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
</body></html>`;
}

// Writes the page into a hidden frame and opens the print / "Save as PDF" dialog once the logo and fonts are ready.
export function printBrandedTestPage(page: BrandedTestPage) {
  const frame = document.createElement("iframe");
  frame.style.position = "fixed"; frame.style.width = "0"; frame.style.height = "0"; frame.style.border = "0";
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
    win.focus();
    win.print();
    window.setTimeout(() => frame.remove(), 60000);
  });
}
