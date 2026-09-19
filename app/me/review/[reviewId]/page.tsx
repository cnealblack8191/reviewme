import { notFound } from "next/navigation";
import { requireForeman } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { averageRating } from "@/lib/reviews";
import { saveSupervisorAnswersAction, submitSupervisorAction } from "@/app/me/review/[reviewId]/actions";

export default async function SupervisorReviewPage({ params }: { params: Promise<{ reviewId: string }> }) {
  const user = await requireForeman();
  const { reviewId } = await params;

  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    include: {
      employee: true,
      period: true,
      template: { include: { criteria: { orderBy: { sortOrder: "asc" } } } },
      answers: { where: { side: "SUPERVISOR" } }
    }
  });
  if (!review || review.supervisorId !== user.id) notFound();

  const locked = review.supervisorStatus === "SUBMITTED";
  const byCriterion = new Map(review.answers.map((a) => [a.criterionId, a]));
  const avg = averageRating(review.template.criteria.map((c) => byCriterion.get(c.id)?.rating));

  return (
    <div className="phone">
      <header className="worker-header">
        <a href="/me" style={{ color: "var(--ink)", fontWeight: 600 }}>‹ Back</a>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", letterSpacing: "0.05em" }}>{review.template.titleEn.toUpperCase()}</span>
      </header>
      <main className="phone-main">
        <div>
          <h1 style={{ fontSize: 24 }}>{review.employee.firstName} {review.employee.lastName}</h1>
          <div style={{ color: "var(--muted)", fontSize: 14 }}>{review.employee.position} · {review.period.name}</div>
          {review.status === "SENT_BACK" ? <p className="error">Sent back by the office: {review.sentBackReason}</p> : null}
        </div>

        <form action={saveSupervisorAnswersAction} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <input type="hidden" name="reviewId" value={review.id} />
          <div className="card" style={{ fontSize: 12, color: "var(--muted)" }}>
            Section II · Evaluation. 1 Unsatisfactory · 2 Fair · 3 Good · 4 Excellent
          </div>
          {review.template.criteria.map((c) => {
            const answer = byCriterion.get(c.id);
            return (
              <fieldset className="card" key={c.id} disabled={locked} style={{ border: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 10 }}>
                <legend style={{ fontSize: 14, fontWeight: 600, padding: "0 4px" }}>{c.labelEn}</legend>
                <div className="scale">
                  {[1, 2, 3, 4].map((n) => (
                    <label key={n}>
                      <input type="radio" name={`rating:${c.id}`} value={n} defaultChecked={answer?.rating === n} />
                      <span>{n}</span>
                      {n}
                    </label>
                  ))}
                </div>
                <input className="digit-single" style={{ letterSpacing: 0, height: 40, fontSize: 14, fontWeight: 400, textAlign: "left", padding: "0 12px" }} name={`comment:${c.id}`} placeholder="Supervisor comment" defaultValue={answer?.comment ?? ""} />
              </fieldset>
            );
          })}

          <fieldset className="card" disabled={locked} style={{ border: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 12 }}>
            <legend style={{ fontSize: 14, fontWeight: 600, padding: "0 4px" }}>Overall evaluation rating{avg ? ` · average of your items is ${avg}` : ""}</legend>
            <div className="scale">
              {[1, 2, 3, 4].map((n) => (
                <label key={n}>
                  <input type="radio" name="overallRating" value={n} defaultChecked={review.overallRating === n} />
                  <span>{n}</span>
                  {n}
                </label>
              ))}
            </div>
            <label className="field"><span>Overall comments</span><textarea name="overallComments" defaultValue={review.overallComments ?? ""} /></label>
            <label className="field"><span>Recommended goals for next review</span><textarea name="goals" defaultValue={review.goals ?? ""} /></label>
          </fieldset>

          {locked ? (
            <div className="card" style={{ color: "var(--ok)", fontWeight: 600 }}>Submitted {review.supervisorSubmittedAt?.toLocaleDateString()}. The office has it.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button className="btn btn-outline btn-lg" type="submit">Save</button>
              <button className="btn btn-primary btn-lg" type="submit" formAction={submitSupervisorAction}>Submit to office</button>
              <small style={{ color: "var(--muted)", textAlign: "center" }}>Submitting locks your side. The office can send it back if something needs a change.</small>
            </div>
          )}
        </form>
      </main>
    </div>
  );
}
