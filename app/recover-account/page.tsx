import Link from "next/link";
import { AuthShell } from "../_components/auth-shell";
import RecoveryRequestForm from "./recovery-request-form";

export default async function RecoverAccountPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const admin = (await searchParams).type === "admin";
  return (
    <AuthShell
      title={admin ? "Administrator account recovery" : "Recover your student account"}
      subtitle="This creates a private support request. We never reveal an email address or mobile number from the information entered here."
      variant={admin ? "admin" : "brand"}
      footer={
        <Link href={admin ? "/admin/login" : "/login"} className="font-semibold text-blue-100 hover:text-white">
          Return to login
        </Link>
      }
    >
      <RecoveryRequestForm admin={admin} />
    </AuthShell>
  );
}
