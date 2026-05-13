// @ts-expect-error vitest is wired in epic 15
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Tests for lib/env.ts — env schema validation.
 *
 * NOTE: These tests cannot run until Vitest is installed in epic 15.
 * They are written here so the epic 15 executor can pick them up without changes.
 *
 * `mutableEnv` casts away the NodeJS.ProcessEnv readonly constraint so tests
 * can freely set and delete keys. This is intentional test scaffolding.
 */

// vi.resetModules() ensures each dynamic import re-evaluates lib/env with the current process.env.

// Cast once so tests can mutate freely — intentional test scaffolding.
const mutableEnv = process.env as Record<string, string | undefined>;

describe("env schema", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("accepts a minimal valid env (only NODE_ENV required; others optional)", async () => {
    mutableEnv.NODE_ENV = "development";
    // Dynamic import allows re-evaluation after process.env manipulation.
    const { env } = await import("../../lib/env");
    expect(env.NODE_ENV).toBe("development");
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBeUndefined();
  });

  it("defaults NODE_ENV to 'development' when not set", async () => {
    delete mutableEnv.NODE_ENV;
    const { env } = await import("../../lib/env");
    expect(env.NODE_ENV).toBe("development");
  });

  it("rejects an invalid NODE_ENV value", async () => {
    mutableEnv.NODE_ENV = "staging";
    // Importing env.ts with an invalid NODE_ENV should throw.
    await expect(import("../../lib/env")).rejects.toThrow("Invalid environment variables");
  });

  it("accepts all optional keys when they are valid", async () => {
    mutableEnv.NODE_ENV = "production";
    mutableEnv.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    mutableEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    mutableEnv.NEXT_PUBLIC_SITE_URL = "https://app.example.com";
    mutableEnv.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    // Epic 13: these are required in production.
    mutableEnv.RESEND_API_KEY = "resend-key";
    mutableEnv.INTERNAL_CRON_SECRET = "a-very-long-internal-cron-secret-32c";
    mutableEnv.SUPABASE_DB_WEBHOOK_SECRET = "a-very-long-webhook-secret-value-32";
    mutableEnv.SENTRY_DSN = "https://sentry.example.com/123";
    const { env } = await import("../../lib/env");
    expect(env.NODE_ENV).toBe("production");
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe("https://example.supabase.co");
  });
});
