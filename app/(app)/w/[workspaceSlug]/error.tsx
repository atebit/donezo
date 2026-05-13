"use client";
import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function WorkspaceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error, { tags: { boundary: "workspace" } });
  }, [error]);
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-start justify-center gap-4 p-8">
      <h1 className="text-2xl font-semibold">This workspace errored</h1>
      <p className="text-fg/70">{error.message}</p>
      <Button onClick={reset}>Try again</Button>
    </main>
  );
}
