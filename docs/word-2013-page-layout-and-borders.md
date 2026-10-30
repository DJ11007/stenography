# Microsoft Word 2013: page margins, reflow, page borders and layout

A working reference for the Word Efficiency editor. It is written for Word 2013 on Windows. Anything I am not sure of is
marked **(verify)**: open your own Word 2013 and check it, because presets and defaults depend on the template, the
regional settings and the installation.

Word 2013 names to use: the tab is **PAGE LAYOUT** (it was renamed *Layout* in Word 2016), and page borders are under
**DESIGN → Page Background → Page Borders**.

---

## 1. Overview in one minute

- A page has a **physical size** (paper), four **margins**, and a **text area** (the body) inside them.
- Margins only decide where the **body text area** is. They do not decide where every object, header, footer or page
  border goes.
- Changing a margin makes Word **recalculate line breaks and page breaks** (reflow). It never rescales fonts, pictures,
  shapes or tables to match.
- A **page border** has its own setting, *Measure from* (Edge of page or Text) and its own four distances. It is not
  tied to the margins unless you choose *Measure from: Text*.
- Printers cannot print to the paper's edge, so a border near the edge may be cut off. Only a print preview or a test
  print tells you.

## 2. Page geometry (the coordinate system)

```
+--------------------------------------------------------+  <- physical paper edge
|   page border (Measure from: Edge of page, e.g. 24 pt)  |
|  +--------------------------------------------------+  |
|  |  header area  (Header from Top, default 0.5")     |  |
|  |  -------------------------------------------     |  |  <- top margin line
|  |                                                  |  |
|  |           main text area (the body)              |  |
|  |                                                  |  |
|  |  -------------------------------------------     |  |  <- bottom margin line
|  |  footer area (Footer from Bottom, default 0.5")   |  |
|  +--------------------------------------------------+  |
|   (printer's non-printable band lies along the edge)    |
+--------------------------------------------------------+
   left margin ->  |<-- text width -->| <- right margin
```

| Area | Controlled by |
|---|---|
| Paper | Size (PAGE LAYOUT → Size) and Orientation |
| Body text area | Top, Bottom, Left, Right margins, plus Gutter |
| Paragraph position inside the body | Paragraph indents (left, right, first line, hanging) |
| Header and footer | *Header from Top* / *Footer from Bottom* (Page Setup → Layout tab), content height |
| Page border | Borders and Shading → Page Border → **Options** (Measure from, 4 distances) |
| Floating objects | Their own position settings (relative to page, margin, paragraph, character, column) and wrapping |
| Printable region | The printer driver (hardware margins) |

The paper size and the area where content can sit are different things. Margins define the body; headers, footers,
borders and floating objects can lie inside the margins, and even near the paper edge.

## 3. Default Word 2013 settings

- **Paper size** depends on the regional settings, the template and the printer. Do not assume Letter everywhere.
  Letter = 8.5 × 11 in (21.59 × 27.94 cm); **A4 = 8.27 × 11.69 in (21.0 × 29.7 cm)**, the usual choice in India.
- **Orientation**: Portrait or Landscape (section-level).
- **Margins**: the *Normal* preset is 1 in on all four sides; the active document can differ.
- **Header from Top / Footer from Bottom**: 0.5 in (1.27 cm) **(verify)**.
- **Gutter**: 0 in; gutter position Left.
- **Page border, when first applied** (Options): distances of **24 pt** measured from the **Edge of page** **(verify in
  your Word 2013: DESIGN → Page Borders → Box → Options)**. Word 2003 used *Text* with 4 pt; newer versions default to
  *Edge of page*. This matters a great deal, see section 8.

How to open it: **PAGE LAYOUT → Page Setup group** has Margins, Orientation and Size. The small arrow at the group's
bottom-right corner opens the **Page Setup** dialog (Margins, Paper, Layout tabs).

Custom paper: Size → More Paper Sizes → Paper tab → Paper size: Custom size, then Width and Height.
Custom margins: Margins → Custom Margins.

### Text area for 1-inch margins

`Text width = page width - left margin - right margin`
`Text height = page height - top margin - bottom margin`

