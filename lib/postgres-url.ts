/**
 * pg 8 treats `sslmode=require` as `verify-full` and emits a process warning
 * that Next.js surfaces as a blocking overlay. Ask for verify-full explicitly.
 */
export function postgresUrl(raw: string): string {
  if (!raw) return raw;
  try {
    const url = new URL(raw);
    const mode = url.searchParams.get("sslmode");
    if (!mode || mode === "require" || mode === "prefer" || mode === "verify-ca") {
      url.searchParams.set("sslmode", "verify-full");
    }
    return url.href;
  } catch {
    return raw;
  }
}
