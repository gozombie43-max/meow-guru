"use client";

import { Menu } from "lucide-react";
import { useRouter } from "next/navigation";

export default function Home() {

  const router = useRouter();

  const subjects = [
    { name: "MATH", path: "/questions?subject=Math", icon: "➕" },
    { name: "ENGLISH", path: "/questions?subject=English", icon: "📖" },
    { name: "REASONING", path: "/questions?subject=Reasoning", icon: "🧠" },
    { name: "GENERAL AWARENESS", path: "/questions?subject=GA", icon: "🌐" },
  ];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden px-4">

      {/* Menu icon */}
      <div className="absolute top-6 right-6 cursor-pointer">
        <Menu size={30} className="text-slate-500"/>
      </div>

      {/* Title */}
      <h1 className="text-5xl font-bold tracking-wide mb-2 gradient-text" style={{ fontFamily: "'SF Pro Display', 'Helvetica Neue', sans-serif" }}>
        Meow
      </h1>

      <div className="glass-header-badge mb-10">
        Developed by Gurucharan
      </div>

      {/* Liquid Glass Buttons */}
      <div className="flex flex-col gap-6 w-80">

        {subjects.map((sub, i) => (
          <button
            key={i}
            onClick={() => router.push(sub.path)}
            className="liquid-btn"
          >
            <span className="btn-label">{sub.name}</span>
            <span className="btn-icon">{sub.icon}</span>
          </button>
        ))}

      </div>
    </div>
  );
}