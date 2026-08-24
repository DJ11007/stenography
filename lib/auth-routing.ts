export type LoginKind = "student" | "admin";
export type AuthenticatedRole = "student" | "admin" | null;
export type AssuranceLevel = "aal1" | "aal2" | null;

export type SignInDecision =
  | { type: "deny-admin" }
  | { type: "redirect"; destination: "/typing" | "/admin" | "/account/security?next=/admin" };

export function decideSignInDestination(
  loginKind: LoginKind,
  role: AuthenticatedRole,
  assurance: AssuranceLevel,
): SignInDecision {
  if (loginKind === "admin") {
    if (role !== "admin") return { type: "deny-admin" };
    return {
      type: "redirect",
      destination: assurance === "aal2" ? "/admin" : "/account/security?next=/admin",
    };
  }
  return { type: "redirect", destination: role === "admin" ? "/admin" : "/typing" };
}

export function safeAuthenticatedNext(value: string | undefined) {
  return value === "/admin" ? "/admin" : undefined;
}
