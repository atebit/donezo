/**
 * lib/email/send.ts
 *
 * Central sendEmail helper. All transactional email goes through here.
 *
 * Behaviour:
 *   - RESEND_API_KEY unset → logs the envelope, returns { skipped: true, reason: 'no-api-key' }.
 *   - EMAIL_SAFE_LIST set and recipient not in it → returns { skipped: true, reason: 'safe-list-miss' }.
 *   - Otherwise → calls Resend and returns { id: string }.
 *
 * The safe-list is a comma-separated list of email addresses and is intended as a
 * preview-deploy guard so we never accidentally email real users from a PR deploy.
 */

import type { ReactElement } from "react";
import { Resend } from "resend";
import { logger } from "@/lib/logger";

// Env is read at call time (not module load) so tests can override process.env.
function getApiKey(): string | undefined {
  return process.env.RESEND_API_KEY;
}
function getEmailFrom(): string {
  return process.env.EMAIL_FROM ?? "Donezo <noreply@donezo.app>";
}
function getSafeList(): string[] | null {
  const raw = process.env.EMAIL_SAFE_LIST;
  if (!raw) return null;
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export type SendEmailResult =
  | { id: string }
  | { skipped: true; reason: "no-api-key" | "safe-list-miss" };

export async function sendEmail({
  to,
  subject,
  react,
  tag,
}: {
  to: string;
  subject: string;
  react: ReactElement;
  tag?: string;
}): Promise<SendEmailResult> {
  const apiKey = getApiKey();
  const from = getEmailFrom();

  // Dev / preview guard — log and skip if no API key.
  if (!apiKey) {
    logger.info(
      { to, subject, tag, from },
      "[sendEmail] would-send envelope (RESEND_API_KEY not set — skipping actual send)",
    );
    return { skipped: true, reason: "no-api-key" };
  }

  // Preview-deploy guard — safe-list check.
  const safeList = getSafeList();
  if (safeList !== null && !safeList.includes(to.toLowerCase())) {
    logger.debug(
      { to, subject, tag, safeList },
      "[sendEmail] recipient not in EMAIL_SAFE_LIST — skipping",
    );
    return { skipped: true, reason: "safe-list-miss" };
  }

  const resend = new Resend(apiKey);
  const sendOptions = {
    from,
    to,
    subject,
    react,
    ...(tag ? { tags: [{ name: "kind", value: tag }] } : {}),
  };
  const { data, error } = await resend.emails.send(sendOptions);

  if (error || !data) {
    const errMessage = error?.message ?? "unknown Resend error";
    logger.error({ to, subject, tag, error }, `[sendEmail] Resend error: ${errMessage}`);
    throw new Error(`[sendEmail] Resend error: ${errMessage}`);
  }

  logger.info({ to, subject, tag, id: data.id }, "[sendEmail] sent");
  return { id: data.id };
}
