begin;

-- One-time data repair for the approvedColor() alpha-channel bug fixed
-- alongside this migration (rich-document-editor.tsx): every ordinary,
-- never-highlighted run computes its background as the browser's default
-- "rgba(0, 0, 0, 0)" (fully transparent) -- the old regex read only the
-- R/G/B groups and silently discarded the alpha channel, so that
-- transparent default was parsed as opaque black and written into the
-- run's `highlight` field on every autosave/submit/model-answer save.
-- Once a run's stored snapshot had highlight:"000000" baked in, reloading
-- it made the black bar real and visible -- this is the actual cause of
-- the recurring "black highlight" rendering reports this session, a much
-- larger-scope bug than the earlier OOXML w:highlight DOCX-import fix
-- (migration 202608310046), which only ever affected genuinely
-- DOCX-imported highlighted runs.
--
-- This repairs already-stored schemaVersion "2" editor-format documents:
-- word_efficiency_attempts.document_autosave/final_document_snapshot
-- (student attempts) and word_efficiency_versions.model_answer_snapshot
-- (admin-authored model answers). Unlike the migration 046 repair, the
-- user explicitly asked for student attempt data to be included here too,
-- since this bug directly made submitted-but-ungraded exams unreadable.
--
-- The repair is intentionally narrow: it only clears a run's `highlight`
-- when it is exactly "000000" AND that run's `color` is also null/absent
-- -- exactly the bug's signature, since the bug never touches `color`. Any
-- run that was deliberately given a highlight alongside an explicit text
-- color (e.g. white-on-black, a legitimate design choice) keeps its color
-- and is left untouched.

create or replace function public.word_efficiency_repair_transparent_highlight_bug(document jsonb)
returns jsonb language sql immutable set search_path=pg_catalog,public as $$
  select case
    when document is null or jsonb_typeof(document)<>'object' or not(document ? 'blocks') then document
    else jsonb_set(document,'{blocks}',coalesce((
      select jsonb_agg(
        case when block_item ? 'runs' then jsonb_set(block_item,'{runs}',coalesce((
          select jsonb_agg(
            case
              when run_item->>'highlight'='000000' and coalesce(run_item->'color','null'::jsonb)='null'::jsonb
                then jsonb_set(run_item,'{highlight}','null'::jsonb)
              else run_item
            end
            order by run_ordinality
          )
          from jsonb_array_elements(block_item->'runs') with ordinality as runs(run_item,run_ordinality)
        ),'[]'::jsonb)) else block_item end
        order by block_ordinality
      )
      from jsonb_array_elements(document->'blocks') with ordinality as blocks(block_item,block_ordinality)
    ),'[]'::jsonb))
  end
$$;

update public.word_efficiency_attempts
set document_autosave=public.word_efficiency_repair_transparent_highlight_bug(document_autosave)
where document_autosave is not null
  and exists(
    select 1 from jsonb_array_elements(coalesce(document_autosave->'blocks','[]'::jsonb)) as b(block_item),
                  jsonb_array_elements(coalesce(b.block_item->'runs','[]'::jsonb)) as r(run_item)
    where run_item->>'highlight'='000000' and coalesce(run_item->'color','null'::jsonb)='null'::jsonb
  );

update public.word_efficiency_attempts
set final_document_snapshot=public.word_efficiency_repair_transparent_highlight_bug(final_document_snapshot)
where final_document_snapshot is not null
  and exists(
    select 1 from jsonb_array_elements(coalesce(final_document_snapshot->'blocks','[]'::jsonb)) as b(block_item),
                  jsonb_array_elements(coalesce(b.block_item->'runs','[]'::jsonb)) as r(run_item)
    where run_item->>'highlight'='000000' and coalesce(run_item->'color','null'::jsonb)='null'::jsonb
  );

update public.word_efficiency_versions
set model_answer_snapshot=public.word_efficiency_repair_transparent_highlight_bug(model_answer_snapshot)
where model_answer_snapshot is not null
  and exists(
    select 1 from jsonb_array_elements(coalesce(model_answer_snapshot->'blocks','[]'::jsonb)) as b(block_item),
                  jsonb_array_elements(coalesce(b.block_item->'runs','[]'::jsonb)) as r(run_item)
    where run_item->>'highlight'='000000' and coalesce(run_item->'color','null'::jsonb)='null'::jsonb
  );

revoke all on function public.word_efficiency_repair_transparent_highlight_bug(jsonb) from public,anon,authenticated;

commit;
