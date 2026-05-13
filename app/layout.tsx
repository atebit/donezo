import type { Metadata } from "next";
import { Figtree } from "next/font/google";
import { LiveRegion } from "@/components/shared/a11y/LiveRegion";
import { ThemeProvider } from "@/components/shared/theme/ThemeProvider";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import "./globals.css";

const figtree = Figtree({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-figtree",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Donezo",
  description: "Project and task management.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={cn("font-sans", figtree.variable)}>
      <body className="bg-bg text-fg antialiased">
        <ThemeProvider>
          {children}
          <LiveRegion />
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
