import { notFound } from "next/navigation";
import { requireOffice } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { describeStatus } from "@/lib/reviews";
import { OfficeShell } from "@/components/office-shell";
import { addOfficeNoteAction, approveAction, closeReviewAction, createManualLinkAction, revealLinkAction, revealedUrl, sendBackAction, sendSelfLinkAction, sendSignLinkAction, savePayBlockAction } from "@/app/office/reviews/[reviewId]/actions";

export default async function OfficeReviewPage({ params, searchParams }: { params: Promise<{ reviewId: string }>; searchParams: Promise<{ reveal?: string }> }) {
  const user = await requireOffice();
  const { reviewId } = await params;
  const { reveal } = await searchParams;
  const revealed = await revealedUrl(reviewId, reveal);

  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    include: {
      employee: true,
      supervisor: { select: { name: true } },
      period: true,
      template: { include: { criteria: { orderBy: { sortOrder: "asc" } }, questions: { orderBy: { sortOrder: "asc" } } } },
      answers: true,
      questionAnswers: true,
      notes: { include: { author: { select: { name: true } } }, orderBy: { createdAt: "desc" } },
      payBlock: true,
      links: { orderBy: { createdAt: "desc" } },
      events: { include: { actor: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 30 }
    }
  });
  if (!review) notFound();

  const answer = (criterionId: string, side: "EMPLOYEE" | "SUPERVISOR") => review.answers.find((a) => a.criterionId === criterionId && a.side === side);
  const pay = review.payBlock;

  return (
    <OfficeShell user={user} active="/office">
      <div className="page-head">
        <div>
          <div className="eyebrow"><a href="/office">Reviews</a> · {review.period.name} · {review.template.titleEn} form</div>
          <h1>{review.employee.firstName} {review.employee.lastName}</h1>
          <div style={{ color: "var(--muted)", fontSize: 14 }}>{review.employee.position} · Reviewer {review.supervisor.name} · <span className="chip chip-muted">{describeStatus(review)}</span></div>
        </div>
        <div className="actions">
          <a className="btn btn-outline" href={`/office/reviews/${review.id}/pdf`} target="_blank" rel="noopener">Office PDF</a>
          <a className="btn btn-outline" href={`/office/reviews/${review.id}/pdf?copy=employee`} target="_blank" rel="noopener">Employee copy</a>
          {review.status === "PENDING_OFFICE" ? (
            <form action={approveAction}><input type="hidden" name="reviewId" value={review.id} /><button className="btn btn-primary" type="submit">Approve</button></form>
          ) : null}
          {review.status === "SIGNED" || review.status === "DECLINED" ? (
            <form action={closeReviewAction}><input type="hidden" name="reviewId" value={review.id} /><button className="btn btn-primary" type="submit">Close and file</button></form>
          ) : null}
          {review.status === "CLOSED" ? <span className="chip chip-ok" style={{ height: 42 }}>Filed {review.closedAt?.toLocaleDateString()}</span> : null}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 360px", gap: 20, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <section className="table-card">
            <table>
              <thead><tr><th>Section I · Self evaluation</th><th>Employee answer</th></tr></thead>
              <tbody>
                {review.template.questions.map((q) => (
                  <tr key={q.id}><td style={{ width: "45%" }}>{q.textEn}</td><td>{review.questionAnswers.find((a) => a.questionId === q.id)?.answer ?? <span style={{ color: "var(--muted)" }}>—</span>}</td></tr>
                ))}
              </tbody>
            </table>
          </section>
          <section className="table-card">
            <table>
              <thead><tr><th>Section II · Quality</th><th style={{ textAlign: "center" }}>Self</th><th style={{ textAlign: "center" }}>Sup.</th><th>Supervisor comments</th></tr></thead>
              <tbody>
                {review.template.criteria.map((c) => (
                  <tr key={c.id}>
                    <td>{c.labelEn}</td>
                    <td style={{ textAlign: "center", fontWeight: 600 }}>{answer(c.id, "EMPLOYEE")?.rating ?? "—"}</td>
                    <td style={{ textAlign: "center", fontWeight: 600 }}>{answer(c.id, "SUPERVISOR")?.rating ?? "—"}</td>
                    <td style={{ color: "#4b5563" }}>{answer(c.id, "SUPERVISOR")?.comment ?? ""}</td>
                  </tr>
                ))}
                <tr><td style={{ fontWeight: 600 }}>Overall rating</td><td></td><td style={{ textAlign: "center", fontWeight: 700 }}>{review.overallRating ?? "—"}</td><td style={{ color: "#4b5563" }}>{review.overallComments ?? ""}</td></tr>
                <tr><td style={{ fontWeight: 600 }}>Goals for next review</td><td colSpan={3} style={{ color: "#4b5563" }}>{review.goals ?? ""}</td></tr>
                <tr><td style={{ fontWeight: 600 }}>Employee comments</td><td colSpan={3} style={{ color: "#4b5563" }}>{review.employeeComments ?? ""}</td></tr>
              </tbody>
            </table>
          </section>

          {review.status === "PENDING_OFFICE" ? (
            <form action={sendBackAction} className="card" style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
              <input type="hidden" name="reviewId" value={review.id} />
              <label className="field" style={{ flex: 1 }}><span>Send back to {review.supervisor.name} with a reason</span><input name="reason" required placeholder="What needs to change" /></label>
              <button className="btn btn-outline" type="submit">Send back</button>
            </form>
          ) : null}

          <section className="table-card">
            <table>
              <thead><tr><th>When</th><th>Who</th><th>What</th></tr></thead>
              <tbody>
                {review.events.map((e) => (
                  <tr key={e.id}>
                    <td style={{ whiteSpace: "nowrap", color: "var(--muted)", fontSize: 13 }}>{e.createdAt.toLocaleString()}</td>
                    <td>{e.actor?.name ?? e.actorLabel}</td>
                    <td>{e.action}{e.field ? ` · ${e.field}` : ""}{e.oldValue || e.newValue ? ` · ${e.oldValue ?? ""} → ${e.newValue ?? ""}` : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>

        <aside style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <section className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div className="group-title" style={{ padding: 0 }}><span>Worker links</span></div>
            {!review.employee.phone && !review.employee.email ? <div style={{ fontSize: 13, color: "var(--warn)", fontWeight: 600 }}>No phone or email on file. Create a link and send it by hand.</div> : null}
            {revealed ? (
              <div style={{ background: "var(--ok-soft)", border: "1px solid var(--ok)", borderRadius: 10, padding: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ok)" }}>{revealed.kind === "SIGN" ? "Sign link" : "Self-evaluation link"} · expires {revealed.expiresAt.toLocaleDateString()}</div>
                <input readOnly value={revealed.url} onFocus={undefined} style={{ width: "100%", fontSize: 12, fontFamily: "monospace", border: "1px solid var(--line)", borderRadius: 8, padding: "6px 8px", background: "#fff" }} />
                <small style={{ color: "var(--muted)" }}>Copy and text it from your phone or hand it to the worker. It works once and the worker still confirms their last 4.</small>
              </div>
            ) : null}
            {review.links.length === 0 ? <small style={{ color: "var(--muted)" }}>No links yet.</small> : null}
            {review.links.slice(0, 6).map((l) => {
              const active = !l.usedAt && !l.voidedAt && !l.lockedAt && l.expiresAt >= new Date();
              const state = l.usedAt ? "used" : l.lockedAt ? "locked" : l.voidedAt ? "voided" : l.expiresAt < new Date() ? "expired" : l.verifiedAt ? "verified" : l.openedAt ? "opened" : "sent";
              return (
                <div key={l.id} style={{ fontSize: 13, display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                  <span>{l.kind === "SELF_EVAL" ? "Self-eval" : "Sign"} · {l.channel.toLowerCase()} · {l.createdAt.toLocaleDateString()}</span>
                  <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ color: active ? "var(--muted)" : l.usedAt ? "var(--ok)" : "var(--danger)" }}>{state}</span>
                    {active && l.tokenCiphertext ? (
                      <form action={revealLinkAction}><input type="hidden" name="reviewId" value={review.id} /><input type="hidden" name="linkId" value={l.id} /><button className="btn btn-ghost" type="submit" style={{ height: 26, padding: "0 6px", fontSize: 12 }}>Show</button></form>
                    ) : null}
                  </span>
                </div>
              );
            })}
            <div style={{ display: "flex", flexDirection: "column", gap: 6, borderTop: "1px solid #eef0f2", paddingTop: 10 }}>
              {review.employeeStatus !== "SUBMITTED" ? (
                <div style={{ display: "flex", gap: 6 }}>
                  <form action={sendSelfLinkAction} style={{ flex: 1 }}><input type="hidden" name="reviewId" value={review.id} /><button className="btn btn-outline" type="submit" style={{ height: 34, width: "100%" }} disabled={!review.employee.phone && !review.employee.email}>Send self-eval link</button></form>
                  <form action={createManualLinkAction}><input type="hidden" name="reviewId" value={review.id} /><input type="hidden" name="kind" value="SELF_EVAL" /><button className="btn btn-outline" type="submit" style={{ height: 34 }}>Create to send by hand</button></form>
                </div>
              ) : null}
              {["APPROVED", "DISCUSSED", "SIGN_LINK_SENT"].includes(review.status) ? (
                <div style={{ display: "flex", gap: 6 }}>
                  <form action={sendSignLinkAction} style={{ flex: 1 }}><input type="hidden" name="reviewId" value={review.id} /><button className="btn btn-primary" type="submit" style={{ height: 34, width: "100%" }} disabled={!review.employee.phone && !review.employee.email}>{review.status === "SIGN_LINK_SENT" ? "Resend sign link" : "Send sign link"}</button></form>
                  <form action={createManualLinkAction}><input type="hidden" name="reviewId" value={review.id} /><input type="hidden" name="kind" value="SIGN" /><button className="btn btn-outline" type="submit" style={{ height: 34 }}>Create to send by hand</button></form>
                </div>
              ) : null}
              {review.status === "APPROVED" ? <small style={{ color: "var(--muted)" }}>Normally the sign link goes out when {review.supervisor.name} taps Discussed. Sending now skips that step.</small> : null}
            </div>
          </section>

          <form action={savePayBlockAction} className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input type="hidden" name="reviewId" value={review.id} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="group-title" style={{ padding: 0 }}>Current status &amp; recommendations</span>
              <span className="chip chip-warn">Office only</span>
            </div>
            <label className="field"><span>Current pay rate</span><input name="currentPayRate" type="number" step="0.01" defaultValue={pay?.currentPayRate?.toString() ?? ""} /></label>
            <label className="field"><span>Last raise date</span><input name="lastRaiseDate" type="date" defaultValue={pay?.lastRaiseDate?.toISOString().slice(0, 10) ?? ""} /></label>
            <label className="field"><span>Last raise amount</span><input name="lastRaiseAmount" type="number" step="0.01" defaultValue={pay?.lastRaiseAmount?.toString() ?? ""} /></label>
            <label className="field"><span>Raise amount</span><input name="raiseAmount" type="number" step="0.01" defaultValue={pay?.raiseAmount?.toString() ?? ""} /></label>
            <label className="field"><span>New pay rate</span><input name="newPayRate" type="number" step="0.01" defaultValue={pay?.newPayRate?.toString() ?? ""} /></label>
            <label className="field"><span>Date effective</span><input name="dateEffective" type="date" defaultValue={pay?.dateEffective?.toISOString().slice(0, 10) ?? ""} /></label>
            <label className="field"><span>Next review date</span><input name="nextReviewDate" type="date" defaultValue={pay?.nextReviewDate?.toISOString().slice(0, 10) ?? ""} /></label>
            <button className="btn btn-outline" type="submit">Save pay block</button>
          </form>

          <section className="office-only" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div className="label">OFFICE ONLY · hidden from reviewer and worker</div>
            {review.notes.map((n) => (
              <div key={n.id} style={{ fontSize: 13, lineHeight: 1.45 }}>
                <div>{n.body}</div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>{n.author.name} · {n.createdAt.toLocaleDateString()}</div>
              </div>
            ))}
            <form action={addOfficeNoteAction} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <input type="hidden" name="reviewId" value={review.id} />
              <textarea name="body" required rows={2} placeholder="Add a note…" style={{ width: "100%", border: "1px solid var(--line)", borderRadius: 9, padding: "9px 10px", fontSize: 13 }} />
              <button className="btn btn-dark" style={{ alignSelf: "flex-end", height: 32 }} type="submit">Save note</button>
            </form>
          </section>
        </aside>
      </div>
    </OfficeShell>
  );
}
