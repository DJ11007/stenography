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
    ["ब्रिक्स","fCkzDl"],
    ["आर्थिक","vkfFkZd"],
    ["अध्यक्षता","v/;{krk"],
    ["निभा","fuHkk"],
    ["वर्ष",'o"kZ'],
    ["भारत इस वर्ष ब्रिक्स अध्यक्षता निभा रहा है।",'Hkkjr bl o"kZ fCkzDl v/;{krk fuHkk jgk gSA'],
  ];
  for(const [unicode,legacy] of encodesTo){assert.equal(unicodeToKrutiDev(unicode),legacy);assert.equal(krutiDevToUnicode(legacy),unicode);}
  const economic=unicodeToKrutiDev("आर्थिक");
  assert.equal(economic,"vkfFkZd");
  assert.deepEqual([...economic].map(char=>`U+${char.codePointAt(0).toString(16).toUpperCase()}`),["U+76","U+6B","U+66","U+46","U+6B","U+5A","U+64"]);
  assert.doesNotMatch(economic,/[\u0900-\u097f]/u);
  assert.match(krutiDevToUnicode(economic),/[\u0900-\u097f]/u);
});

// Real reported bug, follow-up on an admin/teacher's hand-typed reference
// passage: an EARLIER investigation (rendering in the bundled Kruti Dev
// 010 webfont) concluded क्र (Ø) only mis-renders when folded to "dz"
// immediately after the pre-base ि marker ("f") -- but the admin/
// teacher's reference used the raw ligature in words with no "f" nearby
// at all ("dk;ZØe" for कार्यक्रम, "pØokr" for चक्रवात), and re-
// rendering क्रम itself side by side in the SAME webfont confirms the fold
// is wrong there too -- "dze" visibly drops the ्र (renders as just कम),
// not only in the one position the earlier pass happened to test. Ø is
// now left unfolded in every position, the same as Ùk (त्त) above.
// ª (the राष्ट्र root's own ट-cluster rakar ligature) has the identical bug --
// the reference used "jk\"Vªh;" for राष्ट्रीय where this file produced
// "jk\"Vzh;" -- so it is likewise left unfolded rather than folded to "z".
// Scoring is unaffected either way for both: all forms decode to the
// identical Unicode.
test("Ø (क्र) and ª (राष्ट्र root) are never folded to their keyboard-typeable dz/z spellings -- both mis-render in the bundled font, confirmed in every position",()=>{
  assert.equal(unicodeToKrutiDev("प्रक्रिया"),"izf"+"Ø"+";k");
  assert.equal(unicodeToKrutiDev("क्रिकेट"),"f"+"Ø"+"dsV");
  assert.equal(unicodeToKrutiDev("अक्रिय"),"vf"+"Ø"+";");
  assert.equal(unicodeToKrutiDev("क्रम"),"Ø"+"e");
  assert.equal(unicodeToKrutiDev("संक्रमण"),"la"+"Ø"+"e.k");
  assert.equal(unicodeToKrutiDev("कार्यक्रम"),"dk;Z"+"Ø"+"e");
  assert.equal(unicodeToKrutiDev("चक्रवात"),"p"+"Ø"+"okr");
  assert.equal(unicodeToKrutiDev("राष्ट्रीय"),"jk\"V"+"ª"+"h;");
  // every other genuine alt-code ligature is unaffected -- still folded.
  assert.equal(unicodeToKrutiDev("प्रिय"),"fiz;");
  assert.equal(unicodeToKrutiDev("ग्रिड"),"fxzM");
  for(const word of ["प्रक्रिया","क्रिकेट","अक्रिय","क्रम","क्रोध","संक्रमण","कार्यक्रम","चक्रवात","राष्ट्रीय","प्रिय","ग्रिड"]){assert.equal(krutiDevToUnicode(unicodeToKrutiDev(word)),word);}
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

// Real reported bug: an admin's Kruti Dev word-set drill wrapped every word
// in typographic quotes ('कमल' 'कलम' ...), and the "Student preview"
// rendered garbage glyphs around each word instead of quote marks. The
// curly quotes (U+2018/U+2019) aren't Devanagari, so the generic table-
// building loop (which only keeps entries whose decoded side contains a
// Devanagari character) never mapped them, and they passed straight
// through into the Kruti Dev byte stream unconverted -- code points the
// bundled font has no sensible glyph for.
test("typographic single quotes convert to their real Kruti Dev keyboard keys and decode back losslessly",()=>{
  const withQuotes="‘कमल’ ‘कलम’ ‘नगर’ ‘गगन’";
  const legacy=unicodeToKrutiDev(withQuotes);
  assert.equal(legacy,"^dey* ^dye* ^uxj* ^xxu*");
  assert.equal(krutiDevToUnicode(legacy),withQuotes);
});

// Follow-up to the bug above: a student typing a quoted word on an
// ordinary keyboard presses the plain apostrophe key twice ('कलम'), not a
// genuine curly opening/closing pair -- there's no easy way to type a
// real '‘'/'’' at all. Confirmed against the bundled Kruti Dev 010
// font: pressing Shift+6 then Shift+8 ("^dye*") is the one keyboard-
// accurate spelling, so a straight apostrophe must be resolved by
// position -- one right after whitespace/start is opening, one right
// before whitespace/end is closing -- to the same "^"/"*" keys, matching
// exactly what typing "^कलम*" directly already produces.
test("a plain straight apostrophe wrapping a word converts by position to the same Shift+6/Shift+8 keys as typing them directly",()=>{
  assert.equal(unicodeToKrutiDev("'कलम'"),unicodeToKrutiDev("^कलम*"));
  assert.equal(unicodeToKrutiDev("'कमल' 'कलम' 'नगर' 'गगन'"),"^dey* ^dye* ^uxj* ^xxu*");
  // An apostrophe that isn't wrapping a whole word (no whitespace/edge on
  // either side) is left alone -- it's not this quoting pattern.
  assert.equal(unicodeToKrutiDev("मिल'ना"),"fey'uk");
});

// Real reported bug: कृषि converted to "d`f\"k" -- the @anthro-ai
// dictionary's own iteration order happened to pick "—" (em dash) as the
// shortest legacy byte for कृ, and the KEYBOARD_KEY_SEQUENCES fold then
// turned that into the keyboard-typeable "d`" (क + the standalone ृ
// matra). The admin/teacher reported this as visibly wrong in the
// rendered Kruti Dev 010 webfont, where "Ñ" (the OTHER single-byte legacy
// form the same dictionary maps to कृ -- confirmed via
// @anthro-ai/krutidev-unicode directly, both decode to the identical कृ)
// reads correctly. "—"/"Ñ" are used for nothing else in the whole
// dictionary, so preferring Ñ is fully isolated to this one word-part.
test("कृ converts to the single-byte Ñ, not the keyboard-typeable d` spelling the font mis-renders",()=>{
  assert.equal(unicodeToKrutiDev("कृषि"),"Ñf\"k");
  assert.equal(krutiDevToUnicode("Ñf\"k"),"कृषि");
  // d` and — still decode correctly for any already-stored passage that
  // used them before this fix -- only the ENCODING direction changed.
  assert.equal(krutiDevToUnicode("d`f\"k"),"कृषि");
  assert.equal(krutiDevToUnicode("—f\"k"),"कृषि");
});

// Real reported bug: an admin/teacher supplied a 385-word hand-typed
// reference passage and compared it word-by-word against our own output --
// 38 words differed, all tracing back to five root causes. The
// @anthro-ai dictionary's compound entries for three vowel-sign+anusvara
// pairs (ें/ों/ाँ) store the anusvara BEFORE the vowel sign, even though
// both orders decode identically (so round-trip tests never caught it):
// "में" came out as "eas" instead of "esa", every "...ों" word (वर्षों,
// शहरों, नागरिकों, माध्यमों, ...) as "...kas" instead of "...ksa", and
// "जाँचना" as "t¡kpuk" instead of "tk¡puk". घ्र has no dedicated ligature
// (unlike प्र/ग्र/त्र/श्र/क्र), so it fell back to a "?"+"j" kerning
// trick that doesn't render, producing "'kh?j" for "शीघ्र" instead of
// "'kh?kz". ‚ (the vowel SIGN ॉ, used after a consonant as in कॉल/डॉक्टर)
// was, at the time of this test, simply missing from the ligature-to-
// keyboard-sequence fold -- see the dedicated "kW" regression test below
// for the later fix that gave it one. The independent letter ऑ (word-
// initial, as in ऑनलाइन) is a different Unicode codepoint and is
// unaffected either way.
test("systematic vowel-sign+anusवार ordering and घ्र's missing ligature are fixed, confirmed against a real hand-typed reference passage",()=>{
  assert.equal(unicodeToKrutiDev("भारत में डिजिटल"),"Hkkjr esa fMftVy");
  assert.equal(krutiDevToUnicode("Hkkjr esa fMftVy"),"भारत में डिजिटल");
  assert.equal(unicodeToKrutiDev("कुछ वर्षों में"),"dqN o\"kksZa esa");
  assert.equal(krutiDevToUnicode("o\"kksZa"),"वर्षों");
  assert.equal(unicodeToKrutiDev("शहरों"),"'kgjksa");
  assert.equal(unicodeToKrutiDev("नागरिकों"),"ukxfjdksa");
  assert.equal(unicodeToKrutiDev("राशि और ध्यानपूर्वक जाँचना"),"jkf'k vkSj /;kuiwoZd tk¡puk");
  assert.equal(krutiDevToUnicode("tk¡puk"),"जाँचना");
  assert.equal(unicodeToKrutiDev("शीघ्र"),"'kh?kz");
  assert.equal(krutiDevToUnicode("'kh?kz"),"शीघ्र");
  // ऑ (the independent letter, word-initial) is untouched by the ॉ/"kW"
  // fix below -- a different Unicode codepoint from the vowel sign.
  assert.equal(unicodeToKrutiDev("ऑनलाइन"),"v‚uykbu");
});

// Real reported bug, spotted in "ब्रिटिश": ब्र has the exact same missing-
// ligature problem as घ्र above -- confirmed by rendering "ब्रिटिश" in the
// bundled font that the old "j" (plain र) spelling renders as separate
// ब+ि+र instead of the compact ब्र ligature, while "kz" (the explicit
// subjoined-र spelling) matches the Mangal reference exactly.
test("ब्र's missing ligature is fixed the same way as घ्र's -- the explicit kz spelling instead of the mis-rendering j",()=>{
  assert.equal(unicodeToKrutiDev("ब्रिटिश"),"fCkzfV'k");
  assert.equal(krutiDevToUnicode("fCkzfV'k"),"ब्रिटिश");
  assert.equal(unicodeToKrutiDev("ब्रिक्स"),"fCkzDl");
  // The old "fCj..." spelling must still decode correctly for any content
  // saved before this fix -- only the forward encoding changes.
  assert.equal(krutiDevToUnicode("fCjfV'k"),"ब्रिटिश");
  assert.equal(krutiDevToUnicode("fCjDl"),"ब्रिक्स");
});

// Real reported bug (a teacher hand-typing "मिस्र", Egypt): स्र has the
// exact same missing-ligature problem as घ्र/ब्र above -- confirmed by
// rendering "feLj" in the bundled font that the old "Lj" (half-स् + plain
// र) spelling renders as three fully disconnected letters, "मिसर" (no
// halant at all), while "lz" (the explicit subjoined-र spelling, matching
// what the teacher reported as correct) renders the compact स्र ligature.
test("स्र's missing ligature is fixed the same way as घ्र's/ब्र's -- the explicit lz spelling instead of the mis-rendering Lj",()=>{
  assert.equal(unicodeToKrutiDev("मिस्र"),"felz");
  assert.equal(krutiDevToUnicode("felz"),"मिस्र");
  // The old "feLj" spelling must still decode correctly for any content
  // saved before this fix -- only the forward encoding changes.
  assert.equal(krutiDevToUnicode("feLj"),"मिस्र");
  // स्त्र (sa + halant + त्र, e.g. "शस्त्र") is a different cluster --
  // the स here is followed by त, not र, so this override must not touch it.
  assert.equal(unicodeToKrutiDev("शस्त्र"),"'kL=");
  assert.equal(krutiDevToUnicode("'kL="),"शस्त्र");
});

// Real reported bug, follow-up after the admin/teacher re-confirmed their
// hand-typed reference word by word: "वित्तीय" converted to "foRrh;"
// (folding the Ù ligature down to "Rr"), but the admin/teacher's real
// keyboard produces and correctly renders "Ù" itself for त्त -- unlike
// every other entry in KEYBOARD_KEY_SEQUENCES (which genuinely need
// Alt-codes), this one was folded the wrong direction, so it's removed
// entirely rather than assumed to need a keyboard-typeable substitute.
test("त्त (Ù) is no longer folded to the keyboard-typeable Rr spelling -- the admin/teacher's real keyboard confirms Ù renders correctly",async()=>{
  assert.equal(unicodeToKrutiDev("वित्तीय"),"foÙkh;");
  assert.equal(krutiDevToUnicode("foÙkh;"),"वित्तीय");
  const source = await readFile(new URL("../lib/hindi-font-converter.ts", import.meta.url),"utf8");
  assert.doesNotMatch(source, /\[\/Ùk\/g, "Rr"\]/);
});

// Real reported bug, from an official Kruti Dev 010 Alt-code reference
// chart (Samradhi Classes' own teaching material) cross-checked word by
// word against this converter. ट्ट has two same-length dictionary
// ligatures (ê, Í); this converter's first-found tie-break picked ê, which
// then got folded to the keyboard-typeable "V~V" -- confirmed by rendering
// "खट्टा" in the bundled font that "V~V" leaves the doubled ट visibly
// unjoined, while the chart's own Alt+0205 ("Í") joins cleanly. Overridden
// directly to Í, and ê's now-unreachable V~V fold removed.
test("ट्ट uses the alt-code chart's Í spelling instead of the worse-rendering V~V fold",async()=>{
  assert.equal(unicodeToKrutiDev("खट्टा"),"[kÍk");
  assert.equal(krutiDevToUnicode("[kÍk"),"खट्टा");
  // the old spelling still decodes correctly for any already-stored
  // passage that used it -- only the ENCODING direction changed.
  assert.equal(krutiDevToUnicode("[kV~Vk"),"खट्टा");
  const source = await readFile(new URL("../lib/hindi-font-converter.ts", import.meta.url),"utf8");
  assert.doesNotMatch(source, /\[\/ê\/g/);
});

// Same reference chart also lists द्म as Alt+0249 ("ù") -- deliberately
// NOT applied, unlike ट्ट above: "ù" has no reverse-decode entry anywhere
// in the @anthro-ai dictionary at all (confirmed directly), so using it
// would silently break scoring instead of just being a display-only
// preference -- a correctly-typed द्म would decode to gibberish instead of
// matching the reference. Stays on the compositional "n~e" form.
test("द्म deliberately keeps the compositional n~e spelling, not the alt-code chart's ù, because ù has no reverse-decode entry at all",()=>{
  assert.equal(unicodeToKrutiDev("पद्मश्री"),"in~eJh");
  assert.equal(krutiDevToUnicode("in~eJh"),"पद्मश्री");
});

// Real reported bug report that turned out, after verifying against the
// actual bundled Kruti Dev010 webfont (rendered "}", ")", "|", "\\" and ")"
// full-word side by side with their claimed Unicode meanings), to have NO
// bug at all -- every one of the admin/teacher's hand-typed or hand-copied
// reference values for these four keys had its own transcription slip
// ("|" claimed as घ, when the real key for घ is "?k"; "}" claimed via one
// chart as द्ध, when it renders as द्व; "fo)ku" claimed for विद्वान, when
// ")" renders as द्ध, so that spelling actually reads विद्धान -- the
// correct spelling, "fo}ku", is exactly what this converter already
// produces). Locked in here so a future report of the same shape doesn't
// get "fixed" into breaking these -- they were never broken.
test("}/)/| already encode and decode correctly -- द्व, द्ध, and द्य respectively, confirmed against real words and the actual bundled font, not the source of a reported conversion bug",()=>{
  assert.equal(krutiDevToUnicode("}"),"द्व");
  assert.equal(krutiDevToUnicode(")"),"द्ध");
  assert.equal(krutiDevToUnicode("|"),"द्य");
  assert.equal(unicodeToKrutiDev("द्वार"),"}kj");
  assert.equal(krutiDevToUnicode("}kj"),"द्वार");
  assert.equal(unicodeToKrutiDev("विद्वान"),"fo}ku");
  assert.equal(krutiDevToUnicode("fo}ku"),"विद्वान");
  // "fo)ku" is a real typo some reference material makes for विद्वान --
  // it actually spells विद्धान (a different word), not an alternate
  // spelling of विद्वान.
  assert.equal(krutiDevToUnicode("fo)ku"),"विद्धान");
  assert.equal(unicodeToKrutiDev("घ"),"?k");
});

// Found via a systematic audit of the complete Kruti Dev010 keyboard
// (checked at the user's request): a literal ".", ";", or "/" in a Hindi
// passage used to pass straight through unconverted, but those exact raw
// bytes already draw Devanagari half-forms in this font (ण्, य, ध् --
// confirmed against krutiDevToUnicode directly), silently corrupting any
// passage containing an abbreviation ("डॉ.", "आई.ए.एस."), a decimal number,
// a semicolon-joined clause, or a slash ("पर/खिलाफ"). Each now uses a safe,
// already-typeable keyboard byte that decodes to exactly that punctuation
// mark and nothing else.
test("literal . ; and / round-trip correctly instead of colliding with this font's Devanagari half-forms",()=>{
  assert.equal(unicodeToKrutiDev("."),"-");
  assert.equal(unicodeToKrutiDev(";"),"(");
  assert.equal(unicodeToKrutiDev("/"),"@");
  for (const word of ["डॉ.","3.5","पेज 12.","एक; दो","पर/खिलाफ","श्री राम राव, आई.ए.एस."]) {
    assert.equal(krutiDevToUnicode(unicodeToKrutiDev(word)), word);
  }
});

// Real reported bug: a pasted passage's en dash ("1894–95", "चीन–जापान" --
// the kind Word/Docs auto-corrects "--" into) collided with this font's
// दृ half-form the exact same way "." ";" "/" did above. No legacy byte
// decodes back to a literal en dash at all, so it folds to the same safe
// "&" byte already used for a plain hyphen.
test("literal en dash (–) round-trips as a hyphen instead of colliding with this font's दृ half-form",()=>{
  assert.equal(unicodeToKrutiDev("–"),"&");
  for (const word of ["1894–95","चीन–जापान"]) {
    assert.equal(krutiDevToUnicode(unicodeToKrutiDev(word)), word.replace(/–/g,"-"));
  }
});

// Found via a full-paragraph conversion test with a real admin-supplied
// Hindi passage (a quotation-attribution dash before a quoted sentence,
// e.g. "कहा—"): the em dash has the exact same collision as the en dash
// above -- it's already the dictionary's OTHER legacy byte for कृ (see the
// कृ/Ñ override), so left unconverted it decoded to कृ instead of a dash.
// Folds onto the same safe "&" byte as the hyphen/en-dash, for the same
// reason: no Kruti Dev keyboard key produces any of the three distinctly.
test("literal em dash (—) round-trips as a hyphen instead of colliding with this font's कृ meaning",()=>{
  assert.equal(unicodeToKrutiDev("—"),"&");
  assert.equal(krutiDevToUnicode(unicodeToKrutiDev("कहा—बोला")), "कहा-बोला");
});

// Same test passage: typographic double quotes ("...") collided the same
// way the single-quote pair already above did -- left unconverted, they
// round-tripped to श् instead of a quote. krutiDevToUnicode confirms
// legacy "Þ" (Alt+0222) and "ß" (Alt+0223) are this font's dedicated
// opening/closing double-quote bytes (matching the teacher's own
// reference chart), both already ordinary keyboard-typeable Alt-codes.
test("typographic double quotes (“”) convert to their real Kruti Dev Alt-code keys and decode back losslessly",()=>{
  assert.equal(unicodeToKrutiDev("“"),"Þ");
  assert.equal(unicodeToKrutiDev("”"),"ß");
  const sentence = "उसने कहा—“प्रतिनिधित्व नहीं, तो कर भी नहीं।”";
  assert.equal(krutiDevToUnicode(unicodeToKrutiDev(sentence)), sentence.replace(/—/g,"-"));
});

// Real reported bug: a passage wrapped a proper noun in plain STRAIGHT
// double quotes ("ऑटोमन साम्राज्य") -- what a student actually gets by
// pressing Shift+' on a real keyboard, not the curly pair above, which
// needs an input method nobody here uses. The raw " (U+0022) byte was
// passed straight through unconverted, and this font already claims
// Shift+' for ष् (confirmed: krutiDevToUnicode('"') === "ष्"), so the
// quotes silently corrupted into that half-form -- round-tripping the
// broken output produced "ष्ऑटोमन साम्राज्यष्", not the original phrase.
// Same fix as the straight-apostrophe normalization above, one character
// over: position (right after whitespace/start = opening, right before
// whitespace/end = closing) tells open from close, feeding into the
// existing "/Þ, "/ß mapping. Verified at the code-point level, not just
// how the raw bytes look in a normal font.
test('a straight double quote (") converts by position to the same Þ/ß Alt-code keys as a real curly pair, instead of colliding with this font\'s ष् half-form -- repro: "ऑटोमन साम्राज्य"',()=>{
  const phrase = '"ऑटोमन साम्राज्य"';
  const legacy = unicodeToKrutiDev(phrase);
  assert.equal(legacy.codePointAt(0), 0xde, "opening quote must be Alt+0222 (Þ, U+00DE), not a raw ASCII \"");
  assert.equal(legacy.codePointAt(legacy.length-1), 0xdf, "closing quote must be Alt+0223 (ß, U+00DF), not a raw ASCII \"");
  assert.equal(legacy, "Þ" + unicodeToKrutiDev("ऑटोमन साम्राज्य") + "ß", "the phrase's own conversion must be byte-for-byte unchanged -- only the quote bytes differ");
  assert.equal(krutiDevToUnicode(legacy), "“ऑटोमन साम्राज्य”", "decodes back to the phrase wrapped in real curly quotes (the same Kruti Dev keyboard has no separate straight-quote key)");
});

// Found via a key-by-key audit of the official Kruti Dev 010 keyboard
// chart against this font: Shift+4 (raw byte "$") draws a plain "+" glyph
// in the bundled font, a remap the @anthro-ai dictionary has no entry for
// at all -- confirmed by direct rendering. Legacy byte "+" itself is
// already reserved for the nukta mark (ड़/ढ़/ज़), so a literal "+" left
// unconverted would silently encode as invisible nukta instead. Legacy
// byte "=" is likewise already the unshifted "=" key's own meaning
// (त्र), so a literal "=" needs the same treatment via "¾".
test("literal plus (+) and equals (=) round-trip via \"$\"/\"¾\" instead of colliding with nukta/त्र",()=>{
  assert.equal(unicodeToKrutiDev("+"),"$");
  assert.equal(unicodeToKrutiDev("="),"¾");
  assert.equal(krutiDevToUnicode("$"),"+");
  assert.equal(krutiDevToUnicode("¾"),"=");
  for (const word of ["5+5=10"]) {
    assert.equal(krutiDevToUnicode(unicodeToKrutiDev(word)), word);
  }
});

// Real reported bug: a passage priced something in Rupees ("₹750") and the
// ₹ sign (U+20B9) rendered wrong -- this font predates the 2010 Rupee-sign
// Unicode standardisation, so it has no glyph for U+20B9 at all, and it
// only ever looked right on screen because the browser silently
// substitutes a fallback font for that one unsupported codepoint.
// Confirmed by direct rendering that Shift+3 (raw byte "#") is this font's
// purpose-built stand-in: a proper overlined रु ligature.
// Decoding "#" back still yields "रु" (its pre-existing dictionary
// meaning), not "₹" -- fine for scoring, which matches raw keystrokes, not
// decoded meaning.
test("literal Rupee sign (₹) converts to \"#\" (Shift+3), this font's own Rupee-abbreviation glyph",()=>{
  assert.equal(unicodeToKrutiDev("₹750"),"#750");
  assert.equal(krutiDevToUnicode("#"),"रु");
});

// Real reported bug: a time value ("08:30") used a literal colon, and it
// rendered wrong -- Kruti Dev 010 has no dedicated colon key at all.
// Legacy byte "%" (Shift+5) is already claimed for ः (visarga), and
// decodeLegacyWord hard-codes "%" -> ः on the decode side regardless, so
// this is a one-way, many-to-one fold exactly like ₹ -> "#" above:
// confirmed by rendering "%" directly in the bundled font that visarga's
// two stacked dots read as an ordinary colon.
test("literal colon (:) converts to \"%\" (Shift+5), this font's visarga glyph doubling as a colon",()=>{
  assert.equal(unicodeToKrutiDev("08:30"),"08%30");
  assert.equal(krutiDevToUnicode("%"),"ः");
});

// Real reported bug, live-reproduced in the Kruti Dev learn tutor (lesson
// 23, "डॉ. आर.के. शर्मा"): unicodeToKrutiDev used to encode the vowel SIGN
// ॉ (after a consonant, as in डॉ./कॉल/डॉक्टर) as "‚" (U+201A), a Latin-1
// byte with no ordinary key -- only Alt+0130. The tutor compares typed
// keystrokes to this target one character at a time, so a student who
// instead pressed the two ordinary keys "k"+"W" (what Kruti Dev teachers
// actually teach for this glyph) produced two characters where the
// target had one, misaligning every position after it and marking the
// rest of the word/passage wrong too -- not just this one glyph. An
// earlier investigation (this same file's history) looked at exactly
// this "kW" fold and rejected it, since krutiDevToUnicode("kW") decodes
// to the different character ॅ (candra-E, U+0945) on its own. Re-verified
// by rendering "M‚-" and "MkW-" side by side in the bundled Kruti Dev 010
// webfont: pixel-identical, both drawing "डॉ.", and ॅ is not used
// anywhere in this app's content, so the collision that blocked the
// earlier attempt was never a real one. Fixed with a paired encode
// override (preferredLegacy.set("ॉ","kW")) and decode override
// (legacyDecodeOverrides.set("kW","ॉ")), so round-tripping and
// student-answer scoring stay consistent both ways -- and a student who
// still prefers the Alt+0130 method is unaffected, since "‚" itself still
// decodes to ॉ unchanged.
test("ॉ (candra-O vowel sign) now encodes to the keyboard-typeable \"kW\", which round-trips back to ॉ, not the different character ॅ",()=>{
  for (const word of ["डॉक्टर","कॉल","कॉलेज","डॉलर","डॉ."]) {
    const encoded = unicodeToKrutiDev(word);
    assert.match(encoded, /kW/);
    assert.doesNotMatch(encoded, /‚/);
    assert.equal(krutiDevToUnicode(encoded), word);
  }
  // स्कूल has no ॉ at all -- sanity check that it's untouched.
  assert.doesNotMatch(unicodeToKrutiDev("स्कूल"), /kW/);
  // ऑनलाइन's ऑ is the independent letter (a different Unicode codepoint
  // from the vowel sign ॉ), word-initial, and is unaffected either way.
  assert.equal(unicodeToKrutiDev("ऑनलाइन"),"v‚uykbu");
  // The Alt+0130 method still works and still means ॉ.
  assert.equal(krutiDevToUnicode("‚"),"ॉ");
  assert.equal(krutiDevToUnicode("kW"),"ॉ");
});

// Real reported bug, live-reproduced rendering WordTris's own animal word
// bank: unicodeToKrutiDev("भेड़िया") rendered as "भेड़यिा" in the actual
// bundled Kruti Dev 010 webfont -- ि and य visibly swapped. Root cause:
// this app's word lists (and any real Hindi keyboard/IME) author a nukta
// letter as a DECOMPOSED pair -- a plain base consonant immediately
// followed by a separate combining nukta mark U+093C -- not the single
// precomposed codepoint, and NFC normalization does NOT merge them (this
// codebase's own fixtures use the decomposed form throughout, confirmed
// against lib/wordtris-content.ts's literal source bytes). The pre-base
// ि reorder regex matches consonants via a character class, so it never
// recognized "ड + ़" as one consonant unit and never moved a following ि
// before it. Built via explicit codepoints, not literal Devanagari text,
// for the same reason NUKTA_COMPOSE in hindi-font-converter.ts is: a
// decomposed nukta pair is visually indistinguishable from its
// precomposed counterpart, so a literal-glyph test word could never be
// verified as actually exercising the decomposed path.
test("a decomposed nukta consonant (base + separate U+093C) immediately followed by ि is composed before encoding, fixing भेड़िया's visible ि/य swap",()=>{
  const decomposedDa = String.fromCodePoint(0x0921, 0x093c); // ड + ़ (NOT the precomposed ड़, U+095C)
  const bhediya = "भे" + decomposedDa + String.fromCodePoint(0x093f, 0x092f, 0x093e); // भे + ड़(decomposed) + िया
  assert.equal([...bhediya].length, 7, "sanity check: this literal is genuinely 7 codepoints (2+2+3), i.e. really decomposed");
  const encoded = unicodeToKrutiDev(bhediya);
  // f (ि) must come before M+ (ड़), not after -- the exact swap that was reported.
  assert.ok(encoded.indexOf("f") < encoded.indexOf("M+"), `expected f before M+ in ${JSON.stringify(encoded)}`);
  assert.equal(krutiDevToUnicode(encoded), bhediya);
  // The already-precomposed form (however a passage happens to be typed)
  // must encode identically -- krutiDevToUnicode itself always decodes a
  // nukta letter back to the decomposed form regardless of input, which
  // is this dictionary's own pre-existing, unrelated convention (not
  // something this fix changes), so the round-trip check above already
  // covers decode; this just confirms both spellings of the SAME word
  // produce the SAME keystrokes.
  const precomposedBhediya = "भे" + String.fromCodePoint(0x095c, 0x093f, 0x092f, 0x093e);
  assert.equal(unicodeToKrutiDev(precomposedBhediya), encoded);
});

// Real reported bug, teacher-supplied: भ्रष्टाचार and family converted with
// भ्र as disconnected "Hj" instead of the compact "Hkz" ligature (same class
// as the already-fixed घ्र/ब्र/स्र above, this time reported directly against
// this exact word family) -- confirmed by rendering "Hj" in the bundled font
// draws separate भ+र, not भ्र. Also पृथक्/पृथक्करण: a WORD-FINAL "dead" क्
// (nothing follows it) rendered with NO halant at all ("D" alone is pixel-
// identical to plain क in the bundled font), while the exact same byte
// immediately followed by another क (क्क, as in पृथक्करण) previously used
// the dictionary's own "ô" byte, which renders as an unrelated क्ष, not क्क.
// Fixed generally: DEAD_CONSONANT_HALANT forces [full consonant]+"~" for any
// word-final half-form (not just क्), and क्क is overridden directly to "Dd".
test("भ्रष्टाचार family and पृथक्/पृथक्करण convert exactly as reported -- mandatory, teacher-authored test cases",()=>{
  const mandatory=[
    ["भ्रष्टाचार",'Hkz"Vkpkj'],
    ["भ्रष्टाचारी",'Hkz"Vkpkjh'],
    ["भ्रष्ट",'Hkz"V'],
    ["भ्रष्टाचारियों",'Hkz"Vkpkfj;ksa'],
    ["पृथक्","i`Fkd~"],
    ["पृथक्करण","i`FkDdj.k"],
  ];
  for(const [unicode,legacy] of mandatory){assert.equal(unicodeToKrutiDev(unicode),legacy);assert.equal(krutiDevToUnicode(legacy),unicode);}
});

// Real reported requirement: a 30+ word regression sweep across conjuncts,
// halant placement (mid-word AND word-final "dead" consonants), reph, nukta,
// matras, and anusvara/chandrabindu -- confirming the भ्र/क्/क्क/word-final-
// halant fixes above don't disturb any of these, not just the six words
// that were directly reported. Every word here is real, common Hindi
// vocabulary (not a contrived string), and is checked for lossless
// round-tripping (encode then decode returns the exact original) -- the
// same bar every other fixture list in this file already holds itself to.
test("a 30+ word regression sweep (conjuncts, reph, nukta, matras, anusvara, word-final halant) round-trips losslessly after the भ्र/क्क/dead-halant fixes",()=>{
  const words=[
    // क्ष / ज्ञ conjuncts
    "अक्षर","परीक्षा","रक्षा","ज्ञान","विज्ञान",
    // त्र / श्र / द्व / द्य conjuncts
    "पत्र","मित्र","चित्र","श्रम","श्रेणी","विद्वान","द्वार","विद्यालय","विद्या",
    // reph (र् + consonant)
    "कर्म","धर्म","वर्ष","सूर्य","कार्य",
    // ों / ें / ाँ (vowel-sign + anusvara/chandrabindu ordering)
    "वर्षों","शहरों","में","उन्हें","जाँच","माँ",
    // nukta letters (ड़ ढ़ ज़ फ़)
    "बड़ा","पढ़ना","गाड़ी","अंग्रेज़ी","फ़ोन",
    // ृ matra
    "कृपा","कृषि","गृह",
    // mid-word half-form (NOT word-final -- must still use the compact
    // ligature byte, unaffected by the new word-final-only halant rule)
    "सत्य","नित्य",
    // word-final "dead" consonant (the new general fix's whole point) --
    // several different consonants, not just क्
    "जगत्","सत्","विद्युत्","अर्थात्","क्वचित्",
    // भ्र family beyond the mandatory six above
    "भ्रम","भ्रमण",
    // मिस्र (स्र fix, from the previous session's report)
    "मिस्र","मिस्र की सभ्यता",
  ];
  assert.ok(words.length>=30,`expected at least 30 words, got ${words.length}`);
  for(const word of words){
    const legacy=unicodeToKrutiDev(word);
    assert.doesNotMatch(legacy,/\p{Script=Devanagari}/u,`${word} left raw Devanagari untouched: ${JSON.stringify(legacy)}`);
    assert.equal(krutiDevToUnicode(legacy),word,`${word} -> ${JSON.stringify(legacy)} did not round-trip`);
  }
});
