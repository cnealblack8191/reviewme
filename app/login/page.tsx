import Image from "next/image";
import { redirect } from "next/navigation";
import { getCurrentUser, homeFor } from "@/lib/auth";
import { centralLoginConfig, centralLoginStartUrl } from "@/lib/central-login";

const errors: Record<string, string> = {
  "missing-credentials": "Enter both email and password.",
  "invalid-credentials": "That email and password were not recognized.",
  "use-central": "Office accounts sign in through ECI Central. Use the button above.",
  "too-many-attempts": "Too many sign-in attempts. Wait 15 minutes and try again, or ask an admin to reset your password.",
  "central-failed": "ECI Central sign-in did not complete. Try again or use your password.",
  "central-no-account": "ECI Central signed you in, but there is no ReviewMe office account for that email. Ask an admin."
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await getCurrentUser();
  if (user) redirect(homeFor(user));

  const params = await searchParams;
  const message = params.error ? errors[params.error] : undefined;
  const central = centralLoginConfig();
  const base = (process.env.APP_BASE_URL ?? "http://127.0.0.1:3010").replace(/\/$/, "");
  const centralUrl = central ? centralLoginStartUrl(`${base}/auth/central`) : null;

  return (
    <main className="login-shell">
      <section className="login-card">
        <Image alt="ECI" src="/eci-logo.png" width={72} height={72} priority />
        <div className="kicker">ReviewMe</div>
        <h1 style={{ fontSize: 24 }}>Sign in</h1>
        {centralUrl ? (
          <>
            <a className="btn btn-dark btn-lg" href={centralUrl}>Sign in with ECI Central</a>
            <small style={{ color: "var(--muted)" }}>Office and admin staff.{central?.required ? "" : " Or use your ReviewMe password below."}</small>
          </>
        ) : null}
        {message ? <p className="error" role="alert">{message}</p> : null}
        <form action="/login/submit" method="post">
          <label className="field">
            <span>Email</span>
            <input autoComplete="username" inputMode="email" name="email" required type="email" />
          </label>
          <label className="field">
            <span>Password</span>
            <input autoComplete="current-password" name="password" required type="password" />
          </label>
          <button className="btn btn-primary btn-lg" type="submit">Continue</button>
        </form>
        <small style={{ color: "var(--muted)" }}>{centralUrl ? "Foremen and managers sign in here with email and password." : "Sign in with your ReviewMe account."}</small>
      </section>
    </main>
  );
}
