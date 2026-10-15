import type { Metadata } from "next";
import { AuthShell } from "../_components/auth-shell";
import LoginForm from "./login-form";

export const metadata: Metadata = {
  title: "Student Login",
  description: "Log in to Samradhi Classes for your typing tests, efficiency tests, stenography practice and results.",
  alternates: { canonical: "/login" },
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { confirmed } = await searchParams;
  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to your Samradhi Classes account"
    >
      {confirmed && (
        <p className="mt-5 rounded-lg bg-green-50 p-3 text-sm text-green-700">
          Your email is confirmed. Please sign in.
        </p>
      )}
      <LoginForm />
    </AuthShell>
  );
}
