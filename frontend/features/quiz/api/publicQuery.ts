// Only hooks for public, identity-independent question reads opt into this gate.
// Resume initialization remains a separate prerequisite for its session query.
export const PUBLIC_QUESTION_QUERY = { meowPublicQuery: true } as const;
