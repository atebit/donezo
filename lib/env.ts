import { z } from "zod";

// Server-only env vars are inlined as `undefined` in the client bundle, so the
// production-only refines below would always fail on the browser. They are only
// meaningful on the server, where the values actually exist.
const onServer = typeof window === "undefined";

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
    NEXT_PUBLIC_SITE_URL: z.string().url(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
    // Email (Resend + React Email)
    RESEND_API_KEY: z.string().min(1).optional(),
    EMAIL_FROM: z.string().min(1).optional(),
    EMAIL_SAFE_LIST: z.string().optional(),
    // Cron + webhook auth
    INTERNAL_CRON_SECRET: z.string().min(32).optional(),
    SUPABASE_DB_WEBHOOK_SECRET: z.string().min(32).optional(),
    // Observability
    SENTRY_DSN: z.string().url().optional(),
    NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
    SENTRY_AUTH_TOKEN: z.string().min(1).optional(),
    SENTRY_ORG: z.string().min(1).optional(),
    SENTRY_PROJECT: z.string().min(1).optional(),
  })
  .refine(
    (data) =>
      !onServer ||
      data.NODE_ENV !== "production" ||
      (data.RESEND_API_KEY !== undefined && data.RESEND_API_KEY.length > 0),
    { message: "RESEND_API_KEY is required in production", path: ["RESEND_API_KEY"] },
  )
  .refine(
    (data) =>
      !onServer ||
      data.NODE_ENV !== "production" ||
      (data.INTERNAL_CRON_SECRET !== undefined && data.INTERNAL_CRON_SECRET.length >= 32),
    {
      message: "INTERNAL_CRON_SECRET (min 32 chars) is required in production",
      path: ["INTERNAL_CRON_SECRET"],
    },
  )
  .refine(
    (data) =>
      !onServer ||
      data.NODE_ENV !== "production" ||
      (data.SUPABASE_DB_WEBHOOK_SECRET !== undefined &&
        data.SUPABASE_DB_WEBHOOK_SECRET.length >= 32),
    {
      message: "SUPABASE_DB_WEBHOOK_SECRET (min 32 chars) is required in production",
      path: ["SUPABASE_DB_WEBHOOK_SECRET"],
    },
  )
  .refine(
    (data) => {
      // In production, NEXT_PUBLIC_SENTRY_DSN and SENTRY_AUTH_TOKEN must both
      // be set or both be absent — one without the other is a misconfiguration.
      // SENTRY_AUTH_TOKEN is server-only, so skip on the client.
      if (!onServer) return true;
      if (data.NODE_ENV !== "production") return true;
      const hasDsn = !!data.NEXT_PUBLIC_SENTRY_DSN;
      const hasToken = !!data.SENTRY_AUTH_TOKEN;
      return hasDsn === hasToken;
    },
    {
      message:
        "NEXT_PUBLIC_SENTRY_DSN and SENTRY_AUTH_TOKEN must both be set (or both absent) in production",
      path: ["NEXT_PUBLIC_SENTRY_DSN"],
    },
  );

export type Env = z.infer<typeof EnvSchema>;

// Enumerate explicitly: on the client Next.js only inlines references it can
// statically detect (e.g. `process.env.NEXT_PUBLIC_FOO`), not the whole
// `process.env` object. Passing `process.env` directly here yields `{}` in the
// browser bundle and every required key fails validation.
const parsed = EnvSchema.safeParse({
  NODE_ENV: process.env.NODE_ENV,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  EMAIL_FROM: process.env.EMAIL_FROM,
  EMAIL_SAFE_LIST: process.env.EMAIL_SAFE_LIST,
  INTERNAL_CRON_SECRET: process.env.INTERNAL_CRON_SECRET,
  SUPABASE_DB_WEBHOOK_SECRET: process.env.SUPABASE_DB_WEBHOOK_SECRET,
  SENTRY_DSN: process.env.SENTRY_DSN,
  NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  SENTRY_AUTH_TOKEN: process.env.SENTRY_AUTH_TOKEN,
  SENTRY_ORG: process.env.SENTRY_ORG,
  SENTRY_PROJECT: process.env.SENTRY_PROJECT,
});
const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";

if (!parsed.success && !isBuildPhase) {
  // Cannot use logger here — circular dep. Fall back to console.error with a one-time exemption.
  // biome-ignore lint/suspicious/noConsole: bootstrap-time, before logger is available
  console.error("Invalid environment variables", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment variables");
}

if (!parsed.success && isBuildPhase) {
  // Vercel collects page data during `next build` by importing route modules; vars
  // injected only at runtime (or not yet set in the project) trip the schema. Skip
  // the throw — the production server runs this module again on boot and will
  // re-validate strictly. Dev / test still throw on missing config.
  // biome-ignore lint/suspicious/noConsole: bootstrap-time, build phase only
  console.warn(
    "[env] missing keys during build phase — runtime boot will re-validate",
    parsed.error.flatten().fieldErrors,
  );
}

export const env: Env = (parsed.success ? parsed.data : {}) as Env;
