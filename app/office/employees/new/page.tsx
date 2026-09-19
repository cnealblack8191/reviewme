import { requireOffice } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { OfficeShell } from "@/components/office-shell";
import { createEmployeeAction } from "@/app/office/employees/new/actions";

export default async function NewEmployeePage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const user = await requireOffice();
  const params = await searchParams;
  const templates = await prisma.reviewTemplate.findMany({ where: { isActive: true }, include: { criteria: { select: { id: true } } }, orderBy: { sortOrder: "asc" } });
  const reviewers = await prisma.user.findMany({ where: { isActive: true, roles: { hasSome: ["FOREMAN", "OFFICE", "ADMIN"] } }, select: { id: true, name: true, roles: true }, orderBy: { name: "asc" } });
  const settings = await prisma.companySettings.findUnique({ where: { id: "eci" } });

  return (
    <OfficeShell user={user} active="/office/employees/new">
      <div className="page-head">
        <div>
          <div className="eyebrow">They join the open review period and their reviewer sees them right away.</div>
          <h1>Add employee</h1>
        </div>
      </div>
      {params.saved ? <p style={{ color: "var(--ok)", fontWeight: 600 }}>Employee added.</p> : null}
      {params.error ? <p className="error">{params.error}</p> : null}

      <form action={createEmployeeAction} className="dialog">
        <div className="form-grid">
          <label className="field"><span>First name</span><input name="firstName" required /></label>
          <label className="field"><span>Last name</span><input name="lastName" required /></label>
          <label className="field"><span>Mobile phone <span className="hint">· text links and the last-4 identity check</span></span><input name="phone" type="tel" placeholder="(555) 000-0000" /></label>
          <label className="field"><span>Email <span className="hint">· optional</span></span><input name="email" type="email" /></label>
          <label className="field"><span>Current position</span><input name="position" required placeholder="Helper, Journeyman, Foreman T2…" /></label>
          <label className="field"><span>IEC year/status <span className="hint">· optional</span></span><input name="iecStatus" placeholder="IEC YR 2" /></label>
          <label className="field"><span>Hire date</span><input name="hireDate" type="date" /></label>
          <label className="field"><span>Job site</span><input name="jobSite" /></label>
          <label className="field"><span>Language for texts and links</span>
            <select name="language" defaultValue="EN"><option value="EN">English</option><option value="ES">Español</option></select>
          </label>
          {settings?.identityCheck === "SSN_LAST4" ? (
            <label className="field"><span>Last 4 of SSN <span className="hint">· stored hashed, used only for the link check</span></span><input name="ssnLast4" inputMode="numeric" maxLength={4} pattern="[0-9]{4}" /></label>
          ) : <div />}
          <label className="field span2"><span>Review form <span className="hint">· one of the eight ECI templates, sets the questions and rating items</span></span>
            <select name="templateId" required defaultValue="">
              <option value="" disabled>Choose a form</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.titleEn} · {t.criteria.length} items</option>)}
            </select>
          </label>
          <label className="field span2"><span>Reviewer <span className="hint">· their foreman for crew, a Project Manager or Senior Manager for foremen</span></span>
            <select name="reviewerId" required defaultValue="">
              <option value="" disabled>Choose a reviewer</option>
              {reviewers.map((r) => <option key={r.id} value={r.id}>{r.name} · {r.roles.join(", ").toLowerCase()}</option>)}
            </select>
          </label>
        </div>
        <label style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 14 }}>
          <input type="checkbox" name="includeInPeriod" defaultChecked /> Include in the open review period
        </label>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <a className="btn btn-outline" href="/office">Cancel</a>
          <button className="btn btn-primary" type="submit">Add employee</button>
        </div>
      </form>
    </OfficeShell>
  );
}
