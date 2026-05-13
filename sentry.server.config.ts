// NOTE: This file uses process.env directly (not @/lib/env) to keep the
// bootstrap chain short — Sentry must initialise before any other module.
import * as Sentry from "@sentry/nextjs";
import { scrubUserPII } from "@/lib/sentry/scrub";

Sentry.init({
  dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!(process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN),
  environment: process.env.VERCEL_ENV ?? "development",
  release: process.env.NEXT_PUBLIC_BUILD_SHA,
  tracesSampleRate: 0.1,
  beforeSend: scrubUserPII,
  ignoreErrors: [
    // Realtime auto-reconnect noise
    "supabase: WebSocket closed",
    // Server-action expected refusals
    /^FORBIDDEN/,
    /^NOT_FOUND/,
  ],
});
