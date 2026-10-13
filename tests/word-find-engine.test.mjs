import assert from"node:assert/strict";import test from"node:test";
import{findMatches,translateNeedle,expandReplacement,soundex,wordForms,DEFAULT_ENGINE_OPTIONS as D}from"../lib/word-find-engine.ts";

const find=(text,needle,over={})=>findMatches(text,needle,{...D,...over}).map(m=>text.slice(m.index,m.index+m.length));

test("plain text: case-insensitive by default, Match case honoured",()=>{
 assert.deepEqual(find("Apple apple APPLE","apple"),["Apple","apple","APPLE"]);
 assert.deepEqual(find("Apple apple APPLE","apple",{matchCase:true}),["apple"]);
});

test("whole word, prefix and suffix",()=>{
 const text="cat catalog concat cat.";
 assert.deepEqual(find(text,"cat",{wholeWord:true}),["cat","cat"]);
 assert.deepEqual(find(text,"cat",{matchPrefix:true}),["cat","cat","cat"]);
 assert.deepEqual(find(text,"cat",{matchSuffix:true}),["cat","cat","cat"]);
});

test("Word special codes: ^p paragraph mark, ^t tab, ^? any char, ^# digit, ^$ letter, ^^ caret, ^w white space",()=>{
 const text="one\rtwo\tthree 4 x^y";
 assert.equal(find(text,"^p").length,1);
 assert.equal(find(text,"^t").length,1);
 assert.deepEqual(find(text,"t^?o"),["two"]);
 assert.deepEqual(find(text,"^#"),["4"]);
 assert.equal(find(text,"^$^$^$").length,3);
 assert.deepEqual(find(text,"^^"),["^"]);
 assert.equal(find("a \u00a0 b","a^wb").length,1);
 assert.deepEqual(find("a\u2014b\u2013c","^+"),["\u2014"]);
 assert.deepEqual(find("a\u2014b\u2013c","^="),["\u2013"]);
});

test("modelled-out specials (column break, field, footnote) simply find nothing instead of erroring",()=>{
 for(const code of["^n","^d","^f","^e","^b"])assert.deepEqual(find("anything here",code),[]);
});

test("paragraph marks can be part of a longer pattern",()=>{assert.deepEqual(find("end.\rStart","end.^pStart"),["end.\rStart"])});

test("wildcards: ? * [] [!] < > {n,m} @ and (groups)",()=>{
 assert.deepEqual(find("cat cot cut cit","c?t",{wildcards:true}),["cat","cot","cut","cit"]);
 assert.deepEqual(find("cat cot cut cit","c[ao]t",{wildcards:true}),["cat","cot"]);
 assert.deepEqual(find("cat cot cut cit","c[!ao]t",{wildcards:true}),["cut","cit"]);
 assert.deepEqual(find("start to end of it","s*d",{wildcards:true}),["start to end"]);
 assert.deepEqual(find("the then there","<the>",{wildcards:true}),["the"]);
 assert.deepEqual(find("ab abb abbb","ab{2,3}",{wildcards:true}),["abb","abbb"]);
 assert.deepEqual(find("aab ab b","a@b",{wildcards:true}),["aab","ab"]);
 assert.deepEqual(find("a1 b2 c3","[a-b][0-9]",{wildcards:true}),["a1","b2"]);
 assert.deepEqual(find("Apple apple","apple",{wildcards:true}),["apple"],"wildcard searches are case sensitive");
});

test("wildcard groups can be used in the replacement as backreferences",()=>{
 const text="Smith, John";const [match]=findMatches(text,"(<[A-Za-z]@>), (<[A-Za-z]@>)",{...D,wildcards:true});
 assert.equal(expandReplacement("\\2 \\1",{text:text.slice(match.index,match.index+match.length),groups:match.groups},{wildcards:true}),"John Smith");
});

test("replacement codes: ^& found text, ^t, ^p, ^^",()=>{
 const found={text:"abc",groups:[]};
 assert.equal(expandReplacement("[^&]",found,{wildcards:false}),"[abc]");
 assert.equal(expandReplacement("a^tb^^c",found,{wildcards:false}),"a\tb^c");
 assert.equal(expandReplacement("x^py",found,{wildcards:false}),"x\ry");
});

test("ignore white-space and ignore punctuation characters",()=>{
 assert.deepEqual(find("a b  c","abc",{ignoreWhitespace:true}),["a b  c"]);
 assert.deepEqual(find("a-b, c","abc",{ignorePunctuation:true}),["a-b, c"]);
});

test("Sounds like (English): same Soundex code matches",()=>{
 assert.equal(soundex("Robert"),soundex("Rupert"));
 assert.deepEqual(find("Robert met Rupert and Bob","Robert",{soundsLike:true}),["Robert","Rupert"]);
});

test("Find all word forms (English)",()=>{
 assert.ok(wordForms("run").includes("running")&&wordForms("run").includes("ran")&&wordForms("run").includes("runs"));
 assert.deepEqual(find("He walks and walked, walking away. Walker.","walk",{allWordForms:true}),["walks","walked","walking"]);
 assert.deepEqual(find("go went gone going","go",{allWordForms:true}),["go","went","gone","going"]);
 assert.deepEqual(find("child children","child",{allWordForms:true}),["child","children"]);
});

test("translateNeedle returns null for broken wildcard syntax instead of throwing",()=>{
 assert.equal(translateNeedle("[abc",{...D,wildcards:true}),null);
 assert.equal(translateNeedle("a{x}",{...D,wildcards:true}),null);
 assert.deepEqual(find("text","[abc",{wildcards:true}),[]);
});
