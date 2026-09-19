import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { OfficeShell } from "@/components/office-shell";
import { saveSettingsAction, sendTestEmailAction } from "@/app/office/settings/actions";

const TIMEZONES = ["America/New_York", "America/Chicago", "America/Denver", "America/Phoenix", "America/Los_Angeles"];

function configured(keys: string[]) {
  return keys.every((k) => Boolean(process.env[k]));
}

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ saved?: string; test?: string }> }) {
  const user = await requireAdmin();
  const sp = await searchParams;
  const s = await getSettings();
  const twilioReady = configured(["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM_NUMBER"]);
  const graphReady = configured(["MICROSOFT_GRAPH_TENANT_ID", "MICROSOFT_GRAPH_CLIENT_ID", "MICROSOFT_GRAPH_SENDER", "MICROSOFT_GRAPH_CERTIFICATE_PATH", "MICROSOFT_GRAPH_PRIVATE_KEY_PATH"]);
  const centralReady = configured(["CENTRAL_LOGIN_URL", "CENTRAL_LOGIN_SECRET"]);

  return (
    <OfficeShell user={user} active="/office/settings">
      <div className="page-head">
        <div>
          <div className="eyebrow">Admin only. Changes apply to the next link, reminder, or message.</div>
          <h1>Company settings</h1>
        </div>
      </div>
      {sp.saved ? <p style={{ color: "var(--ok)", fontWeight: 600 }}>Saved.</p> : null}
      {sp.test ? <p style={{ color: sp.test === "sent" ? "var(--ok)" : "var(--warn)", fontWeight: 600 }}>Test email: {sp.test}</p> : null}

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 620px) minmax(0, 1fr)", gap: 20, alignItems: "start" }}>
        <form action={saveSettingsAction} className="dialog" style={{ maxWidth: "none" }}>
          <div className="form-grid">
            <label className="field"><span>Company name</span><input name="name" defaultValue={s.name} /></label>
            <label className="field"><span>Short name <span className="hint">· used in texts</span></span><input name="shortName" defaultValue={s.shortName} /></label>

            <label className="field span2"><span>Worker identity check</span>
              <select name="identityCheck" defaultValue={s.identityCheck}>
                <option value="PHONE_LAST4">Last 4 digits of mobile phone</option>
                <option value="SSN_LAST4">Last 4 digits of Social Security number (stored hashed)</option>
              </select>
            </label>
            <label className="field"><span>Link lifetime, days</span><input name="linkTtlDays" type="number" min={1} max={60} defaultValue={s.linkTtlDays} /></label>
            <label className="field"><span>Identity attempts before lock</span><input name="linkMaxAttempts" type="number" min={1} max={10} defaultValue={s.linkMaxAttempts} /></label>

            <label className="field span2" style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <input type="checkbox" name="remindersEnabled" defaultChecked={s.remindersEnabled} style={{ width: 16, height: 16 }} /> Automatic reminders on
            </label>
            <label className="field"><span>Remind workers every, days</span><input name="reminderEmployeeDays" type="number" min={1} max={30} defaultValue={s.reminderEmployeeDays} /></label>
            <label className="field"><span>Remind reviewers every, days</span><input name="reminderSupervisorDays" type="number" min={1} max={60} defaultValue={s.reminderSupervisorDays} /></label>
            <label className="field"><span>Texts allowed from, hour</span><input name="reminderQuietStartHour" type="number" min={0} max={23} defaultValue={s.reminderQuietStartHour} /></label>
            <label className="field"><span>Texts allowed until, hour</span><input name="reminderQuietEndHour" type="number" min={1} max={24} defaultValue={s.reminderQuietEndHour} /></label>
            <label className="field span2"><span>Company timezone</span>
              <select name="timezone" defaultValue={s.timezone}>{TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}</select>
            </label>

            <label className="field" style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <input type="checkbox" name="smsEnabled" defaultChecked={s.smsEnabled} style={{ width: 16, height: 16 }} /> Send texts
            </label>
            <label className="field" style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <input type="checkbox" name="emailEnabled" defaultChecked={s.emailEnabled} style={{ width: 16, height: 16 }} /> Send email
            </label>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button className="btn btn-primary" type="submit">Save settings</button>
          </div>
        </form>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <section className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontWeight: 700 }}>Connections</div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}><span>Twilio texting</span><span className={twilioReady ? "chip chip-ok" : "chip chip-warn"}>{twilioReady ? "Configured" : "Not configured"}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}><span>Microsoft 365 email</span><span className={graphReady ? "chip chip-ok" : "chip chip-warn"}>{graphReady ? "Configured" : "Not configured"}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}><span>Central ECI login</span><span className={centralReady ? "chip chip-ok" : "chip chip-muted"}>{centralReady ? "Configured" : "Off"}</span></div>
            <small style={{ color: "var(--muted)" }}>Credentials live in the server environment, not here. Setup steps are in the docs folder.</small>
            <form action={sendTestEmailAction}>
              <button className="btn btn-outline" type="submit" style={{ height: 34 }}>Send a test email to {user.email}</button>
            </form>
          </section>
          <section className="card" style={{ fontSize: 13, color: "#4b5563", lineHeight: 1.5 }}>
            Switching the identity check to SSN means every employee needs their last 4 entered on the Employees page before their next link. Workers without it on file cannot open a link.
          </section>
        </div>
      </div>
    </OfficeShell>
  );
}
