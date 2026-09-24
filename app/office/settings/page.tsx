import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { OfficeShell } from "@/components/office-shell";
import { clearGraphAction, clearTranslatorAction, clearTwilioAction, saveGraphAction, saveSettingsAction, saveTranslatorAction, saveTwilioAction, sendTestEmailAction, sendTestSmsAction, testTranslatorAction } from "@/app/office/settings/actions";
import { getGraphConfig, getTwilioConfig } from "@/lib/messaging/config";
import { getTranslatorConfig } from "@/lib/translate";
import { decryptSecret, maskTail } from "@/lib/secrets";

const TIMEZONES = ["America/New_York", "America/Chicago", "America/Denver", "America/Phoenix", "America/Los_Angeles"];

function configured(keys: string[]) {
  return keys.every((k) => Boolean(process.env[k]));
}

function decryptHint(ciphertext: string | null) {
  return decryptSecret(ciphertext);
}

function Status({ ready, source }: { ready: boolean; source?: string }) {
  return <span className={ready ? "chip chip-ok" : "chip chip-warn"}>{ready ? `Configured · ${source}` : "Not configured"}</span>;
}

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ saved?: string; test?: string; testsms?: string; testtr?: string; error?: string }> }) {
  const user = await requireAdmin();
  const sp = await searchParams;
  const s = await getSettings();
  const twilio = await getTwilioConfig();
  const graph = await getGraphConfig();
  const translator = await getTranslatorConfig();
  const centralReady = configured(["CENTRAL_LOGIN_URL"]) && (configured(["CENTRAL_LOGIN_SECRET"]) || configured(["CENTRAL_LOGIN_PUBLIC_KEY"]));
  const graphMode = s.graphClientSecretEnc ? "secret" : s.graphCertificatePemEnc ? "certificate" : "secret";

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
      {sp.testsms ? <p style={{ color: sp.testsms === "sent" ? "var(--ok)" : "var(--warn)", fontWeight: 600 }}>Test text: {sp.testsms}</p> : null}
      {sp.testtr ? <p style={{ color: sp.testtr.startsWith("failed") ? "var(--warn)" : "var(--ok)", fontWeight: 600 }}>Translator test: {sp.testtr}</p> : null}
      {sp.error ? <p className="error">{sp.error}</p> : null}

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
          <section className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 700 }}>Twilio texting</div>
              <Status ready={Boolean(twilio)} source={twilio?.source} />
            </div>
            <form action={saveTwilioAction} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <label className="field"><span>Account SID</span><input name="twilioAccountSid" defaultValue={s.twilioAccountSid ?? ""} placeholder="AC…" autoComplete="off" /></label>
              <label className="field"><span>Auth token <span className="hint">· {s.twilioAuthTokenEnc ? "on file, leave blank to keep" : "not on file"}</span></span><input name="twilioAuthToken" type="password" autoComplete="new-password" placeholder={s.twilioAuthTokenEnc ? "••••••••" : ""} /></label>
              <label className="field"><span>From number <span className="hint">· E.164, +15551234567</span></span><input name="twilioFromNumber" defaultValue={s.twilioFromNumber ?? ""} placeholder="+1…" /></label>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-primary" type="submit" style={{ height: 34 }}>Save Twilio</button>
                {s.twilioAccountSid ? <button className="btn btn-ghost" type="submit" formAction={clearTwilioAction} style={{ height: 34 }}>Clear</button> : null}
              </div>
            </form>
            <form action={sendTestSmsAction} style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
              <label className="field" style={{ flex: 1 }}><span>Send a test text to</span><input name="to" type="tel" placeholder="+1…" required /></label>
              <button className="btn btn-outline" type="submit" style={{ height: 42 }}>Send</button>
            </form>
            <small style={{ color: "var(--muted)" }}>Texts to workers also need the Send texts switch on. Registration steps: docs/TWILIO_10DLC.md.</small>
          </section>

          <section className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 700 }}>Microsoft 365 email</div>
              <Status ready={Boolean(graph)} source={graph?.source} />
            </div>
            <form action={saveGraphAction} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <label className="field"><span>Sender mailbox</span><input name="graphSender" type="email" defaultValue={s.graphSender ?? ""} placeholder="reviews@ecinc.us" /></label>
              <label className="field"><span>Tenant ID</span><input name="graphTenantId" defaultValue={s.graphTenantId ?? ""} autoComplete="off" /></label>
              <label className="field"><span>Application (client) ID</span><input name="graphClientId" defaultValue={s.graphClientId ?? ""} autoComplete="off" /></label>
              <label className="field"><span>Credential</span>
                <select name="graphMode" defaultValue={graphMode}>
                  <option value="secret">Client secret</option>
                  <option value="certificate">Certificate and private key</option>
                </select>
              </label>
              <label className="field"><span>Client secret <span className="hint">· {s.graphClientSecretEnc ? `on file ${maskTail(decryptHint(s.graphClientSecretEnc))}, leave blank to keep` : "for the client secret option"}</span></span><input name="graphClientSecret" type="password" autoComplete="new-password" /></label>
              <label className="field"><span>Certificate PEM <span className="hint">· {s.graphCertificatePemEnc ? "on file, leave blank to keep" : "for the certificate option"}</span></span><textarea name="graphCertificatePem" rows={3} placeholder="-----BEGIN CERTIFICATE-----" style={{ fontFamily: "monospace", fontSize: 12 }} /></label>
              <label className="field"><span>Private key PEM <span className="hint">· {s.graphPrivateKeyPemEnc ? "on file, leave blank to keep" : ""}</span></span><textarea name="graphPrivateKeyPem" rows={3} placeholder="-----BEGIN PRIVATE KEY-----" style={{ fontFamily: "monospace", fontSize: 12 }} /></label>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-primary" type="submit" style={{ height: 34 }}>Save Microsoft 365</button>
                {s.graphClientId ? <button className="btn btn-ghost" type="submit" formAction={clearGraphAction} style={{ height: 34 }}>Clear</button> : null}
              </div>
            </form>
            <form action={sendTestEmailAction}>
              <button className="btn btn-outline" type="submit" style={{ height: 34 }}>Send a test email to {user.email}</button>
            </form>
            <small style={{ color: "var(--muted)" }}>The app registration needs Mail.Send with admin consent. Steps: docs/MS365_EMAIL.md.</small>
          </section>

          <section className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 700 }}>Translation of typed text</div>
              <Status ready={Boolean(translator)} source={translator?.source} />
            </div>
            <small style={{ color: "var(--muted)" }}>Azure AI Translator. Translates what people type: self-evaluation answers, supervisor comments, goals, worker comments. Form questions and screen text are already stored in both languages. Originals are always kept and shown.</small>
            <form action={saveTranslatorAction} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <label className="field" style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <input type="checkbox" name="translationEnabled" defaultChecked={s.translationEnabled} style={{ width: 16, height: 16 }} /> Translate typed text when a key is on file
              </label>
              <label className="field"><span>Key <span className="hint">· {s.translatorKeyEnc ? "on file, leave blank to keep" : "from the Azure resource, Keys and Endpoint"}</span></span><input name="translatorKey" type="password" autoComplete="new-password" placeholder={s.translatorKeyEnc ? "••••••••" : ""} /></label>
              <label className="field"><span>Region <span className="hint">· for example eastus</span></span><input name="translatorRegion" defaultValue={s.translatorRegion ?? ""} placeholder="eastus" /></label>
              <label className="field"><span>Endpoint <span className="hint">· leave blank for the global endpoint</span></span><input name="translatorEndpoint" defaultValue={s.translatorEndpoint ?? ""} placeholder="https://api.cognitive.microsofttranslator.com" /></label>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-primary" type="submit" style={{ height: 34 }}>Save translator</button>
                {s.translatorKeyEnc ? <button className="btn btn-ghost" type="submit" formAction={clearTranslatorAction} style={{ height: 34 }}>Clear</button> : null}
              </div>
            </form>
            <form action={testTranslatorAction}><button className="btn btn-outline" type="submit" style={{ height: 34 }}>Translate a test sentence to Spanish</button></form>
            <small style={{ color: "var(--muted)" }}>Setup: docs/TRANSLATION.md. Free tier covers two million characters a month.</small>
          </section>

          <section className="card" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 700 }}>Central ECI login</div>
              <span className={centralReady ? "chip chip-ok" : "chip chip-muted"}>{centralReady ? "Configured" : "Off"}</span>
            </div>
            <small style={{ color: "var(--muted)" }}>Set in the server environment when central.ecinc.us is ready. Contract: docs/CENTRAL_LOGIN.md.</small>
          </section>
          <section className="card" style={{ fontSize: 13, color: "#4b5563", lineHeight: 1.5 }}>
            Credentials saved here are encrypted in the database and win over the server environment. Switching the identity check to SSN means every employee needs their last 4 entered on the Employees page before their next link. Workers without it on file cannot open a link.
          </section>
        </div>
      </div>
    </OfficeShell>
  );
}
