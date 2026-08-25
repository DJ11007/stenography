import { LegalLayout } from "../_components/legal-layout";

export const metadata = {
  title: "Privacy Policy | Samradhi Classes",
  description: "How Samradhi Classes collects, uses and protects your personal information.",
};

export default function PrivacyPolicyPage() {
  return (
    <LegalLayout
      title="Privacy Policy"
      updated="24 August 2026"
      intro="This policy explains what information Samradhi Classes collects through this website, why, and how it is kept safe."
    >
      <section>
        <h2>1. Information we collect</h2>
        <ul>
          <li><strong>Account details:</strong> full name, email address, and password (stored securely by our authentication provider, never in plain text).</li>
          <li><strong>Optional recovery details:</strong> a phone number, only if you choose to add one for account recovery.</li>
          <li><strong>Test activity:</strong> your typing, efficiency and stenography test attempts, timings, submitted documents, and scores.</li>
          <li><strong>Support communication:</strong> anything you tell us when you call or message us for support.</li>
        </ul>
        <p>We do not knowingly collect payment card details through this website.</p>
      </section>

      <section>
        <h2>2. How we use your information</h2>
        <ul>
          <li>To create and secure your student account and let you sign in.</li>
          <li>To run typing, efficiency and stenography tests and show you your own results and progress.</li>
          <li>To operate account-recovery requests you initiate.</li>
          <li>To respond to support requests made by phone or in person.</li>
        </ul>
        <p>We do not sell your personal information, and we do not use it for third-party advertising.</p>
      </section>

      <section>
        <h2>3. Where your data is stored</h2>
        <p>
          Account and test data is stored with Supabase, our database and authentication provider, using
          row-level security so students can only access their own data. Access to administrative functions
          (grading, test management, account recovery review) is restricted to authorized staff accounts.
        </p>
      </section>

      <section>
        <h2>4. Cookies</h2>
        <p>
          The website uses only the essential cookies needed to keep you signed in and to remember your session.
          We do not use third-party advertising or tracking cookies.
        </p>
      </section>

      <section>
        <h2>5. Sharing your information</h2>
        <p>
          We do not share your personal information with third parties except: (a) our infrastructure providers
          (such as Supabase) who process it on our behalf to run the website, or (b) where required by law.
        </p>
      </section>

      <section>
        <h2>6. Your choices</h2>
        <ul>
          <li>You can review and update your account details from your profile.</li>
          <li>You can request account recovery through the &ldquo;forgot password&rdquo; flow.</li>
          <li>To request access to, correction of, or deletion of your personal data, contact us using the details below.</li>
        </ul>
      </section>

      <section>
        <h2>7. Children&apos;s privacy</h2>
        <p>
          Some students preparing for government exams may be minors. Where a student is under 18, we expect a
          parent or guardian to be involved in account creation and course enrollment.
        </p>
      </section>

      <section>
        <h2>8. Changes to this policy</h2>
        <p>
          We may update this policy from time to time. Material changes will update the &ldquo;last updated&rdquo;
          date above.
        </p>
      </section>

      <section>
        <h2>9. Contact us</h2>
        <p>
          For privacy questions or data requests, call us at{" "}
          <a href="tel:+917014371324" className="font-bold text-blue-700">
            7014371324
          </a>{" "}
          or visit our Sanganer, Jaipur centre.
        </p>
      </section>
    </LegalLayout>
  );
}
