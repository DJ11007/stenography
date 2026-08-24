import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdfjs-dist"],
  async redirects() {
    return [
      { source: "/typing/practice/rssb-ldc-english", destination: "/typing/practice/english", permanent: true },
      { source: "/typing/practice/rssb-ldc-hindi", destination: "/typing/practice/hindi", permanent: true },
      { source: "/typing/exams/rssb-ldc-english", destination: "/typing/exams/english-typing", permanent: true },
      { source: "/typing/exams/rssb-ldc-hindi", destination: "/typing/exams/hindi-typing", permanent: true },
      { source: "/typing/typing-test/rssb-exam/rssb-ldc", destination: "/typing/practice/english", permanent: true },
      { source: "/typing/typing-test/rssb-exam/rssb-ldc/english-typing", destination: "/typing/practice/english", permanent: true },
      { source: "/typing/typing-test/rssb-exam/rssb-ldc/hindi-typing", destination: "/typing/practice/hindi", permanent: true },
      { source: "/typing/typing-test/rssb-exam/rssb-ldc/settings", destination: "/typing/practice", permanent: true },
      { source: "/typing/typing-test/exam/rssb-exam/rssb-ldc", destination: "/typing/exams", permanent: true },
    ];
  },
};

export default nextConfig;
