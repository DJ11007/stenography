import { LegalLayout } from "../_components/legal-layout";

export const metadata = {
  title: "Refund Policy | Samradhi Classes",
  description: "Refund and cancellation policy for Samradhi Classes courses.",
};

export default function RefundPolicyPage() {
  return (
    <LegalLayout
      title="Refund & Cancellation Policy"
      updated="24 August 2026"
      intro="This policy covers refunds and cancellations for Samradhi Classes course plans (30 Days, 3 Months, 6 Months and 1 Year)."
    >
      <section>
        <h2>1. Cancellation window</h2>
        <p>
          You may request a full refund within 7 days of purchase, provided you have not attended a class or
          started a paid test or course module during that period.
        </p>
      </section>

      <section>
        <h2>2. After the cancellation window</h2>
        <p>
          Once the 7-day window has passed, or once you have attended a class or started paid course content,
          fees are non-refundable, except where required by law or at the discretion of Samradhi Classes for
          documented technical failures on our side that prevented you from accessing the course.
        </p>
      </section>

      <section>
        <h2>3. How to request a refund</h2>
        <p>
          Call us at{" "}
          <a href="tel:+917014371324" className="font-bold text-blue-700">
            7014371324
          </a>{" "}
          or visit our Sanganer, Jaipur centre with your payment details. We will confirm eligibility and the
          expected processing time when you contact us.
        </p>
      </section>

      <section>
        <h2>4. Course changes</h2>
        <p>
          If you wish to switch between course durations (for example, from 30 Days to 3 Months) instead of
          cancelling, contact us and we will adjust the difference in fees where possible.
        </p>
      </section>

      <section>
        <h2>5. Changes to this policy</h2>
        <p>
          We may update this policy from time to time. Material changes will update the &ldquo;last
          updated&rdquo; date above. This policy is a summary — always confirm current terms with us directly
          before purchasing.
        </p>
      </section>
    </LegalLayout>
  );
}
