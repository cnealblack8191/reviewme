import Image from "next/image";
import { redirect } from "next/navigation";
import { getCurrentUser, homeFor } from "@/lib/auth";

const errors: Record<string, string> = {
  "missing-credentials": "Enter both email and password.",
  "invalid-credentials": "That email and password were not recognized."
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await getCurrentUser();
  if (user) redirect(homeFor(user));

  const params = await searchParams;
  const message = params.error ? errors[params.error] : undefined;

  return (
    <main className="login-shell">
      <section className="login-card">
        <Image alt="ECI" src="/eci-logo.png" width={72} height={72} priority />
        <div className="kicker">ReviewMe</div>
        <h1 style={{ fontSize: 24 }}>Sign in</h1>
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
        <small style={{ color: "var(--muted)" }}>Office accounts move to the central ECI login soon.</small>
      </section>
    </main>
  );
}
