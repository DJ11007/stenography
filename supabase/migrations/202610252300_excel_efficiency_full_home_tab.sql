-- Excel Efficiency: the rest of Excel 2013's commands are valid in a saved sheet.
--   cells   underlineStyle (double / single or double accounting), vertAlign (superscript / subscript), locked
--           (false = unlocked for a protected sheet), hiddenFormula, link (hyperlink), shrink (shrink to fit),
--           currency (₹ $ £ € ¥ for Currency/Accounting); number formats Fraction and Scientific
--   sheet   tabColor, rowBreaks (page breaks), scale / fitWidth / fitHeight (Scale to Fit), centerHorizontally /
--           centerVertically, definedNames, validations (Data Validation); conditional formatting gains
--           Top/Bottom rules, Data Bars, Color Scales and Icon Sets
begin;

do $mig$
declare def text;
begin
 def := pg_get_functiondef('public.assert_excel_efficiency_cells(jsonb)'::regprocedure);
 if position('Invalid hyperlink' in def) = 0 then
  if position('''decimals'',''comment''])' in def) = 0 then raise exception 'cell field list not found'; end if;
  def := replace(def, '''decimals'',''comment''])', '''decimals'',''comment'',''underlineStyle'',''vertAlign'',''locked'',''hiddenFormula'',''link'',''shrink'',''currency''])');
  if position('''Percentage'',''Text'')' in def) = 0 then raise exception 'number format list not found'; end if;
  def := replace(def, '''Percentage'',''Text'')', '''Percentage'',''Fraction'',''Scientific'',''Text'')');
  def := replace(def, E' end loop;\nend $function$', $chk$  if cell_value ? 'underlineStyle' and jsonb_typeof(cell_value->'underlineStyle') <> 'null' and cell_value->>'underlineStyle' not in ('single','double','singleAccounting','doubleAccounting') then raise exception 'Invalid underline at %', cell_ref; end if;
  if cell_value ? 'vertAlign' and jsonb_typeof(cell_value->'vertAlign') <> 'null' and cell_value->>'vertAlign' not in ('superscript','subscript') then raise exception 'Invalid superscript at %', cell_ref; end if;
  if exists (select 1 from jsonb_each(cell_value) e where e.key in ('locked','hiddenFormula','shrink') and jsonb_typeof(e.value) not in ('boolean','null')) then raise exception 'Invalid protection at %', cell_ref; end if;
  if cell_value ? 'link' and (jsonb_typeof(cell_value->'link') not in ('string','null') or length(coalesce(cell_value->>'link','')) > 500) then raise exception 'Invalid hyperlink at %', cell_ref; end if;
  if cell_value ? 'currency' and jsonb_typeof(cell_value->'currency') <> 'null' and cell_value->>'currency' not in ('₹','$','£','€','¥') then raise exception 'Invalid currency at %', cell_ref; end if;
 end loop;
end $function$$chk$);
  if position('Invalid hyperlink' in def) = 0 then raise exception 'cell loop end not found'; end if;
  execute def;
 end if;

 def := pg_get_functiondef('public.assert_excel_efficiency_document_schema(jsonb)'::regprocedure);
 if position('Invalid data validation' in def) = 0 then
  if position('''colWidths'',''rowHeights''])' in def) = 0 then raise exception 'sheet key list not found'; end if;
  def := replace(def, '''colWidths'',''rowHeights''])', '''colWidths'',''rowHeights'',''tabColor'',''rowBreaks'',''scale'',''fitWidth'',''fitHeight'',''centerHorizontally'',''centerVertically'',''definedNames'',''validations''])');
  if position('''greaterThan'',''lessThan'',''between'',''equalTo'',''textContains'',''duplicate'',''unique'')' in def) = 0 then raise exception 'conditional types not found'; end if;
  def := replace(def, '''greaterThan'',''lessThan'',''between'',''equalTo'',''textContains'',''duplicate'',''unique'')', '''greaterThan'',''lessThan'',''between'',''equalTo'',''textContains'',''duplicate'',''unique'',''top'',''bottom'',''topPercent'',''bottomPercent'',''aboveAverage'',''belowAverage'',''dataBar'',''colorScale'',''iconSet'')');
  if position('''lightRed'',''redText'',''redBorder'')' in def) = 0 then raise exception 'conditional styles not found'; end if;
  def := replace(def, '''lightRed'',''redText'',''redBorder'')', '''lightRed'',''redText'',''redBorder'',''blueBar'',''greenBar'',''redBar'',''orangeBar'',''greenYellowRed'',''redYellowGreen'',''greenWhite'',''redWhite'',''arrows3'',''trafficLights3'')');
  def := replace(def, '  for item in select value from jsonb_each(s) e where e.key in (''header'',''footer'') loop', $chk$  if s ? 'tabColor' and jsonb_typeof(s->'tabColor') <> 'null' and (jsonb_typeof(s->'tabColor') <> 'string' or s->>'tabColor' !~ '^[0-9A-Fa-f]{6}$') then raise exception 'Invalid tab color'; end if;
  if s ? 'rowBreaks' and (jsonb_typeof(s->'rowBreaks') <> 'array' or jsonb_array_length(s->'rowBreaks') > 100 or exists (select 1 from jsonb_array_elements(s->'rowBreaks') r where jsonb_typeof(r) <> 'number' or (r#>>'{}')::numeric not between 2 and 200)) then raise exception 'Invalid page breaks'; end if;
  if s ? 'scale' and jsonb_typeof(s->'scale') <> 'null' and (jsonb_typeof(s->'scale') <> 'number' or (s->>'scale')::numeric not between 10 and 400) then raise exception 'Invalid scale'; end if;
  if exists (select 1 from jsonb_each(s) e where e.key in ('fitWidth','fitHeight') and jsonb_typeof(e.value) <> 'null' and (jsonb_typeof(e.value) <> 'number' or (e.value#>>'{}')::numeric not between 1 and 32767)) then raise exception 'Invalid fit to pages'; end if;
  if exists (select 1 from jsonb_each(s) e where e.key in ('centerHorizontally','centerVertically') and jsonb_typeof(e.value) <> 'boolean') then raise exception 'Invalid page centering'; end if;
  if s ? 'definedNames' and (jsonb_typeof(s->'definedNames') <> 'object' or exists (select 1 from jsonb_each(s->'definedNames') n where n.key !~ '^[A-Za-z_][A-Za-z0-9_.]{0,39}$' or n.key ~* '^[A-Z]{1,2}[0-9]{1,3}$' or jsonb_typeof(n.value) <> 'string' or n.value#>>'{}' !~ '^\$?[A-Z]{1,2}\$?[0-9]{1,3}(:\$?[A-Z]{1,2}\$?[0-9]{1,3})?$')) then raise exception 'Invalid defined name'; end if;
  if s ? 'validations' and (jsonb_typeof(s->'validations') <> 'array' or jsonb_array_length(s->'validations') > 50 or exists (select 1 from jsonb_array_elements(s->'validations') v where jsonb_typeof(v) <> 'object'
     or exists (select 1 from jsonb_object_keys(v) k where k not in ('range','type','operator','value1','value2','list','message','title'))
     or v->>'range' !~ '^[A-Z]{1,2}[0-9]{1,3}(:[A-Z]{1,2}[0-9]{1,3})?$' or v->>'type' not in ('whole','decimal','list','date','textLength')
     or (v ? 'operator' and v->>'operator' not in ('between','notBetween','equal','notEqual','greater','less','greaterOrEqual','lessOrEqual'))
     or length(v::text) > 1000)) then raise exception 'Invalid data validation'; end if;
  for item in select value from jsonb_each(s) e where e.key in ('header','footer') loop$chk$);
  if position('Invalid data validation' in def) = 0 then raise exception 'header loop not found'; end if;
  execute def;
 end if;
end $mig$;

commit;
