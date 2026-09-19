import Image from "next/image";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { changePasswordAction } from "@/app/account/password/actions";

const errors: Record<string, string> = {
  mismatch: "The two new passwords do not match.",
  short: "Use at least 12 characters.",
  current: "Your current password was not recognized.",
  same: "Choose a password different from the temporary one."
};

export default async function ChangePasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { error } = await searchParams;

  return (
    <main className="login-shell">
      <section className="login-card">
        <Image alt="ECI" src="/eci-logo.png" width={72} height={72} priority />
        <div className="kicker">ReviewMe</div>
        <h1 style={{ fontSize: 22 }}>{user.mustChangePassword ? "Choose your password" : "Change your password"}</h1>
        <p style={{ margin: 0, fontSize: 14, color: "var(--muted)" }}>
          {user.mustChangePassword ? "You signed in with a temporary password. Pick your own to continue." : `Signed in as ${user.email}.`}
        </p>
        {error ? <p className="error" role="alert">{errors[error] ?? error}</p> : null}
        <form action={changePasswordAction}>
          {!user.mustChangePassword ? (
            <label className="field"><span>Current password</span><input name="current" type="password" autoComplete="current-password" required /></label>
          ) : null}
          <label className="field"><span>New password <span className="hint">· at least 12 characters</span></span><input name="next" type="password" autoComplete="new-password" minLength={12} required /></label>
          <label className="field"><span>New password again</span><input name="confirm" type="password" autoComplete="new-password" minLength={12} required /></label>
          <button className="btn btn-primary btn-lg" type="submit">Save password</button>
        </form>
        {!user.mustChangePassword ? <a href="/" style={{ fontSize: 13 }}>Back</a> : <a href="/logout" style={{ fontSize: 13, color: "var(--muted)" }}>Sign out instead</a>}
      </section>
    </main>
  );
}
