import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("API_BASE", () => {
  it("defaults browser HTTP requests to the backend proxy", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "");
    const { API_BASE, apiUrl } = await import("./api-base");

    expect(API_BASE).toBe("/backend-api");
    expect(apiUrl("api/questions")).toBe("/backend-api/api/questions");
  });

  it("normalizes a configured API base", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.example.com///");
    const { API_BASE, apiUrl } = await import("./api-base");

    expect(API_BASE).toBe("https://api.example.com");
    expect(apiUrl("/health")).toBe("https://api.example.com/health");
  });
});
