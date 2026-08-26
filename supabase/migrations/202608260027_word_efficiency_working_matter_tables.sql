begin;

-- Admin-uploaded Working Matter DOCX files that contained a <w:tbl> table had
-- their table content silently dropped on import -- only a generic "omitted"
-- warning was shown, with no way to recover the lost text. The client-side
-- parser (lib/word-docx.ts) now extracts tables into a new paragraph shape
-- ({id,type:"table",rows:string[][]}, matching the same flat-cell shape the
-- student editor already uses for tables), appended after the running text
-- since the XML parser doesn't preserve their exact interleaved position.
-- This migration teaches the one function that has always fully validated
-- every Working Matter shape (assert_word_efficiency_working_matter, never
-- wrapped since it was introduced) to accept that new paragraph shape too.
create or replace function public.assert_word_efficiency_working_matter(p_snapshot jsonb)
returns void language plpgsql immutable set search_path=pg_catalog,public as $$
declare p jsonb;r jsonb;c jsonb;pc integer;rc integer:=0;cc integer:=0;tc bigint:=0;
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
   if not(p?&array['id','type','rows']) or exists(select 1 from jsonb_object_keys(p) k where k<>all(array['id','type','rows'])) then raise exception 'Working Matter table fields are incomplete';end if;
   if jsonb_typeof(p->'id')<>'string' or length(p->>'id') not between 1 and 100 then raise exception 'Working Matter table identity is invalid';end if;
   if jsonb_typeof(p->'rows')<>'array' or jsonb_array_length(p->'rows') not between 1 and 50 then raise exception 'Working Matter table row count is invalid';end if;
   for r in select value from jsonb_array_elements(p->'rows') loop
    if jsonb_typeof(r)<>'array' or jsonb_array_length(r) not between 1 and 20 then raise exception 'Working Matter table column count is invalid';end if;
    for c in select value from jsonb_array_elements(r) loop
     cc:=cc+1;if cc>1000 or jsonb_typeof(c)<>'string' or length(c#>>'{}')>10000 then raise exception 'Working Matter table cell is invalid';end if;
     tc:=tc+length(c#>>'{}');if tc>1000000 then raise exception 'Working Matter text exceeds 1,000,000 characters';end if;
    end loop;
   end loop;
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
   if jsonb_typeof(r->'fontFamily') not in('string','null') or (jsonb_typeof(r->'fontFamily')='string' and r->>'fontFamily' not in('Arial','Calibri','Times New Roman','Mangal')) then raise exception 'Working Matter run font is not approved';end if;
   if jsonb_typeof(r->'fontSize') not in('number','null') or (jsonb_typeof(r->'fontSize')='number' and (r->>'fontSize')::numeric not between 4 and 200) then raise exception 'Working Matter run font size is invalid';end if;
   if jsonb_typeof(r->'color') not in('string','null') or (jsonb_typeof(r->'color')='string' and r->>'color'!~'^[0-9A-Fa-f]{6}$') or jsonb_typeof(r->'highlight') not in('string','null') or (jsonb_typeof(r->'highlight')='string' and r->>'highlight'!~'^(?:[0-9A-Fa-f]{6}|[A-Za-z]{1,30})$') then raise exception 'Working Matter run color is invalid';end if;
  end loop;
 end loop;
end $$;

revoke all on function public.assert_word_efficiency_working_matter(jsonb) from public,anon,authenticated;

commit;
