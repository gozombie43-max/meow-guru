import NoteWriteAccess from '@/features/notes/NoteWriteAccess';

export default function EditNoteLayout({ children }: { children: React.ReactNode }) {
  return <NoteWriteAccess>{children}</NoteWriteAccess>;
}
