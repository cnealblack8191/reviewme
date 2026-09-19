import { requireOffice } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { OfficeShell } from "@/components/office-shell";
import { openPeriodAction } from "@/app/office/periods/actions";

export default async function PeriodsPage() {
  const user = await requireOffice();
  const periods = await prisma.reviewPeriod.findMany({ include: { _count: { select: { reviews: true } } }, orderBy: { opensAt: "desc" } });
  const open = periods.find((p) => !p.closedAt);

  return (
    <OfficeShell user={user} active="/office/periods">
      <div className="page-head">
        <div>
          <div className="eyebrow">Twice a year. Opening a period creates one review per active employee under their reviewer.</div>
          <h1>Review periods</h1>
        </div>
      </div>

      {!open ? (
        <form action={openPeriodAction} className="dialog" style={{ maxWidth: 520 }}>
          <div className="form-grid">
            <label className="field"><span>Name</span><input name="name" required placeholder="Fall 2026" /></label>
            <label className="field"><span>Due date</span><input name="dueDate" type="date" required /></label>
          </div>
          <button className="btn btn-primary" type="submit">Open period</button>
        </form>
      ) : (
        <div className="card">A period is open: <strong>{open.name}</strong>, due {open.dueDate.toLocaleDateString()}. Close it before opening another.</div>
      )}

      <div className="table-card">
        <table>
          <thead><tr><th>Period</th><th>Opened</th><th>Due</th><th>Reviews</th><th>State</th></tr></thead>
          <tbody>
            {periods.map((p) => (
              <tr key={p.id}>
                <td><strong>{p.name}</strong></td>
                <td>{p.opensAt.toLocaleDateString()}</td>
                <td>{p.dueDate.toLocaleDateString()}</td>
                <td>{p._count.reviews}</td>
                <td>{p.closedAt ? <span className="chip chip-muted">Closed</span> : <span className="chip chip-ok">Open</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </OfficeShell>
  );
}
