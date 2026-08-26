import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const migrationPath=new URL("../supabase/migrations/202608250021_word_efficiency_hyphens_capability_pairing.sql",import.meta.url);

async function database(){
 const db=new PGlite();
 // word_efficiency_command_enabled and word_efficiency_document_feature copied
 // verbatim from supabase/migrations/202608240005_word_efficiency_hierarchical_editor_capabilities.sql
 // and 202608240012_repair_word_efficiency_fonts_clipboard_and_measurements.sql so this test
 // exercises assert_word_efficiency_capability_changes against the same real dependency logic.
 await db.exec(`
create role anon;create role authenticated;
create function public.word_efficiency_command_enabled(c jsonb,command_name text)
returns boolean language sql immutable as $$select exists(select 1 from jsonb_each(c->'tabs')as tab_entries(tab_name,tab_value)join lateral jsonb_each(tab_entries.tab_value->'groups')as group_entries(group_name,group_value)on true join lateral jsonb_each(group_entries.group_value->'options')as option_entries(option_name,option_value)on true where option_entries.option_name=command_name and(tab_entries.tab_value->>'enabled')::boolean and(group_entries.group_value->>'enabled')::boolean and(option_entries.option_value#>>'{}')::boolean)$$;
create function public.word_efficiency_canonical_measurement(measurement_value jsonb,measurement_kind text)
returns numeric language plpgsql immutable as $$
declare measurement_text text;measurement_parts text[];measurement_number numeric;measurement_unit text;
begin
 if measurement_value is null or measurement_value='null'::jsonb then return case when measurement_kind='lineHeight'then 1 else 0 end;end if;
 measurement_text:=btrim(measurement_value#>>'{}');
 if measurement_text=''then return case when measurement_kind='lineHeight'then 1 else 0 end;end if;
 measurement_parts:=regexp_match(measurement_text,'^(-?(?:[0-9]+(?:\\.[0-9]+)?|\\.[0-9]+))([a-z%]*)$','i');
 measurement_number:=measurement_parts[1]::numeric;measurement_unit:=lower(coalesce(measurement_parts[2],''));
 if measurement_kind='lineHeight'then return round(measurement_number,6);end if;
 if measurement_number=0 then return 0;end if;
 return round(case measurement_unit when'px'then measurement_number*.75 when'in'then measurement_number*72 when'cm'then measurement_number*72/2.54 when'mm'then measurement_number*72/25.4 else measurement_number end,6);
end $$;
create function public.word_efficiency_document_feature(d jsonb,f text)
returns jsonb language plpgsql immutable as $$
declare feature_name alias for $2;feature_result jsonb;
begin
 if feature_name in('marginLeft','marginRight','marginTop','marginBottom','lineHeight')then select coalesce(jsonb_object_agg(block_entries.block_value->>'id',to_jsonb(public.word_efficiency_canonical_measurement(block_entries.block_value#>array['attrs',feature_name],case when feature_name='lineHeight'then'lineHeight'else'length'end))order by block_entries.block_value->>'id'),'{}'::jsonb)into feature_result from jsonb_array_elements(d->'blocks')as block_entries(block_value);return feature_result;end if;
 if feature_name in('bold','italic')then select coalesce(jsonb_object_agg(block_entries.block_value->>'id',(select jsonb_agg(coalesce(run_entries.run_value->feature_name,'false'::jsonb)order by run_entries.ordinality)from jsonb_array_elements(block_entries.block_value->'runs')with ordinality as run_entries(run_value,ordinality))order by block_entries.block_value->>'id'),'{}'::jsonb)into feature_result from jsonb_array_elements(d->'blocks')as block_entries(block_value);return feature_result;end if;
 if feature_name in('border','backgroundColor','hyphens')then select coalesce(jsonb_object_agg(block_entries.block_value->>'id',coalesce(block_entries.block_value#>array['attrs',feature_name],'null'::jsonb)order by block_entries.block_value->>'id'),'{}'::jsonb)into feature_result from jsonb_array_elements(d->'blocks')as block_entries(block_value);return feature_result;end if;
 return'{}'::jsonb;
end $$;
`);
 await db.exec(await readFile(migrationPath,"utf8"));
 return db;
}

