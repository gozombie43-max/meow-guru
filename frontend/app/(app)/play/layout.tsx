"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

/** Render the public mode catalog while its hooks wait for session restoration. */
export default function PlayLayout({ children }: { children: ReactNode }) {
  const { token, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !token) {
      router.replace(
        `/login?redirect=${encodeURIComponent(pathname || "/play")}`,
      );
    }
  }, [loading, token, pathname, router]);

  const restoringHub = loading && pathname === "/play";
  if (!restoringHub && (loading || !token)) {
    return (
      <main className="min-h-dvh p-6" aria-busy="true">
        <p role="status">
          {loading
            ? "Restoring your training session…"
            : "Taking you to sign in…"}
        </p>
      </main>
    );
  }

  return children;
}
