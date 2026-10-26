-- Paper solution (written steps, no screenshots) for Hindi EFFICIENCY TEST 3 (version 766b80e8), matched to
-- its marking (migration 202610261400). Updates the current version in place (no new version), so attempts and
-- marking are untouched. Re-running writes the same text.
begin;

create temporary table word_solution(version uuid, number integer, body text) on commit drop;

insert into word_solution values
('766b80e8-41d9-4a21-be3a-f675cd128b0d', 1, $t$पहले पैराग्राफ में हर "समाज" शब्द (कुल 4) के लिए:
1. शब्द "समाज" पर डबल-क्लिक करके उसे सेलेक्ट करें।
2. HOME → **Underline** (Ctrl+U) और **Strikethrough** (abc)।
बाकी तीनों "समाज" शब्दों पर भी यही करें।

जाँच: पहले पैराग्राफ के चारों "समाज" शब्द अंडरलाइन व स्ट्राइकथ्रू।$t$),
('766b80e8-41d9-4a21-be3a-f675cd128b0d', 2, $t$**(क)** दूसरा पैराग्राफ सेलेक्ट करें → HOME → Font Size बॉक्स में **24** → Enter।
**(ख)** दूसरे पैराग्राफ में कहीं भी क्लिक करें (सेलेक्ट करना ज़रूरी नहीं) → HOME → **Line and Paragraph Spacing ▾** → **Line Spacing Options…** → Line spacing **Multiple**, At **3.1** → **OK**।

जाँच: (क) साइज 24 (ख) लाइन स्पेसिंग 3.1।$t$),
('766b80e8-41d9-4a21-be3a-f675cd128b0d', 3, $t$दूसरा पैराग्राफ सेलेक्ट करें → HOME → Font बॉक्स में **Arial Narrow** → Enter।

जाँच: दूसरा पैराग्राफ Arial Narrow फ़ॉन्ट में।$t$),
('766b80e8-41d9-4a21-be3a-f675cd128b0d', 4, $t$**(क)** दूसरा पैराग्राफ सेलेक्ट करें → HOME → **Change Case (Aa ▾)** → **UPPERCASE**।
**(ख)** पैराग्राफ में क्लिक करें → HOME → **Align Right** (Ctrl+R)।

जाँच: (क) सभी अक्षर बड़े (ख) दाईं ओर अलाइन।$t$),
('766b80e8-41d9-4a21-be3a-f675cd128b0d', 5, $t$दूसरे पैराग्राफ में कहीं भी क्लिक करें → HOME → Paragraph ग्रुप **↘** (या Line Spacing Options…) → Paragraph डायलॉग:
- Spacing **After: 0 pt** (आफ्टर स्पेसिंग हटाना)।
- Indentation **Special: First line**, By **0.58"**।
→ **OK**।
(After स्पेसिंग के लिए HOME → **Line and Paragraph Spacing ▾** → **Remove Space After Paragraph** भी चलेगा।)

जाँच: (क) आफ्टर स्पेसिंग 0 (ख) फर्स्ट लाइन इंडेंट 0.58"।$t$),
('766b80e8-41d9-4a21-be3a-f675cd128b0d', 6, $t$तीसरे पैराग्राफ में क्लिक करें → HOME → **Shading ▾** → **Light Green**।

जाँच: पूरे तीसरे पैराग्राफ का बैकग्राउंड हल्का हरा।$t$),
('766b80e8-41d9-4a21-be3a-f675cd128b0d', 7, $t$1. पहले हाइलाइट का रंग चुनें: कुछ भी सेलेक्ट किए बिना HOME → **Text Highlight Color ▾** → **Red**। (Replace का Highlight हमेशा यही चुना हुआ रंग लगाता है; पहले से यह पीला होता है।)
2. तीसरा पैराग्राफ सेलेक्ट करें।
3. HOME → **Replace** (Ctrl+H) → Find what **document**, Replace with **document**।
4. **Replace with** बॉक्स में क्लिक करें → **More >>** → **Format ▾** → **Highlight** (बॉक्स के नीचे "Format: Highlight" दिखेगा)।
5. **Replace All** → "3 replacements" का संदेश → **Close**।

जाँच: तीसरे पैराग्राफ के तीनों "document" लाल रंग से हाइलाइट।$t$),
('766b80e8-41d9-4a21-be3a-f675cd128b0d', 8, $t$1. तीसरे पैराग्राफ के आख़िरी अक्षर के बाद क्लिक करें।
2. INSERT → **Table ▾** → ग्रिड में **6x4 Table** चुनें (6 कॉलम × 4 रो)। या **Insert Table…** → Columns **6**, Rows **4** → **OK**।

जाँच: तीसरे पैराग्राफ के बाद 6 × 4 की टेबल।$t$),
('766b80e8-41d9-4a21-be3a-f675cd128b0d', 9, $t$1. चौथा पैराग्राफ सेलेक्ट करें → HOME → **Italic** (Ctrl+I)।
2. HOME → Font ग्रुप **↘** → Font डायलॉग → Underline style **Double** (दोहरी लाइन), Underline color **Red** → **OK**।

जाँच: (क) इटैलिक (ख) लाल रंग की डबल अंडरलाइन।$t$),
('766b80e8-41d9-4a21-be3a-f675cd128b0d', 10, $t$तीसरे पैराग्राफ में क्लिक करें:
1. HOME → **Align Right** (Ctrl+R)।
2. HOME → Paragraph ग्रुप **↘** → Indentation **Left: 0.58"** → **OK**।

जाँच: (क) दाईं ओर अलाइन (ख) बायाँ इंडेंट 0.58"।$t$),
('766b80e8-41d9-4a21-be3a-f675cd128b0d', 11, $t$पाँचवाँ पैराग्राफ सेलेक्ट करें → HOME → **Text Effects and Typography (A ▾)** → **Outline** → कोई रंग (जैसे **Automatic**)।

जाँच: पाँचवें पैराग्राफ के अक्षर आउटलाइन (खोखले) दिखें।$t$),
('766b80e8-41d9-4a21-be3a-f675cd128b0d', 12, $t$पहले पैराग्राफ में क्लिक करें → HOME → **Justify** (Ctrl+J)।

जाँच: पहला पैराग्राफ दोनों ओर बराबर (जस्टिफाई)।$t$),
('766b80e8-41d9-4a21-be3a-f675cd128b0d', 13, $t$**(क)** टेबल के हर सेल में क्लिक करके कोई भी डेटा टाइप करें (जैसे पहली रो में S.NO., NAME, CITY, POST, MARKS, RESULT और नीचे की रो में नाम, शहर, अंक)।
**(ख)** पूरी टेबल सेलेक्ट करें (टेबल के ऊपर-बाएँ ✥ हैंडल पर क्लिक) → TABLE TOOLS **LAYOUT** → Alignment → **Align Bottom Center**।

जाँच: (क) टेबल में डेटा (ख) सभी सेल बॉटम सेंटर अलाइन।$t$),
('766b80e8-41d9-4a21-be3a-f675cd128b0d', 14, $t$1. टेबल की पहली रो सेलेक्ट करें (पहली रो के बाईं ओर पॉइंटर ले जाकर क्लिक करें)।
2. HOME → Font Size **24**।
3. HOME → **Font Color ▾** → काले के अलावा कोई भी रंग, जैसे **Red**।

जाँच: पहली रो साइज 24 और नए रंग में।$t$),
('766b80e8-41d9-4a21-be3a-f675cd128b0d', 15, $t$दूसरा पैराग्राफ सेलेक्ट करें → HOME → Font ग्रुप **↘** → **Advanced** टैब → Spacing **Condensed**, By **0.3 pt** → **OK**।

जाँच: दूसरे पैराग्राफ के अक्षर 0.3 pt पास-पास (कंडेन्स्ड)।$t$);

update public.word_efficiency_questions q set solution = s.body
from word_solution s where q.version_id = s.version and q.question_number = s.number;

commit;
