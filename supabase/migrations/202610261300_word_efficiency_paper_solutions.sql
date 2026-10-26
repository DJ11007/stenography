-- Paper solutions (written steps) for every published Word Efficiency test, matched to what each question's
-- marking checks. Screenshots are added later through the admin editor. Updates the current versions in place
-- (no new version), so attempts and marking are untouched. Re-running writes the same text.
begin;

create temporary table word_solution(version uuid, number integer, body text) on commit drop;

-- ================= English EFFICIENCY TEST 1 (8474e3be) =================
insert into word_solution values
('8474e3be-5699-455d-94c4-c2c5baa473ed', 1, $t$1. Click in paragraph 6 and triple-click to select the whole paragraph.
2. HOME → **Bold** (Ctrl+B), **Italic** (Ctrl+I) and **Underline** (Ctrl+U).

Checked: paragraph 6 is bold, italic and underlined.$t$),
('8474e3be-5699-455d-94c4-c2c5baa473ed', 2, $t$1. Select paragraph 2 → HOME → **Strikethrough** (abc).
2. Click in paragraph 1 → HOME → **Line and Paragraph Spacing ▾** → **Line Spacing Options…** → Line spacing **Multiple**, At **2.5** → **OK**.

Checked: paragraph 2 has strikethrough; paragraph 1 has line spacing 2.5.$t$),
('8474e3be-5699-455d-94c4-c2c5baa473ed', 3, $t$1. Select paragraph 6.
2. HOME → **Change Case (Aa ▾)** → **Capitalize Each Word**.
3. HOME → **Font Color ▾** → **Red**.

Checked: every word of paragraph 6 starts with a capital letter and the text is red.$t$),
('8474e3be-5699-455d-94c4-c2c5baa473ed', 4, $t$1. Select only the **first line** of paragraph 6 (drag from its start to the end of the first line).
2. HOME → **Text Highlight Color ▾** → **Pink**.

Checked: the first line of paragraph 6 is highlighted pink.$t$),
('8474e3be-5699-455d-94c4-c2c5baa473ed', 5, $t$1. Select paragraph 1 → HOME → **Font Color ▾** → **Red**.
2. HOME → Paragraph group **↘** (dialog launcher) → Indents and Spacing → Indentation: Left **1.23**, Right **1.63** → **OK**.

Checked: paragraph 1 is red with left indent 1.23 and right indent 1.63.$t$),
('8474e3be-5699-455d-94c4-c2c5baa473ed', 6, $t$1. HOME → **Replace** (Ctrl+H).
2. Find what: **the** · Replace with: **SAMRADHI CLASSES**.
3. Click **Replace All**, then **OK** and **Close**.

Checked: every "the" in the document now reads SAMRADHI CLASSES.$t$),
('8474e3be-5699-455d-94c4-c2c5baa473ed', 7, $t$1. Select paragraph 4.
2. HOME → Font group **↘** → Font dialog:
   - Effects: tick **Double strikethrough**.
   - Underline style: **Dot-dot-dash** (the dash–dot–dot line).
3. Click **OK**.

Checked: paragraph 4 has double strikethrough and a dot-dot-dash underline.$t$),
('8474e3be-5699-455d-94c4-c2c5baa473ed', 8, $t$1. Select paragraph 1.
2. HOME → Font box → **Bookman Old Style**.
3. Font Size box → type **18.5** → Enter.

Checked: paragraph 1 is Bookman Old Style, size 18.5.$t$),
('8474e3be-5699-455d-94c4-c2c5baa473ed', 9, $t$1. Select the list lines at the end of paragraph 6.
2. HOME → **Numbering ▾** → choose **I. II. III.** (capital Roman numerals).

Checked: each list line is a list item numbered I, II, III…$t$),
('8474e3be-5699-455d-94c4-c2c5baa473ed', 10, $t$1. Select paragraph 7.
2. HOME → Font group **↘** → **Advanced** tab → Spacing: **Expanded**, By: **2.5 pt** → **OK**.

Checked: paragraph 7 has character spacing expanded by 2.5 pt.$t$),
('8474e3be-5699-455d-94c4-c2c5baa473ed', 11, $t$1. Select paragraph 7.
2. HOME → **Change Case (Aa ▾)** → **tOGGLE cASE**.

Checked: paragraph 7's capital letters became small and small letters became capital.$t$),
('8474e3be-5699-455d-94c4-c2c5baa473ed', 12, $t$1. Click in paragraph 4.
2. HOME → Paragraph group **↘** → Spacing **After: 12 pt** → **OK** (or PAGE LAYOUT → Spacing After **12 pt**).

Checked: paragraph 4 has 12 pt spacing after.$t$),
('8474e3be-5699-455d-94c4-c2c5baa473ed', 13, $t$1. Select paragraph 2.
2. HOME → Font group **↘** → **Advanced** tab → Position: **Lowered**, By: **5 pt** → **OK**.

Checked: paragraph 2 is lowered by 5 pt.$t$);

-- ================= English EFFICIENCY TEST 2 (d5e201a5) =================
insert into word_solution values
('d5e201a5-1ab8-40e1-beb0-393b40f1db0e', 1, $t$**(a)** PAGE LAYOUT → **Size ▾** → **A5**.
**(b)** PAGE LAYOUT → **Margins ▾** → **Custom Margins…** → Right: **0.8"** → **OK**.
**(c)**
1. INSERT → **Header ▾** → **Blank** and type **SAMRADHI CLASSES**.
2. Select the text → HOME → **Bold**, **Center**.
3. HOME → **Underline ▾** → **Double underline**, then **Underline ▾** → **Underline Color** → **Red**.
4. **Close Header and Footer**.

Checked: (a) A5 page (b) right margin 0.8" (c) header text, bold, centred, red double underline.$t$),
('d5e201a5-1ab8-40e1-beb0-393b40f1db0e', 2, $t$**(a)** Select paragraph 4 → HOME → Font group **↘** → Underline style **Words only** → **OK** (the spaces are not underlined).
**(b)**
1. Click in paragraph 3 → HOME → Paragraph group **↘** → Indentation Right **1.0"** → **OK**.
2. PAGE LAYOUT → **Margins ▾** → **Custom Margins…** → Gutter **0.5"**, Gutter position **Left** → **OK**.
**(c)** Select paragraphs 1 and 2, hold Ctrl and select paragraphs 4 and 5 (every paragraph except the third) → HOME → **Bullets**.

Checked: (a) words-only underline in paragraph 4 (b) right indent 1.0" in paragraph 3 (c) bullets on every paragraph except the third.$t$),
('d5e201a5-1ab8-40e1-beb0-393b40f1db0e', 3, $t$**(a)** Select paragraph 1 → HOME → **Borders ▾** → **Outside Borders**. Do the same for paragraph 3.
**(b)** Click in paragraph 4 → HOME → Paragraph group **↘** → Spacing After **30 pt** → **OK**.
**(c)**
1. First set HOME → **Text Highlight Color ▾** → **Pink**.
2. HOME → **Replace** (Ctrl+H) → Find what **Guru**, Replace with **Guru**.
3. Click **More >>** → **Format ▾** → **Font…** → Font style **Italic**, Size **19**, Underline style single, Underline color **Red** → **OK**; then **Format ▾** → **Highlight**.
4. **Replace All**.

Checked: (a) borders on paragraphs 1 and 3 (b) 30 pt after paragraph 4 (c) every "Guru" italic, 19 pt, red underline, pink highlight.$t$),
('d5e201a5-1ab8-40e1-beb0-393b40f1db0e', 4, $t$**(a)** Click in the last paragraph → HOME → **Shading ▾** → **Light Green**.
**(b)** DESIGN → **Page Borders** → Setting **Box** → in Preview click the **top** and **left** edges to remove them (keep bottom and right) → **OK**.
**(c)** Select paragraph 1 → HOME → **Font Color ▾** → **Green**.

Checked: (a) light green shading on the last paragraph (b) page border on bottom and right only (c) paragraph 1 green.$t$),
('d5e201a5-1ab8-40e1-beb0-393b40f1db0e', 5, $t$**(a)** Select the whole first column of the table → Font Size **10**.
**(b)** Select the whole third row → TABLE TOOLS LAYOUT → **Align Top Center**.
**(c)** Select the whole second row → HOME → Font group **↘** → tick **Double strikethrough** → **OK**.

Checked: (a) first column 10 pt (b) third row top-centre (c) second row double strikethrough.$t$);

-- ================= English EFFICIENCY TEST 3 (2ab6ed46) =================
insert into word_solution values
('2ab6ed46-4ab4-484f-a10c-e4cb5ec2c52b', 1, $t$Highlight the words only (not the spaces):
1. Select paragraph 1.
2. HOME → **Find ▾** → **Advanced Find…** → Find what: **^$** (Any Letter) → **Find In ▾** → **Current Selection**. Every letter of the paragraph is now selected, the spaces are not.
3. **Close** the dialog → HOME → **Text Highlight Color ▾** → **Turquoise**.

Checked: the words of paragraph 1 are turquoise and the spaces are not highlighted.$t$),
('2ab6ed46-4ab4-484f-a10c-e4cb5ec2c52b', 2, $t$1. Select paragraph 2.
2. HOME → Font group **↘** → Underline style **Words only**, Underline color **Red** → **OK**.

Checked: the words of paragraph 2 have a red underline.$t$),
('2ab6ed46-4ab4-484f-a10c-e4cb5ec2c52b', 3, $t$1. Click in paragraph 3.
2. HOME → **Shading ▾** → **Green**.

Checked: paragraph 3 has a green background.$t$),
('2ab6ed46-4ab4-484f-a10c-e4cb5ec2c52b', 4, $t$**(a)** Click in paragraph 1 → HOME → Paragraph group **↘** → Indentation Left **1.1"** → **OK**.
**(b)** Select paragraph 1 → HOME → Font group **↘** → **Advanced** → Spacing **Condensed**, By **0.5 pt** → **OK**.

Checked: (a) left indent 1.1" (b) character spacing condensed by 0.5 pt.$t$),
('2ab6ed46-4ab4-484f-a10c-e4cb5ec2c52b', 5, $t$1. First set HOME → **Text Highlight Color ▾** → **Red**.
2. HOME → **Replace** (Ctrl+H) → Find what **Ajay sir**, Replace with **Ajay sir** → **More >>** → tick **Match case**.
3. **Format ▾** → **Font…** → Font color **Purple**, Underline style **double**, Underline color **Yellow** → **OK**; then **Format ▾** → **Highlight**.
4. **Replace All**.

Checked: every "Ajay sir" is purple, red-highlighted, with a yellow double underline.$t$),
('2ab6ed46-4ab4-484f-a10c-e4cb5ec2c52b', 6, $t$1. HOME → **Replace** (Ctrl+H) → **More >>** → tick **Match case**.
2. Find what **rajasthan** (small r), Replace with **punjab**.
3. With the cursor in "Replace with": **Format ▾** → **Font…** → Size **24**, Font color **Red** → **OK**.
4. **Replace All**.

Checked: no small-letter "rajasthan" is left, and each "punjab" is 24 pt red.$t$),
('2ab6ed46-4ab4-484f-a10c-e4cb5ec2c52b', 7, $t$1. INSERT → **Header ▾** → **Blank** → type **Rajasthan LDC**.
2. Select it → Font Size **24**, **Font Color** → **Green**.
3. HOME → Font group **↘** → Underline style **dot-dot-dash**, Underline color **Red** → **OK**.

Checked: header text, 24 pt green, red dot-dot-dash underline.$t$),
('2ab6ed46-4ab4-484f-a10c-e4cb5ec2c52b', 8, $t$1. INSERT → **Footer ▾** → **Blank**.
2. INSERT → **Date & Time** → choose the format like **10/13/1993 7:11:00 PM** (month/day/year with seconds and AM/PM) → **OK**.
3. HOME → **Align Left**.

Checked: the footer has the date and time in that format, left aligned.$t$),
('2ab6ed46-4ab4-484f-a10c-e4cb5ec2c52b', 9, $t$1. INSERT → **Page Number ▾** → **Bottom of Page** → **Plain Number 3** (right side).

Checked: the footer has a page number aligned right.$t$),
('2ab6ed46-4ab4-484f-a10c-e4cb5ec2c52b', 10, $t$PAGE LAYOUT → **Margins ▾** → **Moderate**.

Checked: margins are Moderate (top/bottom 1", left/right 0.75").$t$),
('2ab6ed46-4ab4-484f-a10c-e4cb5ec2c52b', 11, $t$PAGE LAYOUT → **Size ▾** → **Legal**.

Checked: page size is Legal.$t$),
('2ab6ed46-4ab4-484f-a10c-e4cb5ec2c52b', 12, $t$1. DESIGN → **Page Borders**.
2. Setting **Box**, Style: the **wavy** line, Color **Green**.
3. In Preview click the **left** and **right** edges to remove them, so only **top** and **bottom** remain → **OK**.

Checked: a green wavy page border on top and bottom only.$t$),
('2ab6ed46-4ab4-484f-a10c-e4cb5ec2c52b', 13, $t$1. Select the whole table (click the ✥ handle at its top-left corner).
2. TABLE TOOLS LAYOUT → **Align Bottom Center**.

Checked: every filled cell is bottom-centre aligned.$t$),
('2ab6ed46-4ab4-484f-a10c-e4cb5ec2c52b', 14, $t$**(a)** Click in the table → TABLE TOOLS LAYOUT → **AutoFit ▾** → **AutoFit Contents**.
**(b)** Click in the last column → TABLE TOOLS LAYOUT → **Insert Right**.

Checked: (a) AutoFit Contents (b) the table has one more column at the right end.$t$),
('2ab6ed46-4ab4-484f-a10c-e4cb5ec2c52b', 15, $t$1. Select the fourth column (the **City** column): click just above its top cell when the pointer becomes a ↓ arrow.
2. HOME → **Font Color ▾** → any colour except black and white, e.g. **Red**.

Checked: the City column's text has a colour other than black or white.$t$);

-- ================= Hindi EFFICIENCY TEST 1 (69dbc0f2) =================
insert into word_solution values
('69dbc0f2-9055-41d3-a88b-44a65d8f33c5', 1, $t$1. पहला पैराग्राफ सेलेक्ट करें।
2. HOME → Font Size बॉक्स में **14.5** टाइप करें → Enter; **Font Color ▾** → **गुलाबी (Pink)**; **Italic**।
3. HOME → Font group **↘** → Underline style **मोटी लाइन (Thick)**, Underline color **गहरा नीला (Dark Blue)** → **OK**।

जाँच: 14.5 साइज, गुलाबी, इटैलिक तथा गहरे नीले रंग की मोटी अंडरलाइन।$t$),
('69dbc0f2-9055-41d3-a88b-44a65d8f33c5', 2, $t$1. दूसरा पैराग्राफ सेलेक्ट करें।
2. HOME → **Text Effects (A ▾)** → **Outline** → **Blue** रंग चुनें।

जाँच: दूसरे पैराग्राफ के शब्दों पर नीले रंग का आउटलाइन इफेक्ट।$t$),
('69dbc0f2-9055-41d3-a88b-44a65d8f33c5', 3, $t$1. पहले पैराग्राफ में क्लिक करें → HOME → Paragraph group **↘**।
2. Indentation: Left **0.3"**, Right **0.3"**; Special **Hanging**, By **0.6"** → **OK**।

जाँच: (क) बाएँ-दाएँ इंडेंट 0.3" (ख) हैंगिंग इंडेंट 0.6"।$t$),
('69dbc0f2-9055-41d3-a88b-44a65d8f33c5', 4, $t$1. दूसरे पैराग्राफ में क्लिक करें → HOME → Paragraph group **↘**।
2. Special **First line**, By **0.9"** → **OK**।

जाँच: फर्स्ट लाइन इंडेंट 0.9"।$t$),
('69dbc0f2-9055-41d3-a88b-44a65d8f33c5', 5, $t$1. HOME → **Replace** (Ctrl+H)।
2. Find what और Replace with दोनों में कृति देव कीज़ से **ukyank** टाइप करें (यह "नालंदा" बनता है)।
3. Replace with में कर्सर रखकर **More >>** → **Format ▾** → **Font…** → Underline style **डॉट-डैश (dot-dash)**, Underline color **लाल (Red)** → **OK**।
4. **Replace All**।

जाँच: डॉक्यूमेंट के सभी "नालंदा" शब्दों पर लाल डॉट-डैश अंडरलाइन।$t$),
('69dbc0f2-9055-41d3-a88b-44a65d8f33c5', 6, $t$1. HOME → **Replace** (Ctrl+H) → Find what **jfookj** (रविवार), Replace with **lkseokj** (सोमवार) → **Replace All**।
2. पहले HOME → **Text Highlight Color ▾** → **बैंगनी (Violet)** चुन लें।
3. फिर Replace में Find what और Replace with दोनों **lkseokj** → **More >>** → **Format ▾** → **Font…** → **Bold Italic** → **OK**; **Format ▾** → **Highlight** → **Replace All**।

जाँच: (क) कोई "रविवार" नहीं बचा (ख) सभी "सोमवार" बोल्ड, इटैलिक तथा बैंगनी हाइलाइट।$t$),
('69dbc0f2-9055-41d3-a88b-44a65d8f33c5', 7, $t$1. INSERT → **Header ▾** → **Blank**।
2. फ़ॉन्ट **Kruti Dev 010** चुनकर टाइप करें: **jktLFkku ,y-Mh-lh-** (यह "राजस्थान एल.डी.सी." बनता है)।
3. टेक्स्ट सेलेक्ट करें → HOME → **Center**, Font Size **22**।

जाँच: हैडर में "राजस्थान एल.डी.सी." सेंटर में, साइज 22।$t$),
('69dbc0f2-9055-41d3-a88b-44a65d8f33c5', 8, $t$1. INSERT → **Footer ▾** → **Blank**।
2. फ़ॉन्ट **Kruti Dev 010** में टाइप करें: **vf/kuLFk cksMZ** (यह "अधिनस्थ बोर्ड" बनता है)।
3. टेक्स्ट सेलेक्ट करें → Font Size **22** → HOME → **Align Right**।

जाँच: फुटर में "अधिनस्थ बोर्ड" दाईं ओर, साइज 22।$t$),
('69dbc0f2-9055-41d3-a88b-44a65d8f33c5', 9, $t$1. INSERT → **Page Number ▾** → **Bottom of Page** → **Plain Number 1** (बाईं ओर)।
2. INSERT → **Page Number ▾** → **Format Page Numbers…** → Start at **4** → **OK**।

जाँच: फुटर में बाईं ओर पेज नंबर, जो 4 से शुरू होता है।$t$),
('69dbc0f2-9055-41d3-a88b-44a65d8f33c5', 10, $t$1. PAGE LAYOUT → **Size ▾** → **A3**।
2. PAGE LAYOUT → **Orientation ▾** → **Landscape**।

जाँच: (क) A3 पेज (ख) लैंडस्केप।$t$),
('69dbc0f2-9055-41d3-a88b-44a65d8f33c5', 11, $t$1. DESIGN → **Watermark ▾** → **Custom Watermark…** → **Text watermark**।
2. Font **Kruti Dev 010**, Text में टाइप करें: **,y-Mh-lh&2026** (यह "एल.डी.सी-2026" बनता है)।
3. Color **लाल (Red)**, **Semitransparent** का टिक हटाएँ → **OK**।

जाँच: (क) वॉटरमार्क टेक्स्ट (ख) लाल रंग, सेमी-ट्रांसपेरेंट नहीं।$t$),
('69dbc0f2-9055-41d3-a88b-44a65d8f33c5', 12, $t$1. डॉक्यूमेंट के अंत में दी गई पूरी लिस्ट सेलेक्ट करें।
2. HOME → **Multilevel List ▾** → कोई स्टाइल चुनें (1. / a. / i.)।
3. उप-बिंदुओं (sub points) में क्लिक करके **Tab** दबाएँ (या **Increase Indent**) ताकि वे दूसरे लेवल पर जाएँ।

जाँच: लिस्ट मल्टीलेवल है (कम से कम दो लेवल)।$t$),
('69dbc0f2-9055-41d3-a88b-44a65d8f33c5', 13, $t$1. टेबल की आखिरी रो में क्लिक करें।
2. TABLE TOOLS LAYOUT → **Insert Below** (या आखिरी सेल में **Tab** दबाएँ)।

जाँच: टेबल में एक नई रो जुड़ गई।$t$),
('69dbc0f2-9055-41d3-a88b-44a65d8f33c5', 14, $t$1. टेबल में क्लिक करें → TABLE TOOLS LAYOUT → **Sort**।
2. Sort by **Column 1**, Type **Text**, **Ascending** → पहली रो हैडिंग हो तो My list has **Header row** चुनें → **OK**।

जाँच: पहला कॉलम आरोही (A→Z / अ→ह) क्रम में।$t$),
('69dbc0f2-9055-41d3-a88b-44a65d8f33c5', 15, $t$1. तीसरी रो और तीसरे कॉलम वाले सैल में क्लिक करें।
2. TABLE TOOLS DESIGN → **Shading ▾** → **ऑरेंज (Orange)**।

जाँच: उस सैल का बैकग्राउंड ऑरेंज।$t$);

-- ================= Hindi EFFICIENCY TEST 2 (33a36886) =================
insert into word_solution values
('33a36886-41a9-4993-b167-dc10f2735630', 1, $t$1. पहला पैराग्राफ सेलेक्ट करें → HOME → **Replace** (Ctrl+H)।
2. Find what **document**, Replace with **document** → **More >>** → **Format ▾** → **Font…** → Underline style single, Effects **Strikethrough** → **OK**।
3. **Replace All** → आगे पूरे डॉक्यूमेंट में खोजने का पूछे तो **No**।

जाँच: पहले पैराग्राफ के सभी "document" शब्द अंडरलाइन व स्ट्राइकथ्रू।$t$),
('33a36886-41a9-4993-b167-dc10f2735630', 2, $t$पैराग्राफ 2 सेलेक्ट करें → HOME → Font Size **16**।

जाँच: पैराग्राफ 2 का साइज 16।$t$),
('33a36886-41a9-4993-b167-dc10f2735630', 3, $t$पहला पैराग्राफ सेलेक्ट करें → HOME → Font **Times New Roman**, Font Size **17**।

जाँच: (क) Times New Roman (ख) साइज 17।$t$),
('33a36886-41a9-4993-b167-dc10f2735630', 4, $t$पैराग्राफ 2 सेलेक्ट करें → HOME → **Change Case (Aa ▾)** → **tOGGLE cASE**।

जाँच: छोटे अक्षर बड़े और बड़े अक्षर छोटे हो गए।$t$),
('33a36886-41a9-4993-b167-dc10f2735630', 5, $t$पैराग्राफ 2 में क्लिक करें → HOME → **Align Right** (Ctrl+R)।

जाँच: पैराग्राफ 2 दाईं ओर अलाइन।$t$),
('33a36886-41a9-4993-b167-dc10f2735630', 6, $t$पैराग्राफ 3 सेलेक्ट करें → HOME → **Text Highlight Color ▾** → **Red**।

जाँच: पैराग्राफ 3 लाल रंग से हाइलाइट।$t$),
('33a36886-41a9-4993-b167-dc10f2735630', 7, $t$पैराग्राफ 4 सेलेक्ट करें → HOME → **Subscript** (x₂) या Ctrl+=।

जाँच: पैराग्राफ 4 सबस्क्रिप्ट।$t$),
('33a36886-41a9-4993-b167-dc10f2735630', 8, $t$1. पहला पैराग्राफ सेलेक्ट करें → **Copy** (Ctrl+C)।
2. पैराग्राफ 5 के अंत में क्लिक करें → **Enter** दबाकर नई लाइन बनाएँ → **Paste** (Ctrl+V)।

जाँच: पैराग्राफ 5 के बाद पहले पैराग्राफ की कॉपी (नया पैराग्राफ 6)।$t$),
('33a36886-41a9-4993-b167-dc10f2735630', 9, $t$1. पैराग्राफ 4 सेलेक्ट करें → HOME → **Italic**।
2. HOME → Font group **↘** → Underline style **Words only** → **OK** (हर शब्द के नीचे अंडरलाइन, स्पेस के नीचे नहीं)।

जाँच: (क) इटैलिक (ख) प्रत्येक शब्द पर अंडरलाइन।$t$),
('33a36886-41a9-4993-b167-dc10f2735630', 10, $t$पैराग्राफ 5 के बाद पेस्ट किया गया पैराग्राफ (प्रश्न 8 वाला) सेलेक्ट करें → HOME → Font **Arial Black**।

जाँच: पेस्ट किया गया पैराग्राफ Arial Black में।$t$),
('33a36886-41a9-4993-b167-dc10f2735630', 11, $t$पैराग्राफ 3 सेलेक्ट करें → HOME → **Change Case (Aa ▾)** → **Capitalize Each Word**।

जाँच: हर शब्द का पहला अक्षर बड़ा।$t$),
('33a36886-41a9-4993-b167-dc10f2735630', 12, $t$पैराग्राफ 1 में क्लिक करें → HOME → **Center** (Ctrl+E)।

जाँच: पैराग्राफ 1 बीच में अलाइन।$t$),
('33a36886-41a9-4993-b167-dc10f2735630', 13, $t$पैराग्राफ 4 सेलेक्ट करें → HOME → **Shading ▾** → **Red**।

जाँच: पैराग्राफ 4 पर लाल शैडिंग।$t$),
('33a36886-41a9-4993-b167-dc10f2735630', 14, $t$पैराग्राफ 3 में क्लिक करें → HOME → **Line and Paragraph Spacing ▾** → **2.0**।

जाँच: पैराग्राफ 3 की लाइन स्पेसिंग 2.0।$t$),
('33a36886-41a9-4993-b167-dc10f2735630', 15, $t$पैराग्राफ 5 में क्लिक करें → HOME → **Numbering** (1. 2. 3.)।

जाँच: पैराग्राफ 5 नम्बरिंग लिस्ट में।$t$);

update public.word_efficiency_questions q set solution = s.body
from word_solution s where q.version_id = s.version and q.question_number = s.number;

commit;
