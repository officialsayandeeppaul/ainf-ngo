import type { PoolConfig } from "pg";

/**
 * Neon connection options that do not trigger pg's sslmode deprecation warning.
 *
 * Putting `sslmode=require` in the URL makes `pg-connection-string` emit a
 * process warning. Next.js 16 surfaces process warnings as the red "Console
 * Error" overlay, which made a routine TLS setting look like an application
 * crash. We drop those query params and pass TLS explicitly instead.
 */
export function neonPoolConfig(
  connectionString: string,
  extra: Omit<PoolConfig, "connectionString" | "ssl"> = {}
): PoolConfig {
  const url = new URL(connectionString);
  url.searchParams.delete("sslmode");
  url.searchParams.delete("channel_binding");
  return {
    connectionString: url.toString(),
    ssl: { rejectUnauthorized: true },
    ...extra,
  };
}
