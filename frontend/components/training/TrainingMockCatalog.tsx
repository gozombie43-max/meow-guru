"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import api from "@/shared/api/client";
import { useAuth } from "@/context/AuthContext";
import { fetchCatalog, type CatalogPage } from "@/app/(app)/mock-test/_shared/catalog-cache";
import type { MockTestSlot } from "@/app/(app)/mock-test/_shared/exam-config";

type Paper = {
  id: string;
  title: string;
  year?: number;
  shift?: string;
  tier?: string;
  isPyq?: boolean;
  type?: string;
  hasFixedPaper?: boolean;
};
type Attempt = {
  id: string;
  testId: string;
  status: string;
  submittedAt?: string;
  result?: { totalScore?: number; maxScore?: number; percentage?: number };
};
export default function TrainingMockCatalog({ exam }: { exam: string }) {
  const { loading: authLoading, token } = useAuth();
  const ready = !authLoading && Boolean(token);
  const [loaded, setLoaded] = useState<{
    exam: string;
    papers: Paper[];
    attempts: Attempt[];
    error: string;
  } | null>(null);
  const [filters, setFilters] = useState<{ exam: string; year: string; shift: string }>({
    exam,
    year: "",
    shift: "",
  });
  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    let live = true;
    const slotsKey = `/api/mocktest/${encodeURIComponent(exam)}/slots`;
    Promise.all([
      // Do not attach component-local AbortSignal to globally deduplicated fetchCatalog
      // so StrictMode remounts or concurrent mounts never abort a shared in-flight request.
      fetchCatalog(slotsKey, async (): Promise<CatalogPage> => {
        const res = await api.get(slotsKey);
        const slots = (res.data?.slots || []) as MockTestSlot[];
        return {
          slots,
          metadata: res.data?.metadata ?? { mockCount: 0, pyqCount: 0, tiers: [] },
          total: res.data?.total ?? slots.length,
          nextOffset: null,
        };
      }),
      api.get(`/api/mocktest/${encodeURIComponent(exam)}/history`, { signal: controller.signal }),
    ])
      .then(([catalog, history]) => {
        if (live) {
          setLoaded({
            exam,
            papers: ((catalog.slots || []) as unknown as Paper[]).filter(
              (p: Paper) => p.hasFixedPaper && (p.isPyq || p.type?.toLowerCase() === "pyq"),
            ),
            attempts: history.data.attempts || [],
            error: "",
          });
        }
      })
      .catch(() => {
        if (live && !controller.signal.aborted) {
          setLoaded({
            exam,
            papers: [],
            attempts: [],
            error:
              "Could not load previous papers. Try the full mock catalog below.",
          });
        }
      });
    return () => {
      live = false;
      controller.abort();
    };
  }, [exam, ready]);
  const loading = authLoading || (ready && loaded?.exam !== exam);
  const papers = ready && loaded?.exam === exam ? loaded.papers : [];
  const attempts = ready && loaded?.exam === exam ? loaded.attempts : [];
  const error = ready && loaded?.exam === exam ? loaded.error : "";
  const year = filters.exam === exam ? filters.year : "";
  const shift = filters.exam === exam ? filters.shift : "";
  const setYear = (nextYear: string) => setFilters({ exam, year: nextYear, shift: "" });
  const setShift = (nextShift: string) =>
    setFilters((prev) => ({ exam, year: prev.exam === exam ? prev.year : "", shift: nextShift }));
  const filtered = papers.filter(
    (p) => (!year || String(p.year) === year) && (!shift || p.shift === shift),
  );
  return (
    <section className="training-panel">
      <h2>Previous-year papers</h2>
      <p>
        Choose a complete published paper. Review the instructions for its exact
        marking and timing policy.
      </p>
      {loading ? (
        <p role="status">Loading papers…</p>
      ) : error ? (
        <p role="alert">{error}</p>
      ) : (
        <>
          <div className="training-form">
            <label>
              Year
              <select
                value={year}
                onChange={(e) => {
                  setYear(e.target.value);
                  setShift("");
                }}
              >
                <option value="">All years</option>
                {[...new Set(papers.map((p) => p.year).filter(Boolean))]
                  .sort((a, b) => Number(b) - Number(a))
                  .map((y) => (
                    <option key={y}>{y}</option>
                  ))}
              </select>
            </label>
            <label>
              Shift / slot
              <select value={shift} onChange={(e) => setShift(e.target.value)}>
                <option value="">All shifts</option>
                {[
                  ...new Set(
                    papers
                      .filter((p) => !year || String(p.year) === year)
                      .map((p) => p.shift)
                      .filter(Boolean),
                  ),
                ].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
          </div>
          {!filtered.length ? (
            <div className="training-empty">
              <h3>No complete PYQ paper available for this selection.</h3>
              <p>
                Explore the mock catalog or return when a previous paper is
                published.
              </p>
            </div>
          ) : (
            filtered.map((p) => {
              const past = attempts.filter(
                (a) => a.testId === p.id && a.status === "completed",
              );
              return (
                <div className="training-list-row" key={p.id}>
                  <div>
                    <strong>{p.title}</strong>
                    <p>
                      {[p.tier, p.year, p.shift].filter(Boolean).join(" · ")}
                    </p>
                    {past.length > 0 && (
                      <p>
                        {past.length} previous attempts · latest score{" "}
                        {past[0].result?.totalScore ?? "—"} /{" "}
                        {past[0].result?.maxScore ?? "—"}
                      </p>
                    )}
                  </div>
                  <Link
                    data-ui-button="secondary"
                    href={`/mock-test/${exam}/${p.id}`}
                  >
                    Open paper <ArrowRight size={15} />
                  </Link>
                </div>
              );
            })
          )}
        </>
      )}
      <div className="training-mock-footer">
        <Link data-ui-button="primary" href={`/mock-test/${exam}`}>
          All mocks & papers <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
