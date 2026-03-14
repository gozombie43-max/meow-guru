import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "STUDY WITH GURU",
  description: "START YOUR PREPARATION.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* Ambient background glow blobs */}
        <div className="bg-blob-1" aria-hidden="true" />
        <div className="bg-blob-2" aria-hidden="true" />
        <div className="bg-blob-3" aria-hidden="true" />
        {children}
      </body>
    </html>
  );
}
