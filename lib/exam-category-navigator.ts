export const EXAM_CATEGORY_PAGE_SIZE=50;
export function normalizeExamCategoryPage(value:unknown){const page=Number(value);return Number.isSafeInteger(page)&&page>0?page:1;}
export function examCategoryPageCount(total:number){return Math.max(1,Math.ceil(Math.max(0,total)/EXAM_CATEGORY_PAGE_SIZE));}
export function examCategoryPageBounds(page:number,total:number){const pages=examCategoryPageCount(total);const safe=Math.min(Math.max(1,page),pages);return{page:safe,from:(safe-1)*EXAM_CATEGORY_PAGE_SIZE,to:Math.min(total,safe*EXAM_CATEGORY_PAGE_SIZE)-1,pages};}

// Real reported bug: "CHAPTER - 8" was published before "CHAPTER - 6", so
// date-based ordering listed them 1,2,3,4,5,8,6,9,7 -- not the "serial"
// order a student expects from titles that are plainly numbered. Re-sorts
// by the first number found in each title -- direction still follows the
// same Oldest/Newest toggle (ascending = Oldest, descending = Newest).
// Titles with no number at all keep their original (date-based) relative
// order and sort after every numbered title. Only re-orders WITHIN
// whatever page was already fetched by date -- page boundaries themselves
// still come from published_at, so this doesn't change how many pages exist.
export function sortExamCategoryNavigatorItems<T extends {title:string}>(items:T[],direction:"ascending"|"descending"):T[]{
  const sign=direction==="ascending"?1:-1;
  return items
    .map((item,index)=>({item,index,number:Number(item.title.match(/\d+/)?.[0])}))
    .sort((a,b)=>{
      const aHas=Number.isFinite(a.number),bHas=Number.isFinite(b.number);
      if(aHas&&bHas)return (a.number-b.number)*sign||a.index-b.index;
      if(aHas!==bHas)return aHas?-1:1;
      return a.index-b.index;
    })
    .map(({item})=>item);
}
