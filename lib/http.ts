/**
 * Marks every response from a handler as uncacheable unless it already says
 * otherwise. For per-user and privileged GETs: a CDN keys its cache on the URL
 * alone, so a stored copy would be served without the role check ever running.
 */
export function noStore<A extends unknown[]>(handler: (...args: A) => Promise<Response> | Response) {
  return async (...args: A): Promise<Response> => {
    const response = await handler(...args);
    if (!response.headers.has("cache-control")) {
      try {
        response.headers.set("cache-control", "private, no-store");
      } catch {
        // Redirects carry immutable headers and are never cached as content.
      }
    }
    return response;
  };
}
