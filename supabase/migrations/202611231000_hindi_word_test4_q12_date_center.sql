-- Hindi Word Efficiency Test 4, Q12 (23 Nov 2026): the question did not say where in the footer the date and time go.
-- It now says the centre (सेंटर / मध्य में), and is marked so: the date one Tab in (the footer's centre tab stop -- the
-- footer text sits at the left, Q14's page number at the right), or a footer line aligned centre. The model answer
-- had the date two Tabs in (the right side); it now has it one Tab in, with the date the question gives.
-- Existing marks are left as they are; new attempts use this rule.
do $$
declare v uuid; q uuid;
begin
  select t.current_version_id into v from public.word_efficiency_tests t where t.language = 'Hindi' and t.title = 'EFFICIENCY TEST 4';
  if v is null then return; end if;
  select id into q from public.word_efficiency_questions where version_id = v and question_number = 12;
  if q is null then return; end if;

  update public.word_efficiency_questions set
    instruction = 'पेज के फूटर में सेंटर (मध्य) में दिनांक व समय - 24 December 2026 3:30PM दिजिए।',
    solution = E'1. फूटर खोलें (INSERT → **Footer ▾** → **Edit Footer**)।\n2. फूटर के बाएँ लिखे टेक्स्ट के बाद **Tab** एक बार दबाएँ — कर्सर फूटर के बीच (सेंटर) में आ जाएगा।\n3. HEADER & FOOTER TOOLS **DESIGN** → **Date & Time** → फॉर्मेट **24 December 2026 3:30 PM** जैसा (d MMMM yyyy h:mm am/pm) चुनें → **OK**।\n4. **Close Header and Footer**।\n\n(या दिनांक को फूटर की अलग लाइन में लिखकर उस लाइन को **Center** अलाइन करें।)\n\nजाँच: फूटर के बीच (सेंटर) में दिनांक व समय।'
  where id = q;

  update public.word_efficiency_grading_rules set additional_criteria = '[{"rule":"anyOf","criteria":[
    {"kind":"footer","rule":"run","props":{"field":{"regex":"^date-time"},"text":{"regex":"^\\t(?!\\t)"}}},
    {"kind":"footer","rule":"run","props":{"text":{"regex":"^\\t[0-9]{1,2}[ /.-]([A-Za-z]+|[0-9]{1,2})[ /.-][0-9]{4}.{0,3}[0-9]{1,2}:[0-9]{2}"}}},
    {"rule":"allOf","criteria":[
      {"rule":"anyOf","criteria":[{"kind":"footer","rule":"run","props":{"field":{"regex":"^date-time"}}},{"find":"24 December 2026","kind":"footer","rule":"text"},{"kind":"footer","rule":"run","props":{"text":{"regex":"[0-9]{1,2}[ /.-]([A-Za-z]+|[0-9]{1,2})[ /.-][0-9]{4}.{0,3}[0-9]{1,2}:[0-9]{2}"}}}]},
      {"kind":"footer","rule":"value","spec":["center"],"place":0,"target":"blocks.0.alignment"}]}]}]'::jsonb
  where question_id = q;

  -- Model answer: the footer's date run, one Tab in (centre), with the question's date.
  update public.word_efficiency_versions ver set model_answer_snapshot = jsonb_set(ver.model_answer_snapshot, '{blocks}', (
    select jsonb_agg(case when b->>'type' = 'footer' then jsonb_set(b, '{runs}', (
        select jsonb_agg(case when r->>'field' like 'date-time%' then jsonb_set(r, '{text}', to_jsonb(E'\t24 December 2026 3:30 PM'::text)) else r end order by j)
        from jsonb_array_elements(b->'runs') with ordinality y(r, j))) else b end order by i)
    from jsonb_array_elements(ver.model_answer_snapshot->'blocks') with ordinality x(b, i)))
  where ver.id = v and ver.model_answer_snapshot is not null;
end $$;
