import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Tests for lib/env.ts — env schema validation.
 *
 * vi.resetModules() in beforeEach ensures each dynamic import re-evaluates
 * lib/env.ts with the current process.env snapshot. The process.env object is
 * replaced per-test so mutations in one test do not bleed into the next.
 *
 * Key fix (epic-15): the original code held a top-level `mutableEnv` reference
 * to the original process.env object, then replaced process.env with a copy in
 * beforeEach. Mutations via the stale reference did not affect the new copy
 * that lib/env.ts reads. We now cast process.env inline inside each test so
 * the mutation always targets the active env object.
 *
 * Note on required fields: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
 * and NEXT_PUBLIC_SITE_URL are non-optional in the schema. Tests supply minimal
 * valid stubs for these so focus can remain on the field under test.
 */

/** Minimal valid env stubs that satisfy the non-optional schema fields. */
const BASE_VALID_ENV = {
  NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
  NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
};

describe("env schema", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    // Replace the global with a clean minimal-valid copy; restoring in afterEach.
    process.env = { ...originalEnv, ...BASE_VALID_ENV };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("accepts a minimal valid env (NODE_ENV + required public keys)", async () => {
    // Cast inline so we always write to the active process.env object.
    (process.env as Record<string, string | undefined>).NODE_ENV = "development";
    // Dynamic import allows re-evaluation after process.env manipulation.
    const { env } = await import("../../lib/env");
    expect(env.NODE_ENV).toBe("development");
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe("http://localhost:54321");
  });

  it("defaults NODE_ENV to 'development' when not set", async () => {
    delete (process.env as Record<string, string | undefined>).NODE_ENV;
    const { env } = await import("../../lib/env");
    expect(env.NODE_ENV).toBe("development");
  });

  it("rejects an invalid NODE_ENV value", async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "staging";
    // Importing env.ts with an invalid NODE_ENV should throw.
    await expect(import("../../lib/env")).rejects.toThrow("Invalid environment variables");
  });

  it("accepts all optional keys when they are valid", async () => {
    const env_ = process.env as Record<string, string | undefined>;
    env_.NODE_ENV = "production";
    env_.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    env_.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    env_.NEXT_PUBLIC_SITE_URL = "https://app.example.com";
    env_.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    // Epic 13: these are required in production.
    env_.RESEND_API_KEY = "resend-key";
    env_.INTERNAL_CRON_SECRET = "a-very-long-internal-cron-secret-32c";
    env_.SUPABASE_DB_WEBHOOK_SECRET = "a-very-long-webhook-secret-value-32";
    env_.SENTRY_DSN = "https://sentry.example.com/123";
    const { env } = await import("../../lib/env");
    expect(env.NODE_ENV).toBe("production");
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe("https://example.supabase.co");
  });
});
