import { LegalLayout } from "../_components/legal-layout";

export const metadata = {
  title: "Terms & Conditions | Samradhi Classes",
  description: "Terms and conditions for using the Samradhi Classes website and coaching services.",
};

export default function TermsPage() {
  return (
    <LegalLayout
      title="Terms & Conditions"
      updated="24 August 2026"
      intro="These terms govern your use of the Samradhi Classes website and coaching services. By creating an account, taking a test, or enrolling in a course, you agree to them."
    >
      <section>
        <h2>1. About Samradhi Classes</h2>
        <p>
          Samradhi Classes is a coaching institute based in Sanganer, Jaipur, offering typing, computer
          efficiency and stenography training for government-exam preparation, both in person and through this
          website.
        </p>
      </section>

      <section>
        <h2>2. Accounts</h2>
        <ul>
          <li>You must provide accurate information (name, email address) when creating a student account.</li>
          <li>You are responsible for keeping your password confidential and for all activity under your account.</li>
          <li>Accounts are for individual use; sharing login credentials to bypass course access is not permitted.</li>
        </ul>
      </section>

      <section>
        <h2>3. Courses, tests and fees</h2>
        <ul>
          <li>Course durations and prices shown on the website (e.g. 30 Days, 3 Months, 6 Months, 1 Year) are as currently published and may change without prior notice.</li>
          <li>Enrollment and payment are currently coordinated by phone or in person at our Sanganer centre; a plan is confirmed once payment is received.</li>
          <li>Free typing tests and practice tools are provided for evaluation and practice and do not themselves constitute enrollment in a paid course.</li>
          <li>Live tests, results and leaderboards published on the site are provided for informational purposes for enrolled students.</li>
        </ul>
      </section>

      <section>
        <h2>4. Acceptable use</h2>
        <ul>
          <li>Do not attempt to cheat on, manipulate, or unfairly automate any typing, efficiency, or stenography test.</li>
          <li>Do not copy, redistribute, or publish test content, question papers, or working matter outside the platform.</li>
          <li>Do not attempt to access another student&apos;s account, results, or documents.</li>
          <li>Do not use the platform to upload unlawful, harmful, or infringing content.</li>
        </ul>
      </section>

      <section>
        <h2>5. Intellectual property</h2>
        <p>
          Course material, question papers, working matter, and the Samradhi Classes name and logo are the
          property of Samradhi Classes and may not be reproduced or redistributed without permission.
        </p>
      </section>

      <section>
        <h2>6. Vacancy and exam information</h2>
        <p>
          Government job, admit card and result listings shown on the website are provided for convenience.
          Sample or placeholder entries are clearly marked as such. Always verify official notifications,
          eligibility, and deadlines directly with the concerned government authority before acting on them.
        </p>
      </section>

      <section>
        <h2>7. Limitation of liability</h2>
        <p>
          The website and practice tools are provided on an &ldquo;as is&rdquo; basis. Samradhi Classes is not
          liable for exam outcomes, technical interruptions, or indirect losses arising from use of the site, to
          the extent permitted by applicable law.
        </p>
      </section>

      <section>
        <h2>8. Changes to these terms</h2>
        <p>
          We may update these terms from time to time. Continued use of the website after an update means you
          accept the revised terms. Material changes will update the &ldquo;last updated&rdquo; date above.
        </p>
      </section>

      <section>
        <h2>9. Governing law</h2>
        <p>These terms are governed by the laws of India, with courts in Jaipur, Rajasthan having jurisdiction.</p>
      </section>

      <section>
        <h2>10. Contact</h2>
        <p>
          Questions about these terms can be directed to Samradhi Classes at{" "}
          <a href="tel:+917014371324" className="font-bold text-blue-700">
            7014371324
          </a>{" "}
          or in person at our Sanganer, Jaipur centre.
        </p>
      </section>
    </LegalLayout>
  );
}
