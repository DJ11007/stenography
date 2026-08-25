import Link from "next/link";
import LoginForm from "@/app/login/login-form";
import { AuthShell } from "../../_components/auth-shell";

export default function AdminLoginPage() {
  return (
    <AuthShell
      title="Administrator login"
      variant="admin"
      footer={
        <Link href="/login" className="font-semibold text-blue-100 hover:text-white">
          Student login
        </Link>
      }
    >
      <LoginForm admin />
    </AuthShell>
  );
}
