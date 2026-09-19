import { redirect } from "next/navigation";
import { WorkerHeader } from "@/components/worker-header";
import { SignaturePad } from "@/components/signature-pad";
import { loadWorkerLink } from "@/lib/worker-link";
import { pick, scaleLabel, t } from "@/lib/i18n";
import { declineAction, signAction } from "@/app/r/[token]/actions";

export default async function SignPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ lang?: string; error?: string }> }) {
  const { token } = await params;
  const sp = await searchParams;
  const { state, link, lang, verified } = await loadWorkerLink(token, sp.lang);
  if (state !== "ok" || !link || !verified || link.kind !== "SIGN") redirect(`/r/${token}?lang=${lang}`);

  const review = link.review;
  const answer = (criterionId: string, side: "EMPLOYEE" | "SUPERVISOR") => review.answers.find((a) => a.criterionId === criterionId && a.side === side)?.rating;

  return (
    <div className="phone">
      <WorkerHeader token={token} lang={lang} path="/sign" />
      <main className="phone-main" style={{ gap: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span className="chip chip-ok" style={{ alignSelf: "flex-start" }}>{lang === "ES" ? "Aprobada por la oficina de ECI" : "Approved by ECI office"} · {review.approvedAt?.toLocaleDateString()}</span>
          <h1 style={{ fontSize: 24 }}>{review.employee.firstName}, {t(lang, "signTitle").toLowerCase()}</h1>
          <p style={{ color: "#4b5563", lineHeight: 1.5, fontSize: 14 }}>{t(lang, "signIntro")}</p>
        </div>

        <section className="table-card">
          <div className="compare head"><span>{pick(lang, review.template)}</span><span className="num">{t(lang, "you")}</span><span className="num">{t(lang, "supervisor")}</span></div>
          {review.template.criteria.map((c) => {
            const mine = answer(c.id, "EMPLOYEE");
            const theirs = answer(c.id, "SUPERVISOR");
            return (
              <div className="compare" key={c.id}>
                <span>{pick(lang, c)}</span>
                <span className="num">{mine ?? "—"}</span>
                <span className="num" style={{ color: theirs != null && mine != null && theirs < mine ? "var(--danger)" : undefined }}>{theirs ?? "—"}</span>
              </div>
            );
          })}
          <div className="compare" style={{ background: "var(--bg)", gridTemplateColumns: "1fr 112px" }}>
            <span style={{ fontWeight: 600 }}>{t(lang, "overallRating")}</span>
            <span className="num" style={{ fontWeight: 700 }}>{review.overallRating ?? "—"}{review.overallRating ? ` · ${scaleLabel(lang, review.overallRating)}` : ""}</span>
          </div>
          <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
            <div><div className="group-title" style={{ padding: 0 }}><span>{t(lang, "supervisorComments")}</span></div><div style={{ fontSize: 14, lineHeight: 1.5 }}>{review.overallComments ?? "—"}</div></div>
            <div><div className="group-title" style={{ padding: 0 }}><span>{t(lang, "goals")}</span></div><div style={{ fontSize: 14, lineHeight: 1.5 }}>{review.goals ?? "—"}</div></div>
            {review.discussedAt ? <div style={{ fontSize: 13, color: "var(--ok)", fontWeight: 600 }}>✓ {lang === "ES" ? "Conversado con" : "Discussed with"} {review.supervisor.name} · {review.discussedAt.toLocaleDateString()}</div> : null}
          </div>
        </section>

        <form action={signAction} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="lang" value={lang} />
          <label className="field"><span>{t(lang, "yourComments")}</span><textarea name="employeeComments" rows={3} /></label>
          <label className="field"><span>{t(lang, "typeName")}</span><input name="typedName" required defaultValue={`${review.employee.firstName} ${review.employee.lastName}`} /></label>
          <SignaturePad label={t(lang, "signHere")} inputName="signatureData" />
          {sp.error === "signature" ? <p className="error">{lang === "ES" ? "Escriba su nombre y firme antes de terminar." : "Type your name and sign before finishing."}</p> : null}
          {sp.error === "decline" ? <p className="error">{t(lang, "declineNeedsComment")}</p> : null}
          <button className="btn btn-primary btn-lg" type="submit">{t(lang, "signFinish")}</button>
          <button className="btn btn-ghost" style={{ height: 44 }} type="submit" formAction={declineAction} formNoValidate>{t(lang, "decline")}</button>
        </form>
      </main>
    </div>
  );
}
