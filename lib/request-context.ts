import { headers } from "next/headers";

export type RequestContext = { ip: string; userAgent: string };

const IP_HEADERS = [
  "cf-connecting-ip",
  "x-real-ip",
  "x-vercel-forwarded-for",
  "x-forwarded-for",
] as const;

function firstAddress(value: string | null): string | null {
  if (!value) return null;
  // x-forwarded-for is a client, proxy1, proxy2 chain; the left-most entry is
  // the closest thing to the caller that the platform vouches for.
  const candidate = value.split(",")[0]?.trim();
  return candidate || null;
}

export function contextFromHeaders(h: Headers): RequestContext {
  let ip: string | null = null;
  for (const name of IP_HEADERS) {
    ip = firstAddress(h.get(name));
    if (ip) break;
  }
  return { ip: ip ?? "unknown", userAgent: h.get("user-agent") ?? "unknown" };
}

export function contextFromRequest(request: Request): RequestContext {
  return contextFromHeaders(request.headers);
}

/** Server-component / server-action variant. */
export async function requestContext(): Promise<RequestContext> {
  return contextFromHeaders(await headers());
}
