begin;

-- Produce the same bounded schema-v2 shape that the browser serializes. This
-- preserves source formatting while avoiding false changes caused only by the
-- old schema-v1 baseline omitting paragraph style attributes.
create or replace function public.word_efficiency_initial_editor_document(m jsonb)
returns jsonb language plpgsql immutable set search_path=pg_catalog,public as $$
declare editor_blocks jsonb;
begin
 if jsonb_typeof(m->'paragraphs')<>'array'then
  if m->>'schemaVersion'='2'and jsonb_typeof(m->'blocks')='array'then return m;end if;
  raise exception'Attempt original document cannot be converted';
 end if;
 select jsonb_agg(jsonb_build_object(
  'id','block-'||(paragraph_entries.ordinality-1),
  'type',case when paragraph_entries.paragraph_value->>'type'='list-item'then'list-item'else'paragraph'end,
  'alignment',coalesce(paragraph_entries.paragraph_value->>'alignment','left'),
  'runs',(select jsonb_agg(jsonb_build_object(
   'text',run_entries.run_value->>'text','bold',coalesce((run_entries.run_value->>'bold')::boolean,false),'italic',coalesce((run_entries.run_value->>'italic')::boolean,false),'underline',coalesce((run_entries.run_value->>'underline')::boolean,false),'strike',coalesce((run_entries.run_value->>'strike')::boolean,false),'superscript',false,'subscript',false,'fontFamily',run_entries.run_value->'fontFamily','fontSize',run_entries.run_value->'fontSize','color',run_entries.run_value->'color','highlight',run_entries.run_value->'highlight','doubleStrike',false,'href',null,'bookmark',null,'field',null
  )order by run_entries.ordinality)from jsonb_array_elements(paragraph_entries.paragraph_value->'runs')with ordinality as run_entries(run_value,ordinality)),
  'attrs',case when paragraph_entries.paragraph_value->>'type'='list-item'then jsonb_build_object('listStyle','bullet')else jsonb_build_object(
   'marginLeft',coalesce(paragraph_entries.paragraph_value->>'leftIndent','0')||'in','marginRight',coalesce(paragraph_entries.paragraph_value->>'rightIndent','0')||'in','lineHeight',coalesce(paragraph_entries.paragraph_value->>'lineSpacing','1'),'marginTop',coalesce(paragraph_entries.paragraph_value->>'spaceBefore','0')||'pt','marginBottom',coalesce(paragraph_entries.paragraph_value->>'spaceAfter','0')||'pt','lineNumbers',false,'dropCap',false
  )end
 )order by paragraph_entries.ordinality)into editor_blocks from jsonb_array_elements(m->'paragraphs')with ordinality as paragraph_entries(paragraph_value,ordinality);
 return jsonb_build_object('schemaVersion','2','blocks',editor_blocks,'pageLayout',jsonb_build_object('padding',null,'maxWidth',null,'aspectRatio',null,'columnCount',null,'backgroundColor',null,'border',null,'watermark',null),'operations','[]'::jsonb,'savedAt','1970-01-01T00:00:00.000Z');
end $$;

create or replace function public.autosave_word_efficiency_document(p_attempt_id uuid,p_document jsonb)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare attempt_record public.word_efficiency_attempts%rowtype;effective_capabilities jsonb;baseline_document jsonb;
begin
 if not public.is_active_word_efficiency_student()then raise exception'active student account required';end if;
 select attempt_rows.* into attempt_record from public.word_efficiency_attempts as attempt_rows where attempt_rows.id=p_attempt_id and attempt_rows.student_id=auth.uid()for update;
 if not found or attempt_record.status<>'active'or attempt_record.started_at is null or attempt_record.final_document_snapshot is not null then raise exception'attempt unavailable';end if;
 if now()>attempt_record.started_at+make_interval(secs=>attempt_record.selected_duration_seconds)then raise exception'autosave deadline expired';end if;
 if attempt_record.original_document_snapshot is null then raise exception'attempt original document is invalid';end if;
 select public.normalize_word_efficiency_editor_capabilities(version_rows.editor_capabilities)into effective_capabilities from public.word_efficiency_versions as version_rows where version_rows.id=attempt_record.version_id;
 baseline_document:=case when p_document->>'schemaVersion'='1'and attempt_record.snapshot#>>'{initial_editor_document,schemaVersion}'='1'then attempt_record.snapshot->'initial_editor_document'else public.word_efficiency_initial_editor_document(attempt_record.original_document_snapshot)end;
 perform public.assert_word_efficiency_editor_capabilities(effective_capabilities);perform public.assert_word_efficiency_document_schema(p_document,effective_capabilities);perform public.assert_word_efficiency_document_schema(baseline_document,effective_capabilities);perform public.assert_word_efficiency_capability_changes(p_document,baseline_document,effective_capabilities);
 update public.word_efficiency_attempts as attempt_rows set document_autosave=p_document,updated_at=now()where attempt_rows.id=p_attempt_id and attempt_rows.student_id=auth.uid()and attempt_rows.final_document_snapshot is null;
