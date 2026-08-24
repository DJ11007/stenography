import { HindiCatalogue, practiceMetadata } from "../_components/category-catalogue";
import { PracticeNavigator } from "../_components/practice-navigator";
export const metadata=practiceMetadata("Hindi Stenography","Choose a Hindi input system and view compatible stenography tests.");
export default async function HindiStenoPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){const params=await searchParams;return params.input?<PracticeNavigator mode="stenography" language="Hindi" params={params} requireInput/>:<HindiCatalogue title="Hindi Stenography" description="Choose the keyboard and font configured for your Hindi stenography test." mode="stenography"/>;}
