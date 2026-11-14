import { notFound } from "next/navigation";
import LiquidGlassText from "@/components/LiquidGlassText";

export default function GlassTestPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  return (
    <main className="min-h-dvh">
      <LiquidGlassText />
    </main>
  );
}
