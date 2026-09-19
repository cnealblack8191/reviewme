import Image from "next/image";
import type { Language } from "@prisma/client";
import { t } from "@/lib/i18n";

export default async function DonePage({ searchParams }: { searchParams: Promise<{ lang?: string; kind?: string }> }) {
  const sp = await searchParams;
  const lang: Language = sp.lang === "ES" ? "ES" : "EN";
  const title = sp.kind === "signed" ? t(lang, "signedTitle") : sp.kind === "declined" ? t(lang, "declinedTitle") : t(lang, "doneTitle");

  return (
    <div className="phone" style={{ background: "#fff" }}>
      <header className="worker-header" style={{ borderBottom: 0 }}>
        <div className="brand"><Image alt="ECI" src="/eci-logo.png" width={32} height={32} /><span>ReviewMe</span></div>
      </header>
      <main className="phone-main" style={{ justifyContent: "center", gap: 18 }}>
        <div style={{ width: 72, height: 72, borderRadius: "50%", background: "var(--ok-soft)", color: "var(--ok)", display: "grid", placeItems: "center", fontSize: 34 }}>✓</div>
        <h1 style={{ fontSize: 28, lineHeight: 1.15 }}>{title}</h1>
        {sp.kind === "self" ? <p style={{ color: "#4b5563", lineHeight: 1.55 }}>{t(lang, "doneBody")}</p> : null}
        <p style={{ color: "var(--muted)", fontSize: 13 }}>{t(lang, "closePage")}</p>
      </main>
    </div>
  );
}
