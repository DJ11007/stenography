-- Excel Efficiency: the workspace becomes Excel 2013-like, so a saved sheet (schemaVersion "3") also holds
-- font size / font / vertical alignment / wrap per cell, merged ranges, and the sheet's page settings
-- (gridlines, headings, print area, orientation, paper size, margins, header and footer). Version "2"
-- sheets stay valid.
-- Marking: rules with criteria (expected_operation 'rule-criteria', additional_criteria) and part labels,
-- summed per question; a submitted attempt is marked at once and, when every question has rules and the
-- test allows it, its result is published straight away (as for Word Efficiency).
begin;

-- ---------- saved sheet ----------
create or replace function public.assert_excel_efficiency_cells(cells jsonb)
returns void language plpgsql immutable set search_path to 'pg_catalog', 'public' as $function$
declare cell_ref text; cell_value jsonb; cell_count integer := 0;
begin
 if jsonb_typeof(cells) <> 'object' then raise exception 'Sheet cells must be an object'; end if;
 for cell_ref, cell_value in select * from jsonb_each(cells) loop
  cell_count := cell_count + 1; if cell_count > 5000 then raise exception 'Sheet has too many cells'; end if;
  if cell_ref !~ '^[A-Z]{1,2}[0-9]{1,3}$' then raise exception 'Invalid cell reference %', cell_ref; end if;
  if jsonb_typeof(cell_value) <> 'object' or not (cell_value ?& array['value','formula','bold','italic','underline','fontColor','fillColor','border','numberFormat','align'])
     or exists (select 1 from jsonb_object_keys(cell_value) as cell_keys(key_name) where cell_keys.key_name <> all (array['value','formula','bold','italic','underline','fontColor','fillColor','border','numberFormat','align','fontSize','fontFamily','vAlign','wrap'])) then raise exception 'Invalid cell fields at %', cell_ref; end if;
  if jsonb_typeof(cell_value->'value') not in ('string','number','null') or (jsonb_typeof(cell_value->'value') = 'string' and length(cell_value->>'value') > 1000) then raise exception 'Invalid cell value at %', cell_ref; end if;
  if jsonb_typeof(cell_value->'formula') not in ('string','null') or (jsonb_typeof(cell_value->'formula') = 'string' and (length(cell_value->>'formula') > 200 or cell_value->>'formula' !~ '^=[A-Za-z0-9():,+\-*/.\s$<>="&%]{0,200}$')) then raise exception 'Invalid formula at %', cell_ref; end if;
  if jsonb_typeof(cell_value->'bold') <> 'boolean' or jsonb_typeof(cell_value->'italic') <> 'boolean' or jsonb_typeof(cell_value->'underline') <> 'boolean' then raise exception 'Invalid cell style flags at %', cell_ref; end if;
  if jsonb_typeof(cell_value->'fontColor') not in ('string','null') or (jsonb_typeof(cell_value->'fontColor') = 'string' and cell_value->>'fontColor' !~ '^[0-9A-Fa-f]{6}$') then raise exception 'Invalid font color at %', cell_ref; end if;
  if jsonb_typeof(cell_value->'fillColor') not in ('string','null') or (jsonb_typeof(cell_value->'fillColor') = 'string' and cell_value->>'fillColor' !~ '^[0-9A-Fa-f]{6}$') then raise exception 'Invalid fill color at %', cell_ref; end if;
  if jsonb_typeof(cell_value->'border') not in ('string','null') or (jsonb_typeof(cell_value->'border') = 'string' and length(cell_value->>'border') > 50) then raise exception 'Invalid border at %', cell_ref; end if;
  if jsonb_typeof(cell_value->'numberFormat') not in ('string','null') or (jsonb_typeof(cell_value->'numberFormat') = 'string' and cell_value->>'numberFormat' not in ('General','Number','Currency','Percentage')) then raise exception 'Invalid number format at %', cell_ref; end if;
  if jsonb_typeof(cell_value->'align') not in ('string','null') or (jsonb_typeof(cell_value->'align') = 'string' and cell_value->>'align' not in ('left','center','right')) then raise exception 'Invalid alignment at %', cell_ref; end if;
  if cell_value ? 'fontSize' and (jsonb_typeof(cell_value->'fontSize') not in ('number','null') or (jsonb_typeof(cell_value->'fontSize') = 'number' and (cell_value->>'fontSize')::numeric not between 1 and 409)) then raise exception 'Invalid font size at %', cell_ref; end if;
  if cell_value ? 'fontFamily' and (jsonb_typeof(cell_value->'fontFamily') not in ('string','null') or length(coalesce(cell_value->>'fontFamily','')) > 60) then raise exception 'Invalid font at %', cell_ref; end if;
  if cell_value ? 'vAlign' and (jsonb_typeof(cell_value->'vAlign') not in ('string','null') or (jsonb_typeof(cell_value->'vAlign') = 'string' and cell_value->>'vAlign' not in ('top','middle','bottom'))) then raise exception 'Invalid vertical alignment at %', cell_ref; end if;
  if cell_value ? 'wrap' and jsonb_typeof(cell_value->'wrap') not in ('boolean','null') then raise exception 'Invalid wrap text at %', cell_ref; end if;
 end loop;
