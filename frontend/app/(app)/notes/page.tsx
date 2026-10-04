"use client";
import type { Note } from "@/features/notes/types";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { BookOpen, FileText, Pencil, Plus, Trash2 } from "lucide-react";
import { fetchWithRetry } from "@/lib/api/http";
import { API_BASE as API } from "@/lib/api-base";
import styles from "./notes.module.css";
import { useAuth } from '@/context/AuthContext';
import { canManageNotes } from '@/features/notes/permissions';

const TYPE_LABELS = { formula: "Formula", tip: "Tip & trick", note: "Note" };

export default function NotesPage() {
  const { user, loading: authLoading } = useAuth();
  const canWrite = !authLoading && canManageNotes(user?.role);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTopic, setFilterTopic] = useState("");
  const [filterType, setFilterType] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  const fetchNotes = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (filterTopic.trim()) params.set("topic", filterTopic.trim());
      if (filterType) params.set("type", filterType);
      const response = await fetchWithRetry(`${API}/api/notes?${params}`, { signal });
      if (!response.ok) throw new Error("Unable to load notes");
      const data: unknown = await response.json();
      if (!Array.isArray(data)) throw new Error("Invalid notes response");
      if (!signal?.aborted) setNotes(data);
    } catch {
      if (!signal?.aborted) setError("Your notes could not be loaded. Please try again.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [filterTopic, filterType]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void fetchNotes(controller.signal), 150);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [fetchNotes]);

  const handleDelete = async (id: string) => {
    if (!canWrite) return;
    if (!confirm("Delete this note?")) return;
    setDeleting(id);
    try {
      const response = await fetchWithRetry(`${API}/api/notes/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Delete failed");
      setNotes(previous => previous.filter(note => note.id !== id));
    } catch {
      setError("This note could not be deleted. Please try again.");
    } finally { setDeleting(null); }
  };

  const query = search.trim().toLowerCase();
  const visible = notes.filter(note => [note.title, note.topic, ...(note.tags ?? [])].some(value => value?.toLowerCase().includes(query)));
  const filtered = Boolean(filterTopic || filterType || search);
  const clearFilters = () => { setFilterTopic(""); setFilterType(""); setSearch(""); };

  return (
    <main className={styles.page}>
      <div className={styles.content}>
        <header className={styles.header}>
          <div><h1>My notes</h1><p>Your revision library</p></div>
          {canWrite && <Link href="/notes/new" data-ui-button="primary"><Plus size={18} aria-hidden="true" />New note</Link>}
        </header>
        <div className={styles.filters} role="search" aria-label="Find notes">
          <input type="search" placeholder="Search title, topic or tags" aria-label="Search notes" value={search} onChange={event => setSearch(event.target.value)} />
          <input placeholder="Filter by topic" aria-label="Filter by topic" value={filterTopic} onChange={event => setFilterTopic(event.target.value)} />
          <select aria-label="Note type" value={filterType} onChange={event => setFilterType(event.target.value)}>
            <option value="">All types</option><option value="note">Notes</option><option value="formula">Formulas</option><option value="tip">Tips & tricks</option>
          </select>
          {filtered && <button data-ui-button="secondary" onClick={clearFilters}>Clear filters</button>}
        </div>
        {error && <section className={styles.empty} role="alert"><h2>Something needs attention</h2><p>{error}</p><button data-ui-button="secondary" onClick={() => void fetchNotes()}>Try again</button></section>}
        {loading ? <p className={styles.summary} role="status">Loading your notes…</p> : !error && visible.length === 0 ? (
          <section className={styles.empty}>
            <BookOpen size={32} aria-hidden="true" />
            <h2>{filtered ? "No matching notes" : "Make room for your next idea"}</h2>
            <p>{filtered ? "Try a different search or clear your filters to see your library." : "Keep formulas, useful shortcuts and topic notes together for your next revision."}</p>
            {filtered ? <button data-ui-button="secondary" onClick={clearFilters}>Clear filters</button> : canWrite ? <Link href="/notes/new" data-ui-button="primary">Create your first note</Link> : null}
          </section>
        ) : !error && (
          <>
            <p className={styles.summary} aria-live="polite">{visible.length} {visible.length === 1 ? "note" : "notes"}{filtered ? " matching your filters" : " in your library"}</p>
            <div className={styles.grid}>
              {visible.map(note => (
                <article key={note.id} className={styles.card}>
                  <span className={styles.badge}><FileText size={14} aria-hidden="true" />{TYPE_LABELS[note.type] || "Note"}</span>
                  <h2><Link href={`/notes/view?id=${encodeURIComponent(note.id)}`}>{note.title || "Untitled note"}</Link></h2>
                  {note.topic && <p className={styles.meta}>{note.topic}</p>}
                  {!!note.tags?.length && <div className={styles.tags}>{note.tags.map(tag => <span key={tag}>{tag}</span>)}</div>}
                  {(note.updatedAt || note.createdAt) && <p className={styles.meta}>Updated {new Date(note.updatedAt || note.createdAt!).toLocaleDateString()}</p>}
                  {canWrite && <div className={styles.actions}>
                    <Link data-ui-button="secondary" href={`/notes/edit?id=${encodeURIComponent(note.id)}`}><Pencil size={16} aria-hidden="true" />Edit</Link>
                    <button data-ui-button="icon" aria-label={`Delete ${note.title || "note"}`} onClick={() => void handleDelete(note.id)} disabled={deleting !== null}><Trash2 size={18} aria-hidden="true" /></button>
                  </div>}
                </article>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
