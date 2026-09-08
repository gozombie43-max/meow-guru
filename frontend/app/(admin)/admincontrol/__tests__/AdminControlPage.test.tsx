import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as AuthContextModule from "@/context/AuthContext";
import AdminControlPage from "../page";

const mockReplace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

const adminUser = {
  id: "admin-1",
  name: "Admin User",
  email: "admin@example.com",
  role: "admin",
  progress: {},
  bookmarks: [],
};

const authValue = {
  user: adminUser,
  token: "admin-token",
  login: vi.fn(),
  logout: vi.fn(),
  refreshUser: vi.fn(),
  updateProfile: vi.fn(),
  loading: false,
};

describe("AdminControlPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue(authValue);
  });

  afterEach(() => {
    cleanup();
  });

  it("opens with the Manage filter selected", () => {
    render(<AdminControlPage />);

    const hrefs = screen
      .getAllByRole("link")
      .map((link) => link.getAttribute("href"))
      .filter((href) => href !== "/");

    expect(hrefs).toEqual([
      "/admin",
      "/admin/users",
      "/admin/notifications",
      "/admin/battle-integrity",
    ]);
  });

  it("redirects signed-out visitors to login", () => {
    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
      ...authValue,
      user: null,
      token: null,
    });

    render(<AdminControlPage />);

    expect(mockReplace).toHaveBeenCalledWith("/login");
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("keeps only the requested category filters", () => {
    render(<AdminControlPage />);
    expect(screen.getByRole("link", { name: "Back to app" }).textContent).toBe(
      "",
    );
    expect(screen.queryByRole("searchbox")).toBeNull();
    expect(
      screen.queryByRole("button", {
        name: "Toggle light and dark appearance",
      }),
    ).toBeNull();

    const filters = screen.getByRole("navigation", { name: "Filter tools" });
    expect(screen.queryByRole("link", { name: /Upload studio/ })).toBeNull();
    fireEvent.click(within(filters).getByRole("button", { name: "Manage" }));
    expect(screen.getByRole("link", { name: /Upload studio/ })).toBeDefined();
    fireEvent.click(
      within(filters).getByRole("button", { name: "Create & upload" }),
    );
    expect(screen.queryByRole("link", { name: /Question bank/ })).toBeNull();
  });

  it("redirects non-admin users home", () => {
    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
      ...authValue,
      user: { ...adminUser, role: "user" },
    });

    render(<AdminControlPage />);

    expect(mockReplace).toHaveBeenCalledWith("/");
    expect(screen.queryByRole("link")).toBeNull();
  });
});
