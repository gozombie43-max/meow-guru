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
        {/* Titlebar with Traffic Lights */}
        <div className={styles.titlebar}>
          <div className={styles.trafficLights}>
            <span className={`${styles.trafficLight} ${styles.trafficLightClose}`} title="Close" />
            <span className={`${styles.trafficLight} ${styles.trafficLightMin}`} title="Minimize" />
            <span className={`${styles.trafficLight} ${styles.trafficLightMax}`} title="Zoom" />
          </div>
          
          <div className={styles.windowTitle}>
            <span>Studio</span>
            <span>/</span>
            <span>Upload Central</span>
            <span className={styles.windowTitleBadge}>Admin</span>
          </div>

          <div className={styles.titlebarActions}>
            <Link href="/admin" className={styles.adminLinkBtn}>
              <span>📦</span>
              <span>Question Bank</span>
            </Link>
          </div>
        </div>

        {/* macOS Segmented Tab Navigation Bar */}
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

        {/* macOS Window Status Footer */}
        <div className={styles.windowFooter}>
          <div className={styles.statusIndicator}>
            <span className={styles.statusDot} />
            <span>Ready · Cloud Engine Active</span>
          </div>
          <div>macOS Sonoma Native Interface</div>
        </div>
      </div>
    </div>
  );
}
