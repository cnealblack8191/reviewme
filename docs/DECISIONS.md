# Product decisions

Recorded 2026-09-16 and 2026-09-17 with Charles Black. Each line is a decision the code depends on.

## Foundations

| # | Topic | Decision |
|---|---|---|
| 1 | Tenancy | Single company now. ReviewMe is its own app and repo, fully separate from Timex (confirmed 2026-09-19). `CompanySettings` holds company switches; a tenant column comes when a second customer signs. |
| 2 | Stack | Mirror the QC app: Next.js App Router, Prisma, Postgres, PM2 behind Apache on the ECI EC2 host. |
| 3 | Login | Email and password now. The office desktop moves behind the central.ecinc.us login soon; `lib/auth.ts` is the swap point. |
| 4 | Roles | Foreman, Office, Admin. A user can hold several. |
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
| 16 | Offline | Supervisor form saves locally and syncs when back online. (Not yet built: the skeleton autosaves to the server on Save.) |
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

- Role names beyond Foreman, Office, Admin: to be confirmed later.
- Microsoft 365 sender mailbox and app registration: to be created (docs/MS365_EMAIL.md).
- Twilio 10DLC: registration in progress (docs/TWILIO_10DLC.md).

## Assumptions to confirm

- IEC year/status is an employee field.
- The paper form's "return it to Eric H." maps to the Office role, no named person.
- Spanish text was machine-translated; a Spanish-speaking foreman should read `prisma/templates.json` once before go-live.

## Not built yet

PDF generation and bulk export, automated reminder delivery, offline save for supervisors, office edit of supervisor answers, employee edit page, settings page, central.ecinc.us login.
