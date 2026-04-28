import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AuraSci",
  description:
    "Milestone-based open science funding infrastructure powered by AI Agents.",
};

// Minimal pass-through. Real pages live as static HTML in /public,
// each carrying their own <html>/<body>/<nav> markup.
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
