import { redirect } from "next/navigation";
import { WorkerHeader } from "@/components/worker-header";
import { loadWorkerLink } from "@/lib/worker-link";
import { pick, t } from "@/lib/i18n";
import { saveSelfAction, submitSelfAction } from "@/app/r/[token]/actions";

export default async function SelfEvaluationPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ lang?: string; saved?: string; incomplete?: string }> }) {
  const { token } = await params;
  const sp = await searchParams;
  const { state, link, lang, verified } = await loadWorkerLink(token, sp.lang);
  if (state !== "ok" || !link || !verified || link.kind !== "SELF_EVAL") redirect(`/r/${token}?lang=${lang}`);

  const review = link.review;
  const template = review.template;
  const mine = new Map(review.answers.filter((a) => a.side === "EMPLOYEE").map((a) => [a.criterionId, a.rating]));
  const answered = template.questions.filter((q) => review.questionAnswers.some((a) => a.questionId === q.id)).length + [...mine.values()].filter((r) => r != null).length;
  const total = template.questions.length + template.criteria.length;

  return (
    <div className="phone">
      <WorkerHeader token={token} lang={lang} path="/self" />
      <main className="phone-main" style={{ gap: 16 }}>
        <div>
          <div style={{ color: "var(--muted)", fontSize: 14 }}>{t(lang, "hi")} {review.employee.firstName},</div>
          <h1 style={{ fontSize: 24 }}>{t(lang, "selfEvalTitle")}</h1>
          <p style={{ color: "#4b5563", lineHeight: 1.5, fontSize: 14 }}>{pick(lang, template)}. {t(lang, "selfEvalIntro")}</p>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--warn)" }}>{t(lang, "privateLink")} · {t(lang, "expiresOn")} {link.expiresAt.toLocaleDateString()}</div>
        </div>

        <div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 600, color: "var(--muted)" }}><span>{answered} / {total}</span></div>
          <div className="progress" style={{ background: "#e6e8eb" }}><div style={{ width: `${total ? Math.round((answered / total) * 100) : 0}%`, background: "var(--accent)" }} /></div>
        </div>

        {sp.saved ? <div className="card" style={{ color: "var(--ok)", fontWeight: 600 }}>{t(lang, "save")} ✓</div> : null}
        {sp.incomplete ? <div className="card error">{lang === "ES" ? "Califique cada punto de la Sección II antes de enviar." : "Rate every item in Section II before submitting."}</div> : null}

        <form action={saveSelfAction} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="lang" value={lang} />

          <section className="card" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="group-title" style={{ padding: 0 }}><span>{t(lang, "sectionOne")}</span></div>
            {template.questions.map((q, i) => (
              <label className="field" key={q.id}>
                <span style={{ fontSize: 15, lineHeight: 1.35 }}>{i + 1}. {pick(lang, q)}</span>
                <textarea name={`q:${q.id}`} rows={2} defaultValue={review.questionAnswers.find((a) => a.questionId === q.id)?.answer ?? ""} />
              </label>
            ))}
          </section>

          <section className="card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <div className="group-title" style={{ padding: 0 }}><span>{t(lang, "sectionTwo")}</span></div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>{t(lang, "scaleKey")}</div>
            </div>
            {template.criteria.map((c) => (
              <fieldset key={c.id} style={{ border: 0, padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                <legend style={{ padding: 0, fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{pick(lang, c)}</legend>
                <div className="scale">
                  {[1, 2, 3, 4].map((n) => (
                    <label key={n}>
                      <input type="radio" name={`rating:${c.id}`} value={n} defaultChecked={mine.get(c.id) === n} />
                      <span>{n}</span>
                      {n}
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
          </section>

          <button className="btn btn-outline btn-lg" type="submit">{t(lang, "save")}</button>
          <button className="btn btn-primary btn-lg" type="submit" formAction={submitSelfAction}>{t(lang, "submitSelf")}</button>
          <small style={{ color: "var(--muted)", textAlign: "center", lineHeight: 1.45 }}>{t(lang, "submitWarning")}</small>
        </form>
      </main>
    </div>
  );
}
