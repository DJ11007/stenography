import type { Metadata } from "next";
import { ExcelTestCatalogue } from "../_components/excel-test-catalogue";
export const metadata:Metadata={title:"Hindi Excel Efficiency | Samradhi Classes",description:"Hindi spreadsheet data entry, formula, compatible-font, and formatting exercises."};
export default async function HindiExcelEfficiencyPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){const params=await searchParams;return <ExcelTestCatalogue language="Hindi" search={params.search??""} page={Math.max(1,Number(params.page)||1)}/>}
