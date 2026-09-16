import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { convertHindiText, convertHindiTextWithMarker, detectHindiTextFormat, encodingValidationMessage, krutiDevToUnicode, unicodeToKrutiDev } from "../lib/hindi-font-converter.ts";

const fixtures = [
  "अ आ इ ई उ ऊ ऋ ए ऐ ओ औ अं अः अँ",
  "क ख ग घ ङ च छ ज झ ञ ट ठ ड ढ ण त थ द ध न प फ ब भ म य र ल व श ष स ह",
  "का कि की कु कू कृ के कै को कौ कं कः कँ",
  "कर्म प्रार्थना शक्ति क्षेत्र त्रिशूल ज्ञान श्रम द्वार",
  "भारत राष्ट्र निर्माण और शिक्षा",
  "संख्या 123, प्रश्न? उत्तर-हाँ।",
  "पहला अनुच्छेद।\n\nदूसरा अनुच्छेद   कई शब्दों के साथ।\nतीसरी पंक्ति।",
  "  आरम्भ में स्थान\nअन्त में स्थान  ",
];

test("Unicode and Kruti Dev conversion fixtures round-trip deterministically",()=>{
  for(const unicode of fixtures){const legacy=unicodeToKrutiDev(unicode);assert.equal(krutiDevToUnicode(legacy),unicode.normalize("NFC"));assert.equal(unicodeToKrutiDev(unicode),legacy);assert.doesNotMatch(legacy,/\p{Script=Devanagari}/u);}
});

test("order-sensitive production Kruti Dev fixtures convert exactly",()=>{
  // Historical byte strings still DECODE correctly...
  const decodesTo=[
    ["fCjDl","ब्रिक्स"],
    ["vkfFkZd","आर्थिक"],
    ["v/;{krk","अध्यक्षता"],
    ["fuÒk","निभा"],
    ['o"kZ',"वर्ष"],
    ['Òkjr bl o"kZ fCjDl v/;{krk fuÒk jgk gSA',"भारत इस वर्ष ब्रिक्स अध्यक्षता निभा रहा है।"],
  ];
  for(const [legacy,unicode] of decodesTo)assert.equal(krutiDevToUnicode(legacy),unicode);
  // ...but ENCODING now yields the keyboard-typeable spelling: the Latin-1
  // ligature "Ò" (भ) is folded to the "Hk" key sequence a typist presses.
  const encodesTo=[
    ["ब्रिक्स","fCjDl"],
    ["आर्थिक","vkfFkZd"],
    ["अध्यक्षता","v/;{krk"],
    ["निभा","fuHkk"],
    ["वर्ष",'o"kZ'],
    ["भारत इस वर्ष ब्रिक्स अध्यक्षता निभा रहा है।",'Hkkjr bl o"kZ fCjDl v/;{krk fuHkk jgk gSA'],
  ];
  for(const [unicode,legacy] of encodesTo){assert.equal(unicodeToKrutiDev(unicode),legacy);assert.equal(krutiDevToUnicode(legacy),unicode);}
  const economic=unicodeToKrutiDev("आर्थिक");
  assert.equal(economic,"vkfFkZd");
  assert.deepEqual([...economic].map(char=>`U+${char.codePointAt(0).toString(16).toUpperCase()}`),["U+76","U+6B","U+66","U+46","U+6B","U+5A","U+64"]);
  assert.doesNotMatch(economic,/[\u0900-\u097f]/u);
  assert.match(krutiDevToUnicode(economic),/[\u0900-\u097f]/u);
});

