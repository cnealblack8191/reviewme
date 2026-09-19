import type { NextRequest } from "next/server";

/**
 * Absolute URL for a redirect. Next.js can rewrite request.url's host (for
 * example to localhost when started on 127.0.0.1), which would send the browser
 * to a host that never received the session cookie. Prefer APP_BASE_URL, then
 * the proxy's forwarded host, then the Host header.
 */
export function appUrl(pathname: string, request: NextRequest) {
  const configured = process.env.APP_BASE_URL?.trim();
  if (configured) return new URL(pathname, `${configured.replace(/\/$/, "")}/`);
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? request.nextUrl.host;
  const proto = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
  return new URL(pathname, `${proto}://${host}/`);
}
