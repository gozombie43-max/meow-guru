// Keep job error handling available without loading runtime schemas or polling.
export class TutorJobError extends Error {
  constructor(message: string, public terminal = true) { super(message); }
}
