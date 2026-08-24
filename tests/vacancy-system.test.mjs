import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { VACANCIES } from "../lib/vacancies.ts";

test("sample vacancies never expose invented external links", () => {
  assert.ok(VACANCIES.length >= 6);
  assert.ok(VACANCIES.every((vacancy) => vacancy.status.toLowerCase().includes("sample")));
  assert.ok(VACANCIES.every((vacancy) => vacancy.notificationUrl === null && vacancy.officialUrl === null));
});

test("jobs, admit cards and results each have linked detail entries", () => {
  assert.deepEqual(new Set(VACANCIES.map(({ category }) => category)), new Set(["jobs", "admit-cards", "results"]));
  assert.equal(new Set(VACANCIES.map(({ slug }) => slug)).size, VACANCIES.length);
  assert.ok(VACANCIES.every(({ importantDates, applicationFees, eligibility, ageLimit }) => importantDates.length && applicationFees.length && eligibility.length && ageLimit.length));
});

test("vacancy carousel advances every five seconds and preserves student success component", () => {
  const carousel = readFileSync(new URL("../app/_components/vacancy-carousel.tsx", import.meta.url), "utf8");
  const homepage = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(carousel, /setInterval[\s\S]*5000/);
  assert.match(carousel, /Previous vacancy/);
  assert.match(carousel, /Next vacancy/);
  assert.match(homepage, /<StudentSuccessCarousel\s*\/>/);
});
