"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, ArrowUpRight, LoaderCircle, Moon, Sun, Swords } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useThemeMode } from "@/hooks/useTheme";
import useSWR from "swr";
import type { ReactNode } from "react";
import {
  DashboardTemplate,
  AnalyticsTemplate,
  ListingTemplate,
} from "@/design-system";
import "./sections.css";

const pages = ["Profile", "Leaderboard", "Missions", "Social"];

export function useBattleResource<T>(key: string, fetcher: () => Promise<T>) {
  const { token, user } = useAuth();
  return useSWR<T>(token && user ? [key, user.id] : null, fetcher, { revalidateOnFocus: false });
}

export interface BattleSectionProps {
  title: string;
  description: string;
  children?: ReactNode;
  loading?: boolean;
  error?: boolean;
  retry?: () => void;
  template?: "dashboard" | "analytics" | "listing";
  hero?: ReactNode;
  kpis?: ReactNode;
  aside?: ReactNode;
  filters?: ReactNode;
  actions?: ReactNode;
}

export function BattleSection({
  title,
  description,
  children,
  loading,
  error,
  retry,
  template = "dashboard",
  hero,
  kpis,
  aside,
  filters,
  actions,
}: BattleSectionProps) {
  const pathname = usePathname();
  const { user, loading: authLoading } = useAuth();
  const { theme, toggleThemeMode } = useThemeMode();

  const headerNode = (
    <header data-ui-chrome="header" className="bs-header">
      <div className="bs-header-inner">
        <Link replace href="/battle" className="bs-back" aria-label="Back to battle">
          <ArrowLeft size={20} />
        </Link>
        <Link href="/battle" className="bs-brand">
          <Swords size={19} />
          Battle arena
        </Link>
        <button
          data-ui-button="state"
          data-ui-shape="icon"
          className="bs-theme"
          onClick={toggleThemeMode}
          aria-label={theme === "dark" ? "Use light theme" : "Use dark theme"}
        >
          {theme === "dark" ? <Sun size={19} /> : <Moon size={19} />}
        </button>
      </div>
    </header>
  );

  const mainBody = (
    <div className="bs-page">
      <main className="bs-scroll-body">
        <div className="bs-content">
          <div className="bs-heading">
            <div>
              <p className="bs-eyebrow">YOUR ARENA</p>
              <h1>{title}</h1>
              <p>{description}</p>
            </div>
            <Link className="bs-play" href="/battle">
              Play a battle <ArrowUpRight size={17} />
            </Link>
          </div>
          <nav className="bs-nav" aria-label="Battle pages">
            {pages.map((page) => (
              <Link
                key={page}
                href={`/battle/${page.toLowerCase()}`}
                aria-current={pathname === `/battle/${page.toLowerCase()}` ? "page" : undefined}
              >
                {page}
              </Link>
            ))}
          </nav>
          {authLoading ? (
            <Empty title="Preparing your arena…" loading />
          ) : !user ? (
            <Empty
              title="Sign in to see your battle activity"
              detail="Your rank, missions, and friends are linked to your account."
            >
              <Link data-ui-button="secondary" className="bs-button" href="/login">
                Sign in
              </Link>
            </Empty>
          ) : error ? (
            <Empty
              title="Could not load this page"
              detail="Please try again. Your battle progress is saved."
            >
              <button data-ui-button="secondary" className="bs-button" onClick={retry}>
                Try again
              </button>
            </Empty>
          ) : loading ? (
            <Empty title="Loading your battle activity…" loading />
          ) : (
            children
          )}
        </div>
      </main>
    </div>
  );

  if (template === "analytics") {
    return (
      <AnalyticsTemplate
        header={headerNode}
        hero={hero}
        kpis={kpis}
        breakdown={filters}
        actions={actions}
        showBottomNav={false}
        showNavRail={false}
      >
        {mainBody}
      </AnalyticsTemplate>
    );
  }

  if (template === "listing") {
    return (
      <ListingTemplate
        header={headerNode}
        intro={hero}
        filters={filters}
        columns={1}
        showBottomNav={false}
        showNavRail={false}
      >
        {mainBody}
      </ListingTemplate>
    );
  }

  return (
    <DashboardTemplate
      header={headerNode}
      hero={hero}
      primaryMetrics={kpis}
      aside={aside}
      showBottomNav={false}
      showNavRail={false}
    >
      {mainBody}
    </DashboardTemplate>
  );
}

export function Panel({ title, aside, children, className = "" }: { title: string; aside?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={`bs-panel ${className}`}><div className="bs-panel-heading"><h2>{title}</h2>{aside}</div>{children}</section>;
}
export function Empty({ title, detail, loading, children }: { title: string; detail?: string; loading?: boolean; children?: ReactNode }) {
  return <div className="bs-empty" role={loading ? "status" : undefined}>{loading && <LoaderCircle className="bs-spinner" size={22} />}<p>{title}</p>{detail && <small>{detail}</small>}{children}</div>;
}
export function Stats({ items }: { items: { label: string; value: ReactNode }[] }) {
  return <dl className="bs-stats">{items.map(item => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl>;
}
export function Progress({ value, label }: { value: number; label: string }) {
  const percent = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
  return <div className="bs-progress" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percent)}><i style={{ width: `${percent}%` }} /></div>;
}
export function Avatar({ name }: { name: string }) { return <span className="bs-avatar" aria-hidden="true">{name.trim().charAt(0).toUpperCase() || "?"}</span>; }
