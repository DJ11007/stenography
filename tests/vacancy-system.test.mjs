import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mapVacancyRow, mapCoursePackageRow, mapFeedbackRow, VACANCY_CATEGORY_LABELS } from "../lib/homepage-content.ts";

test("vacancy row mapping converts snake_case columns to the camelCase shape the UI expects", () => {
  const vacancy = mapVacancyRow({
    slug: "sample-clerk", category: "jobs", title: "Sample Clerk", organization: "RSSB", summary: "Summary", status: "Open",
    important_dates: ["Notification: 1 Jan"], application_fees: ["General: 100"], eligibility: ["Graduate"], age_limit: ["18-40"],
    notification_url: "https://example.com/notice", official_url: null,
    vacancy_breakdown: [{ postName: "Clerk", totalPosts: "10", eligibility: "Graduate" }], useful_links: [{ label: "Result", url: "https://example.com/result" }],
    notice_documents: [{ label: "Notification PDF", url: "https://example.com/notice.pdf" }],
  });
  assert.deepEqual(vacancy, {
    slug: "sample-clerk", category: "jobs", title: "Sample Clerk", organization: "RSSB", summary: "Summary", status: "Open",
    importantDates: ["Notification: 1 Jan"], applicationFees: ["General: 100"], eligibility: ["Graduate"], ageLimit: ["18-40"],
    notificationUrl: "https://example.com/notice", officialUrl: null,
    vacancyBreakdown: [{ postName: "Clerk", totalPosts: "10", eligibility: "Graduate" }], usefulLinks: [{ label: "Result", url: "https://example.com/result" }],
    noticeDocuments: [{ label: "Notification PDF", url: "https://example.com/notice.pdf" }],
  });
  assert.deepEqual(new Set(Object.keys(VACANCY_CATEGORY_LABELS)), new Set(["jobs", "admit-cards", "results"]));
});

test("null array and jsonb columns map to empty arrays instead of null, so the UI never has to guard against it", () => {
  const vacancy = mapVacancyRow({ slug: "x", category: "results", title: "X", organization: "", summary: "", status: "", important_dates: null, application_fees: null, eligibility: null, age_limit: null, notification_url: null, official_url: null, vacancy_breakdown: null, useful_links: null, notice_documents: null });
  assert.deepEqual(vacancy.importantDates, []);
  assert.deepEqual(vacancy.noticeDocuments, []);
  assert.deepEqual(vacancy.applicationFees, []);
  assert.deepEqual(vacancy.eligibility, []);
  assert.deepEqual(vacancy.ageLimit, []);
  assert.deepEqual(vacancy.vacancyBreakdown, []);
  assert.deepEqual(vacancy.usefulLinks, []);
});

test("course package row mapping preserves coupon and popular flags", () => {
  const pkg = mapCoursePackageRow({ id: "1", title: "Complete Course", duration_label: "6 Months", price_label: "₹599", original_price_label: "₹799", features: ["Typing", "Steno"], coupon_code: "SAVE100", coupon_description: "Flat off", is_popular: true });
  assert.equal(pkg.durationLabel, "6 Months");
  assert.equal(pkg.originalPriceLabel, "₹799");
  assert.equal(pkg.couponCode, "SAVE100");
  assert.equal(pkg.isPopular, true);
});

test("feedback row mapping never exposes moderation fields, only public display fields", () => {
  const feedback = mapFeedbackRow({ id: "1", display_name: "Ravi", rating: 5, message: "Great course", created_at: "2026-01-01T00:00:00Z" });
  assert.deepEqual(Object.keys(feedback).sort(), ["createdAt", "displayName", "id", "message", "rating"]);
});

test("vacancy carousel advances every five seconds and preserves student success component", () => {
  const carousel = readFileSync(new URL("../app/_components/vacancy-carousel.tsx", import.meta.url), "utf8");
  const homepage = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(carousel, /setInterval[\s\S]*5000/);
  assert.match(carousel, /Previous vacancy/);
  assert.match(carousel, /Next vacancy/);
  assert.match(homepage, /<StudentSuccessCarousel\s*\/>/);
  assert.match(homepage, /<WhatsAppButton\s*\/>/);
  assert.match(homepage, /<FeedbackSection feedback=\{feedback\} canSubmit=\{Boolean\(user\)\} \/>/);
});
