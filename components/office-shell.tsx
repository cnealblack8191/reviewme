import Image from "next/image";
import { isAdmin, roleLabel, type SessionUser } from "@/lib/types";

const nav = [
  { href: "/office", label: "Reviews" },
  { href: "/office/employees", label: "Employees" },
  { href: "/office/periods", label: "Periods" },
  { href: "/office/users", label: "Users", adminOnly: true },
  { href: "/office/settings", label: "Settings", adminOnly: true }
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
          {nav.filter((item) => !item.adminOnly || isAdmin(user)).map((item) => (
            <a key={item.href} href={item.href} className={active === item.href || (item.href !== "/office" && active.startsWith(item.href)) ? "active" : undefined}>{item.label}</a>
          ))}
        </nav>
        <div className="user">
          <div>
            <div style={{ fontWeight: 600, color: "#fff" }}>{user.name}</div>
            <small>{user.roles.map(roleLabel).join(" · ")}</small>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2, fontSize: 12 }}>
            <a href="/account/password" style={{ color: "#9aa4af" }}>Password</a>
            <a href="/logout" style={{ color: "#9aa4af" }}>Sign out</a>
          </div>
        </div>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}
