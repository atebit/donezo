"use client";
/**
 * app/(app)/w/[workspaceSlug]/error.tsx
 *
 * Workspace-segment error boundary. Catches render errors inside a workspace
 * route without destroying the outer app shell (e.g. top-level navigation).
 *
 * Sentry capture is intentionally omitted here — errors bubble up to the
 * parent app/(app)/error.tsx boundary which slice 1A wires to Sentry.
 * This boundary's sole role is to provide a friendly workspace-scoped fallback.
 */
import { Button } from "@/components/ui/button";

export default function WorkspaceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // biome-ignore lint/suspicious/noConsole: error boundary fallback before Sentry wiring
  console.error(error);
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-start justify-center gap-4 p-8">
      <h1 className="text-2xl font-semibold">This workspace errored</h1>
      <p className="text-fg/70">{error.message}</p>
      <Button onClick={reset}>Try again</Button>
    </main>
  );
}