// Real reported bug, confirmed by rendering every candidate byte order
// directly through the bundled Kruti Dev 010 webfont in a live browser:
// \u0915\u094d\u0930 (\u00d8, keyboard-typeable fold "dz") is the one ligature this converter
// folds that the font mis-renders when the pre-base \u093f marker ("f")
// immediately precedes it -- "\u092a\u094d\u0930\u0915\u094d\u0930\u093f\u092f\u093e" used to fold all the way to
// "izfdz;k" and render as "\u092a\u094d\u0930\u0915\u093f\u092f\u093e" (the \u094d\u0930 silently disappears visually),
// and "\u0915\u094d\u0930\u093f\u0915\u0947\u091f" the same way rendered "\u0915\u093f\u0915\u0947\u091f". Every OTHER ligature this
// converter folds -- \u092a\u094d\u0930/\u0917\u094d\u0930/\u0924\u094d\u0930/\u0936\u094d\u0930/\u092c\u094d\u0930 (iz/xz/=/J/Cj), and \u00d8 itself
// whenever \u093f does NOT immediately precede it -- was verified the same way
// to render correctly, so \u00d8 is now left unfolded (the raw ligature byte)
// specifically in that one position; every other position still folds to
// "dz" exactly as before. Scoring is unaffected either way: both forms
// decode to the identical Unicode, and a student can only ever type the
// keyboard-typeable "dz" form regardless of which one the reference
// passage stores.
test("\u0915\u094d\u0930 (\u00d8) is not folded to its keyboard-typeable \"dz\" spelling when the pre-base \u093f marker immediately precedes it -- the one ligature+position this font mis-renders",()=>{
  const O="\u00d8";
  assert.equal(unicodeToKrutiDev("\u092a\u094d\u0930\u0915\u094d\u0930\u093f\u092f\u093e"),"izf"+O+";k");
  assert.equal(unicodeToKrutiDev("\u0915\u094d\u0930\u093f\u0915\u0947\u091f"),"f"+O+"dsV");
  assert.equal(unicodeToKrutiDev("\u0905\u0915\u094d\u0930\u093f\u092f"),"vf"+O+";");
  // decoding both the old buggy form and the new correct form must still
  // agree -- this is a pure display fix, not a scoring/meaning change.
  assert.equal(krutiDevToUnicode("izf"+O+";k"),"\u092a\u094d\u0930\u0915\u094d\u0930\u093f\u092f\u093e");
  assert.equal(krutiDevToUnicode("izfdz;k"),"\u092a\u094d\u0930\u0915\u094d\u0930\u093f\u092f\u093e");
  // every other position for \u00d8, and every other ligature immediately after
  // "f", are unaffected -- still folded to their keyboard-typeable spelling.
  assert.equal(unicodeToKrutiDev("\u0915\u094d\u0930\u092e"),"dze");
  assert.equal(unicodeToKrutiDev("\u0938\u0902\u0915\u094d\u0930\u092e\u0923"),"ladze.k");
  assert.equal(unicodeToKrutiDev("\u092a\u094d\u0930\u093f\u092f"),"fiz;");
  assert.equal(unicodeToKrutiDev("\u0917\u094d\u0930\u093f\u0921"),"fxzM");
  for(const word of ["\u092a\u094d\u0930\u0915\u094d\u0930\u093f\u092f\u093e","\u0915\u094d\u0930\u093f\u0915\u0947\u091f","\u0905\u0915\u094d\u0930\u093f\u092f","\u0915\u094d\u0930\u092e","\u0915\u094d\u0930\u094b\u0927","\u0938\u0902\u0915\u094d\u0930\u092e\u0923","\u092a\u094d\u0930\u093f\u092f","\u0917\u094d\u0930\u093f\u0921"]){assert.equal(krutiDevToUnicode(unicodeToKrutiDev(word)),word);}
});

test("long-passage decoding isolates repeated matra and reph operations",async()=>{
  const raw=(await readFile(new URL("./fixtures/affected-krutidev-long-passage.txt",import.meta.url),"utf8")).trimEnd();
  assert.equal(raw.length,5408);
  assert.equal(raw.match(/—f=e/gu)?.length,2);
  const unicode=krutiDevToUnicode(raw);
  assert.equal(unicode.match(/कृत्रिम/gu)?.length,2);
  assert.doesNotMatch(unicode,/कृति्रम/u);
  assert.doesNotMatch(unicode,/खिलाड़यिों/u);
  assert.match(unicode,/कृत्रिम बुद्धिमत्ता/u);
  assert.match(unicode,/युवा खिलाड़ियों को सुविधाएं मिलनी चाहिए।/u);
});

test("known non-injective multi-i spelling decodes to the expected Unicode word",()=>{
  assert.equal(krutiDevToUnicode("f[kykM+f;kas"),"खिलाड़ियों");
  assert.equal(krutiDevToUnicode(unicodeToKrutiDev("खिलाड़ियों")),"खिलाड़ियों");
  assert.notEqual(krutiDevToUnicode("f[kykM+f;kas"),"खिलाड़यिों");
});

test("repeated words, punctuation, paragraphs, and extended Kruti Dev bytes remain bounded",()=>{
  const raw="—f=e —f=e] —f=e।\n\nf[kykM+f;kas dks lqfoèk,a feyuh pkfg,A Òkjr uÃ çxfr nsrÈA";
  const unicode=krutiDevToUnicode(raw);
  assert.equal(unicode.match(/कृत्रिम/gu)?.length,3);
  assert.match(unicode,/कृत्रिम कृत्रिम, कृत्रिम।\n\nखिलाड़ियों को सुविधाएं मिलनी चाहिए।/u);
  assert.match(unicode,/भारत नई प्रगति देतीं।/u);
  assert.doesNotThrow(()=>krutiDevToUnicode("Ò è Ã È Ä ® ç — ‚ ª"));
});

test("complex phrases and paragraphs preserve raw legacy bytes through round trips",()=>{for(const unicode of ["आर्थिक हित कूटनीति","कई देश नए साझेदार खोज रहे हैं।","कि की कु कू कृ के कै को कौ","राष्ट्र कर्म ब्रिक्स प्रार्थना","पहला अनुच्छेद 123।\n\nदूसरा अनुच्छेद, नई पंक्ति।"]){const raw=unicodeToKrutiDev(unicode);assert.doesNotMatch(raw,/[\u0900-\u097f]/u);assert.equal(krutiDevToUnicode(raw),unicode);}});

