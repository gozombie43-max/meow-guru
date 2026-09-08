"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode } from "react";
import styles from "./macos.module.css";

const tabs = [
  { href: "/admin/upload", label: "Overview", icon: "🧭", exact: true },
  { href: "/admin/upload/question", label: "Single MCQ", icon: "✍️" },
  { href: "/admin/upload/bulk", label: "Mass Upload", icon: "📑" },
  { href: "/admin/upload/mock-tests", label: "Mock & PYQs", icon: "🎯" },
  { href: "/admin/upload/assets", label: "Assets (ZIP)", icon: "🗂️" },
];

export default function AdminUploadLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className={styles.desktop}>
      <div className={styles.window}>
        {/* Scrollable upload navigation */}
        <div className={styles.navBar}>
          <nav className={styles.segmentedControl} aria-label="Upload Tools Navigation">
            {tabs.map((tab) => {
              const isActive = tab.exact 
                ? pathname === tab.href 
                : pathname === tab.href || pathname?.startsWith(`${tab.href}/`);
              
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`${styles.tabItem} ${isActive ? styles.tabItemActive : ""}`}
                >
                  <span className={styles.tabIcon}>{tab.icon}</span>
                  <span>{tab.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Main Content Area */}
        <main className={styles.windowContent}>
          {children}
        </main>

      </div>
    </div>
  );
}
