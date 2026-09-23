import { requireOffice } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { OfficeShell } from "@/components/office-shell";
import { closePeriodAction, openPeriodAction, reopenPeriodAction } from "@/app/office/periods/actions";
import { isAdmin } from "@/lib/types";

export default async function PeriodsPage({ searchParams }: { searchParams: Promise<{ error?: string; closed?: string }> }) {
  const user = await requireOffice();
  const sp = await searchParams;
  const periods = await prisma.reviewPeriod.findMany({ include: { _count: { select: { reviews: true } } }, orderBy: { opensAt: "desc" } });
  const open = periods.find((p) => !p.closedAt);
  const unfinished = open ? await prisma.review.count({ where: { periodId: open.id, status: { notIn: ["SIGNED", "DECLINED", "CLOSED"] } } }) : 0;

  return (
    <OfficeShell user={user} active="/office/periods">
      <div className="page-head">
        <div>
          <div className="eyebrow">Twice a year. Opening a period creates one review per active employee under their reviewer.</div>
          <h1>Review periods</h1>
        </div>
      </div>

      {sp.error ? <p className="error">{sp.error}</p> : null}
      {sp.closed ? <p style={{ color: "var(--ok)", fontWeight: 600 }}>Period closed. {sp.closed} reviews filed.</p> : null}
      {!open ? (
        <form action={openPeriodAction} className="dialog" style={{ maxWidth: 520 }}>
          <div className="form-grid">
            <label className="field"><span>Name</span><input name="name" required placeholder="Fall 2026" /></label>
            <label className="field"><span>Due date</span><input name="dueDate" type="date" required /></label>
          </div>
          <button className="btn btn-primary" type="submit">Open period</button>
        </form>
      ) : (
        <form action={closePeriodAction} className="card" style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <input type="hidden" name="periodId" value={open.id} />
          <div style={{ flex: 1 }}>A period is open: <strong>{open.name}</strong>, due {open.dueDate.toLocaleDateString()}. {unfinished === 0 ? "Every review is finished." : `${unfinished} review${unfinished === 1 ? "" : "s"} still unfinished.`}</div>
          <button className="btn btn-primary" type="submit" disabled={unfinished > 0}>Close period</button>
        </form>
      )}

      <div className="table-card">
        <table>
          <thead><tr><th>Period</th><th>Opened</th><th>Due</th><th>Reviews</th><th>State</th><th></th></tr></thead>
          <tbody>
            {periods.map((p) => (
              <tr key={p.id}>
                <td><strong>{p.name}</strong></td>
                <td>{p.opensAt.toLocaleDateString()}</td>
                <td>{p.dueDate.toLocaleDateString()}</td>
                <td>{p._count.reviews}</td>
                <td>{p.closedAt ? <span className="chip chip-muted">Closed {p.closedAt.toLocaleDateString()}</span> : <span className="chip chip-ok">Open</span>}</td>
                <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                  <a href={`/office/export?period=${p.id}`} target="_blank" rel="noopener" style={{ fontWeight: 600, marginRight: 12 }}>PDF</a>
                  {p.closedAt && !open && isAdmin(user) ? (
                    <form action={reopenPeriodAction} style={{ display: "inline" }}><input type="hidden" name="periodId" value={p.id} /><button className="btn btn-ghost" style={{ height: 28, padding: "0 6px", fontSize: 13 }} type="submit">Reopen</button></form>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </OfficeShell>
  );
}