const capsWithIndentOnly={tabs:{Home:{enabled:true,groups:{paragraph:{enabled:true,options:{increaseIndent:true,decreaseIndent:true,lineSpacing:false,paragraphSpacing:false,borders:false,shading:false}}}}}};
const capsWithNothing={tabs:{Home:{enabled:true,groups:{paragraph:{enabled:true,options:{increaseIndent:false,decreaseIndent:false,lineSpacing:false,paragraphSpacing:false,borders:false,shading:false}}}}}};
const capsWithBorders={tabs:{Home:{enabled:true,groups:{paragraph:{enabled:true,options:{increaseIndent:false,decreaseIndent:false,lineSpacing:false,paragraphSpacing:false,borders:true,shading:false}}}}}};

test("an incidental marginRight drift is allowed once indent capability is enabled, matching marginLeft",async()=>{
 const db=await database();
 const baseline={blocks:[{id:"b1",attrs:{marginLeft:"0pt",marginRight:"0pt"},runs:[{bold:false}]}]};
 const edited={schemaVersion:"2",blocks:[{id:"b1",attrs:{marginLeft:"18pt",marginRight:"18pt"},runs:[{bold:false}]}],operations:[]};
 await db.query("select public.assert_word_efficiency_capability_changes($1::jsonb,$2::jsonb,$3::jsonb)",[JSON.stringify(edited),JSON.stringify(baseline),JSON.stringify(capsWithIndentOnly)]);
 await db.close();
});

test("a marginRight drift is still rejected when indent capability is disabled",async()=>{
 const db=await database();
 const baseline={blocks:[{id:"b1",attrs:{marginLeft:"0pt",marginRight:"0pt"},runs:[{bold:false}]}]};
 const edited={schemaVersion:"2",blocks:[{id:"b1",attrs:{marginLeft:"0pt",marginRight:"18pt"},runs:[{bold:false}]}],operations:[]};
 await assert.rejects(db.query("select public.assert_word_efficiency_capability_changes($1::jsonb,$2::jsonb,$3::jsonb)",[JSON.stringify(edited),JSON.stringify(baseline),JSON.stringify(capsWithNothing)]),/Disabled capability changed document feature marginRight/);
 await db.close();
});

test("an unrelated capability change (bold) is still rejected when bold is disabled, unaffected by the margin fix",async()=>{
 const db=await database();
 const baseline={blocks:[{id:"b1",attrs:{},runs:[{bold:false}]}]};
 const edited={schemaVersion:"2",blocks:[{id:"b1",attrs:{},runs:[{bold:true}]}],operations:[]};
 await assert.rejects(db.query("select public.assert_word_efficiency_capability_changes($1::jsonb,$2::jsonb,$3::jsonb)",[JSON.stringify(edited),JSON.stringify(baseline),JSON.stringify(capsWithNothing)]),/Disabled capability changed document feature bold/);
 await db.close();
});

test("a hyphens drift -- previously always rejected no matter what was enabled -- is now allowed once borders/shading capability is enabled",async()=>{
 const db=await database();
 const baseline={blocks:[{id:"b1",attrs:{hyphens:""},runs:[{bold:false}]}]};
 const edited={schemaVersion:"2",blocks:[{id:"b1",attrs:{hyphens:"auto"},runs:[{bold:false}]}],operations:[]};
 await db.query("select public.assert_word_efficiency_capability_changes($1::jsonb,$2::jsonb,$3::jsonb)",[JSON.stringify(edited),JSON.stringify(baseline),JSON.stringify(capsWithBorders)]);
 await assert.rejects(db.query("select public.assert_word_efficiency_capability_changes($1::jsonb,$2::jsonb,$3::jsonb)",[JSON.stringify(edited),JSON.stringify(baseline),JSON.stringify(capsWithNothing)]),/Disabled capability changed document feature hyphens/);
 await db.close();
});
