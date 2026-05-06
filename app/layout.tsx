import type { Metadata } from "next";
// TODO Slice B: mount <Toaster /> from "@/components/ui/sonner" once Slice B installs shadcn/sonner
import "./globals.css";

export const metadata: Metadata = {
  title: "Donezo",
  description: "Project and task management.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-bg text-fg antialiased">{children}</body>
    </html>
  );
}
