/**
 * Daily reminder job. Cron on the server:
 *   15 13 * * *  cd /var/www/reviewme && node --env-file-if-exists=.env scripts/send-reminders.mjs
 * (13:15 UTC is 9:15 a.m. Eastern, inside text quiet hours.)
 * Posts to the app's cron route with CRON_SECRET; the route does the work and returns a summary.
 */
const base = (process.env.APP_BASE_URL ?? "http://127.0.0.1:3010").replace(/\/$/, "");
const secret = process.env.CRON_SECRET;
if (!secret) {
  console.error("CRON_SECRET is not set.");
  process.exit(1);
}
const response = await fetch(`${base}/api/cron/reminders`, { method: "POST", headers: { Authorization: `Bearer ${secret}` } });
const body = await response.json();
console.log(JSON.stringify(body, null, 2));
if (!response.ok) process.exit(1);
