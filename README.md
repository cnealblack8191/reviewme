# ReviewMe

Employee performance reviews for ECI crews and staff. Its own app, separate from Timex and QC, built on the same stack as the QC app: Next.js
App Router, Prisma, Postgres, deployed on the same EC2 host behind Apache.

## Who uses it

- **Foreman / reviewer, on a phone.** Sees only the reviews they need to
  complete, fills the position's form (items rated 1 to 4, comments, overall
  rating, goals), and taps *Discussed* after the office approves.
- **Worker, by one-time link.** Gets a text or email link to the company site,
  confirms the last 4 of their phone, answers the three self-evaluation
  questions and rates themselves. After approval and the meeting, a second link
  lets them read both sides, comment, and sign or decline.
- **Office, on the desktop.** Adds employees, assigns reviewers and forms, opens
  review periods, sends reminders, approves or sends back, keeps office-only
  notes and the pay block, and downloads or prints PDFs one at a time, by
  reviewer, or for the whole company.

## Run it

```bash
cp .env.example .env      # fill DATABASE_URL, SESSION_SECRET, SEED_ADMIN_PASSWORD
npm install
npm run db:generate
npm run db:push
npm run db:seed           # eight ECI form templates + admin account
npm run dev               # http://127.0.0.1:3010
npm run reminders:run     # daily, from cron, needs CRON_SECRET and APP_BASE_URL
```

## Layout

| Path | What |
|---|---|
| `prisma/schema.prisma` | Data model |
| `prisma/templates.json` | The eight ECI review forms, English and Spanish |
| `prisma/seed.mjs` | Settings, templates, first users |
| `lib/auth.ts` | Session cookie, role guards, password and central sign-in |
| `lib/central-login.ts` | Verifies the ECI Central handoff token |
| `components/supervisor-review-form.tsx` | Offline-capable reviewer form, saves on the phone and syncs |
| `lib/links.ts` | One-time worker links: create, resolve, identity check, lock |
| `lib/reviews.ts` | Review status transitions |
| `lib/messaging/` | Twilio SMS and Microsoft 365 (Graph) email adapters |
| `lib/review-pdf.ts` | Office and employee PDFs, merged export by reviewer or company |
| `lib/reminders.ts` | Daily reminder job, called by `/api/cron/reminders` |
| `lib/i18n.ts` | Worker-facing strings, `en` and `es` |
| `app/me` | Foreman phone home |
| `app/office` | Office desktop, including Users and Settings for admins |
| `app/account/password` | Change password, forced after a temporary password |
| `app/r/[token]` | Worker link: verify, self-evaluation, sign, done |
| `docs/DECISIONS.md` | Every product decision made so far |
| `docs/MS365_EMAIL.md` | Microsoft 365 mail setup |
| `docs/CENTRAL_LOGIN.md` | What central.ecinc.us must send to sign office staff in |
| `docs/TWILIO_10DLC.md` | Twilio registration text and message templates |
