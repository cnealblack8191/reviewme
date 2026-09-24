import Image from "next/image";
import { requireReviewer } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { markDiscussedAction, setLanguageAction } from "@/app/me/actions";
import { isOffice } from "@/lib/types";
import { rt } from "@/lib/i18n";
import { userLanguage } from "@/lib/user-language";

function initials(first: string, last: string) {
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase();
}

export default async function ForemanHome() {
  const user = await requireReviewer();
  const lang = await userLanguage(user.id);
  const L = (key: Parameters<typeof rt>[1]) => rt(lang, key);

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
              <div style={{ fontSize: 15, fontWeight: 700 }}>{L("myReviews")}</div>
              <small>{period ? `${period.name} · ${L("due")} ${period.dueDate.toLocaleDateString()}` : L("noOpenPeriod")}</small>
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <form action={setLanguageAction} className="lang-toggle" style={{ background: "rgba(255,255,255,0.1)" }}>
              <button name="lang" value="EN" type="submit" style={{ height: 26, padding: "0 10px", borderRadius: 999, border: 0, fontSize: 12, fontWeight: 700, cursor: "pointer", background: lang === "EN" ? "#fff" : "transparent", color: lang === "EN" ? "#15191d" : "#d5dbe1" }}>EN</button>
              <button name="lang" value="ES" type="submit" style={{ height: 26, padding: "0 10px", borderRadius: 999, border: 0, fontSize: 12, fontWeight: 700, cursor: "pointer", background: lang === "ES" ? "#fff" : "transparent", color: lang === "ES" ? "#15191d" : "#d5dbe1" }}>ES</button>
            </form>
            {isOffice(user) ? <a href="/office" style={{ color: "#9aa4af", fontSize: 13 }}>{L("office")}</a> : null}
            <a href="/account/password" style={{ color: "#9aa4af", fontSize: 13 }}>{L("password")}</a>
            <a href="/logout" style={{ color: "#9aa4af", fontSize: 13 }}>{L("signOut")}</a>
          </div>
        </div>
        <div className="stats">
          <div className="stat"><b className="accent">{needAttention}</b><span>{L("needAttention")}</span></div>
          <div className="stat"><b>{completed}</b><span>{L("completed")}</span></div>
        </div>
        <div>
          <div className="progress"><div style={{ width: `${pct}%` }} /></div>
          <div style={{ fontSize: 12, color: "#9aa4af", marginTop: 6 }}>{completed} / {reviews.length} {L("sentToOffice")}</div>
        </div>
      </header>

      <main className="phone-main">
        <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="group-title"><span>{L("yourReviews")}</span><span>{mine.length}</span></div>
          {mine.length === 0 ? <div className="card" style={{ color: "var(--muted)", fontSize: 14 }}>{L("nothingWaiting")}</div> : null}
          {mine.map((r) => {
            const total = r.template.criteria.length;
            const done = r.answers.filter((a) => a.rating != null).length;
            const started = r.supervisorStatus === "IN_PROGRESS" || done > 0;
            return (
              <div className="card row-card" key={r.id}>
                <div className="avatar">{initials(r.employee.firstName, r.employee.lastName)}</div>
                <div className="who">
                  <strong>{r.employee.firstName} {r.employee.lastName}</strong>
                  <small>{r.employee.position}{r.employee.jobSite ? ` · ${r.employee.jobSite}` : ""}{r.employee.language !== lang ? ` · ${r.employee.language === "ES" ? "Español" : "English"}` : ""}</small>
                  <small className="status" style={{ color: started ? "var(--warn)" : "var(--muted)" }}>
                    {r.status === "SENT_BACK" ? `${L("sentBack")}: ${r.sentBackReason ?? ""}` : started ? `${L("inProgress")} · ${done} / ${total} ${L("items")}` : L("notStarted")}
                  </small>
                </div>
                <a className="btn btn-primary" href={`/me/review/${r.id}`}>{started ? L("continue") : L("start")}</a>
              </div>
            );
          })}
        </section>

        {toDiscuss.length > 0 ? (
          <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div className="group-title"><span>{L("approvedMeet")}</span><span>{toDiscuss.length}</span></div>
            {toDiscuss.map((r) => (
              <form action={markDiscussedAction} className="card row-card" key={r.id}>
                <input type="hidden" name="reviewId" value={r.id} />
                <div className="avatar ok">{initials(r.employee.firstName, r.employee.lastName)}</div>
                <div className="who">
                  <strong>{r.employee.firstName} {r.employee.lastName}</strong>
                  <small>{L("approvedBy")} {r.approvedAt?.toLocaleDateString()}</small>
                  <small className="status" style={{ color: "var(--ok)" }}>{L("sitDown")}</small>
                </div>
                <button className="btn btn-dark" type="submit">{L("discussed")}</button>
              </form>
            ))}
          </section>
        ) : null}

        <div style={{ flex: 1 }} />
        <a className="quiet-link" href="/me/handoff">{L("handoffLink")}</a>
      </main>
    </div>
  );
}
