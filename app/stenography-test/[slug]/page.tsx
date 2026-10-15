import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExamSeoPage } from "@/app/_components/exam-seo-page";
import { BASE_OPEN_GRAPH } from "@/lib/seo";
import { ALL_EXAMS, STENOGRAPHY_EXAMS, getStenographyExam, levelOf, relatedExams, stenographyExamFaqs, stenographyExamPath, stenographyTranscriptionLabel } from "@/lib/seo-exams";

export const dynamicParams = false;
export const generateStaticParams = () => STENOGRAPHY_EXAMS.map((exam) => ({ slug: exam.slug }));

export async function generateMetadata({ params }: PageProps<"/stenography-test/[slug]">): Promise<Metadata> {
  const exam = getStenographyExam((await params).slug);
  if (!exam) return {};
  const title = `${exam.name} Skill Test – Dictation Speed, Pattern & Practice`;
  const description = `${exam.name} (${exam.fullName}) stenography skill test: ${exam.dictationSpeedEnglish} WPM English and ${exam.dictationSpeedHindi} WPM Hindi dictation for ${exam.durationMinutes} minutes, transcription ${stenographyTranscriptionLabel(exam).toLowerCase()}. Practise online on SC Typing.`;
  return { title, description, alternates: { canonical: stenographyExamPath(exam.slug) }, openGraph: { ...BASE_OPEN_GRAPH, title, description, url: stenographyExamPath(exam.slug) } };
}

export default async function StenographyExamPage({ params }: PageProps<"/stenography-test/[slug]">) {
  const exam = getStenographyExam((await params).slug);
  if (!exam) notFound();
  const summary = ALL_EXAMS.find((item) => item.kind === "stenography" && item.slug === exam.slug)!;
  return (
    <ExamSeoPage
      kindLabel="Stenography Skill Test"
      name={exam.name}
      fullName={exam.fullName}
      badge={exam.badge}
      level={levelOf(exam)}
      path={stenographyExamPath(exam.slug)}
      intro={`Everything about the ${exam.fullName} shorthand skill test: dictation speed in English and Hindi, dictation and transcription time, accuracy, and exam-pattern stenography practice online.`}
      pattern={[
        { label: "Exam", value: exam.fullName },
        { label: "English dictation speed", value: `${exam.dictationSpeedEnglish} words per minute` },
        { label: "Hindi dictation speed", value: `${exam.dictationSpeedHindi} words per minute` },
        { label: "Dictation time", value: `${exam.durationMinutes} minutes` },
        { label: "Transcription time", value: stenographyTranscriptionLabel(exam) },
        { label: "Accuracy", value: `${exam.accuracy}% minimum` },
        { label: "Level", value: `${levelOf(exam)} government exam` },
      ]}
      patternSourced={exam.patternSourced}
      notes={exam.patternNotes}
      faqs={stenographyExamFaqs(exam)}
      practiceHref={`/typing/practice/stenography/exams/${exam.slug}`}
      related={relatedExams(summary)}
    />
  );
}
