import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

// Fonts: system stacks defined in globals.css — no next/font/google, no
// build-time network fetch, no vendored font files (Codex review, J6).

export const metadata: Metadata = {
  title: {
    default: "MissionPilot",
    template: "%s · MissionPilot",
  },
  description:
    "AI-assisted opportunity intelligence for senior freelancers, under human supervision.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="h-full antialiased">
      <body className="flex min-h-full flex-col font-sans">
        <a
          href="#main"
          className="bg-background text-foreground sr-only rounded-md px-3 py-2 focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50"
        >
          Skip to main content
        </a>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
