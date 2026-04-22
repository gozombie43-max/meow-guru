// app/notes/edit/[id]/page.jsx
import EditNoteClient from "./EditNoteClient";

export const dynamicParams = false;

export async function generateStaticParams() {
  return [];
}

export default function EditNotePage({ params }) {
  return <EditNoteClient id={params.id} />;
}