| Paper | Page (in) | Page (cm) | Margins | Text width | Text height |
|---|---|---|---|---|---|
| A4 | 8.27 x 11.69 | 21.0 x 29.7 | 1 in all sides | **6.27 in / 15.92 cm** | **9.69 in / 24.62 cm** |
| Letter | 8.5 x 11 | 21.59 x 27.94 | 1 in all sides | **6.5 in / 16.51 cm** | **9.0 in / 22.86 cm** |

(The A4 row matches the table you sent.)

## 4. Margin presets and options

Preset values below are the ones usually shown in Word 2013's Margins gallery **(verify, presets vary with
templates, localisation and customisation)**.

| Option | Typical values | Changes paper size? | Changes text area? | Reflows / repaginates? | Use it for |
|---|---|---|---|---|---|
| Normal | 1 in all sides | No | Sets it | Yes | Everyday documents, Word's usual default |
| Narrow | 0.5 in all sides | No | Wider/taller body | Yes | Fitting more per page, forms |
| Moderate | top/bottom 1 in, left/right 0.75 in | No | Slightly wider | Yes | Reports needing a little more width |
| Wide | top/bottom 1 in, left/right 2 in | No | Narrower | Yes | Margin notes, easy reading |
| Mirrored | top/bottom 1 in, inside 1.25 in, outside 1 in | No | Alternates by page | Yes | Printing on both sides |
| Custom Margins | your numbers | No | Sets it | Yes | Anything else |
| Top / Bottom / Left / Right | any value | No | Each moves one boundary | Yes | Fine control |
| Gutter | e.g. 0.5 in | No | Takes space from the body for binding | Yes | Bound documents |
| Gutter position | Left or Top | No | Which edge gets the gutter | Yes | Side-bound or top-bound |
| Mirror margins | on/off | No | Left/right become inside/outside | Yes | Facing pages |
| Multiple pages | Normal, Mirror margins, 2 pages per sheet, Book fold | No (Book fold changes how pages are laid on the sheet) | Yes | Yes | Booklets |
| Apply to | Whole document, This section, This point forward (Selected sections if you select text) | No | Only that scope | Yes | Section-specific layouts |

Why margins change the text area: every margin is subtracted from the page, so larger margins leave less width or
height and smaller ones leave more. **Gutter** adds binding space on top of the margin: with a 1 in left margin and a
0.5 in left gutter the body starts 1.5 in from the edge. **Mirrored** margins swap left and right for even pages so the
inside (binding) margin is the same on both sides of a sheet.

## 5. Calculations (A4)

| Margins (all sides) | Text width | Text height |
|---|---|---|
| 0.5 in (1.27 cm) | 7.27 in / 18.46 cm | 10.69 in / 27.16 cm |
| 1 in (2.54 cm) | 6.27 in / 15.92 cm | 9.69 in / 24.62 cm |
| 1.25 in (3.175 cm) | 5.77 in / 14.65 cm | 9.19 in / 23.35 cm |
| 1.5 in (3.81 cm) | 5.27 in / 13.38 cm | 8.69 in / 22.08 cm |

Mirrored margins: the effective left margin on an odd page is the *inside* value, and on an even page it is the
*outside* value, so the text area keeps the same width but shifts sideways. With a gutter, subtract the gutter as
well: `body width = page width - left - right - gutter` (for a left gutter).

Limits of the formulas: they describe the **body** only. Headers, footers, page borders and floating objects use
their own positions and can lie outside it.

## 6. What happens when margins change

Example: A4, 1 in margins, five pages of headings, paragraphs, tables, pictures and page numbers. Change all margins
to 0.5 in.

1. **Text paragraphs**: line width grows from 6.27 in to 7.27 in. Word re-breaks every line, so words move up to
   earlier lines and paragraphs get shorter. Nothing is deleted.
2. **Pagination**: pages hold more lines (10.69 in instead of 9.69 in), so the five pages may become four. Automatic
   page breaks move. **Manual page breaks and section breaks stay** where they are. Keep with next, keep lines
   together, widow/orphan control, space before/after and *page break before* all influence where pages end, which
   is why a small change can move a heading to the next page.
3. **Page numbers and page-count fields** update when Word repaginates or the fields are refreshed (F9 or when
   printing).
