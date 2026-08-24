import type { Metadata } from "next";
import { WordTestCatalogue } from "../_components/word-test-catalogue";
export const metadata:Metadata={title:"Hindi Word Efficiency | Samradhi Classes",description:"Hindi document formatting, editing, compatible-font, and productivity exercises."};
export default async function HindiWordEfficiencyPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){const params=await searchParams;return <WordTestCatalogue language="Hindi" search={params.search??""} page={Math.max(1,Number(params.page)||1)}/>}
