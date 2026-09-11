import { useEffect } from "react";
import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PlayLayout from "./layout";

const state = vi.hoisted(() => ({
  auth: { token: null as string | null, loading: true },
  pathname: "/play",
  router: { replace: vi.fn() },
}));
vi.mock("@/context/AuthContext", () => ({ useAuth: () => state.auth }));
vi.mock("next/navigation", () => ({
  usePathname: () => state.pathname,
  useRouter: () => state.router,
}));

describe("Play authentication boundary", () => {
  beforeEach(() => {
    state.auth = { token: null, loading: true };
    state.pathname = "/play";
    vi.clearAllMocks();
  });
  afterEach(cleanup);

  it("does not mount training requests until session restoration completes", () => {
    const request = vi.fn();
    function Training() {
      useEffect(() => {
        request();
      }, []);
      return <p>Training ready</p>;
    }
    const view = render(
      <PlayLayout>
        <Training />
      </PlayLayout>,
    );
    expect(request).not.toHaveBeenCalled();
    expect(state.router.replace).not.toHaveBeenCalled();
    state.auth = { token: "restored-token", loading: true };
    view.rerender(
      <PlayLayout>
        <Training />
      </PlayLayout>,
    );
    expect(request).not.toHaveBeenCalled();
    state.auth.loading = false;
    view.rerender(
      <PlayLayout>
        <Training />
      </PlayLayout>,
    );
    expect(request).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Training ready")).toBeInTheDocument();
  });

  it.each(["/play", "/play/session/saved-session"])(
    "preserves %s when sign in is required",
    (pathname) => {
      state.pathname = pathname;
      state.auth.loading = false;
      render(
        <PlayLayout>
          <p>Training ready</p>
        </PlayLayout>,
      );
      expect(screen.queryByText("Training ready")).not.toBeInTheDocument();
      expect(state.router.replace).toHaveBeenCalledWith(
        `/login?redirect=${encodeURIComponent(pathname)}`,
      );
    },
  );

  it("removes training controls when the session is lost", () => {
    state.auth = { token: "valid-token", loading: false };
    const view = render(
      <PlayLayout>
        <button>Start training</button>
      </PlayLayout>,
    );
    expect(screen.getByRole("button")).toBeInTheDocument();
    state.auth.token = null;
    view.rerender(
      <PlayLayout>
        <button>Start training</button>
      </PlayLayout>,
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(state.router.replace).toHaveBeenCalled();
  });
});
