import assert from"node:assert/strict";import test from"node:test";
import{parseRandCommand,generateRandomParagraphs,DEFAULT_RAND,MAX_RAND_PARAGRAPHS,MAX_RAND_LINES}from"../lib/word-random-text.ts";

test("=rand() means 5 paragraphs of 4 lines; =rand(6,3) means 6 paragraphs of 3 lines",()=>{
 assert.deepEqual(parseRandCommand("=rand()"),{paragraphs:5,lines:4});
 assert.deepEqual(DEFAULT_RAND,{paragraphs:5,lines:4});
 assert.deepEqual(parseRandCommand("=rand(6,3)"),{paragraphs:6,lines:3});
 assert.deepEqual(parseRandCommand("=rand(2)"),{paragraphs:2,lines:4},"one number is the paragraph count");
});

test("the command is forgiving about case and spaces but strict about everything else",()=>{
 assert.deepEqual(parseRandCommand("  =RAND( 3 , 2 )  "),{paragraphs:3,lines:2});
 for(const bad of["rand()","=rand","=rand(,)","=rand(a)","=rand(3,2,1)","=random()","hello =rand()","=rand()x","=rand(0)","=rand(3,0)",""])assert.equal(parseRandCommand(bad),null,bad);
});

test("absurd sizes are capped",()=>{
 assert.deepEqual(parseRandCommand("=rand(999,999)"),{paragraphs:MAX_RAND_PARAGRAPHS,lines:MAX_RAND_LINES});
});

test("it generates the requested number of paragraphs, each with the requested number of lines (sentences)",()=>{
 const text=generateRandomParagraphs(6,3);
 assert.equal(text.length,6);
 for(const paragraph of text)assert.equal((paragraph.match(/\.(\s|$)/g)||[]).length,3,paragraph);
 assert.equal(generateRandomParagraphs(5,4).length,5);
});

test("each line is about a line's worth of words, and a paragraph never repeats a sentence",()=>{
 const text=generateRandomParagraphs(10,4);
 for(const paragraph of text){
  const sentences=paragraph.split(/(?<=\.)\s+/);
  assert.equal(new Set(sentences).size,sentences.length,"no repeated sentence");
  for(const sentence of sentences){const words=sentence.split(/\s+/).length;assert.ok(words>=9&&words<=26,`${words} words: ${sentence}`);assert.match(sentence,/^[A-Z]/)}
 }
});

test("it is random: different runs differ, but a fixed random source is repeatable",()=>{
 assert.notDeepEqual(generateRandomParagraphs(5,4),generateRandomParagraphs(5,4));
 let seed=7;const rng=()=>(seed=(seed*16807)%2147483647)/2147483647;
 let seed2=7;const rng2=()=>(seed2=(seed2*16807)%2147483647)/2147483647;
 assert.deepEqual(generateRandomParagraphs(3,2,"English",rng),generateRandomParagraphs(3,2,"English",rng2));
});

test("Hindi tests get Devanagari text",()=>{
 const text=generateRandomParagraphs(2,3,"Hindi");
 assert.equal(text.length,2);for(const paragraph of text)assert.match(paragraph,/[ऀ-ॿ]/);
});
