export type RecoveryAdminLevel = "ordinary" | "institution_owner" | "platform_owner" | null;

export function recoveryRequestIsUsable(expiresAt: Date, usedAt: Date | null, now = new Date()) {
  return usedAt === null && expiresAt.getTime() > now.getTime();
}

export function canReviewAdministratorRecovery(role: "student" | "admin", level: RecoveryAdminLevel) {
  return role === "admin" && (level === "institution_owner" || level === "platform_owner");
}

export function genericRecoveryResponse() {
  return "If the details match an eligible account, recovery instructions or a support response will be sent.";
}
