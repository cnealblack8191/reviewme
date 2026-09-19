# Microsoft 365 email for ReviewMe

ReviewMe sends worker links, reminders, and copies of signed reviews from a
Microsoft 365 mailbox through the Graph API. It is the same method the ECI QC
app uses, so the tenant already has one working example to copy.

## One-time setup in Entra ID (Azure AD)

1. **Mailbox.** Create or pick the sender, for example `reviews@ecinc.us`.
   A shared mailbox works and needs no license for sending through Graph.
2. **App registration.** Entra ID → App registrations → New registration →
   name `ReviewMe Mail`, single tenant, no redirect URI.
3. **Permission.** API permissions → Add → Microsoft Graph → Application
   permissions → `Mail.Send` → Grant admin consent.
4. **Certificate.** On the server:
   ```bash
   openssl req -x509 -newkey rsa:2048 -nodes -days 730 \
     -keyout /etc/reviewme/graph.key -out /etc/reviewme/graph.crt \
     -subj "/CN=reviewme-mail"
   chmod 600 /etc/reviewme/graph.key
   ```
   Upload `graph.crt` under Certificates & secrets → Certificates.
5. **Limit the sender.** Without this step the app could send as any mailbox in
   the tenant. In Exchange Online PowerShell:
   ```powershell
   New-ApplicationAccessPolicy -AppId <client id> -PolicyScopeGroupId reviews@ecinc.us `
     -AccessRight RestrictAccess -Description "ReviewMe may only send as reviews@ecinc.us"
   Test-ApplicationAccessPolicy -AppId <client id> -Identity reviews@ecinc.us
   ```
6. **Environment.** Fill the five `MICROSOFT_GRAPH_*` values in `.env`.

## How the app uses it

`lib/messaging/ms365.ts` builds a certificate-signed client assertion, trades it
for a token, caches the token, and posts to `/users/{sender}/sendMail`. When any
of the five variables is empty the adapter returns `skipped:ms365-not-configured`
and the message is still written to `MessageLog`, so the app runs before the
mailbox exists.

## What the worker receives

Plain-text email, subject in the worker's language, one link, expiry date, and
a line saying the link is private and works once. No attachments until the
signed PDF export exists.
