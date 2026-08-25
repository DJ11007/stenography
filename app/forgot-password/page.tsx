import Link from "next/link";
import { phoneRecoveryEnabled } from "@/lib/account-recovery";
import { AuthShell } from "../_components/auth-shell";
import { RecoveryForms } from "./recovery-forms";

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Reset your password"
      subtitle="Use a verified recovery method. For privacy, the response is the same whether or not an account matches."
      footer={
        <Link href="/login" className="font-semibold text-blue-100 hover:text-white">
          Return to student login
        </Link>
      }
    >
      <div className="mt-6">
        <RecoveryForms phoneEnabled={phoneRecoveryEnabled()} />
      </div>
    </AuthShell>
  );
}
