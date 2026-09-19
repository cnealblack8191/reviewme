import Image from "next/image";
import type { Language } from "@prisma/client";

export function WorkerHeader({ token, lang, path }: { token: string; lang: Language; path: string }) {
  const base = `/r/${token}${path}`;
  return (
    <header className="worker-header">
      <div className="brand">
        <Image alt="ECI" src="/eci-logo.png" width={32} height={32} />
        <span>ReviewMe</span>
      </div>
      <nav className="lang-toggle" aria-label="Language">
        <a href={`${base}?lang=EN`} className={lang === "EN" ? "active" : undefined}>English</a>
        <a href={`${base}?lang=ES`} className={lang === "ES" ? "active" : undefined}>Español</a>
      </nav>
    </header>
  );
}
