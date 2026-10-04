import NoteWriteAccess from '@/features/notes/NoteWriteAccess';

export default function NewNoteLayout({ children }: { children: React.ReactNode }) {
  return <NoteWriteAccess>{children}</NoteWriteAccess>;
}
