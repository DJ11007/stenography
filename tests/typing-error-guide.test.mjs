import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildErrorGuide, guidePenaltyTotal } from "../lib/typing-error-guide.ts";
import { segmentGraphemes } from "../lib/typing-language.ts";
import { calculateTypingScore } from "../lib/typing-test.ts";

const profile={fullErrorPenalty:1.75,halfErrorPenalty:.35,minorSpellingMaxDistance:1,passNetWpm:35,passAccuracy:90,capitalizationErrors:true};

test("guide classifications and custom penalties match the scoring engine",()=>{
  const guide=buildErrorGuide(profile,"en");
  for(const key of ["missing","substituted","extra","repeated"]){const row=guide.find(item=>item.key===key);assert.equal(row?.kind,"full");assert.equal(row?.penalty,profile.fullErrorPenalty);}
  for(const key of ["minorSpelling","capitalization","spacing","punctuation"]){const row=guide.find(item=>item.key===key);assert.equal(row?.kind,"half");assert.equal(row?.penalty,profile.halfErrorPenalty);}
  const score=calculateTypingScore({passage:"Hello, one two three",typedText:"hello one one free bonus",elapsedSeconds:60,wordMethod:"spaces",scoringProfile:profile,includeUntypedWords:true});
  assert.equal(guidePenaltyTotal(score.analysis.entries,profile,"en"),score.analysis.totalPenalty);
});

test("disabled spelling tolerance displays and scores minor spelling as substitution",()=>{
  const strict={...profile,minorSpellingMaxDistance:0};
  const row=buildErrorGuide(strict,"en").find(item=>item.key==="minorSpelling");
  assert.equal(row?.kind,"full");assert.equal(row?.penalty,strict.fullErrorPenalty);
  const score=calculateTypingScore({passage:"correct",typedText:"corect",elapsedSeconds:60,wordMethod:"spaces",scoringProfile:strict,includeUntypedWords:true});
  assert.equal(score.analysis.counts.substituted,1);assert.equal(score.analysis.halfErrors,0);
});

test("capitalization is absent and disabled for Hindi Unicode and Kruti Dev",()=>{
  const hindi={...profile,capitalizationErrors:false};
  assert.equal(buildErrorGuide(hindi,"hi").some(item=>item.key==="capitalization"),false);
  const legacy=calculateTypingScore({passage:"Hkkjr",typedText:"hkkjr",elapsedSeconds:60,wordMethod:"spaces",scoringProfile:hindi,includeUntypedWords:true});
  assert.equal(legacy.analysis.categoryCounts.capitalization,0);
});

test("Hindi matra and conjunct examples are grapheme-aware",()=>{
  assert.deepEqual(segmentGraphemes("ओर"),["ओ","र"]);
  assert.ok(segmentGraphemes("कृत्रिम").length<[..."कृत्रिम"].length);
  assert.ok(segmentGraphemes("खिलाड़ियों").some(grapheme=>grapheme.includes("ड़")));
});

test("on-screen and printed guides use one shared definition source",async()=>{
  const [component,css]=await Promise.all([readFile(new URL("../app/typing/_components/advanced-typing-results.tsx",import.meta.url),"utf8"),readFile(new URL("../app/globals.css",import.meta.url),"utf8")]);
  assert.match(component,/Error Representation &amp; Scoring Guide/);
  assert.match(component,/buildErrorGuide\(profile,textLanguage\)/);
  assert.match(component,/guidePenaltyTotal\(entries,profile,textLanguage\)/);
  assert.match(component,/Detailed Passage Comparison/);
  assert.match(component,/details open className="error-scoring-guide/);
  assert.match(component,/Capitalization does not apply to Hindi/);
  assert.match(component,/कृति्रम/);assert.match(component,/खिलाड़यिों/);
  assert.match(css,/@media print[\s\S]*details\.error-scoring-guide > \*/);
});
