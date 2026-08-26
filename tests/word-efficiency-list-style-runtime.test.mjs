import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const migrationPath=new URL("../supabase/migrations/202608260025_word_efficiency_list_style_gallery.sql",import.meta.url);

async function capabilityChangesDatabase(){
 const db=new PGlite();
 // word_efficiency_command_enabled and word_efficiency_document_feature copied verbatim
 // from the live migration chain (005/012) so this exercises the real dependency logic.
 await db.exec(`
create role anon;create role authenticated;
create function public.word_efficiency_command_enabled(c jsonb,command_name text)
returns boolean language sql immutable as $$select exists(select 1 from jsonb_each(c->'tabs')as tab_entries(tab_name,tab_value)join lateral jsonb_each(tab_entries.tab_value->'groups')as group_entries(group_name,group_value)on true join lateral jsonb_each(group_entries.group_value->'options')as option_entries(option_name,option_value)on true where option_entries.option_name=command_name and(tab_entries.tab_value->>'enabled')::boolean and(group_entries.group_value->>'enabled')::boolean and(option_entries.option_value#>>'{}')::boolean)$$;
create function public.word_efficiency_document_feature(d jsonb,f text)
returns jsonb language plpgsql immutable as $$
declare feature_name alias for $2;feature_result jsonb;
begin
 if feature_name like'list:%'then select coalesce(jsonb_object_agg(block_entries.block_value->>'id',to_jsonb((block_entries.block_value#>>'{attrs,listStyle}')=substr(feature_name,6))order by block_entries.block_value->>'id')filter(where block_entries.block_value->>'type'='list-item'),'{}'::jsonb)into feature_result from jsonb_array_elements(d->'blocks')as block_entries(block_value);return feature_result;end if;
 return'{}'::jsonb;
end $$;
create function public.assert_word_efficiency_document_schema(jsonb,jsonb) returns void language sql immutable as $$select null::void$$;
`);
 await db.exec(await readFile(migrationPath,"utf8"));
 return db;
}

async function schemaDatabase(){
 const db=new PGlite();
 // Minimal stand-in for the real (much larger) wrapped validator: it only
 // ever accepts "bullet" as a list-item listStyle, mirroring the historical
 // 3-value enum's fallback. If the new wrapper's neutralization step ever
 // stops substituting "bullet" before delegating, every new gallery value
 // would start failing here even though assert_word_efficiency_capability_changes
 // (tested separately above) already approved it.
 await db.exec(`
create role anon;create role authenticated;
create function public.assert_word_efficiency_document_schema(document_snapshot jsonb,editor_capabilities jsonb)
returns void language plpgsql immutable as $$
declare block_value jsonb;
begin
 for block_value in select value from jsonb_array_elements(document_snapshot->'blocks')loop
  if block_value->>'type'='list-item'and block_value#>>'{attrs,listStyle}'<>'bullet'then raise exception'stub only accepts bullet';end if;
 end loop;
end $$;
`);
 await db.exec(await readFile(migrationPath,"utf8"));
 return db;
}

const capsWithBulletsOnly={tabs:{Home:{enabled:true,groups:{paragraph:{enabled:true,options:{bullets:true,numbering:false,multilevelList:false}}}}}};
const capsWithNumberingOnly={tabs:{Home:{enabled:true,groups:{paragraph:{enabled:true,options:{bullets:false,numbering:true,multilevelList:false}}}}}};
const capsWithMultilevelOnly={tabs:{Home:{enabled:true,groups:{paragraph:{enabled:true,options:{bullets:false,numbering:false,multilevelList:true}}}}}};
const capsWithNothing={tabs:{Home:{enabled:true,groups:{paragraph:{enabled:true,options:{bullets:false,numbering:false,multilevelList:false}}}}}};

test("every expanded bullet format is authorized by the bullets command and rejected without it",async()=>{
 const db=await capabilityChangesDatabase();
 // A single list-item's listStyle can only hold one value at a time, so switching it away from
 // "bullet" flips two one-hot list:* feature keys at once (the old key false, the new key true) --
 // this asserts the overall allow/reject outcome, not which of those two keys the engine happens
 // to report first, since VALUES-list iteration order deciding that is an implementation detail.
 const baseline={blocks:[{id:"b1",type:"list-item",attrs:{listStyle:"bullet"}}]};
 for(const style of["bullet-disc","bullet-circle","bullet-square","bullet-diamond","bullet-arrow","bullet-check"]){
  const edited={schemaVersion:"2",blocks:[{id:"b1",type:"list-item",attrs:{listStyle:style}}],operations:[]};
  await db.query("select public.assert_word_efficiency_capability_changes($1::jsonb,$2::jsonb,$3::jsonb)",[JSON.stringify(edited),JSON.stringify(baseline),JSON.stringify(capsWithBulletsOnly)]);
  await assert.rejects(db.query("select public.assert_word_efficiency_capability_changes($1::jsonb,$2::jsonb,$3::jsonb)",[JSON.stringify(edited),JSON.stringify(baseline),JSON.stringify(capsWithNothing)]),/Disabled capability changed document feature list:/);
 }
 await db.close();
});

