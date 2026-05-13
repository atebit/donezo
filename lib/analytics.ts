/**
 * Custom event tracking — Vercel Analytics helpers.
 *
 * Custom events: lightweight, for product insight only. Do not use for
 * engineering observability — that is Sentry + Pino.
 *
 * This module wraps the server-side `track` function from
 * `@vercel/analytics/server`. The main `@vercel/analytics` entry point is
 * browser-only; server actions must use the `/server` subpath export.
 *
 * In development (no `VERCEL_URL` set), `track` logs to console and returns
 * immediately — no network call is made.
 */

import { track } from "@vercel/analytics/server";

export type AnalyticsEvent =
  | { name: "board.created"; props: { workspaceId: string; boardId: string } }
  | { name: "task.added"; props: { boardId: string } }
  | { name: "comment.posted"; props: { boardId: string; taskId: string } };

export function trackEvent<E extends AnalyticsEvent>(event: E): void {
  // track() is async on the server but we fire-and-forget to keep server
  // actions non-blocking. Errors are swallowed by the SDK internally.
  void track(event.name, event.props as Record<string, string>);
}
