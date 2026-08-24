begin;

alter table public.word_efficiency_versions add column if not exists working_matter_snapshot jsonb;
alter table public.word_efficiency_versions add column if not exists editor_capabilities jsonb;
alter table public.word_efficiency_attempts add column if not exists original_document_snapshot jsonb;
alter table public.word_efficiency_attempts add column if not exists document_autosave jsonb;
alter table public.word_efficiency_attempts add column if not exists final_document_snapshot jsonb;

create or replace function public.assert_word_efficiency_working_matter(p_snapshot jsonb)
returns void language plpgsql immutable set search_path=pg_catalog,public as $$
declare p jsonb;r jsonb;pc integer;rc integer:=0;tc bigint:=0;
begin
 if p_snapshot is null or jsonb_typeof(p_snapshot)<>'object' then raise exception 'Working Matter must be a JSON object';end if;
 if pg_column_size(p_snapshot)>2097152 then raise exception 'Working Matter snapshot exceeds 2 MiB';end if;
 if jsonb_typeof(p_snapshot->'schemaVersion')<>'string' or p_snapshot->>'schemaVersion'<>'1' then raise exception 'Working Matter schemaVersion must be "1"';end if;
 if jsonb_typeof(p_snapshot->'language')<>'string' or p_snapshot->>'language' not in('English','Hindi') then raise exception 'Working Matter language is invalid';end if;
 if jsonb_typeof(p_snapshot->'paragraphs')<>'array' then raise exception 'Working Matter paragraphs must be an array';end if;
 if exists(select 1 from jsonb_object_keys(p_snapshot) k where k<>all(array['schemaVersion','language','source','paragraphs','formattingSummary','warnings'])) then raise exception 'Working Matter contains unknown fields';end if;
 pc:=jsonb_array_length(p_snapshot->'paragraphs');if pc<1 or pc>500 then raise exception 'Working Matter must contain 1 to 500 paragraphs';end if;
 if p_snapshot?'source' and jsonb_typeof(p_snapshot->'source') not in('object','null') then raise exception 'Working Matter source is invalid';end if;
 if p_snapshot?'formattingSummary' and jsonb_typeof(p_snapshot->'formattingSummary')<>'object' then raise exception 'Working Matter formatting summary is invalid';end if;
 if p_snapshot?'warnings' and (jsonb_typeof(p_snapshot->'warnings')<>'array' or jsonb_array_length(p_snapshot->'warnings')>100 or exists(select 1 from jsonb_array_elements(p_snapshot->'warnings') w where jsonb_typeof(w)<>'string' or length(w#>>'{}')>1000)) then raise exception 'Working Matter warnings are invalid';end if;
 for p in select value from jsonb_array_elements(p_snapshot->'paragraphs') loop
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

create or replace function public.assert_word_efficiency_editor_capabilities(c jsonb)
returns void language plpgsql immutable set search_path=pg_catalog,public as $$
declare b text;
begin
 if c is null or jsonb_typeof(c)<>'object' or pg_column_size(c)>65536 then raise exception 'Editor capabilities must be a bounded JSON object';end if;
 if not(c?&array['tabs','commands','fonts','fontSizeMin','fontSizeMax','clipboard','findReplace','tables','pageLayout','pause']) or exists(select 1 from jsonb_object_keys(c) k where k<>all(array['tabs','commands','fonts','fontSizeMin','fontSizeMax','clipboard','findReplace','tables','pageLayout','pause'])) then raise exception 'Editor capability fields are invalid';end if;
 if jsonb_typeof(c->'tabs')<>'array' or jsonb_array_length(c->'tabs')<1 or exists(select 1 from jsonb_array_elements(c->'tabs') x where jsonb_typeof(x)<>'string' or x#>>'{}'<>all(array['Home','Insert','Page Layout','Review','View'])) then raise exception 'Unknown editor tab';end if;
 if jsonb_typeof(c->'commands')<>'array' or exists(select 1 from jsonb_array_elements(c->'commands') x where jsonb_typeof(x)<>'string' or x#>>'{}'<>all(array['undo','redo','cut','copy','paste','fontName','fontSize','bold','italic','underline','strikeThrough','superscript','subscript','justifyLeft','justifyCenter','justifyRight','justifyFull','insertUnorderedList','insertOrderedList','indent','outdent','removeFormat','insertHTML','insertText','findReplace'])) then raise exception 'Unknown editor command';end if;
 if jsonb_typeof(c->'fonts')<>'array' or jsonb_array_length(c->'fonts')<1 or exists(select 1 from jsonb_array_elements(c->'fonts') x where jsonb_typeof(x)<>'string' or x#>>'{}'<>all(array['Arial','Calibri','Times New Roman','Mangal'])) then raise exception 'Unknown editor font';end if;
 if jsonb_typeof(c->'fontSizeMin')<>'number' or jsonb_typeof(c->'fontSizeMax')<>'number' or (c->>'fontSizeMin')::numeric<8 or (c->>'fontSizeMax')::numeric>72 or (c->>'fontSizeMin')::numeric>(c->>'fontSizeMax')::numeric then raise exception 'Editor font-size range is invalid';end if;
 foreach b in array array['clipboard','findReplace','tables','pageLayout','pause'] loop if jsonb_typeof(c->b)<>'boolean' then raise exception 'Editor capability % must be boolean',b;end if;end loop;
 if (c->>'pause')::boolean then raise exception 'Pause is not supported without database-owned timing';end if;
end $$;

create or replace function public.assert_word_efficiency_edited_document(d jsonb,v uuid)
returns void language plpgsql immutable set search_path=pg_catalog,public as $$
declare b jsonb;r jsonb;bc integer;rc integer:=0;tc bigint:=0;
begin
 if d is null or jsonb_typeof(d)<>'object' or pg_column_size(d)>2097152 then raise exception 'Document snapshot must be a bounded JSON object';end if;
 if not(d?&array['schemaVersion','blocks','savedAt']) or exists(select 1 from jsonb_object_keys(d) k where k<>all(array['schemaVersion','blocks','savedAt'])) then raise exception 'Document snapshot fields are invalid';end if;
 if jsonb_typeof(d->'schemaVersion') not in('string','number') or d->>'schemaVersion'<>'1' then raise exception 'Document snapshot schema/version is incompatible with this attempt';end if;
 if jsonb_typeof(d->'blocks')<>'array' or jsonb_typeof(d->'savedAt')<>'string' or length(d->>'savedAt')>64 then raise exception 'Document snapshot content is invalid';end if;
 bc:=jsonb_array_length(d->'blocks');if bc<1 or bc>1000 then raise exception 'Document snapshot block count is invalid';end if;
 for b in select value from jsonb_array_elements(d->'blocks')loop
  if jsonb_typeof(b)<>'object' or not(b?&array['id','type','alignment','runs']) or exists(select 1 from jsonb_object_keys(b)k where k<>all(array['id','type','alignment','runs']))then raise exception 'Document block fields are invalid';end if;
  if jsonb_typeof(b->'id')<>'string' or length(b->>'id')not between 1 and 100 or jsonb_typeof(b->'type')<>'string' or b->>'type'not in('paragraph','list-item','table-cell','page-break') or jsonb_typeof(b->'alignment')<>'string' or b->>'alignment'not in('left','center','right','justify')then raise exception 'Document block is invalid';end if;
  if jsonb_typeof(b->'runs')<>'array' or jsonb_array_length(b->'runs')<1 or jsonb_array_length(b->'runs')>500 then raise exception 'Document block runs are invalid';end if;
  for r in select value from jsonb_array_elements(b->'runs')loop
   rc:=rc+1;if rc>20000 or jsonb_typeof(r)<>'object' or not(r?&array['text','bold','italic','underline','strike','superscript','subscript','fontFamily','fontSize','color','highlight'])or exists(select 1 from jsonb_object_keys(r)k where k<>all(array['text','bold','italic','underline','strike','superscript','subscript','fontFamily','fontSize','color','highlight']))then raise exception 'Document run fields are invalid';end if;
   if jsonb_typeof(r->'text')<>'string' or length(r->>'text')>200000 then raise exception 'Document run text is invalid';end if;tc:=tc+length(r->>'text');if tc>1000000 then raise exception 'Document text is too large';end if;
   if jsonb_typeof(r->'bold')<>'boolean' or jsonb_typeof(r->'italic')<>'boolean' or jsonb_typeof(r->'underline')<>'boolean' or jsonb_typeof(r->'strike')<>'boolean' or jsonb_typeof(r->'superscript')<>'boolean' or jsonb_typeof(r->'subscript')<>'boolean' then raise exception 'Document run marks are invalid';end if;
   if jsonb_typeof(r->'fontFamily')not in('string','null')or(jsonb_typeof(r->'fontFamily')='string'and r->>'fontFamily'not in('Arial','Calibri','Times New Roman','Mangal'))or jsonb_typeof(r->'fontSize')not in('number','null')or(jsonb_typeof(r->'fontSize')='number'and(r->>'fontSize')::numeric not between 8 and 72)then raise exception 'Document run font is invalid';end if;
   if jsonb_typeof(r->'color')not in('string','null')or(jsonb_typeof(r->'color')='string'and r->>'color'!~'^[0-9A-Fa-f]{6}$')or jsonb_typeof(r->'highlight')not in('string','null')or(jsonb_typeof(r->'highlight')='string'and r->>'highlight'!~'^(?:[0-9A-Fa-f]{6}|[A-Za-z]{1,30})$')then raise exception 'Document run color is invalid';end if;
  end loop;
 end loop;
 begin perform (d->>'savedAt')::timestamptz;exception when others then raise exception 'Document snapshot savedAt is invalid';end;
end $$;

create or replace function public.is_active_word_efficiency_student()
returns boolean language sql stable security definer set search_path=pg_catalog,public as $$select exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='student' and p.is_active)$$;

update public.word_efficiency_versions set working_matter_snapshot=jsonb_set('{"schemaVersion":"1","language":"English","paragraphs":[{"id":"legacy-working-matter","type":"paragraph","paragraphNumber":1,"listGroup":null,"runs":[{"text":"Working matter was not configured for this legacy version.","bold":false,"italic":false,"underline":false,"strike":false,"fontFamily":"Arial","fontSize":12,"color":null,"highlight":null}],"alignment":"left","leftIndent":0,"rightIndent":0,"lineSpacing":1,"spaceBefore":0,"spaceAfter":0}],"formattingSummary":{"paragraphs":1,"runs":1,"italicParagraphs":0,"justifiedParagraphs":0,"listItems":0,"fonts":["Arial"]},"warnings":["Legacy version: upload Working Matter before creating a replacement version."]}'::jsonb,'{language}',to_jsonb(language),false) where working_matter_snapshot is null;
update public.word_efficiency_versions set editor_capabilities='{"tabs":["Home","Insert","Page Layout","Review","View"],"commands":["undo","redo","cut","copy","paste","fontName","fontSize","bold","italic","underline","strikeThrough","superscript","subscript","justifyLeft","justifyCenter","justifyRight","justifyFull","insertUnorderedList","insertOrderedList","indent","outdent","removeFormat","insertHTML","insertText","findReplace"],"fonts":["Arial","Calibri","Times New Roman","Mangal"],"fontSizeMin":8,"fontSizeMax":72,"clipboard":true,"findReplace":true,"tables":true,"pageLayout":true,"pause":false}'::jsonb where editor_capabilities is null;
alter table public.word_efficiency_versions alter column working_matter_snapshot set not null;
alter table public.word_efficiency_versions alter column editor_capabilities set not null;

-- Save remains one transaction: validator failures roll back the test row, version and questions.
create or replace function public.save_word_efficiency_test(p_test_id uuid,p_payload jsonb)
returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare tid uuid;vid uuid;vn integer;pub boolean;ons boolean;pdf boolean;q jsonb;dur integer;total numeric;qc integer;matter jsonb;caps jsonb;
begin
 if not public.is_aal2_admin() then raise exception 'not authorized';end if;matter:=p_payload->'working_matter_snapshot';caps:=p_payload->'editor_capabilities';perform public.assert_word_efficiency_working_matter(matter);perform public.assert_word_efficiency_editor_capabilities(caps);if matter->>'language'<>p_payload->>'language'then raise exception 'Working Matter language must match test language';end if;
 pub:=coalesce((p_payload->>'publish')::boolean,false);ons:=coalesce((p_payload->>'delivery_onscreen')::boolean,false);pdf:=coalesce((p_payload->>'delivery_pdf')::boolean,false);if nullif(btrim(p_payload->>'instructions_markdown'),'')is null then raise exception 'instructions required';end if;if not ons and not pdf then raise exception 'delivery method required';end if;
 if jsonb_array_length(coalesce(p_payload->'duration_options','[]'))<1 then raise exception 'duration required';end if;for dur in select value::integer from jsonb_array_elements_text(p_payload->'duration_options')loop if dur<60 or dur>14400 then raise exception 'invalid duration';end if;end loop;
 qc:=jsonb_array_length(coalesce(p_payload->'questions','[]'));if qc<1 or qc>500 or qc<>(p_payload->>'question_count')::integer then raise exception 'question count mismatch';end if;
 if exists(select 1 from jsonb_array_elements(p_payload->'questions')i where nullif(i->>'number','')is null or(i->>'number')::integer<1 or nullif(i->>'display_order','')is null or(i->>'display_order')::integer<1 or nullif(i->>'marks','')is null or(i->>'marks')::numeric<=0 or(i->>'marks')::numeric>1000)then raise exception 'invalid question number, order, or marks';end if;
 if(select count(distinct(i->>'number')::integer)from jsonb_array_elements(p_payload->'questions')i)<>qc or(select count(distinct(i->>'display_order')::integer)from jsonb_array_elements(p_payload->'questions')i)<>qc then raise exception 'duplicate question number or order';end if;
 if ons and exists(select 1 from jsonb_array_elements(p_payload->'questions')i where coalesce((i->>'is_visible')::boolean,true)and nullif(btrim(i->>'instruction'),'')is null)then raise exception 'visible question text required';end if;if pdf and(nullif(p_payload->>'pdf_path','')is null or nullif(p_payload->>'pdf_file_name','')is null or coalesce((p_payload->>'pdf_size_bytes')::bigint,0)<=0)then raise exception 'valid PDF required';end if;
 select round(coalesce(sum((i->>'marks')::numeric),0),2)into total from jsonb_array_elements(p_payload->'questions')i;if total<>(p_payload->>'maximum_marks')::numeric then raise exception 'question marks total mismatch';end if;
 if p_test_id is null then insert into public.word_efficiency_tests(slug,title,language,status,created_by)values(p_payload->>'slug',p_payload->>'title',p_payload->>'language',case when pub then'published'else'draft'end,auth.uid())returning id into tid;else select id into tid from public.word_efficiency_tests where id=p_test_id for update;if tid is null then raise exception 'test unavailable';end if;update public.word_efficiency_tests set slug=p_payload->>'slug',title=p_payload->>'title',language=p_payload->>'language',status=case when pub then'published'else'draft'end,updated_at=now()where id=tid;end if;
 select coalesce(max(version_number),0)+1 into vn from public.word_efficiency_versions where test_id=tid;
 insert into public.word_efficiency_versions(test_id,version_number,title,language,description,instructions_markdown,delivery_onscreen,delivery_pdf,question_count,maximum_marks,duration_options,passing_marks,pdf_path,pdf_file_name,pdf_size_bytes,pdf_page_count,pdf_uploaded_at,working_matter_snapshot,editor_capabilities,created_by)values(tid,vn,p_payload->>'title',p_payload->>'language',coalesce(p_payload->>'description',''),p_payload->>'instructions_markdown',ons,pdf,qc,total,array(select value::integer from jsonb_array_elements_text(p_payload->'duration_options')),nullif(p_payload->>'passing_marks','')::numeric,nullif(p_payload->>'pdf_path',''),nullif(p_payload->>'pdf_file_name',''),nullif(p_payload->>'pdf_size_bytes','')::bigint,nullif(p_payload->>'pdf_page_count','')::integer,case when pdf then coalesce((p_payload->>'pdf_uploaded_at')::timestamptz,now())end,matter,caps,auth.uid())returning id into vid;
 for q in select value from jsonb_array_elements(p_payload->'questions')loop insert into public.word_efficiency_questions(version_id,question_number,instruction,marks,sample_text,section,display_order,is_visible,grading_note)values(vid,(q->>'number')::integer,coalesce(q->>'instruction',''),(q->>'marks')::numeric,nullif(q->>'sample_text',''),nullif(q->>'section',''),(q->>'display_order')::integer,coalesce((q->>'is_visible')::boolean,true),nullif(q->>'grading_note',''));end loop;
 update public.word_efficiency_tests set current_version_id=vid,current_version_number=vn,published_at=case when pub then coalesce(published_at,now())else published_at end where id=tid;return tid;
end $$;

create or replace function public.prepare_word_efficiency_attempt(p_test_id uuid,p_duration_seconds integer,p_delivery text)
returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare t public.word_efficiency_tests%rowtype;v public.word_efficiency_versions%rowtype;aid uuid;questions jsonb;question_total numeric;
begin
 if not public.is_active_word_efficiency_student()then raise exception 'active student account required';end if;
 select * into t from public.word_efficiency_tests where id=p_test_id and status='published';if not found then raise exception 'test unavailable';end if;select * into v from public.word_efficiency_versions where id=t.current_version_id;
 if not p_duration_seconds=any(v.duration_options)then raise exception 'duration unavailable';end if;if p_delivery not in('onscreen','pdf')or(p_delivery='onscreen'and not v.delivery_onscreen)or(p_delivery='pdf'and not v.delivery_pdf)then raise exception 'delivery unavailable';end if;
 perform public.assert_word_efficiency_working_matter(v.working_matter_snapshot);perform public.assert_word_efficiency_editor_capabilities(v.editor_capabilities);
 select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'question_version_id',q.id,'number',q.question_number,'display_order',q.display_order,'instruction',case when p_delivery='onscreen'and q.is_visible then q.instruction end,'marks',q.marks,'sample_text',case when p_delivery='onscreen'and q.is_visible then q.sample_text end,'section',q.section,'is_visible',q.is_visible)order by q.display_order),'[]'::jsonb),round(coalesce(sum(q.marks),0),2)into questions,question_total from public.word_efficiency_questions q where q.version_id=v.id;
 if jsonb_array_length(questions)<>v.question_count or question_total<>v.maximum_marks then raise exception 'published question allocation is inconsistent';end if;
 insert into public.word_efficiency_attempts(test_id,version_id,student_id,delivery_method,selected_duration_seconds,snapshot)values(t.id,v.id,auth.uid(),p_delivery,p_duration_seconds,jsonb_build_object('test_id',t.id,'test_version_id',v.id,'instructions_version_id',v.id,'question_version_id',v.id,'title',v.title,'language',v.language,'instructions_markdown',v.instructions_markdown,'delivery_method',p_delivery,'duration_seconds',p_duration_seconds,'question_count',v.question_count,'maximum_marks',question_total,'questions',questions,'pdf_path',case when p_delivery='pdf'then v.pdf_path end,'pdf_file_name',case when p_delivery='pdf'then v.pdf_file_name end,'pdf_size_bytes',case when p_delivery='pdf'then v.pdf_size_bytes end,'pdf_page_count',case when p_delivery='pdf'then v.pdf_page_count end,'pdf_uploaded_at',case when p_delivery='pdf'then v.pdf_uploaded_at end))returning id into aid;
 insert into public.word_efficiency_question_scores(attempt_id,question_id,question_number,maximum_marks,grading_note_snapshot)select aid,q.id,q.question_number,q.marks,q.grading_note from public.word_efficiency_questions q where q.version_id=v.id;return aid;
end $$;

create or replace function public.start_word_efficiency_attempt(p_attempt_id uuid)
returns timestamptz language plpgsql security definer set search_path=pg_catalog,public as $$
declare stamp timestamptz;
begin
 if not public.is_active_word_efficiency_student()then raise exception 'active student account required';end if;
 update public.word_efficiency_attempts set status='active',started_at=coalesce(started_at,now()),updated_at=now()where id=p_attempt_id and student_id=auth.uid()and status in('prepared','active')and original_document_snapshot is not null returning started_at into stamp;
 if stamp is null then raise exception 'attempt unavailable';end if;return stamp;
end $$;

create or replace function public.initialize_word_efficiency_document(p_attempt_id uuid,p_show_questions boolean)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare matter jsonb;caps jsonb;original jsonb;
begin
 if not public.is_active_word_efficiency_student()then raise exception 'active student account required';end if;select v.working_matter_snapshot,v.editor_capabilities,a.original_document_snapshot into matter,caps,original from public.word_efficiency_attempts a join public.word_efficiency_versions v on v.id=a.version_id where a.id=p_attempt_id and a.student_id=auth.uid()and a.status='prepared'for update of a;if not found then raise exception 'attempt unavailable';end if;if original is not null then return original;end if;perform public.assert_word_efficiency_working_matter(matter);perform public.assert_word_efficiency_editor_capabilities(caps);update public.word_efficiency_attempts set original_document_snapshot=coalesce(original_document_snapshot,matter),document_autosave=null,snapshot=coalesce(snapshot,'{}'::jsonb)||jsonb_build_object('working_matter',matter,'editor_capabilities',caps,'show_questions',coalesce(p_show_questions,false)),updated_at=now()where id=p_attempt_id and student_id=auth.uid()and status='prepared'and original_document_snapshot is null;return matter;
end $$;

-- Attempts expire after their selected duration. A fixed five-minute grace period
-- permits final network delivery; pause is disabled and started_at is never reset.
create or replace function public.autosave_word_efficiency_document(p_attempt_id uuid,p_document jsonb)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare a public.word_efficiency_attempts%rowtype;
begin
 if not public.is_active_word_efficiency_student()then raise exception 'active student account required';end if;select * into a from public.word_efficiency_attempts where id=p_attempt_id and student_id=auth.uid()for update;if not found or a.status<>'active'or a.started_at is null or a.final_document_snapshot is not null then raise exception 'attempt unavailable';end if;if now()>a.started_at+make_interval(secs=>a.selected_duration_seconds)then raise exception 'autosave deadline expired';end if;if a.original_document_snapshot is null or a.original_document_snapshot->>'schemaVersion'<>'1'then raise exception 'attempt original document is invalid';end if;perform public.assert_word_efficiency_edited_document(p_document,a.version_id);update public.word_efficiency_attempts set document_autosave=p_document,updated_at=now()where id=p_attempt_id and final_document_snapshot is null;
end $$;

create or replace function public.submit_word_efficiency_document(p_attempt_id uuid,p_document jsonb)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare a public.word_efficiency_attempts%rowtype;
begin
 if not public.is_active_word_efficiency_student()then raise exception 'active student account required';end if;select * into a from public.word_efficiency_attempts where id=p_attempt_id and student_id=auth.uid()for update;if not found or a.status<>'active'or a.started_at is null or a.final_document_snapshot is not null then raise exception 'attempt unavailable or already submitted';end if;if now()>a.started_at+make_interval(secs=>a.selected_duration_seconds+300)then raise exception 'submission grace expired';end if;if a.original_document_snapshot is null or a.original_document_snapshot->>'schemaVersion'<>'1'then raise exception 'attempt original document is invalid';end if;if now()<=a.started_at+make_interval(secs=>a.selected_duration_seconds)then perform public.assert_word_efficiency_edited_document(p_document,a.version_id);else if a.document_autosave is null or p_document is distinct from a.document_autosave then raise exception 'post-deadline submission must match the last valid autosave';end if;perform public.assert_word_efficiency_edited_document(a.document_autosave,a.version_id);p_document:=a.document_autosave;end if;update public.word_efficiency_attempts set document_autosave=p_document,final_document_snapshot=p_document,status='submitted',submitted_at=now(),updated_at=now()where id=p_attempt_id and student_id=auth.uid()and status='active'and final_document_snapshot is null;if not found then raise exception 'attempt unavailable or already submitted';end if;
end $$;

revoke all on function public.assert_word_efficiency_working_matter(jsonb),public.assert_word_efficiency_editor_capabilities(jsonb),public.assert_word_efficiency_edited_document(jsonb,uuid),public.is_active_word_efficiency_student(),public.prepare_word_efficiency_attempt(uuid,integer,text),public.start_word_efficiency_attempt(uuid),public.initialize_word_efficiency_document(uuid,boolean),public.autosave_word_efficiency_document(uuid,jsonb),public.submit_word_efficiency_document(uuid,jsonb) from public,anon;
grant execute on function public.prepare_word_efficiency_attempt(uuid,integer,text),public.start_word_efficiency_attempt(uuid),public.initialize_word_efficiency_document(uuid,boolean),public.autosave_word_efficiency_document(uuid,jsonb),public.submit_word_efficiency_document(uuid,jsonb) to authenticated;
revoke update on public.word_efficiency_attempts from authenticated;

commit;
