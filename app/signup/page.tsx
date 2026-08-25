import { AuthShell } from "../_components/auth-shell";
import SignupForm from "./signup-form";

export default function SignupPage() {
  return (
    <AuthShell title="Create your account" subtitle="Join Samradhi Classes to start practicing">
      <SignupForm />
    </AuthShell>
  );
}
