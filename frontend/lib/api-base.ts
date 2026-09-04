const configuredApiBase = process.env.NEXT_PUBLIC_API_URL?.trim();

export const API_BASE = (configuredApiBase || "/backend-api").replace(/\/+$/, "");

export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE}${normalizedPath}`;
}
