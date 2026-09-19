import Image from "next/image";
import { requireForeman } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { markDiscussedAction } from "@/app/me/actions";

function initials(first: string, last: string) {
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase();
}

export default async function ForemanHome() {
  const user = await requireForeman();

  const period = await prisma.reviewPeriod.findFirst({ where: { closedAt: null }, orderBy: { opensAt: "desc" } });
  const reviews = period
    ? await prisma.review.findMany({
        where: { periodId: period.id, supervisorId: user.id },
        include: { employee: true, template: { select: { titleEn: true, criteria: { select: { id: true } } } }, answers: { where: { side: "SUPERVISOR" } } },
        orderBy: { employee: { lastName: "asc" } }
      })
    : [];

  const mine = reviews.filter((r) => r.supervisorStatus !== "SUBMITTED" && (r.status === "OPEN" || r.status === "SENT_BACK"));
  const toDiscuss = reviews.filter((r) => r.status === "APPROVED");
  const completed = reviews.length - mine.length;
  const needAttention = mine.length + toDiscuss.length;
  const pct = reviews.length ? Math.round((completed / reviews.length) * 100) : 0;

  return (
    <div className="phone">
      <header className="phone-header">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div className="brand">
            <Image alt="ECI" src="/eci-logo.png" width={32} height={32} />
            <div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>My reviews</div>
              <small>{period ? `${period.name} · due ${period.dueDate.toLocaleDateString()}` : "No open review period"}</small>
            </div>
          </div>
          <a href="/logout" className="btn btn-ghost" style={{ color: "#9aa4af", padding: 0 }}>Sign out</a>
        </div>
        <div className="stats">
          <div className="stat"><b className="accent">{needAttention}</b><span>Need attention</span></div>
          <div className="stat"><b>{completed}</b><span>Completed</span></div>
        </div>
        <div>
          <div className="progress"><div style={{ width: `${pct}%` }} /></div>
          <div style={{ fontSize: 12, color: "#9aa4af", marginTop: 6 }}>{completed} of {reviews.length} sent to the office</div>
        </div>
      </header>

      <main className="phone-main">
        <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="group-title"><span>Your reviews</span><span>{mine.length}</span></div>
          {mine.length === 0 ? <div className="card" style={{ color: "var(--muted)", fontSize: 14 }}>Nothing waiting on you.</div> : null}
          {mine.map((r) => {
            const total = r.template.criteria.length;
            const done = r.answers.filter((a) => a.rating != null).length;
            const started = r.supervisorStatus === "IN_PROGRESS" || done > 0;
            return (
              <div className="card row-card" key={r.id}>
                <div className="avatar">{initials(r.employee.firstName, r.employee.lastName)}</div>
                <div className="who">
                  <strong>{r.employee.firstName} {r.employee.lastName}</strong>
                  <small>{r.employee.position}{r.employee.jobSite ? ` · ${r.employee.jobSite}` : ""}</small>
                  <small className="status" style={{ color: started ? "var(--warn)" : "var(--muted)" }}>
                    {r.status === "SENT_BACK" ? `Sent back: ${r.sentBackReason ?? ""}` : started ? `In progress · ${done} of ${total} items` : "Not started"}
                  </small>
                </div>
                <a className="btn btn-primary" href={`/me/review/${r.id}`}>{started ? "Continue" : "Start"}</a>
              </div>
            );
          })}
        </section>

        {toDiscuss.length > 0 ? (
          <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div className="group-title"><span>Approved · meet and confirm</span><span>{toDiscuss.length}</span></div>
            {toDiscuss.map((r) => (
              <form action={markDiscussedAction} className="card row-card" key={r.id}>
                <input type="hidden" name="reviewId" value={r.id} />
                <div className="avatar ok">{initials(r.employee.firstName, r.employee.lastName)}</div>
                <div className="who">
                  <strong>{r.employee.firstName} {r.employee.lastName}</strong>
                  <small>Approved by office {r.approvedAt?.toLocaleDateString()}</small>
                  <small className="status" style={{ color: "var(--ok)" }}>Sit down with them, then tap. That sends the sign link.</small>
                </div>
                <button className="btn btn-dark" type="submit">Discussed</button>
              </form>
            ))}
          </section>
        ) : null}

        <div style={{ flex: 1 }} />
        <a className="quiet-link" href="/me/handoff">Worker can&apos;t get their link? Hand them your phone</a>
      </main>
    </div>
  );
}
