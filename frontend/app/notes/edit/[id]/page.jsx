// app/notes/edit/[id]/page.jsx
"use client";
import { useEffect, useState } from "react";
import { useParams }           from "next/navigation";
import NoteEditor              from "../../components/NoteEditor";
import { useRouter }           from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL;

export default function EditNotePage() {
  const { id }   = useParams();
  const router   = useRouter();
  const [note, setNote] = useState(null);

  useEffect(() => {
    fetch(`${API}/api/notes/${id}`)
      .then((r) => r.json())
      .then(setNote)
      .catch(() => alert("Failed to load note."));
  }, [id]);

  if (!note) {
    return (
      <div style={{ background: "#0d1117", height: "100vh", display: "flex",
        alignItems: "center", justifyContent: "center", color: "#8b949e",
        fontFamily: "Segoe UI, sans-serif", fontSize: 16 }}>
        Loading note…
      </div>
    );
  }

  return (
    <NoteEditor
      initialNote={note}
      onSaved={() => router.push("/notes")}
    />
  );
}