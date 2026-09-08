"use client";

import {
  BellRing,
  ChevronLeft,
  Database,
  LayoutDashboard,
  ShieldCheck,
  Upload,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import styles from "./AdminShell.module.css";

const destinations = [
  { href: "/admincontrol", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/admin", label: "Questions", icon: Database, exact: true },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/notifications", label: "Notifications", icon: BellRing },
  { href: "/admin/battle-integrity", label: "Integrity", icon: ShieldCheck },
  { href: "/admin/upload", label: "Upload", icon: Upload },
] satisfies { href: string; label: string; icon: typeof Upload; exact?: boolean }[];

function getPageTitle(pathname: string) {
  if (pathname === "/admincontrol") return "Admin Control";
  if (pathname === "/admin") return "Question Bank";
  if (pathname.startsWith("/admin/users")) return "Users";
  if (pathname.startsWith("/admin/notifications")) return "Notifications";
  if (pathname.startsWith("/admin/battle-integrity")) return "Battle Integrity";
  if (pathname.startsWith("/admin/upload-image")) return "Image Mapper";
  if (pathname.startsWith("/admin/upload/question")) return "Single MCQ";
  if (pathname.startsWith("/admin/upload/bulk")) return "Bulk Questions";
  if (pathname.startsWith("/admin/upload/mock-tests")) return "Mock Tests & PYQs";
  if (pathname.startsWith("/admin/upload/assets")) return "ZIP Assets";
  if (pathname.startsWith("/admin/upload")) return "Upload Studio";
  return "Admin";
}

export default function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const title = getPageTitle(pathname);

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.titlebar}>
          <Link
            href={pathname === "/admincontrol" ? "/" : "/admincontrol"}
            className={styles.back}
            aria-label={pathname === "/admincontrol" ? "Back to app" : "Back to Admin Control"}
          >
            <ChevronLeft size={22} strokeWidth={2.25} aria-hidden="true" />
            <span>{pathname === "/admincontrol" ? "App" : "Admin"}</span>
          </Link>
          <h1>{title}</h1>
          <span className={styles.status} aria-label="Secure admin workspace">
            <ShieldCheck size={17} aria-hidden="true" />
          </span>
        </div>

        <nav className={styles.nav} aria-label="Admin sections">
          {destinations.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                href={href}
                key={href}
                className={active ? styles.active : undefined}
                aria-current={active ? "page" : undefined}
              >
                <Icon size={15} aria-hidden="true" />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
      </header>

      <div className={styles.scroller} id="admin-scroll-region">
        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
}