end $function$;

create or replace function public.assert_excel_efficiency_document_schema(d jsonb)
returns void language plpgsql immutable set search_path to 'pg_catalog', 'public' as $function$
declare allowed text[]; item jsonb; s jsonb;
begin
 if d is null or jsonb_typeof(d) <> 'object' or pg_column_size(d) > 2097152 then raise exception 'Document snapshot must be a bounded JSON object'; end if;
 if d->>'schemaVersion' not in ('2','3') then raise exception 'Document schema is incompatible'; end if;
 allowed := case when d->>'schemaVersion' = '3' then array['schemaVersion','rows','cols','cells','merges','sheet','operations','savedAt'] else array['schemaVersion','rows','cols','cells','operations','savedAt'] end;
 if not (d ?& array['schemaVersion','rows','cols','cells','operations','savedAt']) or exists (select 1 from jsonb_object_keys(d) as document_keys(key_name) where document_keys.key_name <> all (allowed)) then raise exception 'Unknown document field'; end if;
 if jsonb_typeof(d->'rows') <> 'number' or (d->>'rows')::integer not between 1 and 200 then raise exception 'Invalid row count'; end if;
 if jsonb_typeof(d->'cols') <> 'number' or (d->>'cols')::integer not between 1 and 26 then raise exception 'Invalid column count'; end if;
 if jsonb_typeof(d->'operations') <> 'array' or jsonb_array_length(d->'operations') > 256 or exists (select 1 from jsonb_array_elements_text(d->'operations') op where length(op) > 60) then raise exception 'Invalid operation history'; end if;
 if jsonb_typeof(d->'savedAt') <> 'string' or length(d->>'savedAt') > 64 or (d->>'savedAt')::timestamptz is null then raise exception 'Invalid saved timestamp'; end if;
 if d ? 'merges' then
  if jsonb_typeof(d->'merges') <> 'array' or jsonb_array_length(d->'merges') > 500 then raise exception 'Invalid merged cells'; end if;
  for item in select value from jsonb_array_elements(d->'merges') loop
   if jsonb_typeof(item) <> 'string' or item#>>'{}' !~ '^[A-Z]{1,2}[0-9]{1,3}:[A-Z]{1,2}[0-9]{1,3}$' then raise exception 'Invalid merged range'; end if;
  end loop;
 end if;
 if d ? 'sheet' then
  s := d->'sheet';
  if jsonb_typeof(s) <> 'object' or length(s::text) > 4000 then raise exception 'Invalid sheet settings'; end if;
  if exists (select 1 from jsonb_object_keys(s) k where k <> all (array['gridlines','headings','formulaBar','printGridlines','printHeadings','printArea','orientation','paperSize','margins','header','footer','zoom'])) then raise exception 'Unknown sheet setting'; end if;
  if exists (select 1 from jsonb_each(s) e where e.key in ('gridlines','headings','formulaBar','printGridlines','printHeadings') and jsonb_typeof(e.value) <> 'boolean') then raise exception 'Invalid sheet option'; end if;
  if s ? 'printArea' and jsonb_typeof(s->'printArea') <> 'null' and (jsonb_typeof(s->'printArea') <> 'string' or s->>'printArea' !~ '^\$?[A-Z]{1,2}\$?[0-9]{1,3}(:\$?[A-Z]{1,2}\$?[0-9]{1,3})?$') then raise exception 'Invalid print area'; end if;
  if s ? 'orientation' and s->>'orientation' not in ('portrait','landscape') then raise exception 'Invalid orientation'; end if;
  if s ? 'paperSize' and s->>'paperSize' not in ('Letter','Legal','A4','A5','A3','Executive','Tabloid','B5') then raise exception 'Invalid paper size'; end if;
  if s ? 'margins' and s->>'margins' not in ('Normal','Wide','Narrow') then raise exception 'Invalid margins'; end if;
  if s ? 'zoom' and (jsonb_typeof(s->'zoom') <> 'number' or (s->>'zoom')::numeric not between 10 and 400) then raise exception 'Invalid zoom'; end if;
  for item in select value from jsonb_each(s) e where e.key in ('header','footer') loop
   if jsonb_typeof(item) <> 'object' or exists (select 1 from jsonb_each(item) p where p.key not in ('left','center','right') or jsonb_typeof(p.value) <> 'string' or length(p.value#>>'{}') > 255) then raise exception 'Invalid header or footer'; end if;
  end loop;
 end if;
 perform public.assert_excel_efficiency_cells(coalesce(d->'cells','{}'::jsonb));
end $function$;

-- ---------- marking ----------
alter table public.excel_efficiency_grading_rules add column if not exists additional_criteria jsonb not null default '[]'::jsonb;
alter table public.excel_efficiency_grading_rules add column if not exists part_label text;
alter table public.excel_efficiency_tests add column if not exists auto_publish_results boolean not null default true;
-- A question may have several rules, one per part (a, b, c).
alter table public.excel_efficiency_grading_rules drop constraint if exists excel_efficiency_grading_rules_version_id_question_id_key;
create unique index if not exists excel_efficiency_grading_rules_version_question_part_key on public.excel_efficiency_grading_rules (version_id, question_id, coalesce(part_label, ''));

-- Cells of a range, e.g. 'A27:C28' -> A27,B27,C27,A28,B28,C28 (also a single cell 'A1').
create or replace function public.excel_efficiency_range_cells(p_range text)
returns setof text language plpgsql immutable set search_path to 'pg_catalog', 'public' as $function$
declare m text[]; c1 integer; c2 integer; r1 integer; r2 integer; r integer; c integer;
begin
 m := regexp_match(upper(replace(coalesce(p_range,''),'$','')), '^([A-Z]{1,2})([0-9]{1,3})(?::([A-Z]{1,2})([0-9]{1,3}))?$');
 if m is null then return; end if;
 c1 := public.excel_efficiency_column_index(m[1]); r1 := m[2]::integer;
 c2 := coalesce(public.excel_efficiency_column_index(m[3]), c1); r2 := coalesce(m[4]::integer, r1);
 for r in least(r1,r2)..greatest(r1,r2) loop
  for c in least(c1,c2)..greatest(c1,c2) loop
   return next public.excel_efficiency_column_letters(c) || r;
  end loop;
 end loop;
end $function$;

create or replace function public.excel_efficiency_column_index(p_letters text)
returns integer language plpgsql immutable set search_path to 'pg_catalog', 'public' as $function$
declare v integer := 0; ch text;
begin
 if p_letters is null then return null; end if;
 foreach ch in array regexp_split_to_array(upper(p_letters), '') loop v := v * 26 + (ascii(ch) - 64); end loop;
 return v - 1;
end $function$;

create or replace function public.excel_efficiency_column_letters(p_index integer)
returns text language plpgsql immutable set search_path to 'pg_catalog', 'public' as $function$
declare v integer := p_index; out text := '';
begin
 loop out := chr(65 + (v % 26)) || out; v := v / 26 - 1; exit when v < 0; end loop;
 return out;
end $function$;

-- A cell's value for a property: the defaults a never-touched cell has in the workspace.
create or replace function public.excel_efficiency_cell_prop(p_cell jsonb, p_key text)
returns jsonb language sql immutable set search_path to 'pg_catalog', 'public' as $function$
 select case
  when p_key in ('bold','italic','underline','wrap') then coalesce(case when jsonb_typeof(p_cell->p_key) = 'boolean' then p_cell->p_key end, 'false'::jsonb)
  when p_key = 'fontSize' then coalesce(case when jsonb_typeof(p_cell->'fontSize') = 'number' then p_cell->'fontSize' end, '11'::jsonb)
  when p_key = 'fontFamily' then coalesce(case when jsonb_typeof(p_cell->'fontFamily') = 'string' then p_cell->'fontFamily' end, '"Calibri"'::jsonb)
  when p_key = 'vAlign' then coalesce(case when jsonb_typeof(p_cell->'vAlign') = 'string' then p_cell->'vAlign' end, '"bottom"'::jsonb)
  when p_key in ('fontColor','fillColor') then case when jsonb_typeof(p_cell->p_key) = 'string' then to_jsonb(upper(p_cell->>p_key)) else 'null'::jsonb end
  else coalesce(p_cell->p_key, 'null'::jsonb) end
$function$;

-- Does one property match one of the allowed values (numbers compared as numbers, text case-insensitively)?
create or replace function public.excel_efficiency_prop_matches(p_actual jsonb, p_allowed jsonb)
returns boolean language sql immutable set search_path to 'pg_catalog', 'public' as $function$
 select exists (select 1 from jsonb_array_elements(case when jsonb_typeof(p_allowed) = 'array' then p_allowed else jsonb_build_array(p_allowed) end) a(v)
  where (jsonb_typeof(a.v) = 'number' and jsonb_typeof(p_actual) = 'number' and abs((a.v#>>'{}')::numeric - (p_actual#>>'{}')::numeric) < 0.001)
     or (jsonb_typeof(a.v) = 'string' and jsonb_typeof(p_actual) = 'string' and upper(a.v#>>'{}') = upper(p_actual#>>'{}'))
     or (jsonb_typeof(a.v) in ('boolean','null') and a.v = p_actual))
$function$;

-- One criterion against a saved sheet. Kinds:
--  cells      {range, props, anchor?}  every cell (or only the first, anchor:true) has each prop in its list
--  merged     {ranges}                  each range is merged exactly
--  value      {cell, equals, formula?}  the cell's value equals the number (formula:true: and has a formula)
--  sheet      {path, equals|in|contains} a sheet setting (path like 'gridlines', 'header.right')
--  sameFormat {source, targets, keys?}  the targets have the source's formatting
--  anyOf / allOf {criteria}
create or replace function public.excel_efficiency_criterion_matches(p_doc jsonb, p_c jsonb)
returns boolean language plpgsql immutable set search_path to 'pg_catalog', 'public' as $function$
declare kind text := p_c->>'rule'; ref text; cell jsonb; prop record; item jsonb; actual jsonb; source jsonb; keys text[]; k text; first boolean;
 sheet jsonb := coalesce(p_doc->'sheet', '{}'::jsonb); merges jsonb := coalesce(p_doc->'merges', '[]'::jsonb);
begin
 if kind = 'anyOf' then
  for item in select value from jsonb_array_elements(coalesce(p_c->'criteria','[]'::jsonb)) loop if public.excel_efficiency_criterion_matches(p_doc, item) then return true; end if; end loop;
  return false;
 elsif kind = 'allOf' then
  for item in select value from jsonb_array_elements(coalesce(p_c->'criteria','[]'::jsonb)) loop if not public.excel_efficiency_criterion_matches(p_doc, item) then return false; end if; end loop;
  return true;
 elsif kind = 'cells' then
  first := true;
  for ref in select public.excel_efficiency_range_cells(p_c->>'range') loop
   cell := coalesce(p_doc->'cells'->ref, '{}'::jsonb);
   for prop in select key, value from jsonb_each(coalesce(p_c->'props','{}'::jsonb)) loop
    if not public.excel_efficiency_prop_matches(public.excel_efficiency_cell_prop(cell, prop.key), prop.value) then return false; end if;
   end loop;
   if coalesce((p_c->>'anchor')::boolean, false) then return true; end if;
   first := false;
  end loop;
  return not first;
 elsif kind = 'merged' then
  for item in select value from jsonb_array_elements(coalesce(p_c->'ranges','[]'::jsonb)) loop
   if not exists (select 1 from jsonb_array_elements_text(merges) m where upper(m) = upper(item#>>'{}')) then return false; end if;
  end loop;
  return true;
 elsif kind = 'value' then
  cell := coalesce(p_doc->'cells'->upper(p_c->>'cell'), '{}'::jsonb);
  if coalesce((p_c->>'formula')::boolean, false) and coalesce(cell->>'formula','') = '' then return false; end if;
  actual := cell->'value';
  if jsonb_typeof(actual) = 'string' and actual#>>'{}' ~ '^\s*-?[0-9]+(\.[0-9]+)?\s*$' then actual := to_jsonb((actual#>>'{}')::numeric); end if;
  return public.excel_efficiency_prop_matches(actual, p_c->'equals');
 elsif kind = 'sheet' then
  actual := sheet #> string_to_array(p_c->>'path', '.');
  if actual is null then actual := case p_c->>'path' when 'gridlines' then 'true' when 'headings' then 'true' when 'orientation' then '"portrait"' when 'paperSize' then '"Letter"' else 'null' end::jsonb; end if;
  if p_c ? 'equals' then return public.excel_efficiency_prop_matches(actual, p_c->'equals'); end if;
  if p_c ? 'in' then return public.excel_efficiency_prop_matches(case when jsonb_typeof(actual) = 'string' then to_jsonb(replace(actual#>>'{}','$','')) else actual end, p_c->'in'); end if;
  if p_c ? 'contains' then return jsonb_typeof(actual) = 'string' and position(lower(p_c->>'contains') in lower(actual#>>'{}')) > 0; end if;
  return false;
 elsif kind = 'sameFormat' then
  source := coalesce(p_doc->'cells'->upper(p_c->>'source'), '{}'::jsonb);
  keys := coalesce((select array_agg(value) from jsonb_array_elements_text(p_c->'keys')), array['bold','italic','underline','fontColor','fillColor','fontSize','fontFamily','border','align','vAlign']);
  for item in select value from jsonb_array_elements(coalesce(p_c->'targets','[]'::jsonb)) loop
   cell := coalesce(p_doc->'cells'->upper(item#>>'{}'), '{}'::jsonb);
   foreach k in array keys loop
    if public.excel_efficiency_cell_prop(cell, k) is distinct from public.excel_efficiency_cell_prop(source, k) then return false; end if;
   end loop;
  end loop;
  return true;
 end if;
 return false;
end $function$;

-- Marks for one question: the sum of its rules that are met (criteria rules: every criterion; older rules
-- through evaluate_excel_grading_rule), never more than the question's marks.
create or replace function public.excel_efficiency_score_question(p_doc jsonb, p_version uuid, p_question uuid, p_max numeric)
returns numeric language plpgsql stable set search_path to 'pg_catalog', 'public' as $function$
declare r record; total numeric := 0; ok boolean; item jsonb;
begin
 for r in select * from public.excel_efficiency_grading_rules where version_id = p_version and question_id = p_question loop
  if r.expected_operation = 'rule-criteria' then
   ok := jsonb_array_length(r.additional_criteria) > 0;
   for item in select value from jsonb_array_elements(r.additional_criteria) loop
    if not public.excel_efficiency_criterion_matches(p_doc, item) then ok := false; exit; end if;
   end loop;
   if ok then total := total + r.allocated_marks; end if;
  else
   total := total + coalesce(public.evaluate_excel_grading_rule(p_doc, r.exact_target, r.expected_operation, r.expected_value, r.allocated_marks, r.partial_marks), 0);
  end if;
 end loop;
 return least(round(total, 2), p_max);
end $function$;

-- Part marks per question, for the result page: [{label, awarded, maximum}].
create or replace function public.excel_efficiency_question_parts(p_doc jsonb, p_version uuid, p_question uuid)
returns jsonb language plpgsql stable set search_path to 'pg_catalog', 'public' as $function$
declare r record; out jsonb := '[]'::jsonb; ok boolean; item jsonb;
begin
 for r in select * from public.excel_efficiency_grading_rules where version_id = p_version and question_id = p_question and part_label is not null order by part_label loop
  ok := jsonb_array_length(r.additional_criteria) > 0;
  for item in select value from jsonb_array_elements(r.additional_criteria) loop
   if not public.excel_efficiency_criterion_matches(p_doc, item) then ok := false; exit; end if;
  end loop;
  out := out || jsonb_build_object('label', r.part_label, 'awarded', case when ok then r.allocated_marks else 0 end, 'maximum', r.allocated_marks);
 end loop;
 return case when jsonb_array_length(out) = 0 then null else out end;
end $function$;

-- Submit: as before, then mark every question that has rules, and publish the result when all have.
create or replace function public.submit_excel_efficiency_document(p_attempt_id uuid, p_document jsonb)
returns void language plpgsql security definer set search_path to 'pg_catalog', 'public' as $function$
declare attempt_record public.excel_efficiency_attempts%rowtype; q record; unmarked integer; total numeric; maximum numeric; passing numeric; pct numeric; published timestamptz; auto boolean;
begin
 if not public.is_active_word_efficiency_student() then raise exception 'active student account required'; end if;
 select attempt_rows.* into attempt_record from public.excel_efficiency_attempts as attempt_rows where attempt_rows.id = p_attempt_id and attempt_rows.student_id = auth.uid() for update;
 if not found or attempt_record.status <> 'active' or attempt_record.started_at is null or attempt_record.final_document_snapshot is not null then raise exception 'attempt unavailable or already submitted'; end if;
 if now() <= attempt_record.started_at + make_interval(secs => attempt_record.selected_duration_seconds) then
  perform public.assert_excel_efficiency_document_schema(p_document);
 else
  p_document := coalesce(attempt_record.document_autosave, attempt_record.original_document_snapshot);
  perform public.assert_excel_efficiency_document_schema(p_document);
 end if;
 update public.excel_efficiency_attempts as attempt_rows set document_autosave = p_document, final_document_snapshot = p_document, status = 'submitted', submitted_at = now(), updated_at = now()
  where attempt_rows.id = p_attempt_id and attempt_rows.student_id = auth.uid() and attempt_rows.status = 'active' and attempt_rows.final_document_snapshot is null;
 if not found then raise exception 'attempt unavailable or already submitted'; end if;
 for q in select s.id score_id, s.question_id, s.maximum_marks from public.excel_efficiency_question_scores s
          where s.attempt_id = p_attempt_id and s.awarded_marks is null and s.graded_by is null
            and exists (select 1 from public.excel_efficiency_grading_rules r where r.version_id = attempt_record.version_id and r.question_id = s.question_id) loop
  update public.excel_efficiency_question_scores set awarded_marks = public.excel_efficiency_score_question(p_document, attempt_record.version_id, q.question_id, q.maximum_marks),
   teacher_comment = case when public.excel_efficiency_score_question(p_document, attempt_record.version_id, q.question_id, q.maximum_marks) >= q.maximum_marks then 'Full marks: the required change was found in your sheet.' when public.excel_efficiency_score_question(p_document, attempt_record.version_id, q.question_id, q.maximum_marks) > 0 then 'Part marks: some of the required changes were found in your sheet.' else 'No marks: the required change was not found in your sheet.' end,
   grading_status = 'graded', updated_at = now() where id = q.score_id;
 end loop;
 select count(*) filter (where awarded_marks is null), coalesce(sum(awarded_marks), 0), sum(maximum_marks) into unmarked, total, maximum from public.excel_efficiency_question_scores where attempt_id = p_attempt_id;
 select coalesce(t.auto_publish_results, true) into auto from public.excel_efficiency_tests t where t.id = attempt_record.test_id;
 if unmarked = 0 and auto then
  select v.passing_marks into passing from public.excel_efficiency_versions v where v.id = attempt_record.version_id;
  pct := case when maximum > 0 then round(total * 100 / maximum, 2) else 0 end; published := now();
  update public.excel_efficiency_attempts set evaluation_status = 'published', evaluated_at = published, result_published_at = published, status = 'completed', updated_at = published,
   result = jsonb_build_object('marks', total, 'maximum_marks', maximum, 'percentage', pct, 'passed', case when passing is null then null else total >= passing end, 'passing_marks', passing, 'evaluation_status', 'published', 'evaluated_at', published, 'auto_graded', true)
  where id = p_attempt_id;
 end if;
end $function$;

-- Rules with criteria and part labels can be saved for a version (still only before its first attempt).
create or replace function public.save_excel_efficiency_grading_rules(p_version_id uuid, p_rules jsonb)
returns void language plpgsql security definer set search_path to 'pg_catalog', 'public' as $function$
declare item jsonb; question_record public.excel_efficiency_questions%rowtype; expected jsonb;
 allowed text[] := array['questionNumber','exactTarget','expectedOperation','expectedValue','allocatedMarks','partialMarks','additionalCriteria','partLabel'];
begin
 if not public.is_aal2_admin() then raise exception 'not authorized'; end if;
 if jsonb_typeof(p_rules) <> 'array' or jsonb_array_length(p_rules) > 500 then raise exception 'invalid grading rules'; end if;
 if exists (select 1 from public.excel_efficiency_attempts where version_id = p_version_id) then raise exception 'grading rules are immutable after an attempt is prepared'; end if;
 delete from public.excel_efficiency_grading_rules where version_id = p_version_id;
 for item in select value from jsonb_array_elements(p_rules) loop
  if jsonb_typeof(item) <> 'object' or not (item ?& array['questionNumber','exactTarget','expectedOperation','expectedValue','allocatedMarks','partialMarks']) or exists (select 1 from jsonb_object_keys(item) k where k <> all (allowed)) then raise exception 'invalid grading rule'; end if;
  select * into question_record from public.excel_efficiency_questions where version_id = p_version_id and question_number = (item->>'questionNumber')::integer;
  if not found then raise exception 'grading rule question does not belong to version'; end if;
  begin expected := (item->>'expectedValue')::jsonb; exception when others then expected := to_jsonb(item->>'expectedValue'); end;
  if (item->>'allocatedMarks')::numeric > question_record.marks then raise exception 'grading rule marks exceed question marks'; end if;
  insert into public.excel_efficiency_grading_rules(version_id, question_id, exact_target, expected_operation, expected_value, allocated_marks, partial_marks, additional_criteria, part_label)
  values (p_version_id, question_record.id, btrim(item->>'exactTarget'), btrim(item->>'expectedOperation'), expected, (item->>'allocatedMarks')::numeric,
   case when jsonb_typeof(item->'partialMarks') = 'null' then null else (item->>'partialMarks')::numeric end,
   case when jsonb_typeof(item->'additionalCriteria') = 'array' then item->'additionalCriteria' else '[]'::jsonb end, nullif(btrim(coalesce(item->>'partLabel','')), ''));
 end loop;
end $function$;

commit;
