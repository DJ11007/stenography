begin;

-- One-time data repair. lib/word-docx.ts's DOCX parser used to pass
-- w:highlight's raw OOXML enum name (e.g. "black", "red") straight through
-- as if it were a hex color, instead of mapping it to real hex like every
-- other color field in this app -- and the admin Model Answer editor's
-- initial (pre-edit) render used that value directly as a CSS
-- background-color with no "#" prefix, so a run highlighted with Word's
-- black or red highlighter swatch rendered as a literal solid black/red
-- bar over the text. The client-side parser is now fixed (new DOCX
-- uploads store real hex), but any Working Matter already uploaded before
-- that fix still has the raw enum name baked into working_matter_snapshot
-- and would keep showing the bug until re-uploaded. This repairs the
-- already-stored JSONB in place instead of requiring every admin to
-- re-upload their Working Matter DOCX.
--
-- Scope: only word_efficiency_versions.working_matter_snapshot (admin-
-- authored/imported source content). Past student attempt snapshots
-- (original_document_snapshot/final_document_snapshot/document_autosave)
-- are deliberately left untouched -- they're immutable-by-design grading
-- records, and none of that student-facing data was reported affected.

with highlight_names(name, hex) as (
  values
    ('yellow','FFFF00'),('green','00FF00'),('cyan','00FFFF'),('magenta','FF00FF'),('blue','0000FF'),('red','FF0000'),
    ('darkblue','00008B'),('darkcyan','008B8B'),('darkgreen','006400'),('darkmagenta','8B008B'),('darkred','8B0000'),('darkyellow','808000'),
    ('darkgray','A9A9A9'),('lightgray','D3D3D3'),('black','000000'),('white','FFFFFF')
),
repaired as (
  select
    versions.id,
    jsonb_set(
      versions.working_matter_snapshot,
      '{paragraphs}',
      (
        select jsonb_agg(
          case when paragraph_item->>'type' = 'table' then paragraph_item
          else jsonb_set(
            paragraph_item,
            '{runs}',
            (
              select jsonb_agg(
                case
                  when run_item->>'highlight' is null then run_item
                  when run_item->>'highlight' ~ '^[0-9A-Fa-f]{6}$' then run_item
                  when exists(select 1 from highlight_names where highlight_names.name = lower(run_item->>'highlight'))
                    then jsonb_set(run_item, '{highlight}', to_jsonb((select highlight_names.hex from highlight_names where highlight_names.name = lower(run_item->>'highlight'))))
                  else jsonb_set(run_item, '{highlight}', 'null'::jsonb)
                end
                order by run_ordinality
              )
              from jsonb_array_elements(coalesce(paragraph_item->'runs', '[]'::jsonb)) with ordinality as runs(run_item, run_ordinality)
            )
          )
          end
          order by paragraph_ordinality
        )
        from jsonb_array_elements(versions.working_matter_snapshot->'paragraphs') with ordinality as paragraphs(paragraph_item, paragraph_ordinality)
      )
    ) as fixed_snapshot
  from public.word_efficiency_versions as versions
  where versions.working_matter_snapshot ? 'paragraphs'
    and exists(
      select 1
      from jsonb_array_elements(versions.working_matter_snapshot->'paragraphs') as p(paragraph_item),
           jsonb_array_elements(coalesce(p.paragraph_item->'runs', '[]'::jsonb)) as r(run_item)
      where run_item->>'highlight' is not null
        and run_item->>'highlight' !~ '^[0-9A-Fa-f]{6}$'
    )
)
update public.word_efficiency_versions as versions
set working_matter_snapshot = repaired.fixed_snapshot
from repaired
where versions.id = repaired.id;

commit;
