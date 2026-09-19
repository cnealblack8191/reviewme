import { notFound } from "next/navigation";
import { requireReviewer } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SupervisorReviewForm } from "@/components/supervisor-review-form";
import type { SupervisorDraft } from "@/lib/supervisor-draft";

export default async function SupervisorReviewPage({ params }: { params: Promise<{ reviewId: string }> }) {
  const user = await requireReviewer();
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
  const initial: SupervisorDraft = {
    answers: Object.fromEntries(review.answers.map((a) => [a.criterionId, { rating: a.rating, comment: a.comment ?? "" }])),
    overallRating: review.overallRating,
    overallComments: review.overallComments ?? "",
    goals: review.goals ?? ""
  };
  const serverUpdatedAt = Math.max(review.updatedAt.getTime(), ...review.answers.map((a) => a.updatedAt.getTime()));

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
          {locked ? <p style={{ color: "var(--ok)", fontWeight: 600 }}>Submitted {review.supervisorSubmittedAt?.toLocaleDateString()}. The office has it.</p> : null}
        </div>
        <SupervisorReviewForm
          reviewId={review.id}
          criteria={review.template.criteria.map((c) => ({ id: c.id, label: c.labelEn }))}
          initial={initial}
          serverUpdatedAt={serverUpdatedAt}
          locked={locked}
        />
      </main>
    </div>
  );
}
