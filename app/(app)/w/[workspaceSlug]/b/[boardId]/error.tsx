"use client";
// Board-segment error boundary — so a board crash doesn't destroy the sidebar.
// Narrows error scope to the board route without unmounting workspace chrome.
import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function BoardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error, { tags: { boundary: "board" } });
  }, [error]);
  return (
    <main className="mx-auto flex min-h-[50vh] max-w-xl flex-col items-start justify-center gap-4 p-8">
      <h1 className="text-2xl font-semibold">This board encountered an error</h1>
      <p className="text-fg/70">{error.message}</p>
      <Button onClick={reset}>Try again</Button>
    </main>
  );
}
