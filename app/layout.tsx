import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata } from "next";
import { Figtree } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const messages = await getMessages();

  return (
    <html lang="en" suppressHydrationWarning className={cn("font-sans", figtree.variable)}>
      <body className="bg-bg text-fg antialiased">
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider>
            {children}
            <LiveRegion />
            <Toaster />
            <Analytics />
            <SpeedInsights />
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