end $$;

create or replace function public.submit_word_efficiency_document(p_attempt_id uuid,p_document jsonb)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare attempt_record public.word_efficiency_attempts%rowtype;effective_capabilities jsonb;baseline_document jsonb;
begin
 if not public.is_active_word_efficiency_student()then raise exception'active student account required';end if;
 select attempt_rows.* into attempt_record from public.word_efficiency_attempts as attempt_rows where attempt_rows.id=p_attempt_id and attempt_rows.student_id=auth.uid()for update;
 if not found or attempt_record.status<>'active'or attempt_record.started_at is null or attempt_record.final_document_snapshot is not null then raise exception'attempt unavailable or already submitted';end if;
 if now()>attempt_record.started_at+make_interval(secs=>attempt_record.selected_duration_seconds+300)then raise exception'submission grace expired';end if;
 if attempt_record.original_document_snapshot is null then raise exception'attempt original document is invalid';end if;
 select public.normalize_word_efficiency_editor_capabilities(version_rows.editor_capabilities)into effective_capabilities from public.word_efficiency_versions as version_rows where version_rows.id=attempt_record.version_id;
 baseline_document:=case when p_document->>'schemaVersion'='1'and attempt_record.snapshot#>>'{initial_editor_document,schemaVersion}'='1'then attempt_record.snapshot->'initial_editor_document'else public.word_efficiency_initial_editor_document(attempt_record.original_document_snapshot)end;
 perform public.assert_word_efficiency_editor_capabilities(effective_capabilities);perform public.assert_word_efficiency_document_schema(baseline_document,effective_capabilities);
 if now()<=attempt_record.started_at+make_interval(secs=>attempt_record.selected_duration_seconds)then
  perform public.assert_word_efficiency_document_schema(p_document,effective_capabilities);perform public.assert_word_efficiency_capability_changes(p_document,baseline_document,effective_capabilities);
 else
  if attempt_record.document_autosave is null or p_document is distinct from attempt_record.document_autosave then raise exception'post-deadline submission must match the last valid autosave';end if;
  perform public.assert_word_efficiency_document_schema(attempt_record.document_autosave,effective_capabilities);perform public.assert_word_efficiency_capability_changes(attempt_record.document_autosave,baseline_document,effective_capabilities);p_document:=attempt_record.document_autosave;
 end if;
 update public.word_efficiency_attempts as attempt_rows set document_autosave=p_document,final_document_snapshot=p_document,status='submitted',submitted_at=now(),updated_at=now()where attempt_rows.id=p_attempt_id and attempt_rows.student_id=auth.uid()and attempt_rows.status='active'and attempt_rows.final_document_snapshot is null;
 if not found then raise exception'attempt unavailable or already submitted';end if;
end $$;

revoke all on function public.word_efficiency_initial_editor_document(jsonb),public.autosave_word_efficiency_document(uuid,jsonb),public.submit_word_efficiency_document(uuid,jsonb)from public,anon,authenticated;
grant execute on function public.autosave_word_efficiency_document(uuid,jsonb),public.submit_word_efficiency_document(uuid,jsonb)to authenticated;

commit;
