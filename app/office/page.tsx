import { requireOffice } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { describeStatus } from "@/lib/reviews";
import { OfficeShell } from "@/components/office-shell";

function chipClass(status: string) {
  if (status === "PENDING_OFFICE") return "chip chip-purple";
  if (status === "SIGNED" || status === "CLOSED") return "chip chip-ok";
  if (status === "DECLINED") return "chip chip-danger";
  if (status === "APPROVED" || status === "DISCUSSED" || status === "SIGN_LINK_SENT") return "chip chip-info";
  return "chip chip-warn";
}

export default async function OfficeHome({ searchParams }: { searchParams: Promise<{ reviewer?: string }> }) {
  const user = await requireOffice();
  const { reviewer } = await searchParams;

  const period = await prisma.reviewPeriod.findFirst({ where: { closedAt: null }, orderBy: { opensAt: "desc" } });
  const reviews = period
    ? await prisma.review.findMany({
        where: { periodId: period.id, ...(reviewer ? { supervisorId: reviewer } : {}) },
        include: { employee: true, supervisor: { select: { id: true, name: true } }, messages: { orderBy: { createdAt: "desc" }, take: 1 } },
        orderBy: [{ supervisor: { name: "asc" } }, { employee: { lastName: "asc" } }]
      })
    : [];
  const reviewers = await prisma.user.findMany({ where: { employeesReviewed: { some: {} } }, select: { id: true, name: true }, orderBy: { name: "asc" } });
  const employeeCount = await prisma.employee.count({ where: { isActive: true } });

  const counts = {
    attention: reviews.filter((r) => r.status === "OPEN" || r.status === "SENT_BACK").length,
    ready: reviews.filter((r) => r.status === "PENDING_OFFICE").length,
    inSigning: reviews.filter((r) => ["APPROVED", "DISCUSSED", "SIGN_LINK_SENT"].includes(r.status)).length,
    done: reviews.filter((r) => ["SIGNED", "DECLINED", "CLOSED"].includes(r.status)).length
  };

  return (
    <OfficeShell user={user} active="/office">
      <div className="page-head">
        <div>
          <div className="eyebrow">{period ? `${period.name} · due ${period.dueDate.toLocaleDateString()}` : "No open period"} · {employeeCount} employees</div>
          <h1>Reviews</h1>
        </div>
        <div className="actions">
          <a className="btn btn-outline" href="/office/employees/new">Add employee</a>
          {period ? (
            <a className="btn btn-primary" href={`/office/export?period=${period.id}${reviewer ? `&reviewer=${reviewer}` : ""}`} target="_blank" rel="noopener">
              Download / print {reviewer ? "this reviewer" : "entire company"}
            </a>
          ) : <a className="btn btn-primary" href="/office/periods">Open a period</a>}
        </div>
      </div>

      <div className="tiles">
        <div className="tile"><span>Need attention</span><b className="accent">{counts.attention}</b></div>
        <div className="tile"><span>Ready to approve</span><b>{counts.ready}</b></div>
        <div className="tile"><span>Meeting and signing</span><b>{counts.inSigning}</b></div>
        <div className="tile"><span>Completed</span><b>{counts.done}</b></div>
      </div>

      <div className="table-card">
        <form style={{ display: "flex", gap: 8, alignItems: "center", padding: "14px 18px", borderBottom: "1px solid #eef0f2", fontSize: 13, color: "var(--muted)" }}>
          <span>Reviewer</span>
          <select name="reviewer" defaultValue={reviewer ?? ""} style={{ height: 34, borderRadius: 9, border: "1px solid var(--line)", padding: "0 10px" }}>
            <option value="">All reviewers</option>
            {reviewers.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <button className="btn btn-outline" style={{ height: 34 }} type="submit">Filter</button>
          {period ? (
            <span style={{ marginLeft: "auto", display: "flex", gap: 12, alignItems: "center" }}>
              <a href={`/office/export?period=${period.id}${reviewer ? `&reviewer=${reviewer}` : ""}&drafts=1`} target="_blank" rel="noopener" style={{ fontWeight: 600 }}>PDF with drafts</a>
              <a href={`/office/export?period=${period.id}${reviewer ? `&reviewer=${reviewer}` : ""}&download=1`} style={{ fontWeight: 600 }}>Download completed</a>
            </span>
          ) : null}
        </form>
        <table>
          <thead>
            <tr><th>Employee</th><th>Reviewer</th><th>Status</th><th>Last message</th><th></th></tr>
          </thead>
          <tbody>
            {reviews.length === 0 ? (
              <tr><td colSpan={5} style={{ color: "var(--muted)" }}>{period ? "No reviews in this period yet. Add employees and they appear here." : "Open a review period to create reviews for every active employee."}</td></tr>
            ) : null}
            {reviews.map((r) => (
              <tr key={r.id}>
                <td><strong>{r.employee.firstName} {r.employee.lastName}</strong><small>{r.employee.position}</small></td>
                <td>{r.supervisor.name}</td>
                <td><span className={chipClass(r.status)}>{describeStatus(r)}</span></td>
                <td style={{ fontSize: 13, color: "#4b5563" }}>{r.messages[0] ? `${r.messages[0].channel} · ${r.messages[0].createdAt.toLocaleDateString()} · ${r.messages[0].status}` : "—"}</td>
                <td style={{ textAlign: "right" }}><a href={`/office/reviews/${r.id}`} style={{ fontWeight: 600 }}>Open</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </OfficeShell>
  );
}
