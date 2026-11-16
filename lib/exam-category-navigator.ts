export const EXAM_CATEGORY_PAGE_SIZE=50;
export function normalizeExamCategoryPage(value:unknown){const page=Number(value);return Number.isSafeInteger(page)&&page>0?page:1;}
export function examCategoryPageCount(total:number){return Math.max(1,Math.ceil(Math.max(0,total)/EXAM_CATEGORY_PAGE_SIZE));}
export function examCategoryPageBounds(page:number,total:number){const pages=examCategoryPageCount(total);const safe=Math.min(Math.max(1,page),pages);return{page:safe,from:(safe-1)*EXAM_CATEGORY_PAGE_SIZE,to:Math.min(total,safe*EXAM_CATEGORY_PAGE_SIZE)-1,pages};}

// Serial order of exam exercises, by title: first the name part before the number (so all "EXERCISE"s stay
// together, then "LIVE TEST"s, "PASSAGE"s, "TEST"s ... alphabetically, ignoring spaces/dashes so "EXERCISE-152"
// and "EXERCISE - 4" are the same group), then the number (4 before 18 before 152). Titles with no number go
// after the numbered ones of their group; ties keep their original order. "descending" reverses the whole list.
// (Before 16 Nov 2026 this only re-sorted within a page fetched by publish date, so pages mixed numbers and
// "TEST - 1", "LIVE TEST - 1" and "EXERCISE - 1" were interleaved.)
export function examTitleSortKey(title:string){
  const match=title.match(/\d+/);
  const prefix=(match?title.slice(0,match.index):title).toUpperCase().replace(/[^A-Zऀ-ॿ]+/g," ").trim();
  return{prefix,number:match?Number(match[0]):Number.POSITIVE_INFINITY};
}
export function sortExamCategoryNavigatorItems<T extends {title:string}>(items:T[],direction:"ascending"|"descending"):T[]{
  const sign=direction==="ascending"?1:-1;
  return items
    .map((item,index)=>({item,index,key:examTitleSortKey(item.title)}))
    .sort((a,b)=>{
      const byPrefix=a.key.prefix.localeCompare(b.key.prefix);
      if(byPrefix)return byPrefix*sign;
      if(a.key.number!==b.key.number)return (a.key.number<b.key.number?-1:1)*sign;
      return a.index-b.index;
    })
    .map(({item})=>item);
}
