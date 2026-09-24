# Product decisions

Recorded 2026-09-16 and 2026-09-17 with Charles Black. Each line is a decision the code depends on.

## Foundations

| # | Topic | Decision |
|---|---|---|
| 1 | Tenancy | Single company now. ReviewMe is its own app and repo, fully separate from Timex (confirmed 2026-09-19). `CompanySettings` holds company switches; a tenant column comes when a second customer signs. |
| 2 | Stack | Mirror the QC app: Next.js App Router, Prisma, Postgres, PM2 behind Apache on the ECI EC2 host. |
| 3 | Login | Reviewers: email and password. Office and Admin: ECI Central handoff by signed token in the redirect (docs/CENTRAL_LOGIN.md), password allowed until `CENTRAL_LOGIN_REQUIRED` is switched on. Decided 2026-09-19. |
| 4 | Roles | Foreman, Project Manager, Senior Manager (reviewer roles), Office, Admin. A user can hold several. Managers review foremen and office staff from the same phone home foremen use. Revised 2026-09-19. |
| 5 | Form | Stored as data (`ReviewTemplate`, `TemplateCriterion`, `TemplateQuestion`). The eight ECI forms are seeded from `prisma/templates.json`. |
| 6 | Form sides | Employee and supervisor rate the same items. Shown side by side to the office and on the sign screen. |
| 7 | Periods | Office opens a named period, twice a year. Opening creates one review per active employee. New hires added during a period get a review. |
| 8 | Links | Single use, 7 days. Identity check is last 4 of phone by default, switchable to last 4 of SSN (stored hashed). Three misses lock the link. |
| 9 | Messaging | Twilio SMS, Microsoft 365 email through Graph (revised 2026-09-19, was SES). Email from day one; SMS after 10DLC registration clears. Both log to `MessageLog` and degrade to "logged, not sent" when unconfigured. |
| 10 | Reminders | Manual send plus a default schedule (workers every 3 days, supervisors weekly) the office can switch off. |
| 11 | Send back | Reopens the supervisor side with a reason the supervisor sees. Office may also edit any field directly; every edit is stamped in `AuditEvent` with the old value. |
| 12 | Signing | Typed name plus drawn signature, timestamp, IP, device. Decline to sign is allowed with a required comment and still closes the review. |
| 13 | Exports | One PDF per review. Bulk by reviewer or whole company is one merged PDF with cover and summary. Completed only unless drafts are included. |
| 14 | Office notes | Office and Admin only. Never in any export. |
| 15 | Language | English and Spanish at launch on every worker-facing screen. Strings in `lib/i18n.ts`; form text carries both languages. |
| 16 | Offline | Supervisor form saves every change on the phone and syncs when signal returns. The page must have loaded once online; no service worker. Built 2026-09-19. |
| 17 | Foremen reviewed | Yes, by a Project Manager or Senior Manager. Every employee has a `reviewerId`; a foreman's reviewer is a manager. |
| 18 | Branding | ReviewMe, ECI logo and colors, for now. |

## From the forms (2026-09-17)

| # | Topic | Decision |
|---|---|---|
| 19 | Scale | Items rated 1 to 4: Unsatisfactory, Fair, Good, Excellent. Supervisor picks the overall 1 to 4; the app shows the average of the items as a hint. |
| 20 | Pay block | Current status and recommendations (pay rates, raise, dates) are office only. Never on a supervisor or worker route, never in the worker's PDF. |
| 21 | Meeting | After office approval the supervisor taps Discussed. Only then does the sign link go out. Worker comments are collected on the sign screen. |
| 22 | Template match | Office picks the review form on the employee record. Position stays free text. |

## Open

- Microsoft 365 shared mailbox: being created by Charles; app registration per docs/MS365_EMAIL.md.
- central.ecinc.us must emit the token in docs/CENTRAL_LOGIN.md.
- Twilio 10DLC: registration in progress (docs/TWILIO_10DLC.md).

## Assumptions to confirm

- IEC year/status is an employee field.
- The paper form's "return it to Eric H." maps to the Office role, no named person.
- Spanish text was machine-translated; a Spanish-speaking foreman should read `prisma/templates.json` once before go-live.

## Permissions (2026-09-19)

- Admin changes company settings. Office edits employees, reassigns reviewers (moves the open review), deactivates.
- Deactivating drops untouched open reviews and voids open links; anything with work in it stays for the record.

## Direct sign-in (2026-09-19)

Until central.ecinc.us is defined, everyone signs in to ReviewMe directly. Admins create accounts on the Users page; each new account gets a temporary password shown once and must choose its own password at first sign-in. Admins can reset a password, change roles, and deactivate. The central handoff stays built and switches on when `CENTRAL_LOGIN_URL` is set.

## Filing and links (2026-09-23)

- A signed or declined review is closed by the office with **Close and file**; closing a period files all of them. A period closes only when every review is finished; an admin can reopen the last closed period.
- Each employee has a review file: history on their page with per-review PDFs and one merged **Review file PDF**.
- The office can send or resend the sign link once a review is approved, and can create a link to send by hand for workers with no phone or email. Any active link can be shown once; reveals are audited.
- Staff login locks an email after 5 failures in 15 minutes and an address after 30, for 15 minutes.
- Twilio and Microsoft 365 credentials are entered on the admin Settings page, encrypted at rest, and win over the environment. The mailbox is a shared mailbox.

## Translation (2026-09-24)

- Fixed text is stored in both languages. Reviewers choose EN or ES on the phone; the choice is saved on their account. The office desktop stays English.
- Typed text is machine translated with Azure AI Translator, key entered on the Settings page, cached per sentence, original always shown beneath the translation with a Machine translated label. Off or unconfigured means originals only.

## Not built yet

Office edit of supervisor answers with attribution (audit table is ready), signed-PDF email to the worker after signing.
