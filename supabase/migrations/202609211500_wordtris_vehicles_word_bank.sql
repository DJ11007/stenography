begin;

-- Real requested content update: replace the "Cars" (now "Vehicles")
-- Hindi word bank with the admin's own 50-word list, and clean up one
-- pre-existing corrupted entry (word stored as raw Kruti Dev legacy
-- bytes instead of Unicode -- the same class of mistake
-- app/admin/wordtris-words/wordtris-words-manager.tsx now blocks going
-- forward) that this replacement also removes for free.
delete from public.wordtris_word_banks where language='hindi' and category='cars';

insert into public.wordtris_word_banks(language, category, word, is_published) values
  ('hindi','cars','कार',true),
  ('hindi','cars','बस',true),
  ('hindi','cars','ट्रक',true),
  ('hindi','cars','मोटरसाइकिल',true),
  ('hindi','cars','स्कूटर',true),
  ('hindi','cars','साइकिल',true),
  ('hindi','cars','रिक्शा',true),
  ('hindi','cars','ऑटो रिक्शा',true),
  ('hindi','cars','टैक्सी',true),
  ('hindi','cars','जीप',true),
  ('hindi','cars','वैन',true),
  ('hindi','cars','एम्बुलेंस',true),
  ('hindi','cars','दमकल गाड़ी',true),
  ('hindi','cars','पुलिस जीप',true),
  ('hindi','cars','ट्रैक्टर',true),
  ('hindi','cars','ट्रॉली',true),
  ('hindi','cars','बुलडोजर',true),
  ('hindi','cars','क्रेन',true),
  ('hindi','cars','रोड रोलर',true),
  ('hindi','cars','कचरा गाड़ी',true),
  ('hindi','cars','पानी का टैंकर',true),
  ('hindi','cars','दूध की गाड़ी',true),
  ('hindi','cars','स्कूल बस',true),
  ('hindi','cars','मिनी बस',true),
  ('hindi','cars','पिकअप गाड़ी',true),
  ('hindi','cars','डंपर',true),
  ('hindi','cars','सीमेंट मिक्सर',true),
  ('hindi','cars','कंटेनर ट्रक',true),
  ('hindi','cars','मालगाड़ी',true),
  ('hindi','cars','रेलगाड़ी',true),
  ('hindi','cars','मेट्रो रेल',true),
  ('hindi','cars','ट्राम',true),
  ('hindi','cars','मोनोरेल',true),
  ('hindi','cars','हवाई जहाज',true),
  ('hindi','cars','हेलीकॉप्टर',true),
  ('hindi','cars','ग्लाइडर',true),
  ('hindi','cars','गर्म हवा का गुब्बारा',true),
  ('hindi','cars','नाव',true),
  ('hindi','cars','मोटरबोट',true),
  ('hindi','cars','जहाज',true),
  ('hindi','cars','पनडुब्बी',true),
  ('hindi','cars','नौका',true),
  ('hindi','cars','स्टीमर',true),
  ('hindi','cars','फेरी',true),
  ('hindi','cars','बैलगाड़ी',true),
  ('hindi','cars','घोड़ागाड़ी',true),
  ('hindi','cars','ऊँटगाड़ी',true),
  ('hindi','cars','ई-रिक्शा',true),
  ('hindi','cars','इलेक्ट्रिक कार',true),
  ('hindi','cars','एम्बुलेंस वैन',true);

commit;

