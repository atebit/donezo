import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_SITE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  SENTRY_DSN: z.string().url().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

const parsed = EnvSchema.safeParse(process.env);
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