4. **Tables**: a table follows its own width setting, not the margins. *AutoFit to window* or a preferred width in %
   resizes with the text area. A *fixed* width, or widths set in cm or inches, stays the same and may stick out of a
   narrower text area or leave a gap in a wider one. Row heights change only because text wraps differently.
5. **Pictures and shapes**: an **inline** picture sits in a line of text and is moved by reflow like a character, but
   keeps its size (a picture wider than the new text width is clipped or overflows). A **floating** picture is
   anchored to a paragraph and positioned relative to the page, margin, column, paragraph or character. If it is
   positioned relative to the *page*, it stays at the same physical place when margins change; relative to the
   *margin*, it moves with it. Wrapping decides how text flows around it. Objects can overlap text, be clipped, or
   extend beyond the printable area after a change.
6. **Headers and footers**: they sit at *Header from Top* / *Footer from Bottom* (0.5 in by default), not at the page
   margins. Changing the top margin does not move the header; it only moves the body. If a header is taller than the
   top margin, Word pushes the body down.
7. **Sections**: margins belong to a section. If the document has section breaks, changing margins with *Apply to:
   Whole document* changes all sections, but with *This section* only that one. A document where some pages look
   different usually has an extra section.

Word is **not** a proportional-rescaling system. Changing margins does not scale fonts, pictures, shapes, tables or
text boxes. It reflows text and leaves everything else as the author set it.

Before and after, the same paragraph (30 words) at 6.27 in and 7.27 in wide:

```
6.27 in (1 in margins)                 7.27 in (0.5 in margins)
Video provides a powerful way to       Video provides a powerful way to help you prove your
help you prove your point. When you    point. When you click Online Video, you can paste in the
click Online Video, you can paste      embed code for the video you want to add.
in the embed code for the video
you want to add.
(5 lines)                              (3 lines)
```

## 7. Content-specific behaviour

| Content | Reflows automatically | Needs manual work |
|---|---|---|
| Text, paragraphs | Yes (line breaks and page breaks) | Indents and spacing are separate settings |
| Tables | Only if width is %/AutoFit to window | Fixed widths, nested tables, many columns |
| Inline pictures | Move with text | Resize if wider than the text area |
| Floating pictures/shapes | Only if positioned relative to margin/text | Reposition, check wrapping |
| Headers/footers | Stay at their own distance | Adjust Header from Top / Footer from Bottom |
| Page borders | Only if measured from text | Check distance, printer limits |

## 8. Page borders in detail

Path: **DESIGN → Page Background → Page Borders**. This opens **Borders and Shading** with three tabs: *Borders*
(paragraph or text), **Page Border**, *Shading*.

- A **paragraph border** surrounds selected paragraphs and follows their indents. A **table border** belongs to cells.
  A **page border** surrounds the page and belongs to the section.
- Page Border tab: **Setting** (None, Box, Shadow, 3-D, Custom), **Style**, **Color**, **Width**, **Art**, the preview
  with four buttons (top, bottom, left, right), **Apply to**, and **Options**.
- **Apply to**: Whole document; This section; This section - First page only; This section - All except first page.
- **Options**: *Margin* **Top, Bottom, Left, Right** (distance in points), **Measure from: Edge of page or Text**,
  and checkboxes: *Always display in front*, and, for *Text*, *Surround header* / *Surround footer*.
- Available styles, widths and art depend on the installed Word version.

### The two positioning modes

- **Measure from: Edge of page**: each distance is measured from the *paper edge inward*. Margins play no part.
- **Measure from: Text**: each distance is measured from the *text boundary (the margin line) outward*. Moving a
  margin moves the border.

Word limits the distance to about 31 pt **(verify)**.

### Numbers: A4, left/right margins 1 in, distance 24 pt

72 pt = 1 in, so 24 pt = 0.333 in (0.847 cm).

| Mode | Left border position from the paper edge | Relation to the text boundary (at 1 in) |
|---|---|---|
| Edge of page, 24 pt | 0.333 in (0.847 cm) | 0.667 in **outside** the text boundary |
| Text, 24 pt | 1 in - 0.333 in = 0.667 in (1.69 cm) | 0.333 in outside the text boundary |
| Text, 4 pt | 1 in - 0.056 in = 0.944 in (2.40 cm) | 0.056 in outside the text boundary |

