import { APPROVED_WORD_FONTS, SUPPORTED_WORD_COMMANDS, isWordCommandEnabled, normalizeWordEditorCapabilities } from "./word-editor-capabilities.ts";

type JsonObject = Record<string, unknown>;
const V1_BLOCK_TYPES = new Set(["paragraph", "list-item", "table-cell", "page-break"]);
const V2_BLOCK_TYPES = new Set(["paragraph", "list-item", "table", "image", "page-break", "section-break", "cover-page", "header", "footer", "shape"]);
const ALIGNMENTS = new Set(["left", "center", "right", "justify"]);
const FONTS = new Set<string>(APPROVED_WORD_FONTS);
const ROOT_V1 = new Set(["schemaVersion", "blocks", "savedAt"]);
const ROOT_V2 = new Set(["schemaVersion", "blocks", "pageLayout", "operations", "savedAt"]);
const BLOCK_V1 = new Set(["id", "type", "alignment", "runs"]);
const BLOCK_V2 = new Set(["id", "type", "alignment", "runs", "attrs"]);
const RUN_V1 = new Set(["text", "bold", "italic", "underline", "strike", "superscript", "subscript", "fontFamily", "fontSize", "color", "highlight"]);
const RUN_V2 = new Set([...RUN_V1, "underlineStyle", "underlineColor", "underlineThickness", "underlineWordsOnly", "doubleStrike", "href", "bookmark", "field", "smallCaps", "allCaps", "hidden"]);
const UNDERLINE_STYLES=new Set(["single","double","thick","dotted","dashed","dot-dash","dot-dot-dash","wavy","words-only"]);
const PAGE_LAYOUT_KEYS = new Set(["padding", "maxWidth", "aspectRatio", "columnCount", "backgroundColor", "border", "watermark"]);
const COMMON_BLOCK_ATTRS = new Set(["marginLeft", "marginRight", "lineHeight", "marginTop", "marginBottom", "border", "backgroundColor", "hyphens"]);
export const WORD_LIST_STYLES = new Set(["bullet", "bullet-disc", "bullet-circle", "bullet-square", "bullet-diamond", "bullet-arrow", "bullet-check", "decimal", "decimal-paren", "upper-roman", "upper-alpha", "lower-alpha-paren", "lower-alpha", "lower-roman"]);
const ATTRS: Record<string, Set<string>> = {
  paragraph: new Set([...COMMON_BLOCK_ATTRS, "lineNumbers", "dropCap", "specialIndentMode", "specialIndentAmount"]),
  "list-item": new Set([...COMMON_BLOCK_ATTRS, "listStyle", "specialIndentMode", "specialIndentAmount"]),
  table: new Set(["rows", "tableLayout"]), image: new Set(["src", "alt", "width", "height", "localAsset"]),
  "page-break": new Set(["kind"]), "section-break": new Set(["kind"]),
  "cover-page": new Set(COMMON_BLOCK_ATTRS), header: new Set(COMMON_BLOCK_ATTRS), footer: new Set(COMMON_BLOCK_ATTRS),
  shape: new Set(COMMON_BLOCK_ATTRS),
};
const object = (value: unknown): value is JsonObject => Boolean(value && typeof value === "object" && !Array.isArray(value));
const exact = (value: JsonObject, keys: Set<string>) => Object.keys(value).every(key => keys.has(key)) && [...keys].every(key => key in value);
const optionalExact = (value: JsonObject, keys: Set<string>) => Object.keys(value).every(key => keys.has(key));
const nullableString = (value: unknown, max: number) => value === null || (typeof value === "string" && value.length <= max);
const color = (value: unknown) => value === null || (typeof value === "string" && /^(?:[0-9A-Fa-f]{6}|[A-Za-z]{1,30})$/.test(value));
const safeLink = (value: string) => /^(?:https?:\/\/[^\s]+|mailto:[^\s@]+@[^\s@]+|#bookmark-[A-Za-z0-9_-]{1,50})$/i.test(value) && !/^\/\//.test(value);

export function validateWordEditorDocument(value: unknown) {
  if (!object(value) || !["1", "2"].includes(String(value.schemaVersion))) throw new Error("Invalid structured document snapshot.");
  const version = String(value.schemaVersion);
  if (!exact(value, version === "1" ? ROOT_V1 : ROOT_V2) || !Array.isArray(value.blocks) || value.blocks.length < 1 || value.blocks.length > 1000 || typeof value.savedAt !== "string" || value.savedAt.length > 64 || !Number.isFinite(Date.parse(value.savedAt))) throw new Error("Invalid structured document snapshot.");
  if (version === "2") { validatePageLayout(value.pageLayout); validateOperations(value.operations); }
  const ids = new Set<string>(); let runs = 0, text = 0, imageCount = 0, imageBytes = 0;
  for (const block of value.blocks) {
    if (!object(block) || !exact(block, version === "1" ? BLOCK_V1 : BLOCK_V2) || typeof block.id !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/.test(block.id) || ids.has(block.id)) throw new Error("Invalid or duplicate structured document block ID.");
    ids.add(block.id);
    const types = version === "1" ? V1_BLOCK_TYPES : V2_BLOCK_TYPES;
    if (typeof block.type !== "string" || !types.has(block.type) || typeof block.alignment !== "string" || !ALIGNMENTS.has(block.alignment) || !Array.isArray(block.runs) || block.runs.length < 1 || block.runs.length > 500) throw new Error("Invalid structured document block.");
    if (version === "2") { const media = validateAttrs(block.attrs, block.type); imageCount += media.count; imageBytes += media.bytes; }
    for (const run of block.runs) {
      runs++; if (runs > 20000 || !object(run) || !(version==="1"?exact(run,RUN_V1):validV2Run(run)) || typeof run.text !== "string" || run.text.length > 200000) throw new Error("Invalid structured document run.");
      text += run.text.length; if (text > 1000000) throw new Error("Structured document is too large.");
      for (const flag of ["bold", "italic", "underline", "strike", "superscript", "subscript"] as const) if (typeof run[flag] !== "boolean") throw new Error("Invalid structured document mark.");
      if (version === "2" && typeof run.doubleStrike !== "boolean") throw new Error("Invalid double-strikethrough mark.");
      if (version === "2") for (const flag of ["smallCaps", "allCaps", "hidden"] as const) if (flag in run && typeof run[flag] !== "boolean") throw new Error("Invalid structured document mark.");
      if(version==="2"&&("underlineStyle"in run||"underlineColor"in run||"underlineThickness"in run||"underlineWordsOnly"in run)&&(run.underlineStyle!==null&&(typeof run.underlineStyle!=="string"||!UNDERLINE_STYLES.has(run.underlineStyle))||!color(run.underlineColor)||(run.underlineThickness!==null&&(typeof run.underlineThickness!=="number"||run.underlineThickness<1||run.underlineThickness>5))||typeof run.underlineWordsOnly!=="boolean"))throw new Error("Invalid structured underline style.");
      if (run.fontFamily !== null && (typeof run.fontFamily !== "string" || !FONTS.has(run.fontFamily))) throw new Error("Invalid structured document font.");
      if (run.fontSize !== null && (typeof run.fontSize !== "number" || !Number.isFinite(run.fontSize) || run.fontSize < 8 || run.fontSize > 72)) throw new Error("Invalid structured document font size.");
      if (!color(run.color) || !color(run.highlight)) throw new Error("Invalid structured document color.");
      if (version === "2") validateRunLinkFields(run);
    }
  }
  if (imageCount > 20 || imageBytes > 1024 * 1024) throw new Error("Embedded image count or total size exceeds the safe limit.");
  if (JSON.stringify(value).length > 2097152) throw new Error("Structured document is too large.");
  return value;
}

export function validateWordEditorOperations(value: unknown, capabilities: unknown) {
  const document = validateWordEditorDocument(value) as JsonObject;
  if (String(document.schemaVersion) === "1") return document;
  const normalized = normalizeWordEditorCapabilities(capabilities);
  for (const operation of document.operations as string[]) if (!isWordCommandEnabled(normalized, operation)) throw new Error(`Editor command ${operation} is disabled for this test version.`);
  return document;
}

function validV2Run(run:JsonObject){return optionalExact(run,RUN_V2)&&[...RUN_V1].every(key=>key in run)&&["doubleStrike","href","bookmark","field"].every(key=>key in run)}
function validateOperations(value: unknown) {
  if (!Array.isArray(value) || value.length > 256 || new Set(value).size !== value.length || value.some(item => typeof item !== "string" || !SUPPORTED_WORD_COMMANDS.has(item))) throw new Error("Invalid editor operation history.");
}
const MARGIN_VALUE = String.raw`\d{1,2}(?:\.\d{1,2})?mm`;
const MARGIN_PATTERN = new RegExp(`^${MARGIN_VALUE}$|^(?:${MARGIN_VALUE} ){3}${MARGIN_VALUE}$`);
function validatePageLayout(value: unknown) {
  if (!object(value) || !exact(value, PAGE_LAYOUT_KEYS)) throw new Error("Invalid page layout.");
  for (const [key, item] of Object.entries(value)) if (!nullableString(item, key === "watermark" ? 40 : 100)) throw new Error(`Invalid page layout ${key}.`);
  if (typeof value.padding === "string" && !MARGIN_PATTERN.test(value.padding)) throw new Error("Invalid page margins.");
  if (typeof value.columnCount === "string" && !/^[1-3]$/.test(value.columnCount)) throw new Error("Invalid page columns.");
  if (typeof value.backgroundColor === "string" && !/^(?:#[0-9A-Fa-f]{6}|[0-9A-Fa-f]{6})$/.test(value.backgroundColor)) throw new Error("Invalid page color.");
}
function validateRunLinkFields(run: JsonObject) {
  if (!nullableString(run.href, 2048) || !nullableString(run.bookmark, 50) || !nullableString(run.field, 30)) throw new Error("Invalid link or field metadata.");
  if (typeof run.href === "string" && !safeLink(run.href)) throw new Error("Unsafe hyperlink protocol.");
  if (typeof run.bookmark === "string" && !/^[A-Za-z0-9_-]{1,50}$/.test(run.bookmark)) throw new Error("Invalid bookmark.");
  if (typeof run.field === "string" && !["page-number", "date-time", "symbol", "special-character"].includes(run.field) && !/^page-number\|(top|bottom|current)\|(left|center|right)$/.test(run.field)) throw new Error("Invalid document field.");
}
function validateAttrs(value: unknown, type: string) {
  if (!object(value) || !optionalExact(value, ATTRS[type] ?? new Set())) throw new Error(`Invalid ${type} attributes.`);
  if (type === "table") {
    if (!Array.isArray(value.rows) || value.rows.length < 1 || value.rows.length > 50 || value.rows.some(row => !Array.isArray(row) || row.length < 1 || row.length > 20 || row.some(cell => typeof cell !== "string" || cell.length > 10000))) throw new Error("Invalid table structure.");
    if ("tableLayout" in value && !["auto", "fixed", "window"].includes(String(value.tableLayout))) throw new Error("Invalid table layout.");
  } else if (type === "image") {
    if (typeof value.src !== "string" || !(/^(?:data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+={0,2}|asset:samradhi-mark)$/.test(value.src))) throw new Error("Unsafe embedded image.");
    if (typeof value.alt !== "string" || value.alt.length > 200 || typeof value.width !== "number" || typeof value.height !== "number" || !Number.isInteger(value.width) || !Number.isInteger(value.height) || value.width < 1 || value.height < 1 || value.width > 6000 || value.height > 6000 || typeof value.localAsset !== "boolean") throw new Error("Invalid embedded image metadata.");
    if (value.src === "asset:samradhi-mark" && value.localAsset !== true) throw new Error("Invalid local image asset.");
    const payload = value.src === "asset:samradhi-mark" ? "" : value.src.slice(value.src.indexOf(",") + 1); const bytes = payload ? Math.floor(payload.length * 3 / 4) - (payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0) : 0;
    if ((value.src !== "asset:samradhi-mark" && bytes < 1) || bytes > 512 * 1024) throw new Error("Embedded image is too large.");
    return { count: 1, bytes };
  } else {
    for (const [key, item] of Object.entries(value)) {
      if (["lineNumbers", "dropCap"].includes(key) && typeof item !== "boolean") throw new Error(`Invalid ${key} attribute.`);
      if (key === "listStyle" && !WORD_LIST_STYLES.has(String(item))) throw new Error("Invalid list style.");
      if (key === "kind" && !["page", "blank-page", "section-next-page", "section-continuous"].includes(String(item))) throw new Error("Invalid break type.");
      if (key === "specialIndentMode" && !["none", "firstLine", "hanging"].includes(String(item))) throw new Error("Invalid special indent mode.");
      if (!["lineNumbers", "dropCap"].includes(key) && item !== null && typeof item !== "string") throw new Error(`Invalid ${key} attribute.`);
      if (typeof item === "string" && item.length > 100) throw new Error(`Invalid ${key} attribute.`);
    }
  }
  return { count: 0, bytes: 0 };
}
