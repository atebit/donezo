import type { ErrorEvent, EventHint } from "@sentry/nextjs";

/**
 * `beforeSend` hook used by all three Sentry configs (client, server, edge).
 *
 * Strips PII from the Sentry event's `user` context: only the opaque `id`
 * field is forwarded. `email` and `name` are removed so they never leave the
 * server boundary. Add any additional PII fields here as the app grows.
 */
export function scrubUserPII(event: ErrorEvent, _hint: EventHint): ErrorEvent {
  if (event.user) {
    const { id } = event.user;
    event.user = id !== undefined ? { id } : {};
  }
  return event;
}
