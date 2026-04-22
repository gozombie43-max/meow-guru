// app/notes/page.jsx
"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL;

const TYPE_COLORS = {
  formula: { bg: "#12122a", border: "#63b3ed", label: "📐 Formula" },
  tip:     { bg: "#1a2a1a", border: "#38a169", label: "💡 Tip"     },
  note:    { bg: "#1a1a2e", border: "#805ad5", label: "📝 Note"    },
};

export default function NotesPage() {
  const router = useRouter();
  const [notes,        setNotes]        = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [filterTopic,  setFilterTopic]  = useState("");
  const [filterType,   setFilterType]   = useState("");
  const [deleting,     setDeleting]     = useState(null);
  const [search,       setSearch]       = useState("");

  const fetchNotes = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterTopic) params.append("topic", filterTopic);
      if (filterType)  params.append("type",  filterType);
      const res  = await fetch(`${API}/api/notes?${params}`);
      const data = await res.json();
      setNotes(data);
    } catch {
      alert("Failed to load notes.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchNotes(); }, [filterTopic, filterType]);

  const handleDelete = async (id) => {
    if (!confirm("Delete this note?")) return;
    setDeleting(id);
    try {
      await fetch(`${API}/api/notes/${id}`, { method: "DELETE" });
      setNotes((prev) => prev.filter((n) => n.id !== id));
    } finally {
      setDeleting(null);
    }
  };

  // client-side search filter
  const visible = notes.filter((n) =>
    n.title?.toLowerCase().includes(search.toLowerCase()) ||
    n.topic?.toLowerCase().includes(search.toLowerCase()) ||
    n.tags?.some((t) => t.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div style={s.root}>

      {/* Header */}
      <div style={s.header}>
        <div>
          <h1 style={s.heading}>📚 My Notes</h1>
          <p style={s.sub}>{notes.length} note{notes.length !== 1 ? "s" : ""} saved</p>
        </div>
        <button style={s.newBtn} onClick={() => router.push("/notes/new")}>
          + New Note
        </button>
      </div>

      {/* Filters */}
      <div style={s.filterBar}>
        <input
          style={s.searchInput}
          placeholder="🔍 Search title, topic, tags…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <input
          style={s.filterInput}
          placeholder="Filter by topic"
          value={filterTopic}
          onChange={(e) => setFilterTopic(e.target.value)}
        />
        <select
          style={s.select}
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
        >
          <option value="">All types</option>
          <option value="note">📝 Note</option>
          <option value="formula">📐 Formula</option>
          <option value="tip">💡 Tip & Trick</option>
        </select>
        {(filterTopic || filterType || search) && (
          <button
            style={s.clearBtn}
            onClick={() => { setFilterTopic(""); setFilterType(""); setSearch(""); }}
          >
            ✕ Clear
          </button>
        )}
      </div>

      {/* Notes grid */}
      {loading ? (
        <div style={s.empty}>Loading…</div>
      ) : visible.length === 0 ? (
        <div style={s.empty}>
          No notes found.{" "}
          <span
            style={{ color: "#63b3ed", cursor: "pointer" }}
            onClick={() => router.push("/notes/new")}
          >
            Create one →
          </span>
        </div>
      ) : (
        <div style={s.grid}>
          {visible.map((note) => {
            const color = TYPE_COLORS[note.type] || TYPE_COLORS.note;
            return (
              <div key={note.id} style={{ ...s.card, background: color.bg, borderColor: color.border }}>
                {/* Type badge */}
                <span style={{ ...s.badge, borderColor: color.border, color: color.border }}>
                  {color.label}
                </span>

                {/* Title */}
                <h2 style={s.cardTitle}>{note.title}</h2>

                {/* Topic */}
                {note.topic && (
                  <p style={s.cardTopic}>📌 {note.topic}</p>
                )}

                {/* Tags */}
                {note.tags?.length > 0 && (
                  <div style={s.tagRow}>
                    {note.tags.map((t) => (
                      <span key={t} style={s.tag}>{t}</span>
                    ))}
                  </div>
                )}

                {/* Date */}
                <p style={s.cardDate}>
                  {note.updatedAt
                    ? `Updated ${new Date(note.updatedAt).toLocaleDateString()}`
                    : `Created ${new Date(note.createdAt).toLocaleDateString()}`}
                </p>

                {/* Actions */}
                <div style={s.cardActions}>
                  <button
                    style={s.editBtn}
                    onClick={() => router.push(`/notes/edit/${note.id}`)}
                  >
                    ✏️ Edit
                  </button>
                  <button
                    style={s.deleteBtn}
                    onClick={() => handleDelete(note.id)}
                    disabled={deleting === note.id}
                  >
                    {deleting === note.id ? "…" : "🗑 Delete"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const s = {
  root: {
    minHeight:   "100vh",
    background:  "#0d1117",
    color:       "#e2e8f0",
    fontFamily:  "'Segoe UI', sans-serif",
    padding:     "2rem",
  },
  header: {
    display:        "flex",
    justifyContent: "space-between",
    alignItems:     "center",
    marginBottom:   "1.5rem",
  },
  heading: { fontSize: "1.8rem", fontWeight: 700, color: "#e2e8f0" },
  sub:     { fontSize: "0.85rem", color: "#8b949e", marginTop: 4 },
  newBtn: {
    background:   "#238636",
    border:       "1px solid #2ea043",
    borderRadius: 8,
    color:        "#fff",
    padding:      "8px 20px",
    fontSize:     14,
    fontWeight:   600,
    cursor:       "pointer",
  },
  filterBar: {
    display:      "flex",
    gap:          10,
    marginBottom: "1.5rem",
    flexWrap:     "wrap",
    alignItems:   "center",
  },
  searchInput: {
    flex:         1,
    minWidth:     200,
    background:   "#161b22",
    border:       "1px solid #30363d",
    borderRadius: 8,
    color:        "#e2e8f0",
    padding:      "8px 14px",
    fontSize:     14,
    outline:      "none",
  },
  filterInput: {
    background:   "#161b22",
    border:       "1px solid #30363d",
    borderRadius: 8,
    color:        "#e2e8f0",
    padding:      "8px 14px",
    fontSize:     14,
    outline:      "none",
    width:        160,
  },
  select: {
    background:   "#161b22",
    border:       "1px solid #30363d",
    borderRadius: 8,
    color:        "#e2e8f0",
    padding:      "8px 14px",
    fontSize:     14,
    cursor:       "pointer",
  },
  clearBtn: {
    background:   "transparent",
    border:       "1px solid #30363d",
    borderRadius: 8,
    color:        "#8b949e",
    padding:      "8px 14px",
    fontSize:     13,
    cursor:       "pointer",
  },
  grid: {
    display:             "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
    gap:                 "1.25rem",
  },
  card: {
    border:       "1px solid",
    borderRadius: 14,
    padding:      "1.25rem",
    display:      "flex",
    flexDirection: "column",
    gap:          8,
    transition:   "transform 0.15s, box-shadow 0.15s",
    cursor:       "default",
  },
  badge: {
    display:      "inline-block",
    border:       "1px solid",
    borderRadius: 99,
    fontSize:     11,
    padding:      "2px 10px",
    fontWeight:   600,
    width:        "fit-content",
  },
  cardTitle: {
    fontSize:   "1.1rem",
    fontWeight: 700,
    color:      "#e2e8f0",
    margin:     0,
  },
  cardTopic: { fontSize: 13, color: "#8b949e", margin: 0 },
  tagRow:    { display: "flex", flexWrap: "wrap", gap: 6 },
  tag: {
    background:   "#21262d",
    border:       "1px solid #30363d",
    borderRadius: 99,
    fontSize:     11,
    padding:      "2px 8px",
    color:        "#c9d1d9",
  },
  cardDate:    { fontSize: 12, color: "#6e7681", marginTop: "auto" },
  cardActions: { display: "flex", gap: 8, marginTop: 4 },
  editBtn: {
    flex:         1,
    background:   "#1f6feb",
    border:       "none",
    borderRadius: 6,
    color:        "#fff",
    padding:      "6px 0",
    fontSize:     13,
    cursor:       "pointer",
    fontWeight:   600,
  },
  deleteBtn: {
    background:   "#21262d",
    border:       "1px solid #30363d",
    borderRadius: 6,
    color:        "#f85149",
    padding:      "6px 12px",
    fontSize:     13,
    cursor:       "pointer",
  },
  empty: {
    textAlign:  "center",
    color:      "#8b949e",
    marginTop:  "4rem",
    fontSize:   16,
  },
};