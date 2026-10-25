-- English EFFICIENCY TEST 3 (version 2ab6ed46), Q5 and Q6 gave marks to almost nobody (2 and 1 of 94
-- attempts). Students do these with Find/Replace and Match case ticked, as the paper quotes the words:
-- "Ajay sir" and "rajasthan". MS Word then changes only that exact spelling, so "ajay sir" and
-- "Rajasthan" stay as they were. Both answers now get the marks.
--  Q5  every "Ajay sir" (as written) in paragraphs 1, 3 and 4 red highlight, purple, double yellow underline.
--      Paragraph 1's may keep Q1's turquoise highlight (Q1 highlights that whole paragraph). The lowercase
--      "ajay sir" in paragraph 2 (Q2's words-only underline) and paragraph 5 are not required.
--  Q6a no lowercase "rajasthan" left, and 2 or 3 "punjab" (the capitalised "Rajasthan" may stay or become "Punjab").
--  Q6b every "punjab" red, 24 pt.
begin;

update public.word_efficiency_grading_rules set additional_criteria = '[
 {"rule":"text","kind":"body","place":0,"find":"Ajay sir","caseSensitive":true,"props":{"color":["7030A0","800080"],"highlight":["FF0000","00FFFF"],"underline":[true],"underlineColor":["FFFF00"],"underlineStyle":["double"]}},
 {"rule":"text","kind":"body","place":2,"find":"Ajay sir","caseSensitive":true,"props":{"color":["7030A0","800080"],"highlight":["FF0000"],"underline":[true],"underlineColor":["FFFF00"],"underlineStyle":["double"]}},
 {"rule":"text","kind":"body","place":3,"find":"Ajay sir","caseSensitive":true,"props":{"color":["7030A0","800080"],"highlight":["FF0000"],"underline":[true],"underlineColor":["FFFF00"],"underlineStyle":["double"]}}
]'::jsonb
where id='79028fe1-d912-4e4a-ae9c-d7bb524241d7' and version_id='2ab6ed46-4ab4-484f-a10c-e4cb5ec2c52b';

update public.word_efficiency_grading_rules set additional_criteria = '[
 {"rule":"text","kind":"body","find":"rajasthan","caseSensitive":true,"minCount":0,"maxCount":0},
 {"rule":"text","kind":"body","find":"punjab","minCount":2,"maxCount":3}
]'::jsonb
where id='a36238b6-9f06-4319-82bf-2b51ce29827e' and version_id='2ab6ed46-4ab4-484f-a10c-e4cb5ec2c52b';

update public.word_efficiency_grading_rules set additional_criteria = '[
 {"rule":"text","kind":"body","find":"punjab","minCount":2,"props":{"color":["FF0000"],"fontSize":[24]}}
]'::jsonb
where id='20b56af2-5213-452b-a6a2-fcd281109082' and version_id='2ab6ed46-4ab4-484f-a10c-e4cb5ec2c52b';

commit;
