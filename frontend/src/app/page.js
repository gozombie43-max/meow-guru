"use client";

import { Menu } from "lucide-react";
import { useRouter } from "next/navigation";

export default function Home() {

  const router = useRouter();

  const subjects = [
    { name: "MATH", path: "/questions?subject=Math" },
    { name: "ENGLISH", path: "/questions?subject=English" },
    { name: "REASONING", path: "/questions?subject=Reasoning" },
    { name: "GENERAL AWARENESS", path: "/questions?subject=GA" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-300 flex flex-col items-center justify-center">

      {/* Menu icon */}
      <div className="absolute top-6 right-6 cursor-pointer">
        <Menu size={30}/>
      </div>

      {/* Title */}
      <h1 className="text-5xl font-bold tracking-wide mb-2">
        Meow
      </h1>

      <p className="text-gray-600 mb-10">
        Developed by Gurucharan
      </p>

      {/* Buttons */}
      <div className="flex flex-col gap-6 w-80">

        {subjects.map((sub, i) => (
          <button
            key={i}
            onClick={() => router.push(sub.path)}
            className="
              border-2 border-black
              py-4
              text-xl
              font-semibold
              rounded-xl
              bg-white
              hover:bg-black
              hover:text-white
              transition-all
              duration-300
              shadow-md
              hover:scale-105
            "
          >
            {sub.name}
          </button>
        ))}

      </div>
    </div>
  );
}