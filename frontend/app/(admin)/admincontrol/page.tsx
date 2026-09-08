"use client";

import { useAuth } from "@/context/AuthContext";
import {
  BellRing,
  Boxes,
  ChevronRight,
  FileJson,
  FileQuestion,
  ImageUp,
  ListChecks,
  PackageOpen,
  ShieldCheck,
  Upload,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AdminControlSkeleton from "./AdminControlSkeleton";
import styles from "./AdminControlPage.module.css";

type AdminRoute = {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
};

type AdminRouteGroup = {
  title: string;
  description: string;
  routes: AdminRoute[];
};

const ADMIN_ROUTE_GROUPS: AdminRouteGroup[] = [
  {
    title: "Manage",
    description: "Monitor the platform and manage day-to-day operations.",
    routes: [
      {
        href: "/admin",
        title: "Question bank",
        description: "Search, filter, edit, and maintain questions.",
        icon: FileQuestion,
      },
      {
        href: "/admin/users",
        title: "Users",
        description: "Review accounts, roles, status, and user activity.",
        icon: Users,
      },
      {
        href: "/admin/notifications",
        title: "Notifications",
        description: "Send broadcasts and review notification operations.",
        icon: BellRing,
      },
      {
        href: "/admin/battle-integrity",
        title: "Battle integrity",
        description: "Review competitive-play signals and decisions.",
        icon: ShieldCheck,
      },
    ],
  },
  {
    title: "Create & upload",
    description: "Add questions, tests, and supporting media.",
    routes: [
      {
        href: "/admin/upload",
        title: "Upload studio",
        description: "Open the complete content-upload workspace.",
        icon: Upload,
      },
      {
        href: "/admin/upload/question",
        title: "Single MCQ",
        description: "Create one question with answers and metadata.",
        icon: ListChecks,
      },
      {
        href: "/admin/upload/bulk",
        title: "Bulk questions",
        description: "Import and validate NDJSON question batches.",
        icon: FileJson,
      },
      {
        href: "/admin/upload/mock-tests",
        title: "Mock tests & PYQs",
        description: "Create and maintain full exam papers.",
        icon: Boxes,
      },
      {
        href: "/admin/upload/assets",
        title: "ZIP assets",
        description: "Upload question and solution image archives.",
        icon: PackageOpen,
      },
      {
        href: "/admin/upload-image",
        title: "Image MCQ mapper",
        description: "Mark answer regions on visual questions.",
        icon: ImageUp,
      },
    ],
  },
];

export default function AdminControlPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState<
    AdminRouteGroup["title"] | null
  >("Manage");
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";
  const groups = activeFilter
    ? ADMIN_ROUTE_GROUPS.filter((group) => group.title === activeFilter)
    : ADMIN_ROUTE_GROUPS;
  const toggleFilter = (filter: AdminRouteGroup["title"]) => {
    setActiveFilter((current) => (current === filter ? null : filter));
  };

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace("/login");
    } else if (!isAdmin) {
      router.replace("/");
    }
  }, [isAdmin, loading, router, user]);

  if (loading || !isAdmin) {
    return <AdminControlSkeleton />;
  }

  return (
    <div className={styles.page}>
      <main className={styles.content}>
            <header className={styles.header}>
              <span className={styles.eyebrow}>YOUR WORKSPACE, SIMPLIFIED</span>
              <h1>
                Admin Control<span>.</span>
              </h1>
              <p>A little more control. A lot less searching.</p>
            </header>
            <nav className={styles.segments} aria-label="Filter tools">
              {["Manage", "Create & upload"].map((filter) => (
                <button
                  key={filter}
                  aria-pressed={activeFilter === filter}
                  onClick={() =>
                    toggleFilter(filter as AdminRouteGroup["title"])
                  }
                >
                  {filter}
                </button>
              ))}
            </nav>
            <div className={styles.groups}>
              {groups.map((group) => (
                <section className={styles.group} key={group.title}>
                  <div className={styles.groupHeading}>
                    <h2>{group.title}</h2>
                    <p>{group.description}</p>
                  </div>

                  <div className={styles.grid}>
                    {group.routes.map((route) => {
                      const Icon = route.icon;

                      return (
                        <Link
                          className={styles.card}
                          href={route.href}
                          key={route.href}
                          data-tool={route.href.split("/").pop()}
                        >
                          <span className={styles.icon} aria-hidden="true">
                            <Icon size={22} strokeWidth={2} />
                          </span>
                          <span className={styles.cardCopy}>
                            <strong>{route.title}</strong>
                            <span>{route.description}</span>
                          </span>
                          <ChevronRight
                            className={styles.arrow}
                            size={20}
                            aria-hidden="true"
                          />
                        </Link>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
            <footer className={styles.footer}>
              <ShieldCheck size={14} aria-hidden="true" />
              <span>Meow Guru · Admin workspace</span>
              <span className={styles.footerHint}>
                Choose a tool to get started
              </span>
            </footer>
      </main>
    </div>
  );
}