Border width at the top and sides for Edge of page, 24 pt: `8.27 - 2 x 0.333 = 7.60 in` (19.31 cm), wider than the
6.27 in text width. That is why a border measured from the page edge looks "outside the margins": it is, by design.
Changing a margin does not move it.

**Do not assume the border prints where requested.** Printers have non-printable bands (often 0.17-0.25 in) and drivers
differ. If a margin or border distance falls inside that band, Word warns "One or more margins are set outside the
printable area". Always check Print Preview and print a test page.

Overlaps: a border measured from text can overlap a header or footer that lies outside the text area unless
*Surround header/footer* is ticked; a large *Text* distance can reach into images or the printer's non-printable band.

## 9. Choosing safe settings

| Use | Approach | Start with | Check |
|---|---|---|---|
| Reports, assignments | Measure from **Text**, thin line, Surround header/footer on | 4-10 pt | Border clear of header/footer and page numbers; print preview |
| Certificates, decorative | Measure from **Edge of page**, art or thick line | 24 pt, then try 18-31 | Test print on the real printer; nothing cut off |
| Books, bound documents | Measure from Text, gutter set, mirrored margins | 6-12 pt | Check inside edge near the binding on facing pages |

A *visually centred* border is not the same as a *reliably printable* one: a border at 12 pt from the edge may look
centred on screen yet be cut off by a printer whose hardware margin is 0.2 in (14.4 pt).

Problems and fixes:
- Cut off when printed: increase the distance from the edge, or switch to *Text*.
- Too close to the text: with *Text*, increase the distance; with *Edge of page*, increase the margins.
- Overlaps header/footer: *Measure from Text* with Surround header/footer, or move the header/footer.
- Only on some pages: check *Apply to* (first page only / all except first) and section breaks.
- Missing on page 1: *Apply to: All except first page*, or a different first page.
- Moves after section changes: each section has its own border settings; check *Apply to* and the section breaks.

Border or rectangle shape? A page border repeats on every page of the section and follows the page; a rectangle shape
needs anchoring on each page, can be moved by editing, and may print differently. Use a shape only when a custom
design is needed on one page; its position then depends on its anchor and wrapping.

## 10. Professional A4 document (Word 2013)

Order matters: set the page first, then the text, so that layout settings do not undo each other.

1. PAGE LAYOUT → Size → A4.
2. PAGE LAYOUT → Orientation → Portrait.
3. PAGE LAYOUT → Margins → Custom Margins: all four 1 in, Gutter 0, Apply to *Whole document*.
4. Layout tab of Page Setup: Header 0.5 in, Footer 0.5 in; leave *Different first page* off unless needed.
5. HOME: set the body font and size, and paragraph spacing (Line spacing, Spacing After) in the Normal style so all text
   follows it.
6. INSERT → Page Number → Bottom of Page: choose a design. INSERT → Header & Footer for anything else.
7. DESIGN → Page Borders → Box, thin line, Options: measure from Text (or Edge of page), check Apply to.
8. Do not insert section breaks unless you need them (to avoid section-specific margins).

Changing from 1 in to 0.5 in: change margins (Apply to *Whole document*), then check: paragraphs for odd breaks,
headings left at page bottoms, tables (width and AutoFit), pictures (floating anchors), headers and footers (their
distances), and the page border (distance, whether it moved).

## 11. Troubleshooting

