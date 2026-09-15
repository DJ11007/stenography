import { createClient } from "./supabase/server";
import { normalizeExamCategoryPage, examCategoryPageBounds, sortExamCategoryNavigatorItems, EXAM_CATEGORY_PAGE_SIZE } from "./exam-category-navigator";
export { normalizeExamCategoryPage, examCategoryPageBounds, examCategoryPageCount, EXAM_CATEGORY_PAGE_SIZE } from "./exam-category-navigator";

export type ExamCategoryNavigatorItem={id:string;slug:string;title:string;publishedAt:string|null};
export type ExamCategoryNavigatorFilters={categorySlug:string;language:"English"|"Hindi";page:unknown;sort?:"newest"|"oldest"};

// Admin-uploaded exercises tied to one of the 25 hardcoded exam categories
// (lib/exam-categories.ts) via the exam_category key inside tests.settings --
// no dedicated column exists, matching the zero-migration jsonb pattern
// already used for task_category/audio_path/pdf_path/dictation_categories.
//
// Every exam exercise, whichever category it was native-uploaded under, is
// shared into every OTHER category's list too (no exam_category filter at
// all here) -- managedVersionToPreset()'s viewAsCategorySlug parameter
// (lib/admin-tests.ts) is what makes a shared exercise render/score with
// THIS category's own rules instead of its native one's. This is a live
// query (no caching on this route -- createClient() forces dynamic
// rendering), so it's retroactive: a newly published exercise appears on
// every category's list immediately, no admin re-save needed.
//
// Fetched in date order (page boundaries come from published_at), then
// re-sorted within that page by sortExamCategoryNavigatorItems() so
// plainly-numbered titles ("CHAPTER - 8") display in their natural serial
// order instead of publish order.
export async function getExamCategoryNavigator(filters:ExamCategoryNavigatorFilters){
 const supabase=await createClient();const oldest=filters.sort==="oldest";
 const query=supabase.from("tests").select("id,slug,title,published_at",{count:"exact"}).eq("mode","exam").eq("status","published").eq("visibility","public").eq("is_live",false).eq("language",filters.language);
 const requested=normalizeExamCategoryPage(filters.page);const from=(requested-1)*EXAM_CATEGORY_PAGE_SIZE;const{data,error,count}=await query.order("published_at",{ascending:oldest}).order("id",{ascending:true}).range(from,from+EXAM_CATEGORY_PAGE_SIZE-1);
 if(error){console.error("Exam category navigator query failed",{code:error.code,message:error.message});throw new Error(`Exam exercises could not be loaded (${error.code||"database error"}).`);}
 const total=count??0;const bounds=examCategoryPageBounds(requested,total);
 const items:ExamCategoryNavigatorItem[]=(data??[]).map(test=>({id:test.id,slug:test.slug,title:test.title,publishedAt:test.published_at}));
 return{items:sortExamCategoryNavigatorItems(items,oldest?"ascending":"descending"),total,...bounds};
}
