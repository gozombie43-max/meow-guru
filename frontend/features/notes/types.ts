export interface Note {
  id: string; title: string; body: string; type: 'note' | 'formula' | 'tip'; topic?: string;
  tags?: string[]; createdAt?: string; updatedAt?: string;
}
export interface NoteImageResponse { url: string; error?: string }