| Problem | Likely cause | Check | Fix |
|---|---|---|---|
| Different margins on different pages | Several sections | Show ¶, look for section breaks; Page Setup per section | Apply to Whole document |
| Text too close to the paper edge | Small margins or a printer limit | Page Setup values; print preview | Raise margins; check printer margins |
| Text does not move inward after raising margins | Paragraph indents or a text box | Ruler indents; wrapping | Reset indents; it is not a margin problem |
| Table extends beyond the text area | Fixed width | Table Properties → Table | AutoFit to window or set width |
| Picture overlaps text after margins change | Floating, positioned relative to the page | Picture position and wrapping | Change reference to margin, or move |
| Page border does not move with margins | Measured from the Edge of page | Border Options | Measure from Text |
| Page border prints incompletely | Distance inside the printer's non-printable band | Print preview, test print | Increase the distance |
| Header/footer in the wrong place | Header from Top / Footer from Bottom values | Page Setup → Layout | Adjust the distances |
| Blank page appears | Manual page break, section break or a table at the end | Show ¶ | Delete the break or last empty paragraph |
| Page numbering restarts | Section with "Start at" | Header & Footer → Page Number → Format | Continue from previous section |
| Content jumps pages after a tiny change | Keep with next, page break before, widow control | Paragraph dialog | Adjust these options |
| Print preview and paper differ | Printer driver, fonts, non-printable area | Compare, check the printer | Use the same printer; embed fonts |
| A section has a different orientation | Section-level setting | Page Setup per section | Set it for the section |
| Changing one page's margins changes several | Apply to *This section* covers many pages | Section breaks | Insert section breaks or choose This point forward |
| Margin change affects the wrong pages | Wrong Apply to scope | Page Setup dialog | Reselect scope |

A true layout problem is visible on screen and in Print Preview. A printer limitation appears only on paper (cut-off
borders, shifted edges), usually along the edges.

## 12. Reflow versus scaling

| Action | What it does |
|---|---|
| Reflowing text | Recalculates line and page breaks; no change to size |
| Repositioning floating objects | Moves them only if their reference moves |
| Resizing tables | Only through width/AutoFit settings |
| Resizing pictures and shapes | Manual or via object settings |
| Scaling all content proportionally | Not something Word does (Scale to paper size when printing is separate) |
| Changing page dimensions | New paper; text area and all positions change |
| Changing margins | Moves the text area; reflows |
| Changing font size or spacing | Changes text height and so pagination |

To fit content in a smaller area: reduce margins, set tables to AutoFit, resize pictures, adjust font size and spacing,
review manual breaks, use styles consistently, and check floating objects. Changing margins alone will not do it.

## 13. How the layout engine works

Word stores **content and formatting instructions**: paragraphs, runs of characters, styles, section properties,
table properties, drawing anchors. It does not store a fixed position for every line. When a document is opened,
the layout engine reads the instructions and **calculates**: line breaking, pagination, object wrapping and
position, table cell sizes, headers and footers and the page border. The result (the rendered page) depends on the
fonts available, the page setup and the printer, so it can differ slightly between computers.

In DOCX (a ZIP of XML files): each **section** has `w:sectPr` with the paper size (`w:pgSz`), margins (`w:pgMar`:
top, bottom, left, right, header, footer, gutter), page borders (`w:pgBorders` with `w:offsetFrom` = `page` or
`text`, and `w:space` per side), orientation and columns. **Paragraphs** have `w:pPr` (indents, spacing, keep-with-next,
page-break-before). **Tables** have `w:tblPr` (width, layout fixed/auto, borders) and `w:tcW` per cell. **Drawings**
carry an anchor, a position relative to page/margin/paragraph/column, and wrap settings. None of these is a
"page number plus coordinate" for each line.

## 14. Practical experiments

| # | Setup | Steps | Observe | Why / what it teaches |
|---|---|---|---|---|
| 1 | A4, 1 in margins, 5 pages of text | PAGE LAYOUT → Margins → Narrow | Fewer pages, shorter paragraphs | Reflow, text is not deleted |
| 2 | Same | Margins → Custom: 1.5 in all sides | More pages, text narrower | Margins only move the text area |
| 3 | Add a table (INSERT → Table), fixed width 6 in | Change margins to 2 in | Table sticks out; then set AutoFit to window | Tables follow their own width |
| 4 | An inline and a floating picture (wrapping Square, position relative to Page) | Change margins | Inline moves with text; floating stays | Anchors and reference points |
| 5 | Box page border, 24 pt, Measure from Text | Options → Measure from: Edge of page; then change a margin | Border jumps to the edge; with *Text* it moves with margins, with *Edge of page* it does not | Borders and margins are separate |
| 6 (optional) | Two sections (PAGE LAYOUT → Breaks → Next Page) | Set different margins for each (Apply to This section) | Pages differ | Margins belong to sections |

