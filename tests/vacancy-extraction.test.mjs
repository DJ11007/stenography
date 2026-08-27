import assert from "node:assert/strict";
import test from "node:test";
import { parseVacancyExtractionResponse, VACANCY_EXTRACTION_PROMPT, isFetchableExternalUrl, htmlToPlainText } from "../lib/vacancy-extraction.ts";

test("parses a well-formed extraction response into the expected draft shape", () => {
  const raw = JSON.stringify({
    category: "jobs", title: "RRB NTPC 10+2 Recruitment 2025", organization: "Railway Recruitment Board",
    summary: "Recruitment for various non-technical posts.", status: "Applications open",
    importantDates: ["Application Begin: 28/10/2025", "Last Date: 04/12/2025"],
    applicationFees: ["General/OBC/EWS: 500/-"], eligibility: ["10+2 Intermediate Passed"], ageLimit: ["Minimum Age: 18 Years"],
    notificationUrl: "https://example.com/notice.pdf", officialUrl: "https://example.com/apply",
    vacancyBreakdown: [{ postName: "Commercial Cum Ticket Clerk", totalPosts: "2424", eligibility: "12th pass" }],
    usefulLinks: [{ label: "Download RRB Ajmer Result", url: "https://example.com/ajmer" }],
  });
  const draft = parseVacancyExtractionResponse(raw);
  assert.ok(draft);
  assert.equal(draft.category, "jobs");
  assert.equal(draft.title, "RRB NTPC 10+2 Recruitment 2025");
  assert.equal(draft.importantDates.length, 2);
  assert.equal(draft.vacancyBreakdown[0].postName, "Commercial Cum Ticket Clerk");
  assert.equal(draft.usefulLinks[0].url, "https://example.com/ajmer");
});

test("tolerates the model wrapping JSON in prose or markdown fences", () => {
  const raw = "Here is the extracted data:\n```json\n" + JSON.stringify({ category: "results", title: "X", organization: "", summary: "", status: "", importantDates: [], applicationFees: [], eligibility: [], ageLimit: [], notificationUrl: null, officialUrl: null, vacancyBreakdown: [], usefulLinks: [] }) + "\n```";
  const draft = parseVacancyExtractionResponse(raw);
  assert.ok(draft);
  assert.equal(draft.category, "results");
});

test("rejects an unparseable or non-JSON response instead of throwing", () => {
  assert.equal(parseVacancyExtractionResponse("Sorry, I could not read this document."), null);
  assert.equal(parseVacancyExtractionResponse(""), null);
});

test("defends against a hallucinated invalid category, non-string array items, and unsafe URLs", () => {
  const raw = JSON.stringify({
    category: "not-a-real-category", title: "X", organization: "Y", summary: "Z", status: "S",
    importantDates: ["ok", 42, null, "  "], applicationFees: "not-an-array", eligibility: [], ageLimit: [],
    notificationUrl: "javascript:alert(1)", officialUrl: "ftp://example.com/file",
    vacancyBreakdown: [{ postName: "Clerk" }, { postName: "", totalPosts: "5", eligibility: "" }],
    usefulLinks: [{ label: "No URL" }, { label: "Bad protocol", url: "javascript:alert(1)" }],
  });
  const draft = parseVacancyExtractionResponse(raw);
  assert.ok(draft);
  assert.equal(draft.category, "jobs");
  assert.deepEqual(draft.importantDates, ["ok"]);
  assert.deepEqual(draft.applicationFees, []);
  assert.equal(draft.notificationUrl, null);
  assert.equal(draft.officialUrl, null);
  assert.deepEqual(draft.vacancyBreakdown, [{ postName: "Clerk", totalPosts: "", eligibility: "" }]);
  assert.equal(draft.usefulLinks.length, 0);
});

test("caps runaway array lengths and string lengths from a misbehaving model", () => {
  const raw = JSON.stringify({
    category: "jobs", title: "X".repeat(5000), organization: "", summary: "", status: "",
    importantDates: Array.from({ length: 200 }, (_, i) => `Date ${i}`), applicationFees: [], eligibility: [], ageLimit: [],
    notificationUrl: null, officialUrl: null, vacancyBreakdown: [], usefulLinks: [],
  });
  const draft = parseVacancyExtractionResponse(raw);
  assert.ok(draft);
  assert.ok(draft.title.length <= 300);
  assert.ok(draft.importantDates.length <= 40);
});

test("the extraction prompt instructs the model to never invent dates, fees, or URLs, and to paraphrase rather than copy", () => {
  assert.match(VACANCY_EXTRACTION_PROMPT, /[Nn]ever invent/);
  assert.match(VACANCY_EXTRACTION_PROMPT, /"jobs" \| "admit-cards" \| "results"/);
  assert.match(VACANCY_EXTRACTION_PROMPT, /do not copy sentences verbatim/i);
});

test("isFetchableExternalUrl allows ordinary public http(s) links and rejects everything else", () => {
  assert.equal(isFetchableExternalUrl("https://www.sarkariresult.com/2026/ctet-september-2026/"), true);
  assert.equal(isFetchableExternalUrl("http://example.com/page"), true);
  assert.equal(isFetchableExternalUrl("ftp://example.com/file"), false);
  assert.equal(isFetchableExternalUrl("javascript:alert(1)"), false);
  assert.equal(isFetchableExternalUrl("not a url"), false);
});

test("isFetchableExternalUrl blocks localhost and private/internal network addresses (SSRF guard)", () => {
  for (const url of [
    "http://localhost/admin",
    "http://127.0.0.1:5432",
    "http://0.0.0.0",
    "http://10.0.0.5/internal",
    "http://192.168.1.1/router",
    "http://172.16.0.1/internal",
    "http://169.254.169.254/latest/meta-data",
    "http://[::1]/",
  ]) {
    assert.equal(isFetchableExternalUrl(url), false, `expected ${url} to be blocked`);
  }
  // A public 172.x address outside the private 172.16-31 range must still be allowed.
  assert.equal(isFetchableExternalUrl("http://172.64.0.1/"), true);
});

test("htmlToPlainText strips tags, scripts, and styles while preserving readable text and line breaks", () => {
  const html = `<html><head><style>.x{color:red}</style><script>alert(1)</script></head><body><h1>SSC CHSL Recruitment 2025</h1><p>Application Begin: 28/10/2025</p><p>Last Date &amp; Fee: 500/-</p></body></html>`;
  const text = htmlToPlainText(html);
  assert.doesNotMatch(text, /<[^>]+>/);
  assert.doesNotMatch(text, /alert\(1\)/);
  assert.doesNotMatch(text, /color:red/);
  assert.match(text, /SSC CHSL Recruitment 2025/);
  assert.match(text, /Application Begin: 28\/10\/2025/);
  assert.match(text, /Last Date & Fee: 500\/-/);
});

test("htmlToPlainText caps output length for very large pages", () => {
  const html = `<p>${"a".repeat(200000)}</p>`;
  assert.ok(htmlToPlainText(html, 1000).length <= 1000);
});
