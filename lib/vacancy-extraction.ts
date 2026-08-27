export type ExtractedVacancyDraft = {
  category: "jobs" | "admit-cards" | "results";
  title: string;
  organization: string;
  summary: string;
  status: string;
  importantDates: string[];
  applicationFees: string[];
  eligibility: string[];
  ageLimit: string[];
  notificationUrl: string | null;
  officialUrl: string | null;
  vacancyBreakdown: { postName: string; totalPosts: string; eligibility: string }[];
  usefulLinks: { label: string; url: string }[];
};

export const VACANCY_EXTRACTION_PROMPT = `You are reading an Indian government job/exam notice (a recruitment notification, admit card notice, or result notice), from an uploaded document image or PDF page. Extract the information into this exact JSON shape and return ONLY the JSON, no other text:

{
  "category": "jobs" | "admit-cards" | "results",
  "title": string (short notice title, e.g. "RRB NTPC 10+2 Recruitment 2025"),
  "organization": string (the recruiting board/authority name),
  "summary": string (1-2 sentence plain summary),
  "status": string (short current-status phrase, e.g. "Applications open"),
  "importantDates": string[] (each entry like "Application Begin: 28/10/2025"),
  "applicationFees": string[] (each entry like "General/OBC/EWS: 500/-"),
  "eligibility": string[] (each entry a plain eligibility requirement),
  "ageLimit": string[] (each entry like "Minimum Age: 18 Years"),
  "notificationUrl": string or null (only if an actual URL is visible in the document, never invent one),
  "officialUrl": string or null (only if an actual URL is visible in the document, never invent one),
  "vacancyBreakdown": [{ "postName": string, "totalPosts": string, "eligibility": string }] (post-wise vacancy table if present, else []),
  "usefulLinks": [{ "label": string, "url": string }] (only links with a visible URL text in the document, else [])
}

Only use information actually present in the document. Never invent dates, fees, or URLs. If a field is not present, use an empty string, empty array, or null as appropriate. Write the "summary" field as your own short paraphrase of the facts — do not copy sentences verbatim from the source.`;

const BLOCKED_HOSTNAME_PATTERNS = [/^localhost$/i, /^127\./, /^0\.0\.0\.0$/, /^10\./, /^192\.168\./, /^169\.254\./, /^\[?::1\]?$/, /^\[?fc/i, /^\[?fe80/i];
function isPrivateHostname(hostname: string): boolean {
  if (BLOCKED_HOSTNAME_PATTERNS.some((pattern) => pattern.test(hostname))) return true;
  const octets = hostname.match(/^(\d{1,3})\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/);
  if (octets) { const first = Number(octets[1]), second = Number(octets[2]); if (first === 172 && second >= 16 && second <= 31) return true; }
  return false;
}

/** Basic SSRF guard: only allow http(s) URLs pointing somewhere that isn't obviously local/internal infrastructure. */
export function isFetchableExternalUrl(value: string): boolean {
  let url: URL;
  try { url = new URL(value); } catch { return false; }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  return !isPrivateHostname(url.hostname);
}

/** Strips tags/scripts/styles from HTML into plain readable text, bounded in length. Not a full HTML parser — just enough to hand a page's visible text to an extraction model. */
export function htmlToPlainText(html: string, maxLength = 50000): string {
  const withoutNoise = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
  const withBreaks = withoutNoise.replace(/<(br|p|div|tr|li|h[1-6])[^>]*>/gi, "\n");
  const stripped = withBreaks.replace(/<[^>]+>/g, " ");
  const decoded = stripped
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  return decoded.replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim().slice(0, maxLength);
}

function asStringArray(value: unknown, max = 40): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, max).map((item) => item.trim().slice(0, 500));
}

function asSafeUrl(value: unknown): string | null {
  return typeof value === "string" && /^https?:\/\/\S+$/i.test(value.trim()) ? value.trim().slice(0, 2000) : null;
}

export function parseVacancyExtractionResponse(rawText: string): ExtractedVacancyDraft | null {
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  let parsed: unknown;
  try { parsed = JSON.parse(jsonMatch[0]); } catch { return null; }
  if (!parsed || typeof parsed !== "object") return null;
  const record = parsed as Record<string, unknown>;
  const category = record.category === "admit-cards" || record.category === "results" ? record.category : "jobs";
  const vacancyBreakdown = Array.isArray(record.vacancyBreakdown)
    ? record.vacancyBreakdown.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
        .slice(0, 60)
        .map((item) => ({
          postName: typeof item.postName === "string" ? item.postName.trim().slice(0, 200) : "",
          totalPosts: typeof item.totalPosts === "string" ? item.totalPosts.trim().slice(0, 50) : String(item.totalPosts ?? "").slice(0, 50),
          eligibility: typeof item.eligibility === "string" ? item.eligibility.trim().slice(0, 300) : "",
        })).filter((row) => row.postName)
    : [];
  const usefulLinks = Array.isArray(record.usefulLinks)
    ? record.usefulLinks.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
        .slice(0, 60)
        .map((item) => ({ label: typeof item.label === "string" ? item.label.trim().slice(0, 200) : "", url: asSafeUrl(item.url) ?? "" }))
        .filter((row) => row.label && row.url)
    : [];
  return {
    category,
    title: typeof record.title === "string" ? record.title.trim().slice(0, 300) : "",
    organization: typeof record.organization === "string" ? record.organization.trim().slice(0, 300) : "",
    summary: typeof record.summary === "string" ? record.summary.trim().slice(0, 1000) : "",
    status: typeof record.status === "string" ? record.status.trim().slice(0, 200) : "",
    importantDates: asStringArray(record.importantDates),
    applicationFees: asStringArray(record.applicationFees),
    eligibility: asStringArray(record.eligibility),
    ageLimit: asStringArray(record.ageLimit),
    notificationUrl: asSafeUrl(record.notificationUrl),
    officialUrl: asSafeUrl(record.officialUrl),
    vacancyBreakdown,
    usefulLinks,
  };
}
