"use client";

import styles from "./BattleIntegrity.module.css";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  BattleIntegrityEvent,
  BattleIntegritySummary,
  fetchBattleIntegrityEvents,
  fetchBattleIntegritySummary,
  reviewBattleIntegrityEvent,
} from "@/lib/api/battleIntegrityApi";
import { AnalyticsTemplate } from "@/design-system";

export default function BattleIntegrityPage() {
  const [summary, setSummary] = useState<BattleIntegritySummary | null>(null);
  const [events, setEvents] = useState<BattleIntegrityEvent[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busyIds, setBusyIds] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");
  const busyRef = useRef<Set<string>>(new Set());
  const loadingMoreRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const [nextSummary, nextEvents] = await Promise.all([
        fetchBattleIntegritySummary(),
        fetchBattleIntegrityEvents({ page: 1 }),
      ]);
      setSummary(nextSummary);
      setEvents(nextEvents.items);
      setHasMore(Boolean(nextEvents.hasMore));
      setPage(1);
    } catch {
      setError("Could not load integrity signals.");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const loadMore = async () => {
    if (loadingMoreRef.current || !hasMore) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    setError("");
    const nextPage = page + 1;
    try {
      const nextEvents = await fetchBattleIntegrityEvents({ page: nextPage });
      setEvents((prev) => [...prev, ...nextEvents.items]);
      setHasMore(Boolean(nextEvents.hasMore));
      setPage(nextPage);
    } catch {
      setError("Could not load more integrity signals.");
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  };

  const review = async (id: string, status: "reviewed" | "dismissed" | "escalated") => {
    if (busyRef.current.has(id)) return;
    busyRef.current.add(id);
    setBusyIds((prev) => ({ ...prev, [id]: true }));
    setError("");
    try {
      await reviewBattleIntegrityEvent(id, status);
      await load();
    } catch {
      setError("Could not save the review decision.");
    } finally {
      busyRef.current.delete(id);
      setBusyIds((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  const heroSection = (
    <div>
      <h1 className="text-2xl font-black">Battle Integrity</h1>
      <p className="mt-1 text-sm text-[var(--admin-text-secondary)]">
        Signals require human review. They do not automatically affect accounts or ratings.
      </p>
    </div>
  );

  const kpisSection = (
    <div className="grid gap-3 sm:grid-cols-3">
      {[
        ["Open signals", summary?.openSignals],
        ["High severity", summary?.highSeverity],
        ["Flagged players", summary?.flaggedPlayers],
      ].map(([label, value]) => (
        <div key={String(label)} className={styles.card}>
          <div className="text-xs font-bold uppercase tracking-wide text-[var(--admin-text-secondary)]">{label}</div>
          <div className="mt-1 text-2xl font-black">{value ?? "—"}</div>
        </div>
      ))}
    </div>
  );

  return (
    <AnalyticsTemplate
      hero={heroSection}
      kpis={kpisSection}
      kpiColumns={3}
      showNavRail={false}
      showBottomNav={false}
      showSkipLink={false}
    >
      <div className={styles.page}>
        {error && <p role="alert" className="mb-4 text-sm text-rose-600">{error}</p>}
        <div className="space-y-3">
          {events.map((event) => {
            const isBusy = Boolean(busyIds[event._id]);
            return (
              <article key={event._id} className={styles.card}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <span
                      className={`mr-2 rounded px-2 py-1 text-xs font-black ${
                        event.severity === "high"
                          ? "bg-rose-100 text-rose-700"
                          : event.severity === "medium"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {event.severity.toUpperCase()}
                    </span>
                    <span className="font-bold">{event.signalType.replaceAll("-", " ")}</span>
                    <p className="mt-2 text-sm text-[var(--admin-text-secondary)]">
                      Player {event.userId}
                      {event.opponentUserId ? ` ↔ ${event.opponentUserId}` : ""}
                      {event.roomCode ? ` · Room ${event.roomCode}` : ""}
                    </p>
                    <pre className="mt-2 overflow-auto text-xs text-[var(--admin-text-secondary)]">
                      {JSON.stringify(event.details)}
                    </pre>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      data-ui-button="state"
                      disabled={isBusy}
                      aria-busy={isBusy}
                      onClick={() => void review(event._id, "reviewed")}
                      className="rounded border px-3 py-1.5 text-sm disabled:opacity-50"
                    >
                      Review
                    </button>
                    <button
                      type="button"
                      data-ui-button="state"
                      disabled={isBusy}
                      aria-busy={isBusy}
                      onClick={() => void review(event._id, "escalated")}
                      className="rounded bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      Escalate
                    </button>
                    <button
                      type="button"
                      data-ui-button="state"
                      disabled={isBusy}
                      aria-busy={isBusy}
                      onClick={() => void review(event._id, "dismissed")}
                      className="rounded border px-3 py-1.5 text-sm disabled:opacity-50"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
          {hasMore && (
            <div className="pt-2">
              <button
                type="button"
                data-ui-button="secondary"
                disabled={loadingMore}
                aria-busy={loadingMore}
                onClick={() => void loadMore()}
                className="rounded border px-4 py-2 text-sm font-semibold disabled:opacity-50"
              >
                {loadingMore ? "Loading…" : "Load more"}
              </button>
            </div>
          )}
          {!events.length && !error && (
            <p className="text-sm text-[var(--admin-text-secondary)]">No open integrity signals.</p>
          )}
        </div>
      </div>
    </AnalyticsTemplate>
  );
}