test("Mangal output is normalized Unicode rather than another encoding",()=>{
  const decomposed="क\u093c";assert.equal(convertHindiText(decomposed,"unicode","unicode"),decomposed.normalize("NFC"));
  assert.equal(convertHindiText(unicodeToKrutiDev("हिन्दी"),"krutidev","unicode"),"हिन्दी");
});

test("wrong-encoding validation is explicit and prevents double conversion",()=>{
  assert.equal(detectHindiTextFormat("भारत की शिक्षा"),"unicode");assert.equal(detectHindiTextFormat("Hkkjr dh f'k{kk"),"krutidev");
  assert.equal(encodingValidationMessage("भारत की शिक्षा","krutidev"),"Convert to Kruti Dev before saving.");
  assert.equal(encodingValidationMessage("Hkkjr dh f'k{kk","unicode"),"Convert to Unicode before saving.");
  assert.equal(encodingValidationMessage("Hkkjr dh f'k{kk","krutidev"),null);
  assert.deepEqual(convertHindiTextWithMarker("fCjDl","krutidev","unicode"),{text:"ब्रिक्स",encoding:"unicode"});
});

test("admin form and student workspace select the bundled Kruti Dev font",async()=>{
  const [manager,converter,workspace,css]=await Promise.all([readFile(new URL("../app/admin/tests/test-manager.tsx",import.meta.url),"utf8"),readFile(new URL("../app/admin/font-converter/font-converter.tsx",import.meta.url),"utf8"),readFile(new URL("../app/typing/_components/configurable-typing-exam.tsx",import.meta.url),"utf8"),readFile(new URL("../app/globals.css",import.meta.url),"utf8")]);
  assert.match(css,/url\("\/fonts\/KrutiDev010\.ttf"\)/);assert.match(manager,/Kruti Dev 010 · Legacy encoded text/);assert.match(manager,/document\.fonts\.load/);assert.match(manager,/Open Font Converter/);assert.match(manager,/View raw encoding/);assert.match(manager,/result\.encoding!==passageFormat/);assert.match(manager,/setPassage\(result\.text\)/);assert.match(converter,/Use converted text in test/);assert.match(converter,/Raw encoded text/);assert.match(converter,/Rendered Kruti Dev preview/);assert.match(converter,/navigator\.clipboard\.writeText\(converted\)/);assert.match(converter,/data-encoding=\{output\}/);assert.match(workspace,/fontFamily: inputSystem\.fontStack/);assert.match(workspace,/fontAvailable === true/);
});

test("result analysis renders score.analysis.entries directly -- scoring itself already produces readable Unicode for Kruti Dev, so the display layer must not decode a second time",async()=>{const results=await readFile(new URL("../app/typing/_components/advanced-typing-results.tsx",import.meta.url),"utf8");assert.match(results,/const displayEntries = score\.analysis\.entries;/);assert.doesNotMatch(results,/krutiDevToUnicode/);assert.match(results,/style=\{\{fontFamily\}\}/);});

test("database repair creates a new immutable version without rewriting history",async()=>{const migration=await readFile(new URL("../supabase/migrations/202608230007_mark_krutidev_passage_encoding.sql",import.meta.url),"utf8");assert.match(migration,/expected_version constant uuid := '312d84cd-b8c6-4c33-894d-7575ec105152'/);assert.match(migration,/insert into public\.test_versions/);assert.match(migration,/passage_encoding','krutidev-legacy'/);assert.doesNotMatch(migration,/update public\.test_versions/);});

test("affected legacy test receives a Unicode title in another immutable version",async()=>{const migration=await readFile(new URL("../supabase/migrations/202608230008_unicode_title_for_krutidev_test.sql",import.meta.url),"utf8");assert.match(migration,/insert into public\.test_versions/);assert.match(migration,/'ब्रिक्स अध्यक्षता'/);assert.match(migration,/title_encoding','unicode'/);assert.doesNotMatch(migration,/update public\.test_versions/);});

test("long passage repair advances the affected test to a new immutable version",async()=>{const migration=await readFile(new URL("../supabase/migrations/202608230009_reconvert_long_krutidev_passage.sql",import.meta.url),"utf8");assert.match(migration,/expected_version constant uuid := '506fdfc0-60dc-4263-93b5-03bf2ef1bfc5'/);assert.match(migration,/token-isolated-v2/);assert.match(migration,/insert into public\.test_versions/);assert.doesNotMatch(migration,/update public\.test_versions\s+set/);});

test("font converter route is protected by administrator MFA",async()=>{
  const [page,dashboard]=await Promise.all([readFile(new URL("../app/admin/font-converter/page.tsx",import.meta.url),"utf8"),readFile(new URL("../app/admin/page.tsx",import.meta.url),"utf8")]);assert.match(page,/await requireAdmin\(\)/);assert.match(dashboard,/\/admin\/font-converter/);
});
