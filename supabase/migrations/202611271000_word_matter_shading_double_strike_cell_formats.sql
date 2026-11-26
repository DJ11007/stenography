-- Practice documents (Working Matter) can now hold three more kinds of formatting, so a paper can ask to REMOVE them
-- (Hindi Word EFFICIENCY TEST 11: "remove the shading of paragraph 1", "remove the double strikethrough of paragraph 5",
-- "remove the underline of the table's first column"). Before, the admin could apply them in the document designer but
-- they were dropped when the document was saved.
--   * a paragraph's shading      -> paragraph "shading": "RRGGBB"
--   * double strikethrough       -> run "doubleStrike": true (with "strike": false, as the editor saves it)
--   * a table cell's formatting  -> table "cellFormats": per cell null or {bold, italic, underline, strike,
--                                   doubleStrike: true; color, highlight, shading: "RRGGBB"; align}
-- All three are optional, so every practice document saved before is unchanged and still valid.
--
-- 1. assert_word_efficiency_working_matter accepts them (full redefinition of 202610211000's version).
-- 2. word_efficiency_initial_editor_document -- the starting document an attempt is checked and marked against --
--    carries them exactly as the student's editor saves them: shading as "rgb(r, g, b)", doubleStrike on the run,
--    and the table's cellFormats (with each cell's font and size, as the editor saves them). Without this an
--    untouched paper would look as if the student had removed them (and a "remove ..." question would be met by
--    doing nothing), and an unchanged double strikethrough would count as a change.
-- Safe to run twice.
begin;

-- "92D050" -> "rgb(146, 208, 80)", as a browser reports a paragraph's background colour.
create or replace function public.word_efficiency_rgb(hex text)
returns text language sql immutable set search_path=pg_catalog,public as $$
 select format('rgb(%s, %s, %s)',('x'||substr(hex,1,2))::bit(8)::int,('x'||substr(hex,3,2))::bit(8)::int,('x'||substr(hex,5,2))::bit(8)::int)
$$;

