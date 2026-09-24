import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { roleLabel } from "@/lib/types";
import { OfficeShell } from "@/components/office-shell";
import { createUserAction, resetPasswordAction, setUserActiveAction, updateRolesAction } from "@/app/office/users/actions";

const ROLES = ["FOREMAN", "PROJECT_MANAGER", "SENIOR_MANAGER", "OFFICE", "ADMIN"] as const;

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ created?: string; temp?: string; email?: string; error?: string; saved?: string }> }) {
  const admin = await requireAdmin();
  const sp = await searchParams;
  const users = await prisma.user.findMany({
    include: { _count: { select: { employeesReviewed: true } } },
    orderBy: [{ isActive: "desc" }, { name: "asc" }]
  });

  return (
    <OfficeShell user={admin} active="/office/users">
      <div className="page-head">
        <div>
          <div className="eyebrow">Admin only. Sign-in accounts for office staff and reviewers. Workers never get accounts, they use links.</div>
          <h1>Users</h1>
        </div>
      </div>

      {sp.temp && sp.email ? (
        <div className="card" style={{ borderColor: "var(--ok)", display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontWeight: 700, color: "var(--ok)" }}>{sp.created ? "Account created" : "Password reset"} for {sp.email}</div>
          <div style={{ fontSize: 14 }}>Temporary password, shown once. Hand it to them in person or by phone, not by text or email:</div>
          <code style={{ fontSize: 22, fontWeight: 700, letterSpacing: "0.08em", background: "var(--bg)", padding: "8px 12px", borderRadius: 8, alignSelf: "flex-start" }}>{sp.temp}</code>
          <div style={{ fontSize: 13, color: "var(--muted)" }}>They must choose their own password the first time they sign in.</div>
        </div>
      ) : null}
      {sp.saved ? <p style={{ color: "var(--ok)", fontWeight: 600 }}>Saved.</p> : null}
      {sp.error ? <p className="error">{sp.error}</p> : null}

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 380px", gap: 20, alignItems: "start" }}>
        <div className="table-card">
          <table>
            <thead><tr><th>Name</th><th>Email</th><th>Roles</th><th>Reviews for</th><th></th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} style={{ opacity: u.isActive ? 1 : 0.55 }}>
                  <td><strong>{u.name}</strong>{!u.isActive ? <small>Inactive</small> : u.mustChangePassword ? <small style={{ color: "var(--warn)" }}>Temporary password, not yet signed in</small> : null}</td>
                  <td style={{ fontSize: 13 }}>{u.email}<small>{u.language === "ES" ? "Español" : "English"}</small></td>
                  <td>
                    <form action={updateRolesAction} style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                      <input type="hidden" name="userId" value={u.id} />
                      {ROLES.map((r) => (
                        <label key={r} style={{ display: "flex", gap: 4, alignItems: "center", fontSize: 12, whiteSpace: "nowrap" }}>
                          <input type="checkbox" name="roles" value={r} defaultChecked={u.roles.includes(r)} disabled={u.id === admin.id && r === "ADMIN"} /> {roleLabel(r)}
                        </label>
                      ))}
                      <button className="btn btn-ghost" style={{ height: 26, padding: "0 8px", fontSize: 12 }} type="submit">Save</button>
                    </form>
                  </td>
                  <td style={{ fontSize: 13, color: "#4b5563" }}>{u._count.employeesReviewed} employees</td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <form action={resetPasswordAction} style={{ display: "inline" }}>
                      <input type="hidden" name="userId" value={u.id} />
                      <button className="btn btn-ghost" style={{ height: 30, padding: "0 8px", fontSize: 13 }} type="submit">Reset password</button>
                    </form>
                    {u.id !== admin.id ? (
                      <form action={setUserActiveAction} style={{ display: "inline" }}>
                        <input type="hidden" name="userId" value={u.id} />
                        <input type="hidden" name="active" value={u.isActive ? "0" : "1"} />
                        <button className="btn btn-ghost" style={{ height: 30, padding: "0 8px", fontSize: 13 }} type="submit">{u.isActive ? "Deactivate" : "Reactivate"}</button>
                      </form>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <form action={createUserAction} className="dialog" style={{ maxWidth: "none" }}>
          <div>
            <h2 style={{ fontSize: 18 }}>Add a user</h2>
            <div style={{ fontSize: 13, color: "var(--muted)" }}>A temporary password is generated and shown once.</div>
          </div>
          <label className="field"><span>Full name</span><input name="name" required /></label>
          <label className="field"><span>Email <span className="hint">· their sign-in</span></span><input name="email" type="email" required /></label>
          <fieldset style={{ border: 0, padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            <legend style={{ fontSize: 13, fontWeight: 600, padding: 0, marginBottom: 6 }}>Roles</legend>
            {ROLES.map((r) => (
              <label key={r} style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 14 }}>
                <input type="checkbox" name="roles" value={r} defaultChecked={r === "FOREMAN"} /> {roleLabel(r)}
                <span style={{ color: "var(--muted)", fontSize: 12 }}>
                  {r === "FOREMAN" || r === "PROJECT_MANAGER" || r === "SENIOR_MANAGER" ? "completes reviews on the phone" : r === "OFFICE" ? "runs periods, approvals, exports" : "adds users, changes settings"}
                </span>
              </label>
            ))}
          </fieldset>
          <button className="btn btn-primary" type="submit">Create account</button>
        </form>
      </div>
    </OfficeShell>
  );
}
