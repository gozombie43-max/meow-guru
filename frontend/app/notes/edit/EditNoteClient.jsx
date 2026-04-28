"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import NoteEditor from "../components/NoteEditor";
import { fetchWithRetry } from "@/lib/api/http";

const API = process.env.NEXT_PUBLIC_API_URL;

export default function EditNoteClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const noteId = searchParams.get("id");
  const [note, setNote] = useState(null);

  useEffect(() => {
    if (!noteId) return;
    fetchWithRetry(`${API}/api/notes/${noteId}`)
      .then((r) => r.json())
      .then(setNote)
      .catch(() => alert("Failed to load note."));
  }, [noteId]);

  if (!noteId) {
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
        Missing note id.
      </div>
    );
  }

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
        Loading note...
      </div>
    );
  }

  return <NoteEditor initialNote={note} onSaved={() => router.push("/notes")} />;
}
