import test from "node:test";
import assert from "node:assert/strict";
import { splitQuestionParts } from "../lib/question-parts.ts";

test("a question with a), b), c) parts is split into its opening line and one line per part", () => {
  const split = splitQuestionParts("Give above formatting’s to the main documents. a) Set page size to “A5”. b) Set the right margin of page to 0.8 ”. c) Write the text “ SAMRADHI CLASSES ” in the header and give it bold effect.");
  assert.equal(split.intro, "Give above formatting’s to the main documents.");
  assert.deepEqual(split.parts.map(part => part.label), ["a", "b", "c"]);
  assert.equal(split.parts[0].text, "Set page size to “A5”.");
  assert.equal(split.parts[1].text, "Set the right margin of page to 0.8 ”.");
  assert.equal(splitQuestionParts("Do it. a) One. b) Red color .").parts[1].text, "Red color.");
});

test("letters inside words or out of order are not taken as parts", () => {
  // "a)" only counts in sequence; "c)" before "b)" is ignored, and "(x)" in text is not a part.
  const split = splitQuestionParts("Do this. a) First (see note c) here). b) Second.");
  assert.deepEqual(split.parts.map(part => part.label), ["a", "b"]);
  assert.equal(split.parts[0].text, "First (see note c) here).");
});

test("a question without lettered parts is shown as written", () => {
  assert.equal(splitQuestionParts("Set paragraph 2, lower position at 5pt."), null);
  assert.equal(splitQuestionParts("Only a) one part."), null);
  assert.equal(splitQuestionParts(""), null);
  assert.equal(splitQuestionParts(null), null);
});
