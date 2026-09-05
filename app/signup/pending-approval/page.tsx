import Link from "next/link";
import { AuthShell } from "../../_components/auth-shell";

export default function SignupPendingApprovalPage() {
  return (
    <AuthShell title="Account created" subtitle="One more step before you can sign in">
      <div className="mt-8 space-y-5 text-center">
        <p className="rounded-lg bg-green-50 p-4 text-sm text-green-800">
          Your account has been created. Please wait for admin approval — you&apos;ll be able to sign in once your account is activated.
        </p>
        <p className="text-sm text-slate-600">
          Already approved? <Link href="/login" className="font-semibold text-blue-700">Sign in</Link>
        </p>
      </div>
    </AuthShell>
  );
}
