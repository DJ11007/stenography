begin;

-- Word Efficiency working documents (the document students start from) could only use four fonts:
-- Arial, Calibri, Times New Roman, Mangal. A Hindi test typed in Kruti Dev 010 (EFFICIENCY TEST 4)
-- lost its font, and students saw the Kruti Dev keys ("ukyank gekjs ...") instead of Hindi.
-- 1. A run may use any font the editor offers (word_efficiency_approved_fonts(), which has Kruti Dev 010).
-- 2. A table may carry cellFonts / cellSizes (each cell's font and size), shaped like its rows.
-- Everything else is checked exactly as before. Older documents stay valid.

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
   if not(p?&array['id','type','rows']) or exists(select 1 from jsonb_object_keys(p) k where k<>all(array['id','type','rows','cellFonts','cellSizes'])) then raise exception 'Working Matter table fields are incomplete';end if;
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
   continue;
  end if;
  if jsonb_typeof(p)<>'object' or not(p?&array['id','type','paragraphNumber','listGroup','runs','alignment','leftIndent','rightIndent','lineSpacing','spaceBefore','spaceAfter']) then raise exception 'Working Matter paragraph fields are incomplete';end if;
  if exists(select 1 from jsonb_object_keys(p) k where k<>all(array['id','type','paragraphNumber','listGroup','runs','alignment','leftIndent','rightIndent','lineSpacing','spaceBefore','spaceAfter'])) then raise exception 'Working Matter paragraph contains unknown fields';end if;
  if jsonb_typeof(p->'id')<>'string' or length(p->>'id') not between 1 and 100 or jsonb_typeof(p->'type')<>'string' or p->>'type' not in('paragraph','list-item') then raise exception 'Working Matter paragraph identity is invalid';end if;
  if jsonb_typeof(p->'paragraphNumber') not in('number','null') or jsonb_typeof(p->'listGroup') not in('string','null') then raise exception 'Working Matter paragraph numbering is invalid';end if;
  if (p->>'type'='paragraph' and (jsonb_typeof(p->'paragraphNumber')<>'number' or (p->>'paragraphNumber')::numeric not between 1 and 500 or trunc((p->>'paragraphNumber')::numeric)<>(p->>'paragraphNumber')::numeric)) or (p->>'type'='list-item' and jsonb_typeof(p->'paragraphNumber')<>'null') then raise exception 'Working Matter paragraph numbering is incompatible';end if;
  if jsonb_typeof(p->'listGroup')='string' and length(p->>'listGroup') not between 1 and 100 then raise exception 'Working Matter list group is invalid';end if;
  if jsonb_typeof(p->'alignment')<>'string' or p->>'alignment' not in('left','center','right','justify') then raise exception 'Working Matter alignment is invalid';end if;
  if jsonb_typeof(p->'runs')<>'array' or jsonb_array_length(p->'runs')<1 or jsonb_array_length(p->'runs')>500 then raise exception 'Working Matter runs are invalid';end if;
  if jsonb_typeof(p->'leftIndent')<>'number' or (p->>'leftIndent')::numeric not between 0 and 10 or jsonb_typeof(p->'rightIndent')<>'number' or (p->>'rightIndent')::numeric not between 0 and 10 or jsonb_typeof(p->'lineSpacing')<>'number' or (p->>'lineSpacing')::numeric not between 0.5 and 5 or jsonb_typeof(p->'spaceBefore')<>'number' or (p->>'spaceBefore')::numeric not between 0 and 500 or jsonb_typeof(p->'spaceAfter')<>'number' or (p->>'spaceAfter')::numeric not between 0 and 500 then raise exception 'Working Matter paragraph measurements are invalid';end if;
  for r in select value from jsonb_array_elements(p->'runs') loop
   rc:=rc+1;if rc>10000 or jsonb_typeof(r)<>'object' or not(r?&array['text','bold','italic','underline','strike','fontFamily','fontSize','color','highlight']) then raise exception 'Working Matter has too many or malformed runs';end if;
   if exists(select 1 from jsonb_object_keys(r) k where k<>all(array['text','bold','italic','underline','strike','fontFamily','fontSize','color','highlight'])) then raise exception 'Working Matter run contains unknown fields';end if;
   if jsonb_typeof(r->'text')<>'string' or length(r->>'text')>200000 then raise exception 'Working Matter run text is invalid';end if;tc:=tc+length(r->>'text');if tc>1000000 then raise exception 'Working Matter text exceeds 1,000,000 characters';end if;
   if jsonb_typeof(r->'bold')<>'boolean' or jsonb_typeof(r->'italic')<>'boolean' or jsonb_typeof(r->'underline')<>'boolean' or jsonb_typeof(r->'strike')<>'boolean' then raise exception 'Working Matter run flags are invalid';end if;
   if jsonb_typeof(r->'fontFamily') not in('string','null') or (jsonb_typeof(r->'fontFamily')='string' and not((r->>'fontFamily')=any(public.word_efficiency_approved_fonts()))) then raise exception 'Working Matter run font is not approved';end if;
   if jsonb_typeof(r->'fontSize') not in('number','null') or (jsonb_typeof(r->'fontSize')='number' and (r->>'fontSize')::numeric not between 4 and 200) then raise exception 'Working Matter run font size is invalid';end if;
   if jsonb_typeof(r->'color') not in('string','null') or (jsonb_typeof(r->'color')='string' and r->>'color'!~'^[0-9A-Fa-f]{6}$') or jsonb_typeof(r->'highlight') not in('string','null') or (jsonb_typeof(r->'highlight')='string' and r->>'highlight'!~'^(?:[0-9A-Fa-f]{6}|[A-Za-z]{1,30})$') then raise exception 'Working Matter run color is invalid';end if;
  end loop;
 end loop;
end $function$;

commit;
