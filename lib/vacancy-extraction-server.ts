import "server-only";
import { htmlToPlainText, isFetchableExternalUrl, parseVacancyExtractionResponse, VACANCY_EXTRACTION_PROMPT, type ExtractedVacancyDraft } from "./vacancy-extraction";

const GEMINI_MODEL = "gemini-3.6-flash";

export type VacancyExtractionResult = { ok: true; draft: ExtractedVacancyDraft } | { ok: false; error: string };

async function callGemini(parts: ({ text: string } | { inline_data: { mime_type: string; data: string } })[]): Promise<VacancyExtractionResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { ok: false, error: "AI extraction is not configured yet. Add GEMINI_API_KEY to the environment to enable it." };

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseMimeType: "application/json", temperature: 0.1 } }),
  }).catch((error: unknown) => { throw new Error(error instanceof Error ? `Could not reach the AI extraction service: ${error.message}` : "Could not reach the AI extraction service."); });

  if (!response.ok) {
    const bodyText = await response.text().catch(() => "");
    if (response.status === 400 && /API key not valid/i.test(bodyText)) return { ok: false, error: "The configured GEMINI_API_KEY is invalid." };
    if (response.status === 429) return { ok: false, error: "The free Gemini quota was reached. Try again in a minute, or extract fewer documents at once." };
    console.error("[Vacancy AI extraction] Gemini request failed", response.status, bodyText.slice(0, 500));
    return { ok: false, error: "AI extraction failed. You can still fill the form in manually." };
  }

  const payload = await response.json().catch(() => null) as { candidates?: { content?: { parts?: { text?: string }[] } }[] } | null;
  const text = payload?.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
  const draft = parseVacancyExtractionResponse(text);
  if (!draft) return { ok: false, error: "The AI response could not be understood. You can still fill the form in manually." };
  return { ok: true, draft };
}

export async function extractVacancyFromDocument(bytes: Uint8Array, mimeType: string): Promise<VacancyExtractionResult> {
  const base64 = Buffer.from(bytes).toString("base64");
  return callGemini([{ text: VACANCY_EXTRACTION_PROMPT }, { inline_data: { mime_type: mimeType, data: base64 } }]);
}

const MAX_URL_FETCH_BYTES = 5 * 1024 * 1024;

export async function extractVacancyFromUrl(pageUrl: string): Promise<VacancyExtractionResult> {
  if (!isFetchableExternalUrl(pageUrl)) return { ok: false, error: "That link is not allowed. Use a public http:// or https:// URL." };
  let response: Response;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    response = await fetch(pageUrl, { signal: controller.signal, headers: { "User-Agent": "Mozilla/5.0 (compatible; SamradhiClassesBot/1.0)" } });
    clearTimeout(timeout);
  } catch (error) {
    return { ok: false, error: error instanceof Error && error.name === "AbortError" ? "The page took too long to respond." : "Could not fetch that page." };
  }
  if (!response.ok) return { ok: false, error: `The page returned an error (HTTP ${response.status}). Check the link.` };
  const contentLength = Number(response.headers.get("content-length") ?? "0");
  if (contentLength > MAX_URL_FETCH_BYTES) return { ok: false, error: "That page is too large to read." };
  const html = await response.text();
  if (html.length > MAX_URL_FETCH_BYTES) return { ok: false, error: "That page is too large to read." };
  const text = htmlToPlainText(html);
  if (text.length < 50) return { ok: false, error: "Could not find readable text on that page." };
  return callGemini([{ text: `${VACANCY_EXTRACTION_PROMPT}\n\nThe document text follows, extracted from a web page:\n\n${text}` }]);
}
