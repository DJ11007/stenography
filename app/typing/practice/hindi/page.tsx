import { HindiCatalogue, hindiInputSystemIds, practiceMetadata } from "../_components/category-catalogue";
import { PracticeNavigator } from "../_components/practice-navigator";
export const metadata=practiceMetadata("Hindi Typing","Compatible published practice tests for Hindi.");
export default async function HindiTypingPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
  const params=await searchParams;
  if(params.input)return <PracticeNavigator language="Hindi" params={params} requireInput/>;
  // Kruti Dev 010 is the only Hindi practice keyboard today, so "choose
  // your keyboard" has nothing to actually choose -- skip straight to the
  // test list, same as English. The moment a second one (Mangal, Remington
  // GAIL...) is configured for practice, ids.length grows past 1 and the
  // picker below comes back on its own -- nothing to remember to re-enable.
  const ids=await hindiInputSystemIds("practice");
  if(ids.length===1)return <PracticeNavigator language="Hindi" params={{...params,input:ids[0]}} requireInput/>;
  return <HindiCatalogue title="Hindi Typing" description="Choose the exact keyboard and font required for your Hindi typing test." mode="practice"/>;
}
