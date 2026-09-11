import { HindiCatalogue, hindiInputSystemIds, practiceMetadata } from "../_components/category-catalogue";
import { PracticeNavigator } from "../_components/practice-navigator";
export const metadata=practiceMetadata("Hindi Stenography","Choose a Hindi input system and view compatible stenography tests.");
export default async function HindiStenoPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
  const params=await searchParams;
  if(params.input)return <PracticeNavigator mode="stenography" language="Hindi" params={params} requireInput/>;
  // Same auto-skip as Hindi practice: only pointless when stenography is
  // also ever reduced to a single Hindi input system -- today it isn't
  // (Mangal/InScript/Remington GAIL/CBI/Kruti Dev all remain available
  // here), so this keeps showing the picker exactly as before.
  const ids=await hindiInputSystemIds("stenography");
  if(ids.length===1)return <PracticeNavigator mode="stenography" language="Hindi" params={{...params,input:ids[0]}} requireInput/>;
  return <HindiCatalogue title="Hindi Stenography" description="Choose the keyboard and font configured for your Hindi stenography test." mode="stenography"/>;
}
