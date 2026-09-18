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
// "'kh?kz". And ‚ (ॉ, used in every English loanword like ऑनलाइन/कॉल) was
// simply missing from the ligature-to-keyboard-sequence fold.
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
  // ‚ (ऑ/ॉ's alt-code-only byte) is left unfolded -- see the dedicated
  // "kW" regression test below for why.
  assert.equal(unicodeToKrutiDev("ऑनलाइन"),"v‚uykbu");
  assert.equal(unicodeToKrutiDev("कॉल"),"d‚y");
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

// Found by the same audit: a "‚" (U+201A) -> "kW" fold was added earlier
// this session on the unverified claim that "kW" is ॉ's (candra-O)
// keyboard-typeable form with "scoring unaffected either way it's
// stored". Direct testing disproves it: krutiDevToUnicode("kW") decodes to
// ॅ (candra-E, U+0945) -- a different character -- so a student correctly
// typing ॉ via its real, already-documented Alt+0130 would decode to ॉ
// while the "kW"-folded passage decoded to ॅ, silently marking a correct
// answer wrong. ‚ has no keyboard-typeable form at all (same as ँ) and is
// left unfolded.
test("ॉ (candra-O) is never folded to \"kW\", which actually decodes to the different character ॅ (candra-E)",async()=>{
  for (const word of ["डॉक्टर","कॉल","स्कूल","कॉलेज","डॉलर","ऑनलाइन"]) {
    const encoded = unicodeToKrutiDev(word);
    assert.doesNotMatch(encoded, /kW/);
    assert.equal(krutiDevToUnicode(encoded), word);
  }
  assert.equal(krutiDevToUnicode("‚"),"ॉ");
  assert.equal(krutiDevToUnicode("kW"),"ॅ");
  const source = await readFile(new URL("../lib/hindi-font-converter.ts", import.meta.url),"utf8");
  assert.doesNotMatch(source, /\[\/‚\/g/);
});
