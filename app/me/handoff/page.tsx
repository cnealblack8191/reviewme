import { requireReviewer } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { handoffAction } from "@/app/me/handoff/actions";
import { rt } from "@/lib/i18n";
import { userLanguage } from "@/lib/user-language";

/** Last resort: the foreman hands their own phone to a worker whose link did not reach them. */
export default async function HandoffPage() {
  const user = await requireReviewer();
  const lang = await userLanguage(user.id);
  const L = (key: Parameters<typeof rt>[1]) => rt(lang, key);
  const waiting = await prisma.review.findMany({
    where: { supervisorId: user.id, status: { in: ["OPEN", "SENT_BACK"] }, employeeStatus: { not: "SUBMITTED" }, period: { closedAt: null } },
    include: { employee: true },
    orderBy: { employee: { lastName: "asc" } }
  });

  return (
    <div className="phone" style={{ background: "#fff" }}>
      <header className="worker-header" style={{ borderBottom: 0 }}>
        <a href="/me" style={{ color: "var(--ink)", fontWeight: 600 }}>‹ {L("back")}</a>
        <span className="chip chip-warn">{L("lastResort")}</span>
      </header>
      <main className="phone-main" style={{ gap: 22 }}>
        <div>
          <h1 style={{ fontSize: 26 }}>{L("handoffTitle")}</h1>
          <p style={{ color: "#4b5563", lineHeight: 1.5 }}>{L("handoffIntro")}</p>
        </div>
        <form action={handoffAction} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <label className="field">
            <span>{L("whoCompleting")}</span>
            <select name="reviewId" required defaultValue="">
              <option value="" disabled>{L("chooseWorker")}</option>
              {waiting.map((r) => (
                <option key={r.id} value={r.id}>{r.employee.firstName} {r.employee.lastName}</option>
              ))}
            </select>
            <span className="hint">{L("onlyWaiting")}</span>
          </label>
          <ol style={{ margin: 0, paddingLeft: 20, color: "#4b5563", lineHeight: 1.6, fontSize: 14 }}>
            {L("handoffSteps").split("|").map((step) => <li key={step}>{step}</li>)}
          </ol>
          <button className="btn btn-dark btn-lg" type="submit" disabled={waiting.length === 0}>{L("signOutHandOver")}</button>
          <a className="btn btn-outline btn-lg" href="/me">{L("neverMind")}</a>
        </form>
      </main>
    </div>
  );
}
