import "server-only";
import { createPrivateKey, createPublicKey, sign } from "node:crypto";

// Activation keys for the SCTyping desktop app, made from the admin page /admin/app-activation -- the same format
// the app checks (stenography-offline/src/lib/activation.ts) and scripts/sign-key.mjs prints:
//   base64url(JSON {machineId, issuedAt, note}) + "." + base64url(Ed25519 signature of that first part).
// The signing key is SCTYPING_ACTIVATION_PRIVATE_KEY in the server environment (base64 PKCS#8, the contents of
// stenography-offline/scripts/.private-key.txt). It never leaves the server; the app only holds the public key.

const APP_PUBLIC_KEY = "MCowBQYDK2VwAyEA30vNF7CoUZCbKT1Sedpr+pNqwnr1ozC+GT1HTMjPAGY=";

function privateKey() {
  const raw = process.env.SCTYPING_ACTIVATION_PRIVATE_KEY?.trim();
  if (!raw) return null;
  try {
    return createPrivateKey({ key: Buffer.from(raw, "base64"), format: "der", type: "pkcs8" });
  } catch {
    return null;
  }
}

export type SigningStatus = "ready" | "missing" | "wrong-key";

// "wrong-key": a key is set but it is not the pair of the public key built into the app, so its keys would be rejected.
export function activationSigningStatus(): SigningStatus {
  const key = privateKey();
  if (!key) return process.env.SCTYPING_ACTIVATION_PRIVATE_KEY ? "wrong-key" : "missing";
  const publicDer = createPublicKey(key).export({ format: "der", type: "spki" }).toString("base64");
  return publicDer === APP_PUBLIC_KEY ? "ready" : "wrong-key";
}

export function issueActivationKey(deviceId: string, note: string): string {
  const key = privateKey();
  if (!key || activationSigningStatus() !== "ready") throw new Error("Activation signing key is not set up on this server.");
  const payload = { machineId: deviceId, issuedAt: new Date().toISOString(), note };
  const payloadPart = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = sign(null, Buffer.from(payloadPart, "utf8"), key).toString("base64url");
  return `${payloadPart}.${signature}`;
}
