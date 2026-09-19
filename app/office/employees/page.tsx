import { requireOffice } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { OfficeShell } from "@/components/office-shell";

export default async function EmployeesPage({ searchParams }: { searchParams: Promise<{ q?: string; inactive?: string }> }) {
  const user = await requireOffice();
  const { q, inactive } = await searchParams;
  const employees = await prisma.employee.findMany({
    where: {
      ...(inactive ? {} : { isActive: true }),
      ...(q ? { OR: [{ firstName: { contains: q, mode: "insensitive" } }, { lastName: { contains: q, mode: "insensitive" } }, { position: { contains: q, mode: "insensitive" } }] } : {})
    },
    include: { reviewer: { select: { name: true } }, template: { select: { titleEn: true } } },
    orderBy: [{ isActive: "desc" }, { lastName: "asc" }, { firstName: "asc" }]
  });

  return (
    <OfficeShell user={user} active="/office/employees">
      <div className="page-head">
        <div>
          <div className="eyebrow">{employees.length} shown{inactive ? ", inactive included" : ""}</div>
          <h1>Employees</h1>
        </div>
        <div className="actions">
          <a className="btn btn-primary" href="/office/employees/new">Add employee</a>
        </div>
      </div>

      <div className="table-card">
        <form style={{ display: "flex", gap: 8, alignItems: "center", padding: "14px 18px", borderBottom: "1px solid #eef0f2", fontSize: 13 }}>
          <input name="q" defaultValue={q ?? ""} placeholder="Search name or position" style={{ height: 34, borderRadius: 9, border: "1px solid var(--line)", padding: "0 10px", width: 260 }} />
          <label style={{ display: "flex", gap: 6, alignItems: "center", color: "var(--muted)" }}>
            <input type="checkbox" name="inactive" value="1" defaultChecked={Boolean(inactive)} /> Show inactive
          </label>
          <button className="btn btn-outline" style={{ height: 34 }} type="submit">Filter</button>
        </form>
        <table>
          <thead>
            <tr><th>Employee</th><th>Position</th><th>Reviewer</th><th>Form</th><th>Contact</th><th>Language</th><th></th></tr>
          </thead>
          <tbody>
            {employees.length === 0 ? <tr><td colSpan={7} style={{ color: "var(--muted)" }}>No employees match.</td></tr> : null}
            {employees.map((e) => (
              <tr key={e.id} style={{ opacity: e.isActive ? 1 : 0.55 }}>
                <td><strong>{e.lastName}, {e.firstName}</strong>{!e.isActive ? <small>Inactive</small> : e.jobSite ? <small>{e.jobSite}</small> : null}</td>
                <td>{e.position}{e.iecStatus ? <small>{e.iecStatus}</small> : null}</td>
                <td>{e.reviewer.name}</td>
                <td style={{ color: "#4b5563" }}>{e.template.titleEn}</td>
                <td style={{ fontSize: 13, color: "#4b5563" }}>{e.phone ?? "—"}{e.email ? <small>{e.email}</small> : null}</td>
                <td>{e.language === "ES" ? "Español" : "English"}</td>
                <td style={{ textAlign: "right" }}><a href={`/office/employees/${e.id}`} style={{ fontWeight: 600 }}>Edit</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </OfficeShell>
  );
}
