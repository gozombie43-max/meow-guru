// These unverified claims only invalidate local state. They never authorize it.
export function authSessionIdentity(token: string | null) {
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload.id && payload.sid ? JSON.stringify([payload.id, payload.sid]) : token;
  } catch { return token; }
}
