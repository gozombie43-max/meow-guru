// app/notes/edit/[id]/page.jsx
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import NoteEditor from "../../components/NoteEditor";

const API = process.env.NEXT_PUBLIC_API_URL;

export function generateStaticParams() {
  // Required for static export — actual data loads client-side
  return [];
}

export default function EditNotePage() {
  const router = useRouter();
  const [note, setNote] = useState(null);
  const [id, setId] = useState(null);

  useEffect(() => {
    // Get id from URL since params may not resolve immediately in static export
    const segments = window.location.pathname.split("/");
    const noteId = segments[segments.indexOf("edit") + 1];
    setId(noteId);

    fetch(`${API}/api/notes/${noteId}`)
      .then((r) => r.json())
      .then(setNote)
      .catch(() => alert("Failed to load note."));
  }, []);

  if (!note) {
    return (
      <div
        style={{
          background: "#0d1117",
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#8b949e",
          fontFamily: "Segoe UI, sans-serif",
          fontSize: 16,
        }}
      >
        Loading note…
      </div>
    );
  }

  return <NoteEditor initialNote={note} onSaved={() => router.push("/notes")} />;
}