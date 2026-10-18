"use client";

import {
  BellRing,
  ChevronLeft,
  Database,
  Files,
  LayoutDashboard,
  ShieldCheck,
  Upload,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useExamMode } from "@/context/ExamModeContext";
import ExamModeSwitch from "@/components/ExamModeSwitch";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import styles from "./AdminShell.module.css";

const destinations = [
  { href: "/admincontrol", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/admin", label: "Questions", icon: Database, exact: true },
  { href: "/admin/mock-pyq", label: "Mock & Pyq", icon: Files },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/notifications", label: "Notifications", icon: BellRing },
  { href: "/admin/battle-integrity", label: "Integrity", icon: ShieldCheck },
  { href: "/admin/upload", label: "Upload", icon: Upload },
] satisfies { href: string; label: string; icon: typeof Upload; exact?: boolean }[];

export default function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();
  const { mode } = useExamMode();
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
    else if (!isAdmin) router.replace("/");
  }, [isAdmin, loading, router, user]);

  if (loading || !isAdmin) return null;

  return (
    <div className={styles.shell}>
      <header data-ui-chrome="header" className={styles.header}>
        <div className={styles.headerLayout}>
          <Link replace
            href={pathname === "/admincontrol" ? "/" : "/admincontrol"}
            className={styles.back}
            aria-label={pathname === "/admincontrol" ? "Back to app" : "Back to Admin Control"}
          >
            <ChevronLeft size={22} strokeWidth={2.25} aria-hidden="true" />
            <span>{pathname === "/admincontrol" ? "App" : "Admin"}</span>
          </Link>
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
          <div className={styles.modeControl}><ExamModeSwitch compact /></div>
        </div>
      </header>

      <div className={styles.scroller} id="admin-scroll-region">
        <div key={mode} className={styles.content}>{children}</div>
      </div>
    </div>
  );
}
