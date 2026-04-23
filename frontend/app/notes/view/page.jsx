"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

function NoteViewContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [note, setNote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const noteId = searchParams.get("id");

  useEffect(() => {
    if (!noteId) {
      setError("Missing note id.");
      setLoading(false);
      return;
    }

    const loadNote = async () => {
      try {
        setLoading(true);
        setError("");

        const res = await fetch(`${API}/api/notes/${noteId}`);
        if (!res.ok) {
          throw new Error("Failed to load note.");
        }

        const data = await res.json();
        setNote(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load note.");
      } finally {
        setLoading(false);
      }
    };

    loadNote();
  }, [noteId]);

  if (loading) {
    return (
      <div style={styles.stateShell}>
        <p style={styles.stateText}>Loading note...</p>
      </div>
    );
  }

  if (error || !note) {
    return (
      <div style={styles.stateShell}>
        <p style={styles.stateText}>{error || "Note not found."}</p>
        <button type="button" style={styles.backButton} onClick={() => router.back()}>
          Back
        </button>
      </div>
    );
  }

  return (
    <>
      <main className="note-view-page" style={styles.page}>
        <button
          type="button"
          className="note-view-back"
          style={styles.backButton}
          onClick={() => router.back()}
        >
          Back
        </button>
        <header className="note-view-header" style={styles.header}>
          <button type="button" style={styles.backButton} onClick={() => router.back()}>
            Back
          </button>
          <div style={styles.headerText}>
            <h1 style={styles.title}>{note.title || "Untitled Note"}</h1>
            <p style={styles.subtitle}>{note.topic || "Formula note"}</p>
          </div>
        </header>

        <section className="note-view-card" style={styles.viewerCard}>
          <iframe
            className="note-view-frame"
            title={note.title || "Note preview"}
            srcDoc={note.body || "<p>No HTML content found for this note.</p>"}
            sandbox="allow-scripts"
            style={styles.iframe}
          />
        </section>
      </main>

      <style jsx>{`
        .note-view-page {
          min-height: 100svh;
          height: 100svh;
          display: flex;
          flex-direction: column;
          padding: 20px;
          overflow: hidden;
        }

        .note-view-back {
          position: fixed;
          top: calc(16px + env(safe-area-inset-top));
          left: 16px;
          z-index: 6;
          display: none;
          box-shadow: 0 10px 24px rgba(0, 0, 0, 0.35);
        }

        .note-view-header {
          max-width: 1200px;
          width: 100%;
          margin: 0 auto 16px;
        }

        .note-view-card {
          max-width: 1200px;
          width: 100%;
          margin: 0 auto;
          border: 1px solid #30363d;
          border-radius: 16px;
          overflow: hidden;
          flex: 1;
          min-height: 0;
        }

        .note-view-frame {
          width: 100%;
          height: 100%;
        }

        @media (max-width: 768px) {
          .note-view-page {
            padding: 0;
          }

          .note-view-header {
            display: none;
          }

          .note-view-back {
            display: inline-flex;
            align-items: center;
          }

          .note-view-card {
            margin: 0;
            border-radius: 0;
            border: 0;
          }
        }
      `}</style>
    </>
  );
}

export default function NoteViewPage() {
  return (
    <Suspense
      fallback={
        <div style={styles.stateShell}>
          <p style={styles.stateText}>Loading note...</p>
        </div>
      }
    >
      <NoteViewContent />
    </Suspense>
  );
}

const styles = {
  page: {
    background: "#0d1117",
    color: "#e2e8f0",
    fontFamily: "'Segoe UI', sans-serif",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
  },
  headerText: {
    minWidth: 0,
  },
  title: {
    margin: 0,
    fontSize: "1.25rem",
    fontWeight: 700,
  },
  subtitle: {
    margin: "4px 0 0",
    color: "#8b949e",
    fontSize: "0.9rem",
  },
  viewerCard: {
    background: "#111827",
    boxShadow: "0 18px 40px rgba(0, 0, 0, 0.28)",
    display: "flex",
    flex: 1,
    minHeight: 0,
  },
  iframe: {
    display: "block",
    width: "100%",
    border: "none",
    background: "#ffffff",
    flex: 1,
  },
  backButton: {
    border: "1px solid #30363d",
    background: "#161b22",
    color: "#e2e8f0",
    borderRadius: "10px",
    padding: "10px 14px",
    cursor: "pointer",
    fontSize: "0.9rem",
  },
  stateShell: {
    minHeight: "100vh",
    background: "#0d1117",
    color: "#e2e8f0",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "12px",
    fontFamily: "'Segoe UI', sans-serif",
  },
  stateText: {
    margin: 0,
    color: "#8b949e",
    fontSize: "1rem",
  },
};
