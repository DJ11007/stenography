import { jsonLdHtml } from "@/lib/seo";

/** Structured data (schema.org JSON-LD) for search and AI answer engines. */
export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdHtml(data)} />;
}
