-- Excel Efficiency: AutoFit Row Height / Column Width can be marked.
-- The sheet now remembers the rows and columns given AutoFit (sheet.autoFitRows: row numbers, sheet.autoFitCols:
-- column letters), because AutoFit Row Height on default-height rows changes nothing else in the sheet and the
-- Model Answer page answered "No change was detected". A rule then asks for them with the new sheet criterion
-- {"rule":"sheet","path":"autoFitRows","includesAll":[1,2,...]} (the student's list must contain all of them).
-- Both functions are changed in place from their live definitions; safe to run twice.
begin;

do $migration$
declare definition text;
begin
  -- 1. The document check accepts the two new sheet settings.
  select pg_get_functiondef('public.assert_excel_efficiency_document_schema(jsonb)'::regprocedure) into definition;
  if position('autoFitRows' in definition) = 0 then
    if position($$'definedNames','validations'])) then raise exception 'Unknown sheet setting'$$ in definition) = 0
       or position($$  if s ? 'tabColor'$$ in definition) = 0 then
      raise exception 'assert_excel_efficiency_document_schema is not the expected version';
    end if;
    definition := replace(definition, $$'definedNames','validations'])) then raise exception 'Unknown sheet setting'$$,
      $$'definedNames','validations','autoFitRows','autoFitCols'])) then raise exception 'Unknown sheet setting'$$);
    definition := replace(definition, $$  if s ? 'tabColor'$$,
      $$  if s ? 'autoFitRows' and (jsonb_typeof(s->'autoFitRows') <> 'array' or jsonb_array_length(s->'autoFitRows') > 200 or exists (select 1 from jsonb_array_elements(s->'autoFitRows') r where jsonb_typeof(r) <> 'number' or (r#>>'{}')::numeric not between 1 and 200)) then raise exception 'Invalid AutoFit rows'; end if;
  if s ? 'autoFitCols' and (jsonb_typeof(s->'autoFitCols') <> 'array' or jsonb_array_length(s->'autoFitCols') > 26 or exists (select 1 from jsonb_array_elements(s->'autoFitCols') c where jsonb_typeof(c) <> 'string' or c#>>'{}' !~ '^[A-Z]{1,2}$')) then raise exception 'Invalid AutoFit columns'; end if;
  if s ? 'tabColor'$$);
    execute definition;
  end if;

  -- 2. The marking understands {"rule":"sheet", "path":..., "includesAll":[...]}.
  select pg_get_functiondef('public.excel_efficiency_criterion_matches(jsonb,jsonb)'::regprocedure) into definition;
  if position('includesAll' in definition) = 0 then
    if position($$  if p_c ? 'includes' then$$ in definition) = 0 then
      raise exception 'excel_efficiency_criterion_matches is not the expected version';
    end if;
    definition := replace(definition, $$  if p_c ? 'includes' then$$,
      $$  if p_c ? 'includesAll' then return jsonb_typeof(actual) = 'array' and jsonb_typeof(p_c->'includesAll') = 'array' and actual @> (p_c->'includesAll'); end if;
  if p_c ? 'includes' then$$);
    execute definition;
  end if;
end
$migration$;

commit;
