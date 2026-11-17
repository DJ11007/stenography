-- Hindi Word Efficiency Test 3, Q6 ("paragraph 3 background colour light green").
-- Q7 then asks for the word "document" in the same paragraph to be highlighted red, so many
-- students made the paragraph light green with Text Highlight (every word light green, the
-- "document" words red) instead of paragraph Shading, and got 0. Both now count; any other
-- colour (e.g. dark Green 00B050) still gets no marks. Applied 2026-11-17 together with a
-- Q6 regrade of all attempts (34 raised from 0 to 1.66, none lowered).
update public.word_efficiency_grading_rules
set additional_criteria = '[{"rule":"anyOf","criteria":[{"kind":"body","place":2,"target":"blocks.2.attrs.backgroundColor","ignoreCase":false,"alternatives":[],"expectedValue":"rgb(146, 208, 80)"},{"kind":"body","rule":"words","place":2,"except":["document"],"props":{"highlight":["92D050"]}}]}]'::jsonb
where id in ('89d5e781-2e31-4f96-9263-9824444947cd', 'b4dad236-1b61-4134-a7a9-716cd611456b');
