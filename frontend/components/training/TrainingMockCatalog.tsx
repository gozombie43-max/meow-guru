"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import api from "@/lib/axios";

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
  const [papers, setPapers] = useState<Paper[]>([]),
    [attempts, setAttempts] = useState<Attempt[]>([]),
    [year, setYear] = useState(""),
    [shift, setShift] = useState(""),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    Promise.all([
      api.get(`/api/mocktest/${exam}/slots`),
      api.get(`/api/mocktest/${exam}/history`),
    ])
      .then(([catalog, history]) => {
        if (live) {
          setPapers(
            (catalog.data.slots || []).filter(
              (p: Paper) => p.hasFixedPaper && (p.isPyq || p.type === "pyq"),
            ),
          );
          setAttempts(history.data.attempts || []);
        }
      })
      .catch(() => {
        if (live)
          setError(
            "Could not load previous papers. Try the full mock catalog below.",
          );
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [exam]);
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
