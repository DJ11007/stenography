import test from "node:test";
import assert from "node:assert/strict";
import { buildFindRegex, DEFAULT_FIND_OPTIONS } from "../lib/word-find-replace.ts";

const options = (overrides = {}) => ({ ...DEFAULT_FIND_OPTIONS, ...overrides });

test("an empty needle produces no regex", () => {
  assert.equal(buildFindRegex("", options()), null);
});

test("plain search is case-insensitive by default and matches a literal substring", () => {
  const regex = buildFindRegex("cat", options());
  assert.match("The CAT sat", regex);
  assert.equal("The CAT sat".match(regex)[0], "CAT");
});

test("Match case makes the search case-sensitive", () => {
  const regex = buildFindRegex("cat", options({ matchCase: true }));
  assert.doesNotMatch("The CAT sat", regex);
  assert.match("The cat sat", regex);
});

test("Find whole words only rejects a substring inside a larger word", () => {
  const regex = buildFindRegex("cat", options({ wholeWord: true }));
  assert.doesNotMatch("concatenate", regex);
  assert.match("the cat sat", regex);
});

test("special regex characters in the needle are escaped, not treated as regex syntax", () => {
  const regex = buildFindRegex("3.5", options());
  assert.doesNotMatch("3x5", regex);
  assert.match("Price: 3.5 rupees", regex);
});

test("Match prefix requires a word boundary before the match but not after", () => {
  const regex = buildFindRegex("extra", options({ matchPrefix: true }));
  assert.match("extraordinary", regex);
  assert.doesNotMatch("flextra", regex);
});

test("Match suffix requires a word boundary after the match but not before", () => {
  const regex = buildFindRegex("tion", options({ matchSuffix: true }));
  assert.match("nation", regex);
  assert.doesNotMatch("tionary", regex);
});

test("Ignore white-space characters lets the needle match across intervening spaces", () => {
  const regex = buildFindRegex("helloworld", options({ ignoreWhitespace: true }));
  assert.match("hello   world", regex);
  assert.match("helloworld", regex);
});

test("Ignore punctuation characters lets the needle match across intervening punctuation", () => {
  const regex = buildFindRegex("abc", options({ ignorePunctuation: true }));
  assert.match("a.b-c", regex);
  assert.match("a,b;c", regex);
});

test("Use wildcards treats the needle as a raw regex fragment (Any Digit / Any Character tokens)", () => {
  const digit = buildFindRegex("[0-9]+", options({ wildcards: true }));
  assert.match("Room 42", digit);
  const anyChar = buildFindRegex("c.t", options({ wildcards: true }));
  assert.match("cat", anyChar);
  assert.match("cot", anyChar);
});

test("an invalid wildcard pattern returns null instead of throwing", () => {
  assert.equal(buildFindRegex("[unterminated", options({ wildcards: true })), null);
});

test("the global flag is only added when explicitly requested (for Replace All)", () => {
  const single = buildFindRegex("a", options());
  assert.equal(single.flags.includes("g"), false);
  const global = buildFindRegex("a", options(), true);
  assert.equal(global.flags.includes("g"), true);
});
