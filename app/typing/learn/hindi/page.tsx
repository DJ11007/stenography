import { getPublishedLearningTests } from "@/lib/learning-tests-server";
import { LearningCatalog } from "../learning-catalog";

export default async function HindiLearningPage() {
  return <LearningCatalog lessons={await getPublishedLearningTests("Hindi")}/>;
}

