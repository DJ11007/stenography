begin;

-- Admin-editable content for the Kruti Dev learn simulator
-- (/typing/learn/krutidev): its three practice tabs -- key drills, word
-- sets and paragraphs. Same shape as classroom_updates: a plain table
-- reachable only through security-definer RPCs (RLS on, no policies), an
-- anon read for the tutor page and is_aal2_admin()-gated writes.
--
-- Stored in Unicode Hindi (readable/reviewable); the tutor page converts
-- to keyboard-typeable Kruti Dev bytes with toTypeableKrutiDev at request
-- time, exactly as it did with the bundled lib/krutidev-tutor-content.ts
-- defaults -- which stay as a fallback for when this table is empty.
-- key-lesson content is one drill line per newline; word-set content is
-- space-separated words; paragraph content is the passage.

create table if not exists public.krutidev_tutor_exercises(
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('key-lesson','word-set','paragraph')),
  title text not null,
  content text not null default '',
  focus_keys text,
  is_published boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
alter table public.krutidev_tutor_exercises enable row level security;
create index if not exists krutidev_tutor_exercises_listing
  on public.krutidev_tutor_exercises(is_published, kind, display_order, created_at);

create or replace function public.list_published_krutidev_exercises()
returns setof public.krutidev_tutor_exercises
language sql stable security definer set search_path=public as $fn$
  select * from public.krutidev_tutor_exercises where is_published
  order by kind, display_order, created_at;
$fn$;

create or replace function public.admin_list_krutidev_exercises()
returns setof public.krutidev_tutor_exercises
language plpgsql stable security definer set search_path=public as $fn$
begin
  if not public.is_aal2_admin() then raise exception 'not authorized'; end if;
  return query select * from public.krutidev_tutor_exercises order by kind, display_order, created_at;
end $fn$;

create or replace function public.admin_save_krutidev_exercise(
  p_id uuid, p_kind text, p_title text, p_content text, p_focus_keys text,
  p_is_published boolean, p_display_order integer
) returns public.krutidev_tutor_exercises
language plpgsql security definer set search_path=public as $fn$
declare row public.krutidev_tutor_exercises;
begin
  if not public.is_aal2_admin() then raise exception 'not authorized'; end if;
  if p_kind not in ('key-lesson','word-set','paragraph') then raise exception 'Invalid exercise type.'; end if;
  if trim(coalesce(p_title,'')) = '' then raise exception 'Title is required.'; end if;
  if trim(coalesce(p_content,'')) = '' then raise exception 'Content is required.'; end if;
  if p_id is null then
    insert into public.krutidev_tutor_exercises(kind,title,content,focus_keys,is_published,display_order,created_by)
    values(p_kind, p_title, p_content, nullif(trim(coalesce(p_focus_keys,'')),''),
           coalesce(p_is_published,true), coalesce(p_display_order,0), auth.uid())
    returning * into row;
  else
    update public.krutidev_tutor_exercises set
      kind=p_kind, title=p_title, content=p_content,
      focus_keys=nullif(trim(coalesce(p_focus_keys,'')),''),
      is_published=coalesce(p_is_published,true), display_order=coalesce(p_display_order,0), updated_at=now()
    where id=p_id returning * into row;
    if row.id is null then raise exception 'Exercise not found.'; end if;
  end if;
  return row;
end $fn$;

create or replace function public.admin_delete_krutidev_exercise(p_id uuid) returns void
language plpgsql security definer set search_path=public as $fn$
begin
  if not public.is_aal2_admin() then raise exception 'not authorized'; end if;
  delete from public.krutidev_tutor_exercises where id=p_id;
end $fn$;

grant execute on function public.list_published_krutidev_exercises() to anon, authenticated;
revoke all on function public.admin_list_krutidev_exercises(),
  public.admin_save_krutidev_exercise(uuid,text,text,text,text,boolean,integer),
  public.admin_delete_krutidev_exercise(uuid) from public, anon;
