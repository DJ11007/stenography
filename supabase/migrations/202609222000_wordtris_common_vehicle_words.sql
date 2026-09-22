begin;

-- Real requested content update: replace the Hindi "common" word bank
-- (previously a fixed list of grammatical particles -- और, के, का...)
-- with the admin's own 28-word vehicle/equipment list. The category id
-- stays "common"; only its content changes. Each word's exact Kruti Dev
-- 010 keystroke sequence (what the games actually validate against, not
-- this table) is verified separately in lib/kruti-dev-word-bank.ts.
delete from public.wordtris_word_banks where language='hindi' and category='common';

insert into public.wordtris_word_banks(language, category, word, is_published) values
  ('hindi','common','सीमेंट',true),
  ('hindi','common','मिक्सर',true),
  ('hindi','common','इलेक्ट्रिक',true),
  ('hindi','common','नौका',true),
  ('hindi','common','गर्म हवा का गुब्बारा',true),
  ('hindi','common','गाड़ी',true),
  ('hindi','common','ट्रक',true),
  ('hindi','common','ई-रिक्शा',true),
  ('hindi','common','रिक्शा',true),
  ('hindi','common','स्कूटर',true),
  ('hindi','common','कार',true),
  ('hindi','common','फेरी',true),
  ('hindi','common','ट्रॉली',true),
  ('hindi','common','ग्लाइडर',true),
  ('hindi','common','पनडुब्बी',true),
  ('hindi','common','टैक्सी',true),
  ('hindi','common','स्कूल बस',true),
  ('hindi','common','एम्बुलेंस',true),
  ('hindi','common','पुलिस जीप',true),
  ('hindi','common','बैलगाड़ी',true),
  ('hindi','common','क्रेन',true),
  ('hindi','common','रोड रोलर',true),
  ('hindi','common','मालगाड़ी',true),
  ('hindi','common','पानी का टैंकर',true),
  ('hindi','common','हवाई जहाज',true),
  ('hindi','common','ऑटो',true),
  ('hindi','common','नाव',true),
  ('hindi','common','बुलडोजर',true);

commit;
