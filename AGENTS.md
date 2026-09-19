# ReviewMe — working rules

Employee performance reviews for Electrical Contractor Inc. Standalone app: no shared code, database, or login with Timex or QC. Foremen and managers
complete a position-specific review on their phone; workers complete a
self-evaluation through a one-time text or email link; the office approves,
holds the pay block, and exports PDFs.

## Decisions that shape the code

See `docs/DECISIONS.md` for the full record. The ones that bite most often:

- Single company for now. There is a `CompanySettings` row but no tenant column.
- Auth is a session cookie signed with `SESSION_SECRET`, same as the QC app.
  `lib/auth.ts` is the only module that knows how a user is authenticated, so
  the office desktop can move behind the central.ecinc.us login later.
- Review forms are data. `prisma/templates.json` seeds eight templates; never
  hard-code a question or criterion in a component.
- Every worker-facing string has an English and Spanish value. Add both.
- Worker links are single use, expire after `CompanySettings.linkTtlDays`, and
  require the last 4 of the phone (or SSN, by setting) before they open.
- The pay block (`PayBlock`) is office-only. It never renders on a foreman or
  worker route and never appears in a PDF the worker receives.
- Office edits to a foreman's answers keep the old value in `AuditEvent`.

## Required working rules

- Database, session, token, messaging, and PDF code live in server-only modules under `lib/`.
- Authorize every page, route, and action on the server. Foremen see only reviews where they are the supervisor.
- Secrets stay in `.env`, never in source.
- Run `npm run check` before pushing.
