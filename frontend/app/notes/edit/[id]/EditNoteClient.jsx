"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import NoteEditor from "../../components/NoteEditor";

const API = process.env.NEXT_PUBLIC_API_URL;

export default function EditNoteClient({ id }) {
  const router = useRouter();
  const [note, setNote] = useState(null);

  useEffect(() => {
    if (!id) return;
    fetch(`${API}/api/notes/${id}`)
      .then((r) => r.json())
      .then(setNote)
      .catch(() => alert("Failed to load note."));
  }, [id]);

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
