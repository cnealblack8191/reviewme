/** Shared loader for the worker link routes: resolves the token, applies the language, checks verification. */
import { cookies } from "next/headers";
import type { Language } from "@prisma/client";
import { isLinkCookieValid, linkCookieName, resolveLink, type LinkState } from "@/lib/links";

export async function loadWorkerLink(token: string, langParam?: string) {
  const { state, link } = await resolveLink(token);
  const lang: Language = langParam === "ES" ? "ES" : langParam === "EN" ? "EN" : link?.review.language ?? "EN";
  let verified = false;
  if (link) {
    const store = await cookies();
    verified = Boolean(link.verifiedAt) && isLinkCookieValid(link.id, store.get(linkCookieName(link.id))?.value);
  }
  return { state: state as LinkState, link, lang, verified };
}
