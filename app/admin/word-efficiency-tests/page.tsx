import type { Metadata } from "next";
import { WordEfficiencyTestsPage } from "./tests-page";

export const metadata: Metadata = { title: "Word Efficiency Tests | Admin" };

export default function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  return <WordEfficiencyTestsPage view="manage" searchParams={searchParams} />;
}
