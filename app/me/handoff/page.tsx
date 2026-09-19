import { requireForeman } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { handoffAction } from "@/app/me/handoff/actions";

/** Last resort: the foreman hands their own phone to a worker whose link did not reach them. */
export default async function HandoffPage() {
  const user = await requireForeman();
  const waiting = await prisma.review.findMany({
    where: { supervisorId: user.id, status: { in: ["OPEN", "SENT_BACK"] }, employeeStatus: { not: "SUBMITTED" }, period: { closedAt: null } },
    include: { employee: true },
    orderBy: { employee: { lastName: "asc" } }
  });

  return (
    <div className="phone" style={{ background: "#fff" }}>
      <header className="worker-header" style={{ borderBottom: 0 }}>
        <a href="/me" style={{ color: "var(--ink)", fontWeight: 600 }}>‹ Back</a>
        <span className="chip chip-warn">LAST RESORT</span>
      </header>
      <main className="phone-main" style={{ gap: 22 }}>
        <div>
          <h1 style={{ fontSize: 26 }}>Hand your phone to a worker</h1>
          <p style={{ color: "#4b5563", lineHeight: 1.5 }}>Only when the text or email link can&apos;t reach them. The office can resend a link first, so try that before this.</p>
        </div>
        <form action={handoffAction} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <label className="field">
            <span>Who is completing their self-evaluation?</span>
            <select name="reviewId" required defaultValue="">
              <option value="" disabled>Choose a worker</option>
              {waiting.map((r) => (
                <option key={r.id} value={r.id}>{r.employee.firstName} {r.employee.lastName}</option>
              ))}
            </select>
            <span className="hint">Only crew still waiting on their part are listed.</span>
          </label>
          <ol style={{ margin: 0, paddingLeft: 20, color: "#4b5563", lineHeight: 1.6, fontSize: 14 }}>
            <li>You are signed out of the portal on this phone.</li>
            <li>The worker confirms the last 4 digits of their phone number.</li>
            <li>They complete the same one-time self-evaluation the link opens. Your review is never shown.</li>
            <li>On submit the session ends and any pending link dies.</li>
          </ol>
          <button className="btn btn-dark btn-lg" type="submit" disabled={waiting.length === 0}>Sign out and hand over</button>
          <a className="btn btn-outline btn-lg" href="/me">Never mind</a>
        </form>
      </main>
    </div>
  );
}
