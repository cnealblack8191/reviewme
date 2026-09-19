import Image from "next/image";
import type { SessionUser } from "@/lib/types";

const nav = [
  { href: "/office", label: "Reviews" },
  { href: "/office/employees/new", label: "Add employee" },
  { href: "/office/periods", label: "Periods" }
];

export function OfficeShell({ user, active, children }: { user: SessionUser; active: string; children: React.ReactNode }) {
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <Image alt="ECI" src="/eci-logo.png" width={40} height={40} />
          <div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>ReviewMe</div>
            <small>Office</small>
          </div>
        </div>
        <nav>
          {nav.map((item) => (
            <a key={item.href} href={item.href} className={active === item.href ? "active" : undefined}>{item.label}</a>
          ))}
        </nav>
        <div className="user">
          <div>
            <div style={{ fontWeight: 600, color: "#fff" }}>{user.name}</div>
            <small>{user.roles.join(" · ").toLowerCase()}</small>
          </div>
          <a href="/logout" style={{ marginLeft: "auto", color: "#9aa4af", fontSize: 12 }}>Sign out</a>
        </div>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}
