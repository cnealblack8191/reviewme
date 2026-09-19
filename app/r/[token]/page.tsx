import { redirect } from "next/navigation";
import { WorkerHeader } from "@/components/worker-header";
import { loadWorkerLink } from "@/lib/worker-link";
import { getSettings } from "@/lib/settings";
import { t } from "@/lib/i18n";
import { verifyIdentityAction } from "@/app/r/[token]/actions";

export default async function WorkerEntry({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ lang?: string; error?: string }> }) {
  const { token } = await params;
  const { lang: langParam, error } = await searchParams;
  const { state, link, lang, verified } = await loadWorkerLink(token, langParam);
  const settings = await getSettings();

  if (state === "ok" && link && verified) {
    redirect(`/r/${token}/${link.kind === "SIGN" ? "sign" : "self"}?lang=${lang}`);
  }

  const problem =
    state === "not_found" ? t(lang, "linkNotFound")
    : state === "expired" ? t(lang, "linkExpired")
    : state === "used" || state === "voided" ? t(lang, "linkUsed")
    : state === "locked" ? t(lang, "linkLocked")
    : null;

  return (
    <div className="phone">
      <WorkerHeader token={token} lang={lang} path="" />
      <main className="phone-main" style={{ gap: 22, paddingTop: 36 }}>
        {problem ? (
          <div className="card" style={{ lineHeight: 1.5 }}>{problem}</div>
        ) : (
          <>
            <div>
              <h1 style={{ fontSize: 26 }}>{t(lang, "confirmTitle")}</h1>
              <p style={{ color: "#4b5563", lineHeight: 1.5 }}>
                {settings.identityCheck === "SSN_LAST4" ? t(lang, "confirmBodySsn") : t(lang, "confirmBodyPhone")}
                {" "}<strong>{link!.review.employee.firstName} {link!.review.employee.lastName[0]}.</strong>
              </p>
            </div>
            <form action={verifyIdentityAction} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <input type="hidden" name="token" value={token} />
              <input type="hidden" name="lang" value={lang} />
              <label className="field">
                <span>{settings.identityCheck === "SSN_LAST4" ? t(lang, "last4Ssn") : t(lang, "last4Phone")}</span>
                <input className="digit-single" name="digits" inputMode="numeric" autoComplete="one-time-code" maxLength={4} pattern="[0-9]{4}" required autoFocus />
              </label>
              {error ? <p className="error">{t(lang, "wrongDigits")}</p> : null}
              <button className="btn btn-primary btn-lg" type="submit">{t(lang, "openReview")}</button>
            </form>
            <div className="card" style={{ fontSize: 13, color: "#4b5563", lineHeight: 1.45 }}>
              {t(lang, "expiresOn")} {link!.expiresAt.toLocaleDateString()}. {t(lang, "worksOnce")}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