## 15. Reference table and checklist

| Setting | Controls | Where | Affects body? | Reflows? | Per section? | Scope |
|---|---|---|---|---|---|---|
| Paper size | Paper width/height | PAGE LAYOUT → Size | Yes | Yes | Yes | Section |
| Orientation | Portrait/landscape | PAGE LAYOUT → Orientation | Yes | Yes | Yes | Section |
| Top/Bottom/Left/Right margin | Body boundaries | Margins / Page Setup | Yes | Yes | Yes | Section |
| Gutter, Gutter position | Binding space | Page Setup → Margins | Yes | Yes | Yes | Section |
| Multiple pages | Normal, Mirror, 2 per sheet, Book fold | Page Setup → Margins | Yes | Yes | Yes | Section |
| Header from Top / Footer from Bottom | Header/footer distance | Page Setup → Layout | Indirectly | Maybe | Yes | Section |
| Page border style/width/color | Border look | DESIGN → Page Borders | No | No | Yes | Section |
| Measure from | Edge of page or text | Page Borders → Options | No | No | Yes | Section |
| Border distances | Distance from the reference | Page Borders → Options | No | No | Yes | Section |
| Apply to | Scope | Page Setup / Page Borders | Scope only | - | - | Per dialog |
| Paragraph indentation | Inside the body | PARAGRAPH dialog, ruler | Inside it | Yes | No | Paragraph |
| Paragraph spacing | Space before/after | Paragraph dialog | Yes | Yes | No | Paragraph |
| Table AutoFit | Table width | Table Tools → Layout | No | Yes | No | Table |
| Picture text wrapping | Flow around the object | Picture Tools → Wrap Text | No | Yes | No | Object |
| Section breaks | Start a section | Breaks | No | Yes | - | Structural |
| Page breaks | Force a new page | Insert → Page Break | No | Yes | - | Structural |

Settings that depend on the printer: the printable area, hardware margins, and how a border near the edge prints.

### Final checklist

- [ ] Paper size and orientation are right for the section.
- [ ] Margins set with the correct *Apply to*.
- [ ] No unneeded section breaks (Show ¶).
- [ ] Header and footer distances checked; nothing overlaps.
- [ ] Border: measure-from, distances and *Apply to* set on purpose; checked in Print Preview.
- [ ] Tables are AutoFit or fit the text width.
- [ ] Pictures: inline, or floating with the right reference.
- [ ] A test print on the real printer.

## 16. Notes for the Word Efficiency editor

- The editor's A4 page is 794 x 1123 px (8.27 x 11.69 in at 96 dpi) with 96 px margins: a text area of 602 px
  (6.27 in), as in the table above.
- **Page borders follow Word's Page Border > Options.** DESIGN > Page Borders > choose a Setting > **Options...** opens
  *Border and Shading Options*: Margin Top / Left / Bottom / Right in points (0-31), **Measure from** (Edge of page |
  Text) and, for Text, *Surround header* / *Surround footer*. A new border starts as Word's default **(verify in your
  Word 2013)**: Edge of page, 24 pt. Switching *Measure from* gives the distances that mode's defaults (24 pt from the
  edge, 4 pt from the text) while they are still the old mode's defaults.
  - Edge of page: each distance from the paper's edge; margins play no part (a margin change does not move it).
  - Text: each distance outward from the margins, so it moves with them. A header that is not surrounded stays
    above the border (the border starts below it); the same for the footer.
  - Not offered, because they would do nothing here: *Always display in front*, and the *Apply to* choices other than
    Whole document (the exam document has one section).
- **Saved** inside `pageLayout.border`: `<line>[ measure:text][ gap:T,R,B,L][ nohdr][ noftr][ sides:...]`. A part equal
  to its default is not written, so documents saved before these options mean Edge of page, 24 pt (lib/word-page-border.ts).
- **Marked** through `pageLayout.borderSides` (as before), and, only when it differs from Word's default,
  `pageLayout.borderMeasure` ("page" | "text") and `pageLayout.borderDistance` ("top,right,bottom,left" in points)
  (migration 202610291200). The line's style, colour and width are never marked.
