export function normalizeTotpQr(value: string) {
  const normalized = value.trimEnd();
  return normalized.startsWith("data:image/svg+xml") ? normalized : null;
}
