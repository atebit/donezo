"use client";
// global-error.tsx catches errors thrown inside app/layout.tsx itself.
// It cannot use any layout chrome (providers, themes) because it replaces
// the entire root layout. Must render its own <html>/<body> shell.
// See: https://nextjs.org/docs/app/api-reference/file-conventions/error#global-errorjs
import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalRootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);
  return (
    <html lang="en">
      <body>
        <main
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            justifyContent: "center",
            minHeight: "100vh",
            maxWidth: "36rem",
            margin: "0 auto",
            padding: "2rem",
            gap: "1rem",
          }}
        >
          <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>Something went wrong</h1>
          <p style={{ opacity: 0.7 }}>{error.message}</p>
          <button
            type="button"
            onClick={reset}
            style={{
              padding: "0.5rem 1rem",
              border: "1px solid currentColor",
              borderRadius: "0.375rem",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
