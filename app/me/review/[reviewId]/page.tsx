import { notFound } from "next/navigation";
import { requireReviewer } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SupervisorReviewForm } from "@/components/supervisor-review-form";
import type { SupervisorDraft } from "@/lib/supervisor-draft";
import { pick, reviewerLabels, rt } from "@/lib/i18n";
import { userLanguage } from "@/lib/user-language";
import { bilingualMany } from "@/lib/translate";
import { Translated } from "@/components/translated";

export default async function SupervisorReviewPage({ params }: { params: Promise<{ reviewId: string }> }) {
  const user = await requireReviewer();
  const lang = await userLanguage(user.id);
  const L = (key: Parameters<typeof rt>[1]) => rt(lang, key);
  const { reviewId } = await params;

  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    include: {
      employee: true,
      period: true,
      template: { include: { criteria: { orderBy: { sortOrder: "asc" } }, questions: { orderBy: { sortOrder: "asc" } } } },
      answers: true,
      questionAnswers: true
    }
  });
  if (!review || review.supervisorId !== user.id) notFound();

  const supervisorAnswers = review.answers.filter((a) => a.side === "SUPERVISOR");
  const workerRatings = new Map(review.answers.filter((a) => a.side === "EMPLOYEE").map((a) => [a.criterionId, a.rating]));
  const workerSubmitted = review.employeeStatus === "SUBMITTED";
  const workerAnswers = workerSubmitted
    ? await bilingualMany(review.template.questions.map((q) => review.questionAnswers.find((a) => a.questionId === q.id)?.answer ?? ""), lang, review.language)
    : [];

  const locked = review.supervisorStatus === "SUBMITTED";
  const initial: SupervisorDraft = {
    answers: Object.fromEntries(supervisorAnswers.map((a) => [a.criterionId, { rating: a.rating, comment: a.comment ?? "" }])),
    overallRating: review.overallRating,
    overallComments: review.overallComments ?? "",
    goals: review.goals ?? ""
  };
  const serverUpdatedAt = Math.max(review.updatedAt.getTime(), ...supervisorAnswers.map((a) => a.updatedAt.getTime()));

  return (
    <div className="phone">
      <header className="worker-header">
        <a href="/me" style={{ color: "var(--ink)", fontWeight: 600 }}>‹ {L("back")}</a>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", letterSpacing: "0.05em" }}>{pick(lang, review.template).toUpperCase()}</span>
      </header>
      <main className="phone-main">
        <div>
          <h1 style={{ fontSize: 24 }}>{review.employee.firstName} {review.employee.lastName}</h1>
          <div style={{ color: "var(--muted)", fontSize: 14 }}>{review.employee.position} · {review.period.name}</div>
          {review.status === "SENT_BACK" ? <p className="error">{L("sentBackBy")}: {review.sentBackReason}</p> : null}
          {locked ? <p style={{ color: "var(--ok)", fontWeight: 600 }}>{L("submittedOn")} {review.supervisorSubmittedAt?.toLocaleDateString()}. {L("officeHasIt")}</p> : null}
        </div>

        <section className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="group-title" style={{ padding: 0 }}><span>{L("workerSelfEval")}</span>{workerSubmitted ? <span>{review.employeeSubmittedAt?.toLocaleDateString()}</span> : null}</div>
          {!workerSubmitted ? <small style={{ color: "var(--muted)" }}>{L("workerNotSubmitted")}</small> : null}
          {workerSubmitted ? review.template.questions.map((q, i) => (
            <div key={q.id} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>{i + 1}. {pick(lang, q)}</div>
              <Translated value={workerAnswers[i]} lang={lang} size={14} />
            </div>
          )) : null}
        </section>
        <SupervisorReviewForm
          reviewId={review.id}
          criteria={review.template.criteria.map((c) => ({ id: c.id, label: pick(lang, c), workerRating: workerSubmitted ? workerRatings.get(c.id) ?? null : null }))}
          initial={initial}
          serverUpdatedAt={serverUpdatedAt}
          locked={locked}
          labels={reviewerLabels(lang)}
        />
      </main>
    </div>
  );
}
