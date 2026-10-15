import { BUSINESS, EXAMS_COVERED, FULL_ADDRESS, HOME_FAQS, SAME_AS, SERVICES, SITE_DESCRIPTION, SITE_NAME, absoluteUrl } from "@/lib/seo";

// llms.txt (https://llmstxt.org): a plain summary of the site for AI answer
// engines, built from the same facts as the pages and the JSON-LD.
export const dynamic = "force-static";

export function GET() {
  const body = `# ${SITE_NAME}

> ${SITE_DESCRIPTION}

${SITE_NAME} is a coaching institute in Sanganer, Jaipur (Rajasthan, India) that trains students for the typing, computer efficiency and stenography tests of government job exams. The website ${absoluteUrl("/")} also gives students online typing tests, efficiency tests, stenography dictation practice, live tests with published rankings, and government vacancy updates.

## Courses
${SERVICES.map((service) => `- ${service.name}: ${service.description}`).join("\n")}

## Exams covered
${EXAMS_COVERED.join(", ")}.

## Contact
- Address: ${FULL_ADDRESS}
- Phone / WhatsApp: ${BUSINESS.phoneDisplay}
- Map: ${BUSINESS.mapUrl}
${SAME_AS.map((url) => `- ${url}`).join("\n")}

## Key pages
- [Home](${absoluteUrl("/")}): overview, latest results, vacancies and courses
- [Buy a Course](${absoluteUrl("/courses")}): course plans and fees
- [Live Test](${absoluteUrl("/live-test")}): scheduled live typing, stenography and efficiency tests with results
- [Vacancies](${absoluteUrl("/vacancies")}): government job notices, admit cards and results
- [About](${absoluteUrl("/about")}) and [Contact](${absoluteUrl("/contact")})

## FAQ
${HOME_FAQS.map((faq) => `### ${faq.question}\n${faq.answer}`).join("\n\n")}
`;
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
