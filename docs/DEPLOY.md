# Deploying ReviewMe

Same host and pattern as the QC app: Next.js under PM2 on `127.0.0.1:3010`,
Apache in front with TLS, Postgres for data. Node 22.9 or newer (`.nvmrc`).

## First time

1. **DNS and certificate.** Point `reviewme.ecinc.us` at the EC2 host, then
   `sudo certbot certonly --apache -d reviewme.ecinc.us`.
2. **Database.** Create an empty database and a user that owns it:
   ```sql
   CREATE USER reviewme WITH PASSWORD '...';
   CREATE DATABASE reviewme OWNER reviewme;
   ```
3. **Code.** `sudo git clone <repo> /var/www/reviewme` and give the app user ownership.
4. **Environment.** `cp .env.example .env` and fill it in. The app refuses to
   start in production unless all of these are right:
   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | `postgresql://reviewme:...@localhost:5432/reviewme` |
   | `SESSION_SECRET` | 32+ random characters: `openssl rand -base64 48` |
   | `APP_BASE_URL` | `https://reviewme.ecinc.us` (worker links are built from it) |
   | `COOKIE_SECURE` | `true` |

   Also set `CRON_SECRET` (`openssl rand -hex 32`) for reminders, and
   `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` for the first admin. Leave
   `SEED_DEMO_PASSWORD` empty; the seed ignores it in production anyway.
   `chmod 600 .env`.

   `SESSION_SECRET` also encrypts saved worker links, and (unless
   `APP_ENCRYPTION_KEY` is set) the Twilio and Microsoft 365 credentials saved
   on the Settings page. Changing it signs everyone out, breaks links already
   sent, and means re-entering those credentials. Set it once.
5. **Apache.** Copy `deploy/apache/reviewme.ecinc.us.conf` to
   `/etc/apache2/sites-available/`, then
   `sudo a2enmod ssl proxy proxy_http headers && sudo a2ensite reviewme.ecinc.us && sudo systemctl reload apache2`.
6. **Deploy.** `cd /var/www/reviewme && deploy/deploy.sh`. It installs, applies
   migrations, seeds, builds, starts PM2 and checks `/api/health`.
   Run `pm2 startup` once if PM2 is not already set to start on boot.
7. **Sign in** as the seed admin. After the first sign-in, blank
   `SEED_ADMIN_PASSWORD` in `.env`. The seed only ever creates that account, so
   leaving it set does no harm, but it doesn't need to sit there either.
8. **Reminders.** `crontab -e` as the app user:
   ```
   15 13 * * *  cd /var/www/reviewme && node --env-file-if-exists=.env scripts/send-reminders.mjs >> /var/log/reviewme-reminders.log 2>&1
   ```
9. **Messaging.** Enter Twilio and Microsoft 365 on the admin Settings page
   (docs/TWILIO_10DLC.md, docs/MS365_EMAIL.md). Until then, messages are logged, not sent.

## Every update

```bash
cd /var/www/reviewme && deploy/deploy.sh
```

The seed runs on every deploy. It adds missing settings, syncs form text from
`prisma/templates.json`, and creates the admin only if that account doesn't
exist yet. It never changes an existing user.

## Schema changes

Migrations live in `prisma/migrations` and `deploy.sh` applies them with
`prisma migrate deploy`. In development, change `prisma/schema.prisma` and run
`npm run db:migrate -- --name what-changed`, then commit the new migration
folder. Don't use `db:push` against production.

A database that was set up earlier with `db:push` already has the tables. Mark
the baseline as applied once, before the first `deploy.sh`:

```bash
npx prisma migrate resolve --applied 0_init
```

## Checks

- `curl https://reviewme.ecinc.us/api/health` returns `"database":"ok"`. It
  returns 503 when Postgres is unreachable.
- `pm2 logs reviewme`. If the configuration is wrong, the server log names
  every missing or weak variable.
- Backups: include the `reviewme` database in the host's nightly `pg_dump`.
  Signatures and all review data live only there.
