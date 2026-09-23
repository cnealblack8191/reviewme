import { notFound } from "next/navigation";
import { requireOffice } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { roleLabel } from "@/lib/types";
import { describeStatus } from "@/lib/reviews";
import { OfficeShell } from "@/components/office-shell";
import { setEmployeeActiveAction, updateEmployeeAction } from "@/app/office/employees/[employeeId]/actions";

export default async function EditEmployeePage({ params, searchParams }: { params: Promise<{ employeeId: string }>; searchParams: Promise<{ saved?: string; error?: string }> }) {
  const user = await requireOffice();
  const { employeeId } = await params;
  const sp = await searchParams;

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: {
      reviews: { include: { period: true, supervisor: { select: { name: true } }, signature: { select: { declined: true, signedAt: true } } }, orderBy: { createdAt: "desc" } }
    }
  });
  if (!employee) notFound();

  const [templates, reviewers, settings] = await Promise.all([
    prisma.reviewTemplate.findMany({ where: { isActive: true }, include: { criteria: { select: { id: true } } }, orderBy: { sortOrder: "asc" } }),
    prisma.user.findMany({ where: { isActive: true, roles: { hasSome: ["FOREMAN", "PROJECT_MANAGER", "SENIOR_MANAGER", "OFFICE", "ADMIN"] } }, select: { id: true, name: true, roles: true }, orderBy: { name: "asc" } }),
    prisma.companySettings.findUnique({ where: { id: "eci" } })
  ]);

  const openReview = employee.reviews.find((r) => !r.period.closedAt && !["SIGNED", "DECLINED", "CLOSED"].includes(r.status));
  const templateLocked = Boolean(openReview && (openReview.supervisorStatus !== "NOT_STARTED" || openReview.employeeStatus !== "NOT_STARTED"));

  return (
    <OfficeShell user={user} active="/office/employees">
      <div className="page-head">
        <div>
          <div className="eyebrow"><a href="/office/employees">Employees</a> · {employee.isActive ? "Active" : "Inactive"}</div>
          <h1>{employee.firstName} {employee.lastName}</h1>
        </div>
        <div className="actions">
          <a className="btn btn-outline" href={`/office/employees/${employee.id}/pdf`} target="_blank" rel="noopener">Review file PDF</a>
          <form action={setEmployeeActiveAction}>
            <input type="hidden" name="employeeId" value={employee.id} />
            <input type="hidden" name="active" value={employee.isActive ? "0" : "1"} />
            <button className="btn btn-outline" type="submit">{employee.isActive ? "Deactivate" : "Reactivate"}</button>
          </form>
        </div>
      </div>
      {sp.saved ? <p style={{ color: "var(--ok)", fontWeight: 600 }}>Saved.</p> : null}
      {sp.error ? <p className="error">{sp.error}</p> : null}

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 620px) minmax(0, 1fr)", gap: 20, alignItems: "start" }}>
        <form action={updateEmployeeAction} className="dialog" style={{ maxWidth: "none" }}>
          <input type="hidden" name="employeeId" value={employee.id} />
          <div className="form-grid">
            <label className="field"><span>First name</span><input name="firstName" required defaultValue={employee.firstName} /></label>
            <label className="field"><span>Last name</span><input name="lastName" required defaultValue={employee.lastName} /></label>
            <label className="field"><span>Mobile phone <span className="hint">· text links and the last-4 check</span></span><input name="phone" type="tel" defaultValue={employee.phone ?? ""} /></label>
            <label className="field"><span>Email</span><input name="email" type="email" defaultValue={employee.email ?? ""} /></label>
            <label className="field"><span>Current position</span><input name="position" required defaultValue={employee.position} /></label>
            <label className="field"><span>IEC year/status</span><input name="iecStatus" defaultValue={employee.iecStatus ?? ""} /></label>
            <label className="field"><span>Hire date</span><input name="hireDate" type="date" defaultValue={employee.hireDate?.toISOString().slice(0, 10) ?? ""} /></label>
            <label className="field"><span>Job site</span><input name="jobSite" defaultValue={employee.jobSite ?? ""} /></label>
            <label className="field"><span>Language for texts and links</span>
              <select name="language" defaultValue={employee.language}><option value="EN">English</option><option value="ES">Español</option></select>
            </label>
            {settings?.identityCheck === "SSN_LAST4" ? (
              <label className="field"><span>Last 4 of SSN <span className="hint">· {employee.ssnLast4Hash ? "on file, enter to replace" : "not on file"}</span></span><input name="ssnLast4" inputMode="numeric" maxLength={4} pattern="[0-9]{4}" placeholder="••••" /></label>
            ) : <div />}
            <label className="field span2"><span>Review form{templateLocked ? <span className="hint"> · locked while the current review is in progress</span> : null}</span>
              <select name="templateId" defaultValue={employee.templateId} disabled={templateLocked}>
                {templates.map((t) => <option key={t.id} value={t.id}>{t.titleEn} · {t.criteria.length} items</option>)}
              </select>
            </label>
            <label className="field span2"><span>Reviewer <span className="hint">· changing this also moves the open review</span></span>
              <select name="reviewerId" defaultValue={employee.reviewerId}>
                {reviewers.map((r) => <option key={r.id} value={r.id}>{r.name} · {r.roles.map(roleLabel).join(", ")}</option>)}
              </select>
            </label>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <a className="btn btn-outline" href="/office/employees">Cancel</a>
            <button className="btn btn-primary" type="submit">Save changes</button>
          </div>
        </form>

        <section className="table-card">
          <div style={{ padding: "14px 18px", borderBottom: "1px solid #eef0f2", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontWeight: 700 }}>Review file</span>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>{employee.reviews.filter((r) => r.status === "CLOSED").length} filed · {employee.reviews.length} total</span>
          </div>
          <table>
            <thead><tr><th>Period</th><th>Reviewer</th><th>Status</th><th>Overall</th><th>Signed</th><th></th></tr></thead>
            <tbody>
              {employee.reviews.length === 0 ? <tr><td colSpan={6} style={{ color: "var(--muted)" }}>No reviews yet.</td></tr> : null}
              {employee.reviews.map((r) => (
                <tr key={r.id}>
                  <td><strong>{r.period.name}</strong></td>
                  <td>{r.supervisor.name}</td>
                  <td><span className="chip chip-muted">{describeStatus(r)}</span></td>
                  <td style={{ fontWeight: 600 }}>{r.overallRating ?? "—"}</td>
                  <td style={{ fontSize: 13, color: "#4b5563" }}>{r.signature ? (r.signature.declined ? "Declined" : r.signature.signedAt.toLocaleDateString()) : "—"}</td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    {r.supervisorStatus === "SUBMITTED" ? <a href={`/office/reviews/${r.id}/pdf`} target="_blank" rel="noopener" style={{ fontWeight: 600, marginRight: 10 }}>PDF</a> : null}
                    <a href={`/office/reviews/${r.id}`} style={{ fontWeight: 600 }}>Open</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </OfficeShell>
  );
}