grant execute on function public.admin_list_krutidev_exercises(),
  public.admin_save_krutidev_exercise(uuid,text,text,text,text,boolean,integer),
  public.admin_delete_krutidev_exercise(uuid) to authenticated;

-- Seed the current bundled curriculum so the admin has real content to edit.
do $seed$
begin
  if not exists (select 1 from public.krutidev_tutor_exercises) then
    insert into public.krutidev_tutor_exercises (kind, title, content, focus_keys, display_order) values
      ('key-lesson', 'पाठ 1 — क  र  (d j)', E'कर करक रकर कक रर\nकर रक कर रक कररक\nरकरक कररक रकर कर', 'd j', 0),
      ('key-lesson', 'पाठ 2 — ा  ी  (k h)', E'का रा कार रार\nकी री कारी रीका\nकारी रकार राका कीरा', 'k h', 1),
      ('key-lesson', 'पाठ 3 — ह  (g)', E'हर हार हारी हरी\nहा हा हाहा राही\nहीरा हरी हार कहार', 'g', 2),
      ('key-lesson', 'पाठ 4 — स  (l)', E'सर सार सारी हरस\nरस रास सरहर सहसा\nसराहा हसरस सारस', 'l', 3),
      ('key-lesson', 'पाठ 5 — े  (s)', E'के रे सेर हेर\nसेहरा केसर हेरा\nरेस सेरा हेरे केरे', 's', 4),
      ('key-lesson', 'पाठ 6 — ि  ं  य  (f a ;)', E'यह किस रिस हिस\nकहीं यहीं सहसा\nकिसी यकीन हरियस', 'f a ;', 5),
      ('key-lesson', 'पाठ 7 — त  ज  (r t)', E'तर तार जार जीत\nजाति रीति ताकत\nजरा तेरा जीरा तीर', 'r t', 6),
      ('key-lesson', 'पाठ 8 — म  न  (e u)', E'मन नमन मान नाम\nमीना नाना मनन\nनमक मकान नियम', 'e u', 7),
      ('key-lesson', 'पाठ 9 — प  व  च  (i o p)', E'पर पार पवन चयन\nवचन विचार पावन\nचावल पानी वीर चीर', 'i o p', 8),
      ('key-lesson', 'पाठ 10 — ल  ग  ब  (y x c)', E'लाल बाग बगल गला\nबालक कमल सबल\nगगन लगन बचत जंगल', 'y x c', 9),
      ('key-lesson', 'पाठ 11 — द  अ  इ  उ  (n v b m)', E'अब दर उदय इधर\nअनार अदब उबल\nदिन उधार अपना इनाम', 'n v b m', 10),
      ('key-lesson', 'पाठ 12 — ु  ू  ृ  (q w `)', E'गुण सुख दुख कृपा\nपूरा सूरज गुरु\nकृषि मृदु रुचि धुन', 'q w `', 11),
      ('key-lesson', 'पाठ 13 — ो  ौ  (a+s)', E'को सो रोज मोर\nबोल तोल कौन दौर\nसोना रोटी चोर औरत', 'a s', 12),
      ('key-lesson', 'पाठ 14 — आधे अक्षर  (Shift + D R T U L)', E'सत्य नित्य कर्म धर्म\nस्वर वस्तु सक्ति\nअस्त पुस्तक समस्या', 'D R T U L', 13),
      ('key-lesson', 'पाठ 15 — संयुक्त अक्षर  (Z { J K)', E'ज्ञान क्षमा श्रम कर्ज\nराष्ट्र विज्ञान प्रश्न\nक्षेत्र श्रेणी अक्षर', 'Z { J K', 14),
      ('key-lesson', 'पाठ 16 — अंक और चिह्न  (1 2 3 . ,)', E'12 34 56 78 90\nराम, श्याम, मोहन।\nपृष्ठ 15, अध्याय 3।', '1 2 3 . ,', 15),
      ('word-set', 'शब्द समूह 1 — सरल दो अक्षर', 'कल जल फल थल हम तुम कब जब सब अब घर डर मन धन कण रण वन तन गया लिया दिया', null, 16),
      ('word-set', 'शब्द समूह 2 — तीन अक्षर', 'कमल कपड़ा नगर सड़क मकान समय जीवन दुनिया रचना कहानी परिवार विद्यालय पुस्तक अध्यापक विद्यार्थी', null, 17),
      ('word-set', 'शब्द समूह 3 — मात्राओं का अभ्यास', 'पानी नानी दादी चाची मामा काका रोटी मोती सोना रोना गाना खाना पीना सीना जीना हीरा', null, 18),
      ('word-set', 'शब्द समूह 4 — संयुक्त अक्षर', 'ज्ञान विज्ञान प्रयोग प्रश्न क्षेत्र क्षमता राष्ट्र स्वास्थ्य विश्वास श्रम श्रेय अध्ययन उद्योग विद्युत मुख्य', null, 19),
      ('word-set', 'शब्द समूह 5 — रेफ और आधे अक्षर', 'कर्म धर्म वर्ष सूर्य कार्य पूर्ण अर्थ स्पर्श गर्व दर्द मार्ग वर्ग सर्दी बर्फ चर्चा', null, 20),
      ('word-set', 'शब्द समूह 6 — दैनिक जीवन', 'सुबह शाम दोपहर रात दिन सप्ताह महीना वर्ष घंटा मिनट सेकंड आज कल परसों अभी', null, 21),
      ('word-set', 'शब्द समूह 7 — प्रकृति', 'नदी पर्वत सागर आकाश धरती सूरज चंद्रमा तारा बादल वर्षा हवा आग मिट्टी वृक्ष फूल', null, 22),
      ('word-set', 'शब्द समूह 8 — कार्यालय', 'पत्र फाइल आवेदन हस्ताक्षर अधिकारी कर्मचारी विभाग कार्यालय बैठक सूचना आदेश नियम प्रस्ताव रिपोर्ट परियोजना', null, 23),
      ('word-set', 'शब्द समूह 9 — शिक्षा', 'शिक्षक छात्र कक्षा परीक्षा प्रश्नपत्र उत्तर अंक परिणाम प्रमाणपत्र पाठ्यक्रम पुस्तकालय प्रयोगशाला शोध ज्ञान कौशल', null, 24),
      ('word-set', 'शब्द समूह 10 — समाज और देश', 'भारत राष्ट्र नागरिक समाज संस्कृति परंपरा स्वतंत्रता अधिकार कर्तव्य लोकतंत्र संविधान न्याय समानता एकता विकास', null, 25),
      ('word-set', 'शब्द समूह 11 — भाव और गुण', 'प्रेम स्नेह करुणा दया क्षमा साहस धैर्य विनम्रता सच्चाई ईमानदारी परिश्रम लगन उत्साह आत्मविश्वास सहनशीलता', null, 26),
      ('word-set', 'शब्द समूह 12 — मिश्रित कठिन शब्द', 'उत्तरदायित्व प्रतिनिधित्व अंतरराष्ट्रीय व्यावसायिक वैज्ञानिक तकनीकी संवैधानिक प्रशासनिक बुनियादी संरचना क्रियान्वयन मूल्यांकन प्रोत्साहन उपलब्धि सशक्तिकरण', null, 27),
      ('paragraph', 'अनुच्छेद 1 — परिचय', 'हिन्दी हमारी राजभाषा है और यह करोड़ों लोगों के मन की भाषा है। कंप्यूटर पर हिन्दी टाइप करना अब पहले से कहीं आसान हो गया है। जो व्यक्ति नियमित अभ्यास करता है वह कुछ ही सप्ताह में अच्छी गति प्राप्त कर लेता है। सही अंगुली से सही कुंजी दबाना ही तेज़ टाइपिंग का पहला नियम है।', null, 28),
      ('paragraph', 'अनुच्छेद 2 — अभ्यास का महत्व', 'किसी भी कौशल को सीखने के लिए धैर्य और निरंतर अभ्यास सबसे ज़रूरी है। आरंभ में गति धीमी रहती है और गलतियाँ भी होती हैं, परंतु घबराना नहीं चाहिए। प्रतिदिन आधा घंटा अभ्यास करने से हाथ कुंजियों की स्थिति याद कर लेते हैं। धीरे धीरे बिना कीबोर्ड देखे टाइप करना संभव हो जाता है।', null, 29),
      ('paragraph', 'अनुच्छेद 3 — शुद्धता पहले', 'टाइपिंग सीखते समय गति से अधिक शुद्धता पर ध्यान देना चाहिए। यदि आप शुरू से ही सही कुंजी दबाने की आदत डालेंगे तो गति अपने आप बढ़ जाएगी। बार बार की गई गलती एक आदत बन जाती है जिसे बाद में सुधारना कठिन होता है। इसलिए हर शब्द को ध्यान से और सही ढंग से टाइप करें।', null, 30),
      ('paragraph', 'अनुच्छेद 4 — कार्यालयी पत्र', 'सेवा में, श्रीमान कार्यालय अध्यक्ष महोदय। विषय, कार्यालय में हिन्दी टाइपिंग प्रशिक्षण आरंभ करने के संबंध में। महोदय, निवेदन है कि विभाग के कर्मचारियों को हिन्दी में कार्य करने में कठिनाई होती है। अतः अनुरोध है कि एक प्रशिक्षण कार्यक्रम आयोजित किया जाए ताकि सभी कर्मचारी शुद्ध और तेज़ हिन्दी टाइप कर सकें।', null, 31),
      ('paragraph', 'अनुच्छेद 5 — समाचार शैली', 'राज्य सरकार ने कहा है कि आगामी वर्ष से सभी सरकारी कार्यालयों में कामकाज मुख्य रूप से हिन्दी में किया जाएगा। इसके लिए कर्मचारियों को विशेष प्रशिक्षण दिया जाएगा और आवश्यक सुविधाएँ उपलब्ध कराई जाएँगी। अधिकारियों का मानना है कि इस कदम से आम नागरिकों को अपनी बात रखने में सुविधा होगी।', null, 32),
      ('paragraph', 'अनुच्छेद 6 — प्रेरणा', 'सफलता उन्हीं को मिलती है जो कठिन परिश्रम से नहीं घबराते। रास्ते में आने वाली बाधाएँ हमें रोकने के लिए नहीं, बल्कि हमें मज़बूत बनाने के लिए होती हैं। जो लोग हार नहीं मानते और लगातार प्रयास करते रहते हैं, समय आने पर वे अवश्य अपने लक्ष्य तक पहुँचते हैं। आत्मविश्वास बनाए रखें और आगे बढ़ते रहें।', null, 33),
      ('paragraph', 'अनुच्छेद 7 — तकनीक और भविष्य', 'आज का युग सूचना और तकनीक का युग है। जो देश नई तकनीक को जल्दी अपनाते हैं वे तेज़ी से विकास करते हैं। हमें अपनी भाषा में विज्ञान, गणित और तकनीक का ज्ञान बढ़ाना होगा ताकि हर विद्यार्थी बिना किसी झिझक के नए विषयों को समझ सके। भाषा केवल बोलचाल का साधन नहीं, बल्कि सोचने और सीखने का आधार है।', null, 34),
      ('paragraph', 'अनुच्छेद 8 — दीर्घ अभ्यास', 'एक अच्छा टंकक बनने के लिए यह आवश्यक है कि हाथों की मुद्रा सही हो, कमर सीधी हो और आँखें स्क्रीन पर टिकी रहें। कुंजीपटल को बार बार देखने की आदत गति को कम करती है। आरंभ में यह कठिन लगता है, परंतु कुछ दिनों के नियमित अभ्यास के बाद अंगुलियाँ स्वयं सही कुंजी तक पहुँचने लगती हैं। प्रतिदिन नए शब्दों और अनुच्छेदों का अभ्यास करने से शब्द भंडार भी बढ़ता है और आत्मविश्वास भी। यही निरंतरता एक साधारण विद्यार्थी को कुशल टंकक बना देती है।', null, 35);
  end if;
end $seed$;

commit;