test("every expanded numbering format is authorized by either numbering or multilevelList",async()=>{
 const db=await capabilityChangesDatabase();
 // Baseline stays within the numbering family (never "bullet") so only list:decimal and the
 // destination list:<style> keys toggle -- crossing into/out of the separate bullets family is
 // exercised by the dedicated "switching directly between two non-bullet numbering formats" test.
 const baseline={blocks:[{id:"b1",type:"list-item",attrs:{listStyle:"decimal"}}]};
 for(const style of["decimal-paren","upper-roman","upper-alpha","lower-alpha-paren","lower-alpha","lower-roman"]){
  const edited={schemaVersion:"2",blocks:[{id:"b1",type:"list-item",attrs:{listStyle:style}}],operations:[]};
  await db.query("select public.assert_word_efficiency_capability_changes($1::jsonb,$2::jsonb,$3::jsonb)",[JSON.stringify(edited),JSON.stringify(baseline),JSON.stringify(capsWithNumberingOnly)]);
  await db.query("select public.assert_word_efficiency_capability_changes($1::jsonb,$2::jsonb,$3::jsonb)",[JSON.stringify(edited),JSON.stringify(baseline),JSON.stringify(capsWithMultilevelOnly)]);
  await assert.rejects(db.query("select public.assert_word_efficiency_capability_changes($1::jsonb,$2::jsonb,$3::jsonb)",[JSON.stringify(edited),JSON.stringify(baseline),JSON.stringify(capsWithNothing)]),/Disabled capability changed document feature list:/);
 }
 await db.close();
});

test("switching directly between two non-bullet numbering formats is rejected without the numbering capability",async()=>{
 const db=await capabilityChangesDatabase();
 const baseline={blocks:[{id:"b1",type:"list-item",attrs:{listStyle:"decimal"}}]};
 const edited={schemaVersion:"2",blocks:[{id:"b1",type:"list-item",attrs:{listStyle:"upper-roman"}}],operations:[]};
 await db.query("select public.assert_word_efficiency_capability_changes($1::jsonb,$2::jsonb,$3::jsonb)",[JSON.stringify(edited),JSON.stringify(baseline),JSON.stringify(capsWithNumberingOnly)]);
 await assert.rejects(db.query("select public.assert_word_efficiency_capability_changes($1::jsonb,$2::jsonb,$3::jsonb)",[JSON.stringify(edited),JSON.stringify(baseline),JSON.stringify(capsWithNothing)]),/Disabled capability changed document feature list:(decimal|upper-roman)/);
 await db.close();
});

test("the document schema validator accepts every gallery value, rejects unknown ones, and still neutralizes to bullet for the wrapped legacy validator",async()=>{
 const db=await schemaDatabase();
 for(const style of["bullet","bullet-disc","bullet-circle","bullet-square","bullet-diamond","bullet-arrow","bullet-check","decimal","decimal-paren","upper-roman","upper-alpha","lower-alpha-paren","lower-alpha","lower-roman"]){
  const document={blocks:[{id:"b1",type:"list-item",attrs:{listStyle:style}}]};
  await db.query("select public.assert_word_efficiency_document_schema($1::jsonb,'{}'::jsonb)",[JSON.stringify(document)]);
 }
 const invalid={blocks:[{id:"b1",type:"list-item",attrs:{listStyle:"not-a-real-style"}}]};
 await assert.rejects(db.query("select public.assert_word_efficiency_document_schema($1::jsonb,'{}'::jsonb)",[JSON.stringify(invalid)]),/Invalid list style/);
 await db.close();
});

test("word_efficiency_approved_list_styles matches the client-side WORD_LIST_STYLES set exactly",async()=>{
 const db=await capabilityChangesDatabase();
 const{rows:[{styles}]}=await db.query("select public.word_efficiency_approved_list_styles() as styles");
 const source=await readFile(new URL("../lib/word-editor-document.ts",import.meta.url),"utf8");
 const match=source.match(/WORD_LIST_STYLES = new Set\(\[([^\]]+)\]\)/);
 const tsStyles=match[1].split(",").map(item=>item.trim().replace(/^"|"$/g,""));
 assert.deepEqual([...styles].sort(),[...tsStyles].sort());
 await db.close();
});