-- A practice-document table's cellFormats as the editor saves them: each cell's formatting with its font and size,
-- null for a plain cell. Only tables that have cellFormats get them (older papers' tables are unchanged).
create or replace function public.word_efficiency_matter_cell_formats(t jsonb)
returns jsonb language sql immutable set search_path=pg_catalog,public as $$
 select case when jsonb_typeof(t->'cellFormats') is distinct from 'array' then '{}'::jsonb else jsonb_build_object('cellFormats',(
  select jsonb_agg((
   select coalesce(jsonb_agg(nullif(jsonb_strip_nulls(
     coalesce(case when jsonb_typeof(t->'cellFormats'->(r.ord::int-1)->(c.ord::int-1))='object' then t->'cellFormats'->(r.ord::int-1)->(c.ord::int-1) end,'{}'::jsonb)
     ||jsonb_build_object('fontFamily',case when jsonb_typeof(t->'cellFonts'->(r.ord::int-1)->(c.ord::int-1))='string' then t->'cellFonts'->(r.ord::int-1)->(c.ord::int-1) end,
                          'fontSize',case when jsonb_typeof(t->'cellSizes'->(r.ord::int-1)->(c.ord::int-1))='number' then t->'cellSizes'->(r.ord::int-1)->(c.ord::int-1) end)),'{}'::jsonb)
     order by c.ord),'[]'::jsonb)
   from jsonb_array_elements(r.value) with ordinality as c(value,ord)) order by r.ord)
  from jsonb_array_elements(t->'rows') with ordinality as r(value,ord))) end
$$;

create or replace function public.assert_word_efficiency_working_matter(p_snapshot jsonb)
 returns void
 language plpgsql
 immutable
 set search_path to 'pg_catalog', 'public'
as $function$
declare p jsonb;r jsonb;c jsonb;pc integer;rc integer:=0;cc integer:=0;tc bigint:=0;row_index integer;cell_index integer;
begin
 if p_snapshot is null or jsonb_typeof(p_snapshot)<>'object' then raise exception 'Working Matter must be a JSON object';end if;
 if pg_column_size(p_snapshot)>2097152 then raise exception 'Working Matter snapshot exceeds 2 MiB';end if;
 if jsonb_typeof(p_snapshot->'schemaVersion')<>'string' or p_snapshot->>'schemaVersion'<>'1' then raise exception 'Working Matter schemaVersion must be "1"';end if;
 if jsonb_typeof(p_snapshot->'language')<>'string' or p_snapshot->>'language' not in('English','Hindi') then raise exception 'Working Matter language is invalid';end if;
 if jsonb_typeof(p_snapshot->'paragraphs')<>'array' then raise exception 'Working Matter paragraphs must be an array';end if;
 if exists(select 1 from jsonb_object_keys(p_snapshot) k where k<>all(array['schemaVersion','language','source','paragraphs','formattingSummary','warnings'])) then raise exception 'Working Matter contains unknown fields';end if;
 pc:=jsonb_array_length(p_snapshot->'paragraphs');if pc<1 or pc>550 then raise exception 'Working Matter must contain 1 to 550 paragraphs';end if;
 if p_snapshot?'source' and jsonb_typeof(p_snapshot->'source') not in('object','null') then raise exception 'Working Matter source is invalid';end if;
 if p_snapshot?'formattingSummary' and jsonb_typeof(p_snapshot->'formattingSummary')<>'object' then raise exception 'Working Matter formatting summary is invalid';end if;
 if p_snapshot?'warnings' and (jsonb_typeof(p_snapshot->'warnings')<>'array' or jsonb_array_length(p_snapshot->'warnings')>100 or exists(select 1 from jsonb_array_elements(p_snapshot->'warnings') w where jsonb_typeof(w)<>'string' or length(w#>>'{}')>1000)) then raise exception 'Working Matter warnings are invalid';end if;
 for p in select value from jsonb_array_elements(p_snapshot->'paragraphs') loop
  if p->>'type'='table' then
   if not(p?&array['id','type','rows']) or exists(select 1 from jsonb_object_keys(p) k where k<>all(array['id','type','rows','cellFonts','cellSizes','cellFormats'])) then raise exception 'Working Matter table fields are incomplete';end if;
   if jsonb_typeof(p->'id')<>'string' or length(p->>'id') not between 1 and 100 then raise exception 'Working Matter table identity is invalid';end if;
   if jsonb_typeof(p->'rows')<>'array' or jsonb_array_length(p->'rows') not between 1 and 50 then raise exception 'Working Matter table row count is invalid';end if;
   for r in select value from jsonb_array_elements(p->'rows') loop
    if jsonb_typeof(r)<>'array' or jsonb_array_length(r) not between 1 and 20 then raise exception 'Working Matter table column count is invalid';end if;
    for c in select value from jsonb_array_elements(r) loop
     cc:=cc+1;if cc>1000 or jsonb_typeof(c)<>'string' or length(c#>>'{}')>10000 then raise exception 'Working Matter table cell is invalid';end if;
     tc:=tc+length(c#>>'{}');if tc>1000000 then raise exception 'Working Matter text exceeds 1,000,000 characters';end if;
    end loop;
   end loop;
   -- cellFonts / cellSizes: one entry per cell (same shape as rows); a font from the approved list or
   -- null, a size from 4 to 200 or null.
   if p?'cellFonts' then
    if jsonb_typeof(p->'cellFonts')<>'array' or jsonb_array_length(p->'cellFonts')<>jsonb_array_length(p->'rows') then raise exception 'Working Matter table cell fonts are invalid';end if;
    for row_index in 0..jsonb_array_length(p->'rows')-1 loop
     if jsonb_typeof(p->'cellFonts'->row_index)<>'array' or jsonb_array_length(p->'cellFonts'->row_index)<>jsonb_array_length(p->'rows'->row_index) then raise exception 'Working Matter table cell fonts are invalid';end if;
     for cell_index in 0..jsonb_array_length(p->'rows'->row_index)-1 loop
      c:=p->'cellFonts'->row_index->cell_index;
      if jsonb_typeof(c) not in('string','null') or (jsonb_typeof(c)='string' and not((c#>>'{}')=any(public.word_efficiency_approved_fonts()))) then raise exception 'Working Matter table cell font is not approved';end if;
     end loop;
    end loop;
   end if;
   if p?'cellSizes' then
    if jsonb_typeof(p->'cellSizes')<>'array' or jsonb_array_length(p->'cellSizes')<>jsonb_array_length(p->'rows') then raise exception 'Working Matter table cell sizes are invalid';end if;
    for row_index in 0..jsonb_array_length(p->'rows')-1 loop
     if jsonb_typeof(p->'cellSizes'->row_index)<>'array' or jsonb_array_length(p->'cellSizes'->row_index)<>jsonb_array_length(p->'rows'->row_index) then raise exception 'Working Matter table cell sizes are invalid';end if;
     for cell_index in 0..jsonb_array_length(p->'rows'->row_index)-1 loop
      c:=p->'cellSizes'->row_index->cell_index;
      if jsonb_typeof(c) not in('number','null') or (jsonb_typeof(c)='number' and (c#>>'{}')::numeric not between 4 and 200) then raise exception 'Working Matter table cell size is invalid';end if;
     end loop;
    end loop;
   end if;
   -- cellFormats (26 Nov 2026): one entry per cell, null or the cell's text formatting -- so a question can ask to
   -- change or remove it (e.g. remove the underline of column 1).
   if p?'cellFormats' then
    if jsonb_typeof(p->'cellFormats')<>'array' or jsonb_array_length(p->'cellFormats')<>jsonb_array_length(p->'rows') then raise exception 'Working Matter table cell formatting is invalid';end if;
    for row_index in 0..jsonb_array_length(p->'rows')-1 loop
     if jsonb_typeof(p->'cellFormats'->row_index)<>'array' or jsonb_array_length(p->'cellFormats'->row_index)<>jsonb_array_length(p->'rows'->row_index) then raise exception 'Working Matter table cell formatting is invalid';end if;
     for cell_index in 0..jsonb_array_length(p->'rows'->row_index)-1 loop
      c:=p->'cellFormats'->row_index->cell_index;
      if jsonb_typeof(c)='null' then continue;end if;
      if jsonb_typeof(c)<>'object' or exists(select 1 from jsonb_each(c) e where not(
           (e.key in('bold','italic','underline','strike','doubleStrike') and e.value='true'::jsonb)
        or (e.key in('color','highlight','shading') and jsonb_typeof(e.value)='string' and e.value#>>'{}'~'^[0-9A-Fa-f]{6}$')
        or (e.key='align' and jsonb_typeof(e.value)='string' and e.value#>>'{}' in('left','center','right','justify')))) then raise exception 'Working Matter table cell formatting is invalid';end if;
     end loop;
    end loop;
   end if;
   continue;
  end if;
  if jsonb_typeof(p)<>'object' or not(p?&array['id','type','paragraphNumber','listGroup','runs','alignment','leftIndent','rightIndent','lineSpacing','spaceBefore','spaceAfter']) then raise exception 'Working Matter paragraph fields are incomplete';end if;
  if exists(select 1 from jsonb_object_keys(p) k where k<>all(array['id','type','paragraphNumber','listGroup','runs','alignment','leftIndent','rightIndent','lineSpacing','spaceBefore','spaceAfter','shading'])) then raise exception 'Working Matter paragraph contains unknown fields';end if;
  -- shading (26 Nov 2026): a paragraph's background colour, RRGGBB (Borders and Shading > Shading).
  if p?'shading' and (p->>'type'<>'paragraph' or jsonb_typeof(p->'shading')<>'string' or p->>'shading'!~'^[0-9A-Fa-f]{6}$') then raise exception 'Working Matter paragraph shading is invalid';end if;
  if jsonb_typeof(p->'id')<>'string' or length(p->>'id') not between 1 and 100 or jsonb_typeof(p->'type')<>'string' or p->>'type' not in('paragraph','list-item') then raise exception 'Working Matter paragraph identity is invalid';end if;
  if jsonb_typeof(p->'paragraphNumber') not in('number','null') or jsonb_typeof(p->'listGroup') not in('string','null') then raise exception 'Working Matter paragraph numbering is invalid';end if;
  if (p->>'type'='paragraph' and (jsonb_typeof(p->'paragraphNumber')<>'number' or (p->>'paragraphNumber')::numeric not between 1 and 500 or trunc((p->>'paragraphNumber')::numeric)<>(p->>'paragraphNumber')::numeric)) or (p->>'type'='list-item' and jsonb_typeof(p->'paragraphNumber')<>'null') then raise exception 'Working Matter paragraph numbering is incompatible';end if;
  if jsonb_typeof(p->'listGroup')='string' and length(p->>'listGroup') not between 1 and 100 then raise exception 'Working Matter list group is invalid';end if;
  if jsonb_typeof(p->'alignment')<>'string' or p->>'alignment' not in('left','center','right','justify') then raise exception 'Working Matter alignment is invalid';end if;
  if jsonb_typeof(p->'runs')<>'array' or jsonb_array_length(p->'runs')<1 or jsonb_array_length(p->'runs')>500 then raise exception 'Working Matter runs are invalid';end if;
  if jsonb_typeof(p->'leftIndent')<>'number' or (p->>'leftIndent')::numeric not between 0 and 10 or jsonb_typeof(p->'rightIndent')<>'number' or (p->>'rightIndent')::numeric not between 0 and 10 or jsonb_typeof(p->'lineSpacing')<>'number' or (p->>'lineSpacing')::numeric not between 0.5 and 5 or jsonb_typeof(p->'spaceBefore')<>'number' or (p->>'spaceBefore')::numeric not between 0 and 500 or jsonb_typeof(p->'spaceAfter')<>'number' or (p->>'spaceAfter')::numeric not between 0 and 500 then raise exception 'Working Matter paragraph measurements are invalid';end if;
  for r in select value from jsonb_array_elements(p->'runs') loop
   rc:=rc+1;if rc>10000 or jsonb_typeof(r)<>'object' or not(r?&array['text','bold','italic','underline','strike','fontFamily','fontSize','color','highlight']) then raise exception 'Working Matter has too many or malformed runs';end if;
   if exists(select 1 from jsonb_object_keys(r) k where k<>all(array['text','bold','italic','underline','strike','fontFamily','fontSize','color','highlight','doubleStrike'])) then raise exception 'Working Matter run contains unknown fields';end if;
   -- doubleStrike (26 Nov 2026): double strikethrough; such a run has strike false, as the editor saves it.
   if r?'doubleStrike' and (jsonb_typeof(r->'doubleStrike')<>'boolean' or (r->'doubleStrike'='true'::jsonb and r->'strike'='true'::jsonb)) then raise exception 'Working Matter run double strikethrough is invalid';end if;
   if jsonb_typeof(r->'text')<>'string' or length(r->>'text')>200000 then raise exception 'Working Matter run text is invalid';end if;tc:=tc+length(r->>'text');if tc>1000000 then raise exception 'Working Matter text exceeds 1,000,000 characters';end if;
   if jsonb_typeof(r->'bold')<>'boolean' or jsonb_typeof(r->'italic')<>'boolean' or jsonb_typeof(r->'underline')<>'boolean' or jsonb_typeof(r->'strike')<>'boolean' then raise exception 'Working Matter run flags are invalid';end if;
   if jsonb_typeof(r->'fontFamily') not in('string','null') or (jsonb_typeof(r->'fontFamily')='string' and not((r->>'fontFamily')=any(public.word_efficiency_approved_fonts()))) then raise exception 'Working Matter run font is not approved';end if;
   if jsonb_typeof(r->'fontSize') not in('number','null') or (jsonb_typeof(r->'fontSize')='number' and (r->>'fontSize')::numeric not between 4 and 200) then raise exception 'Working Matter run font size is invalid';end if;
   if jsonb_typeof(r->'color') not in('string','null') or (jsonb_typeof(r->'color')='string' and r->>'color'!~'^[0-9A-Fa-f]{6}$') or jsonb_typeof(r->'highlight') not in('string','null') or (jsonb_typeof(r->'highlight')='string' and r->>'highlight'!~'^(?:[0-9A-Fa-f]{6}|[A-Za-z]{1,30})$') then raise exception 'Working Matter run color is invalid';end if;
  end loop;
 end loop;
end $function$;

create or replace function public.word_efficiency_initial_editor_document(m jsonb)
returns jsonb language plpgsql immutable set search_path=pg_catalog,public as $$
declare editor_blocks jsonb;
begin
 if jsonb_typeof(m->'paragraphs')<>'array'then
  if m->>'schemaVersion'='2'and jsonb_typeof(m->'blocks')='array'then return m;end if;
  raise exception'Attempt original document cannot be converted';
 end if;
 select jsonb_agg(
  case when paragraph_entries.paragraph_value->>'type'='table' then jsonb_build_object(
   'id','block-'||(paragraph_entries.ordinality-1),
   'type','table',
   'alignment','left',
   'runs',jsonb_build_array(jsonb_build_object(
    'text',coalesce((select string_agg(cell_entries.cell_value#>>'{}',' 'order by row_entries.row_ordinality,cell_entries.cell_ordinality)from jsonb_array_elements(coalesce(paragraph_entries.paragraph_value->'rows','[]'::jsonb))with ordinality as row_entries(row_value,row_ordinality),jsonb_array_elements(row_entries.row_value)with ordinality as cell_entries(cell_value,cell_ordinality)),''),
    'bold',false,'italic',false,'underline',false,'strike',false,'superscript',false,'subscript',false,'fontFamily',null,'fontSize',null,'color',null,'highlight',null,'doubleStrike',false,'href',null,'bookmark',null,'field',null
   )),
   'attrs',jsonb_build_object('rows',coalesce(paragraph_entries.paragraph_value->'rows','[]'::jsonb))||public.word_efficiency_matter_cell_formats(paragraph_entries.paragraph_value)
  ) else jsonb_build_object(
   'id','block-'||(paragraph_entries.ordinality-1),
   'type',case when paragraph_entries.paragraph_value->>'type'='list-item'then'list-item'else'paragraph'end,
   'alignment',coalesce(paragraph_entries.paragraph_value->>'alignment','left'),
   'runs',(select jsonb_agg(jsonb_build_object(
    'text',run_entries.run_value->>'text','bold',coalesce((run_entries.run_value->>'bold')::boolean,false),'italic',coalesce((run_entries.run_value->>'italic')::boolean,false),'underline',coalesce((run_entries.run_value->>'underline')::boolean,false),'strike',coalesce((run_entries.run_value->>'strike')::boolean,false),'superscript',false,'subscript',false,'fontFamily',run_entries.run_value->'fontFamily','fontSize',run_entries.run_value->'fontSize','color',run_entries.run_value->'color','highlight',run_entries.run_value->'highlight','doubleStrike',coalesce((run_entries.run_value->>'doubleStrike')::boolean,false),'href',null,'bookmark',null,'field',null
   )order by run_entries.ordinality)from jsonb_array_elements(paragraph_entries.paragraph_value->'runs')with ordinality as run_entries(run_value,ordinality)),
   'attrs',case when paragraph_entries.paragraph_value->>'type'='list-item'then jsonb_build_object('listStyle','bullet')else jsonb_build_object(
    'marginLeft',coalesce(paragraph_entries.paragraph_value->>'leftIndent','0')||'in','marginRight',coalesce(paragraph_entries.paragraph_value->>'rightIndent','0')||'in','lineHeight',coalesce(paragraph_entries.paragraph_value->>'lineSpacing','1'),'marginTop',coalesce(paragraph_entries.paragraph_value->>'spaceBefore','0')||'pt','marginBottom',coalesce(paragraph_entries.paragraph_value->>'spaceAfter','0')||'pt','lineNumbers',false,'dropCap',false
   )||case when paragraph_entries.paragraph_value?'shading' then jsonb_build_object('backgroundColor',public.word_efficiency_rgb(paragraph_entries.paragraph_value->>'shading'))else'{}'::jsonb end end
  )end
 order by paragraph_entries.ordinality)into editor_blocks from jsonb_array_elements(m->'paragraphs')with ordinality as paragraph_entries(paragraph_value,ordinality);
 return jsonb_build_object('schemaVersion','2','blocks',editor_blocks,'pageLayout',jsonb_build_object('padding',null,'maxWidth',null,'aspectRatio',null,'columnCount',null,'backgroundColor',null,'border',null,'watermark',null),'operations','[]'::jsonb,'savedAt','1970-01-01T00:00:00.000Z');
end $$;

revoke all on function public.word_efficiency_rgb(text), public.word_efficiency_matter_cell_formats(jsonb) from public, anon, authenticated;

commit;
