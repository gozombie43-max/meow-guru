import { Suspense } from "react";
import EditNoteClient from "./EditNoteClient";

export default function EditNotePage() {
  return (
    <Suspense
      fallback={
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
      }
    >
      <EditNoteClient />
    </Suspense>
  );
}
